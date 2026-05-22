use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use crate::error::Result;

#[derive(Clone)]
pub struct CacheService {
    client: redis::Client,
}

impl CacheService {
    pub fn new(client: redis::Client) -> Self {
        Self { client }
    }
    
    /// 获取缓存
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let mut conn = self.client.get_async_connection().await?;
        let value: Option<String> = conn.get(key).await?;
        
        match value {
            Some(v) => Ok(Some(serde_json::from_str(&v)?)),
            None => Ok(None),
        }
    }
    
    /// 设置缓存（带TTL，单位：秒）
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: u64) -> Result<()> {
        let mut conn = self.client.get_async_connection().await?;
        let serialized = serde_json::to_string(value)?;
        conn.set_ex::<_, _, ()>(key, serialized, ttl).await?;
        Ok(())
    }
    
    /// 删除缓存
    pub async fn delete(&self, key: &str) -> Result<()> {
        let mut conn = self.client.get_async_connection().await?;
        conn.del::<_, ()>(key).await?;
        Ok(())
    }
    
    /// 批量删除（模式匹配）
    pub async fn delete_pattern(&self, pattern: &str) -> Result<()> {
        let mut conn = self.client.get_async_connection().await?;
        let keys: Vec<String> = conn.keys(pattern).await?;
        if !keys.is_empty() {
            conn.del::<_, ()>(keys).await?;
        }
        Ok(())
    }
    
    /// 增加计数器
    pub async fn incr(&self, key: &str) -> Result<i64> {
        let mut conn = self.client.get_async_connection().await?;
        let value: i64 = conn.incr(key, 1).await?;
        Ok(value)
    }
    
    /// 设置过期时间
    pub async fn expire(&self, key: &str, seconds: i64) -> Result<()> {
        let mut conn = self.client.get_async_connection().await?;
        conn.expire::<_, ()>(key, seconds).await?;
        Ok(())
    }
}
