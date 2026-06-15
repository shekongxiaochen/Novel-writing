use chrono::Utc;
use sqlx::MySqlPool;

use crate::{error::Result, utils::id};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ImageProvider {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub price_per_image_yuan: f64,
    pub consumption_multiplier: f64,
    pub is_active: bool,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Clone)]
pub struct ImageProviderService {
    db: MySqlPool,
}

impl ImageProviderService {
    pub fn new(db: MySqlPool) -> Self {
        Self { db }
    }

    pub async fn list_all(&self) -> Result<Vec<ImageProvider>> {
        let rows = sqlx::query_as::<_, ImageProvider>(
            "SELECT * FROM image_providers ORDER BY is_active DESC, created_at ASC",
        )
        .fetch_all(&self.db)
        .await?;
        Ok(rows)
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<ImageProvider>> {
        let row = sqlx::query_as::<_, ImageProvider>("SELECT * FROM image_providers WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.db)
            .await?;
        Ok(row)
    }

    pub async fn active_provider(&self) -> Result<Option<ImageProvider>> {
        let row = sqlx::query_as::<_, ImageProvider>(
            "SELECT * FROM image_providers WHERE is_active = 1 LIMIT 1",
        )
        .fetch_optional(&self.db)
        .await?;
        Ok(row)
    }

    pub async fn create(
        &self,
        name: &str,
        base_url: &str,
        api_key: &str,
        model: &str,
        price_per_image: f64,
        multiplier: f64,
    ) -> Result<ImageProvider> {
        let now = Utc::now().naive_utc();
        let provider_id = id::generate_id();

        sqlx::query(
            "INSERT INTO image_providers (id, name, base_url, api_key, model, \
             price_per_image_yuan, consumption_multiplier, \
             is_active, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
        )
        .bind(&provider_id)
        .bind(name)
        .bind(base_url)
        .bind(api_key)
        .bind(model)
        .bind(price_per_image)
        .bind(multiplier)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;

        let provider = self.find_by_id(&provider_id).await?.unwrap();
        Ok(provider)
    }

    pub async fn update(
        &self,
        provider_id: &str,
        name: &str,
        base_url: &str,
        api_key: &str,
        model: &str,
        price_per_image: f64,
        multiplier: f64,
    ) -> Result<()> {
        let now = Utc::now().naive_utc();

        // 若 api_key 为空，保留原有 key
        if api_key.is_empty() {
            sqlx::query(
                "UPDATE image_providers SET name = ?, base_url = ?, model = ?, \
                 price_per_image_yuan = ?, consumption_multiplier = ?, updated_at = ? \
                 WHERE id = ?",
            )
            .bind(name)
            .bind(base_url)
            .bind(model)
            .bind(price_per_image)
            .bind(multiplier)
            .bind(now)
            .bind(provider_id)
            .execute(&self.db)
            .await?;
        } else {
            sqlx::query(
                "UPDATE image_providers SET name = ?, base_url = ?, api_key = ?, model = ?, \
                 price_per_image_yuan = ?, consumption_multiplier = ?, updated_at = ? \
                 WHERE id = ?",
            )
            .bind(name)
            .bind(base_url)
            .bind(api_key)
            .bind(model)
            .bind(price_per_image)
            .bind(multiplier)
            .bind(now)
            .bind(provider_id)
            .execute(&self.db)
            .await?;
        }

        Ok(())
    }

    pub async fn delete(&self, provider_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM image_providers WHERE id = ? AND is_active = 0")
            .bind(provider_id)
            .execute(&self.db)
            .await?;
        Ok(())
    }

    pub async fn set_active(&self, provider_id: &str) -> Result<()> {
        let mut tx = self.db.begin().await?;

        sqlx::query("UPDATE image_providers SET is_active = 0")
            .execute(&mut *tx)
            .await?;

        sqlx::query("UPDATE image_providers SET is_active = 1 WHERE id = ?")
            .bind(provider_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }
}
