use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::time::Duration;

pub async fn create_db_pool(database_url: &str) -> Result<DatabaseConnection, sea_orm::DbErr> {
    let mut opt = ConnectOptions::new(database_url.to_owned());
    
    opt.max_connections(100)
        .min_connections(10)
        .connect_timeout(Duration::from_secs(8))
        .acquire_timeout(Duration::from_secs(8))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(3600))
        .sqlx_logging(true)
        .sqlx_logging_level(log::LevelFilter::Debug);
    
    tracing::info!("Connecting to database...");
    let db = Database::connect(opt).await?;
    tracing::info!("Database connection established");
    
    Ok(db)
}

pub async fn create_redis_client(redis_url: &str) -> Result<redis::Client, redis::RedisError> {
    tracing::info!("Connecting to Redis...");
    let client = redis::Client::open(redis_url)?;
    
    // 测试连接
    let mut conn = client.get_async_connection().await?;
    redis::cmd("PING").query_async::<_, String>(&mut conn).await?;
    
    tracing::info!("Redis connection established");
    Ok(client)
}
