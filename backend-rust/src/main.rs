mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod services;
mod utils;

use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post, put},
    Router,
};
use config::Config;
use handlers::{auth, health, novels};
use middleware::{auth_middleware, cors_layer};
use services::{AuthService, CacheService, NovelService};
use std::sync::Arc;
use tower_http::{compression::CompressionLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,novel_backend_rust=debug,sqlx=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
    
    tracing::info!("🚀 Starting Novel Backend (Rust)...");
    
    // 2. 加载配置
    let config = Config::from_env()?;
    tracing::info!("Configuration loaded");
    
    // 3. 初始化数据库连接池
    let db = sqlx::mysql::MySqlPoolOptions::new()
        .max_connections(100)
        .min_connections(10)
        .connect(&config.database_url)
        .await?;
    
    tracing::info!("Database connection pool established");
    
    // 4. 初始化Redis
    let redis_client = db::create_redis_client(&config.redis_url).await?;
    
    // 5. 初始化服务
    let cache_service = CacheService::new(redis_client);
    let auth_service = Arc::new(AuthService::new(
        db.clone(),
        cache_service.clone(),
        config.clone(),
    ));
    let novel_service = Arc::new(NovelService::new(db.clone(), cache_service.clone()));
    
    tracing::info!("Services initialized");
    
    // 6. 构建路由
    let app = Router::new()
        // 健康检查（无需认证）
        .route("/health", get(health::health_check))
        
        // 认证路由（无需认证）
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route("/auth/send-code", post(auth::send_code))
        
        // 需要认证的路由
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
        // 添加认证中间件到需要认证的路由
        .layer(axum_middleware::from_fn_with_state(
            auth_service.clone(),
            auth_middleware,
        ))
        
        // 全局中间件
        .layer(cors_layer(&config.cors_origins))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        
        // 共享状态
        .with_state(auth_service)
        .with_state(novel_service);
    
    // 7. 启动服务器
    let addr = format!("{}:{}", config.host, config.port);
    tracing::info!("🚀 Server listening on {}", addr);
    tracing::info!("📚 Novel Backend (Rust) is ready!");
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}
