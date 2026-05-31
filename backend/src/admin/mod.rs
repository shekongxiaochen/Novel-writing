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

mod ai_config;
mod card_key_admin;
mod labels;
mod user_ops;

use std::{path::PathBuf, sync::Arc};

use crate::entities::AiWalletLedgerEntity;
use crate::services::{AiProviderService, CardKeyService, WalletService};
use labels::{apply_field_labels, AI_WALLET_LEDGER_FIELDS};

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

pub async fn build_router(
    database_url: &str,
    admin_username: &str,
    admin_password: &str,
    admin_sync_password: bool,
    env_deepseek_api_key: &str,
    env_deepseek_base_url: &str,
    providers_service: AiProviderService,
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

    let ledger_admin = apply_field_labels(
        EntityAdmin::from_entity::<AiWalletLedgerEntity>("ai_wallet_ledger")
            .label("余额流水")
            .icon("fa-solid fa-list")
            .search_fields(vec!["user_id".to_string(), "reason".to_string()])
            .list_display(vec![
                "user_id".to_string(),
                "delta".to_string(),
                "reason".to_string(),
                "ref_id".to_string(),
                "created_at".to_string(),
            ]),
        AI_WALLET_LEDGER_FIELDS,
    )
    .field(Field::text("id").label("ID").readonly())
    .field(Field::text("user_id").label("用户 ID").readonly())
    .field(Field::number("delta").label("变动数额").readonly())
    .field(Field::text("reason").label("类型").readonly())
    .field(Field::text("ref_id").label("备注/关联").readonly())
    .field(Field::datetime("created_at").label("时间").readonly())
    .adapter(Box::new(SeaOrmAdapter::<AiWalletLedgerEntity>::new(db.clone())));

    let template_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("admin-templates");
    let home_template = std::fs::read_to_string(template_dir.join("home.html"))
        .unwrap_or_else(|_| include_str!("../../admin-templates/home.html").to_string());

    let sqlx_pool = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    // 确保 card_keys 表存在
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS card_keys (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            code VARCHAR(64) NOT NULL,
            amount_yuan INT NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'unused',
            used_by_user_id VARCHAR(36) NULL,
            used_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            UNIQUE KEY uk_card_keys_code (code),
            INDEX idx_card_keys_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .execute(&sqlx_pool)
    .await
    .unwrap_or_else(|e| {
        tracing::warn!("ensure card_keys table: {:?}", e);
        sqlx::mysql::MySqlQueryResult::default()
    });

    let wallet_service = WalletService::new(sqlx_pool.clone());
    let card_key_service = CardKeyService::new(sqlx_pool.clone(), wallet_service.clone());
    let auth_for_admin: Arc<dyn axum_admin::auth::AdminAuth> =
        Arc::new(axum_admin::SeaOrmAdminAuth::new(db.clone()).await?);

    let router = axum_admin::AdminApp::new()
        .title("Novel 管理后台")
        .icon("fa-solid fa-pen-nib")
        .prefix("/admin")
        .template_dir(&template_dir)
        .template("home.html", &home_template)
        .seaorm_auth(auth)
        .register(
            EntityGroupAdmin::new("运营")
                .register(ledger_admin),
        )
        .into_router()
        .await
        .merge(user_ops::routes(user_ops::UserOpsState {
            db: sqlx_pool.clone(),
            wallet: wallet_service,
            auth: auth_for_admin.clone(),
        }))
        .merge(ai_config::routes(ai_config::AiConfigState {
            providers: providers_service,
            auth: auth_for_admin.clone(),
            env_api_key: env_deepseek_api_key.to_string(),
            env_base_url: env_deepseek_base_url.to_string(),
        }))
        .merge(card_key_admin::routes(card_key_admin::CardKeyAdminState {
            db: sqlx_pool.clone(),
            card_keys: card_key_service,
            auth: auth_for_admin,
        }));

    tracing::info!("Admin user ops: http://127.0.0.1:8080/admin/user-ops");
    tracing::info!("Admin AI config: http://127.0.0.1:8080/admin/ai-config");
    tracing::info!("Admin card keys: http://127.0.0.1:8080/admin/card-keys");

    Ok(router)
}
