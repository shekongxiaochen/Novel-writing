use axum::Router;
use axum_admin::adapters::migrations::Migrator;
use axum_admin::adapters::seaorm::SeaOrmAdapter;
use axum_admin::adapters::seaorm_auth::{AuthUserActiveModel, AuthUserEntity, Column};
use axum_admin::{EntityAdmin, EntityGroupAdmin, Field};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, Database, DatabaseConnection, DbBackend,
    EntityTrait, PaginatorTrait, QueryFilter, Set, Statement,
};
use sea_orm_migration::MigratorTrait;

mod labels;

use std::path::PathBuf;

use crate::entities::{NovelEntity, PaymentOrderEntity, UserEntity};
use labels::{apply_field_labels, NOVEL_FIELDS, PAYMENT_ORDER_FIELDS, USER_FIELDS};

/// 业务库曾用 `auth_sessions` 存 App 登录态，与 axum-admin 要求的表结构冲突，需改名为 `user_sessions`。
async fn separate_app_session_table(db: &DatabaseConnection) -> Result<(), sea_orm::DbErr> {
    let row = db
        .query_one(Statement::from_string(
            DbBackend::MySql,
            "SELECT COUNT(*) AS c FROM information_schema.COLUMNS \
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_sessions' AND COLUMN_NAME = 'user_id'"
                .to_string(),
        ))
        .await?;

    let is_app_table = row
        .and_then(|r| r.try_get::<i64>("", "c").ok())
        .unwrap_or(0)
        > 0;

    if !is_app_table {
        return Ok(());
    }

    let user_sessions_exists = db
        .query_one(Statement::from_string(
            DbBackend::MySql,
            "SELECT COUNT(*) AS c FROM information_schema.TABLES \
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_sessions'"
                .to_string(),
        ))
        .await?
        .and_then(|r| r.try_get::<i64>("", "c").ok())
        .unwrap_or(0)
        > 0;

    if user_sessions_exists {
        tracing::warn!(
            "auth_sessions is app-style but user_sessions already exists; \
             drop or rename auth_sessions manually if admin login fails"
        );
        return Ok(());
    }

    db.execute(Statement::from_string(
        DbBackend::MySql,
        "RENAME TABLE auth_sessions TO user_sessions".to_string(),
    ))
    .await?;
    tracing::info!("Renamed app table auth_sessions -> user_sessions for axum-admin");
    Ok(())
}

/// 旧库曾用同名 `auth_sessions` 存 App 会话，迁移记录已写入但表结构不对或表已被 rename 走。
async fn ensure_admin_auth_sessions_table(db: &DatabaseConnection) -> Result<(), sea_orm::DbErr> {
    let has_admin_schema = db
        .query_one(Statement::from_string(
            DbBackend::MySql,
            "SELECT COUNT(*) AS c FROM information_schema.COLUMNS \
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_sessions' AND COLUMN_NAME = 'username'"
                .to_string(),
        ))
        .await?
        .and_then(|r| r.try_get::<i64>("", "c").ok())
        .unwrap_or(0)
        > 0;

    if has_admin_schema {
        return Ok(());
    }

    db.execute(Statement::from_string(
        DbBackend::MySql,
        "CREATE TABLE IF NOT EXISTS auth_sessions (
            id VARCHAR(255) NOT NULL PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            is_superuser TINYINT(1) NOT NULL DEFAULT 0,
            expires_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            .to_string(),
    ))
    .await?;
    tracing::info!("Created axum-admin auth_sessions table");
    Ok(())
}

/// MySQL：axum-admin 迁移使用 TIMESTAMP，SeaORM 1 读取 auth 表时期望 DATETIME。
async fn fix_admin_timestamp_columns(db: &DatabaseConnection) -> Result<(), sea_orm::DbErr> {
    db.execute(Statement::from_string(
        DbBackend::MySql,
        "ALTER TABLE auth_users MODIFY created_at DATETIME NOT NULL, MODIFY updated_at DATETIME NOT NULL"
            .to_string(),
    ))
    .await?;

    let admin_sessions = db
        .query_one(Statement::from_string(
            DbBackend::MySql,
            "SELECT COUNT(*) AS c FROM information_schema.COLUMNS \
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_sessions' AND COLUMN_NAME = 'username'"
                .to_string(),
        ))
        .await?
        .and_then(|r| r.try_get::<i64>("", "c").ok())
        .unwrap_or(0)
        > 0;

    if admin_sessions {
        db.execute(Statement::from_string(
            DbBackend::MySql,
            "ALTER TABLE auth_sessions MODIFY expires_at DATETIME NOT NULL".to_string(),
        ))
        .await?;
    }
    Ok(())
}

fn hash_admin_password(password: &str) -> Result<String, Box<dyn std::error::Error>> {
    use argon2::{
        password_hash::{rand_core::OsRng, SaltString},
        Argon2, PasswordHasher,
    };

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("admin password hash: {e}"))?
        .to_string();
    Ok(hash)
}

/// 确保 `.env` 中的管理员存在；可选在每次启动时同步密码（修复「库内密码与配置不一致」）。
async fn ensure_admin_user(
    auth: &axum_admin::SeaOrmAdminAuth,
    username: &str,
    password: &str,
    sync_password: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let db = auth.db();

    if let Some(user) = AuthUserEntity::find()
        .filter(Column::Username.eq(username))
        .one(db)
        .await?
    {
        if sync_password {
            let hash = hash_admin_password(password)?;
            let mut active: AuthUserActiveModel = user.into();
            active.password_hash = Set(hash);
            active.updated_at = Set(chrono::Utc::now().naive_utc());
            active.update(db).await?;
            tracing::info!("Admin password synced from env for user '{}'", username);
        }
        auth.assign_role(username, "admin").await?;
        return Ok(());
    }

    let count = AuthUserEntity::find().count(db).await?;
    if count == 0 {
        auth.ensure_user(username, password).await?;
    } else {
        auth.create_user(username, password, true).await?;
        auth.assign_role(username, "admin").await?;
    }
    Ok(())
}

/// 挂载 Django 风格管理后台（axum-admin），路径前缀 `/admin`。
pub async fn build_router(
    database_url: &str,
    admin_username: &str,
    admin_password: &str,
    admin_sync_password: bool,
) -> Result<Router, Box<dyn std::error::Error>> {
    let db = Database::connect(database_url).await?;

    separate_app_session_table(&db).await?;
    ensure_admin_auth_sessions_table(&db).await?;
    Migrator::up(&db, None).await?;
    fix_admin_timestamp_columns(&db).await?;

    let auth = axum_admin::SeaOrmAdminAuth::new(db.clone()).await?;
    ensure_admin_user(&auth, admin_username, admin_password, admin_sync_password).await?;

    tracing::info!(
        "Admin console ready at /admin (login user: {})",
        admin_username
    );

    let users_admin = apply_field_labels(
        EntityAdmin::from_entity::<UserEntity>("app_users")
            .label("应用用户")
            .icon("fa-solid fa-users")
            .search_fields(vec!["email".to_string(), "display_name".to_string()])
            .list_display(vec![
                "email".to_string(),
                "display_name".to_string(),
                "is_active".to_string(),
                "email_verified".to_string(),
                "created_at".to_string(),
            ]),
        USER_FIELDS,
    )
    .field(Field::password("password_hash").label("密码哈希").hidden())
    .adapter(Box::new(SeaOrmAdapter::<UserEntity>::new(db.clone())));

    let novels_admin = apply_field_labels(
        EntityAdmin::from_entity::<NovelEntity>("novels")
            .label("小说")
            .icon("fa-solid fa-book")
            .search_fields(vec!["title".to_string(), "user_id".to_string()])
            .list_display(vec![
                "title".to_string(),
                "user_id".to_string(),
                "genre".to_string(),
                "updated_at".to_string(),
            ]),
        NOVEL_FIELDS,
    )
    .adapter(Box::new(SeaOrmAdapter::<NovelEntity>::new(db.clone())));

    let orders_admin = apply_field_labels(
        EntityAdmin::from_entity::<PaymentOrderEntity>("payment_orders")
            .label("支付订单")
            .icon("fa-solid fa-receipt")
            .search_fields(vec![
                "user_id".to_string(),
                "status".to_string(),
                "provider_trade_no".to_string(),
            ])
            .list_display(vec![
                "user_id".to_string(),
                "plan_code".to_string(),
                "status".to_string(),
                "amount_cents".to_string(),
                "created_at".to_string(),
            ]),
        PAYMENT_ORDER_FIELDS,
    )
    .adapter(Box::new(SeaOrmAdapter::<PaymentOrderEntity>::new(db.clone())));

    let template_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("admin-templates");

    let router = axum_admin::AdminApp::new()
        .title("Novel 管理后台")
        .icon("fa-solid fa-pen-nib")
        .prefix("/admin")
        .template_dir(&template_dir)
        .seaorm_auth(auth)
        .register(
            EntityGroupAdmin::new("业务数据")
                .register(users_admin)
                .register(novels_admin)
                .register(orders_admin),
        )
        .into_router()
        .await;

    Ok(router)
}
