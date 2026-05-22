pub async fn create_redis_client(redis_url: &str) -> Result<redis::Client, redis::RedisError> {
    tracing::info!("Connecting to Redis...");
    let client = redis::Client::open(redis_url)?;
    
    // 测试连接
    let mut conn = client.get_async_connection().await?;
    redis::cmd("PING").query_async::<_, String>(&mut conn).await?;
    
    tracing::info!("Redis connection established");
    Ok(client)
}
