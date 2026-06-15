mod admin;
mod config;
mod db;
mod entities;
mod error;
mod handlers;
mod middleware;
mod models;
mod services;
mod utils;

use axum::{
    extract::DefaultBodyLimit,
    middleware as axum_middleware,
    routing::{get, post},
    Router,
};
use config::Config;
use handlers::{ai, announcement, auth, billing, comic, health, novels};
use middleware::{auth_middleware, cors_layer};
use services::{
    AiProviderService, AiService, AppState, AuthService, AutoApplyLogService, CacheService, CardKeyService,
    CharacterStateService, EmbeddingIndexService, EmbeddingProviderService, ImageProviderService, NovelService,
    SettingsService, WalletService,
};
use std::sync::Arc;
use tower_http::{compression::CompressionLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,novel_backend_rust=debug,sqlx=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Novel Backend (Rust)...");

    let config = Config::from_env()?;
    tracing::info!("Configuration loaded");

    let db = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(100)
        .min_connections(10)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Database connection pool established");

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
    .execute(&db)
    .await
    .unwrap_or_else(|e| {
        tracing::warn!("ensure card_keys table: {:?}", e);
        sqlx::mysql::MySqlQueryResult::default()
    });

    let redis_client = db::create_redis_client(&config.redis_url).await?;

    let cache_service = CacheService::new(redis_client);
    let settings = Arc::new(SettingsService::new(db.clone()));
    settings.ensure_defaults().await?;
    settings
        .sync_deepseek_from_env_if_empty(
            &config.deepseek_api_key,
            &config.deepseek_base_url,
        )
        .await?;
    let wallet = Arc::new(WalletService::new(db.clone()));
    let card_keys = Arc::new(CardKeyService::new(db.clone(), (*wallet).clone(), cache_service.clone()));
    let providers = Arc::new(AiProviderService::new(db.clone()));
    let image_providers = Arc::new(ImageProviderService::new(db.clone()));
    let embedding_index = Arc::new(EmbeddingIndexService::new(
        db.clone(),
        EmbeddingProviderService::new(db.clone()),
    ));
    let character_states = Arc::new(CharacterStateService::new(db.clone()));
    let auto_apply_log = Arc::new(AutoApplyLogService::new(db.clone()));
    let state = Arc::new(AppState {
        auth: Arc::new(AuthService::new(
            db.clone(),
            cache_service.clone(),
            config.clone(),
            (*wallet).clone(),
        )),
        novels: Arc::new(NovelService::new(db.clone(), cache_service.clone())),
        settings: settings.clone(),
        wallet: wallet.clone(),
        card_keys,
        providers: providers.clone(),
        image_providers: image_providers.clone(),
        ai: Arc::new(AiService::new(
            config.clone(),
            (*settings).clone(),
            (*wallet).clone(),
            (*providers).clone(),
        )),
        embedding_index,
        character_states,
        auto_apply_log,
    });

    tracing::info!("Services initialized");

    let public_routes = Router::new()
        .route("/", get(health::root))
        .route("/health", get(health::health_check))
        .route("/auth/device-status", get(auth::device_status))
        .route("/auth/register-by-device", post(auth::register_by_device))
        .route("/auth/login", post(auth::login))
        .route("/announcement", get(announcement::get_announcement));

    let authed_routes = Router::new()
        .route("/auth/me", get(auth::get_current_user))
        .route("/auth/logout", post(auth::logout))
        .route("/billing/wallet", get(billing::get_wallet))
        .route("/billing/ledger", get(billing::get_ledger))
        .route("/billing/redeem", post(billing::redeem_card_key))
        .route("/ai/chat", post(ai::chat))
        .route("/ai/prompt", post(ai::prompt_chat))
        .route("/comic/gen-image", post(comic::gen_image))
        .route("/novels", get(novels::list_novels).post(novels::create_novel))
        .route(
            "/novels/:id",
            get(novels::get_novel)
                .put(novels::update_novel)
                .delete(novels::delete_novel),
        )
        .route(
            "/novels/:id/snapshot",
            get(novels::get_snapshot).put(novels::update_snapshot),
        )
        .route(
            "/novels/:id/character-states",
            get(novels::get_character_states).put(novels::put_character_states),
        )
        .route(
            "/novels/:id/auto-apply-log",
            get(novels::get_auto_apply_log).put(novels::put_auto_apply_log),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    let mut app = public_routes
        .merge(authed_routes)
        .layer(cors_layer(&config.cors_origins))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        // 全局请求体上限 16MB，防止超大快照/正文 payload 造成内存与存储滥用(DoS)
        .layer(DefaultBodyLimit::max(16 * 1024 * 1024))
        .with_state(state);

    if config.admin_enabled {
        let admin_router = admin::build_router(
            &config.database_url,
            &config.admin_username,
            &config.admin_password,
            config.admin_sync_password,
            &config.deepseek_api_key,
            &config.deepseek_base_url,
            (*providers).clone(),
            cache_service.clone(),
        )
        .await?;
        app = app.merge(admin_router);
        tracing::info!(
            "Admin console: http://{}:{}/admin/",
            config.host,
            config.port
        );
    }

    let addr = format!("{}:{}", config.host, config.port);
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
