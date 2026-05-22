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
    middleware as axum_middleware,
    routing::{get, post},
    Router,
};
use config::Config;
use handlers::{auth, health, novels};
use middleware::{auth_middleware, cors_layer};
use services::{AppState, AuthService, CacheService, NovelService};
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

    tracing::info!("🚀 Starting Novel Backend (Rust)...");

    let config = Config::from_env()?;
    tracing::info!("Configuration loaded");

    let db = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(100)
        .min_connections(10)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Database connection pool established");

    let redis_client = db::create_redis_client(&config.redis_url).await?;

    let cache_service = CacheService::new(redis_client);
    let state = Arc::new(AppState {
        auth: Arc::new(AuthService::new(
            db.clone(),
            cache_service.clone(),
            config.clone(),
        )),
        novels: Arc::new(NovelService::new(db.clone(), cache_service)),
    });

    tracing::info!("Services initialized");

    let public_routes = Router::new()
        .route("/", get(health::root))
        .route("/health", get(health::health_check))
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route("/auth/send-code", post(auth::send_code));

    let authed_routes = Router::new()
        .route("/auth/me", get(auth::get_current_user))
        .route("/auth/logout", post(auth::logout))
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
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    let mut app = public_routes
        .merge(authed_routes)
        .layer(cors_layer(&config.cors_origins))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    if config.admin_enabled {
        let admin_router = admin::build_router(
            &config.database_url,
            &config.admin_username,
            &config.admin_password,
            config.admin_sync_password,
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
    tracing::info!("🚀 Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
