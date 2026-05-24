use crate::error::{AppError, Result};
use chrono::{DateTime, Utc};
use sqlx::{MySql, Pool};

#[derive(Debug, Clone)]
pub struct BillingSettings {
    pub consumption_multiplier: f64,
    pub deepseek_model: String,
    /// 每百万 input token 的单价（元人民币）
    pub price_per_1m_input_yuan: f64,
    /// 每百万 output token 的单价（元人民币）
    pub price_per_1m_output_yuan: f64,
}

#[derive(Debug, Clone)]
pub struct SettingsService {
    db: Pool<MySql>,
}

impl SettingsService {
    pub fn new(db: Pool<MySql>) -> Self {
        Self { db }
    }

    pub async fn get_optional(&self, key: &str) -> Result<Option<String>> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT setting_value FROM system_settings WHERE setting_key = ?",
        )
        .bind(key)
        .fetch_optional(&self.db)
        .await?;
        Ok(row.map(|(v,)| v))
    }

    pub async fn get(&self, key: &str) -> Result<String> {
        self.get_optional(key)
            .await?
            .ok_or_else(|| AppError::Internal(format!("缺少配置项: {key}")))
    }

    pub async fn deepseek_api_key(&self, env_fallback: &str) -> Result<String> {
        let from_db = self
            .get_optional("deepseek_api_key")
            .await?
            .unwrap_or_default();
        let from_db = from_db.trim();
        if !from_db.is_empty() {
            return Ok(from_db.to_string());
        }
        let from_env = env_fallback.trim();
        if !from_env.is_empty() {
            return Ok(from_env.to_string());
        }
        Err(AppError::Internal(
            "AI 未配置：请在管理后台填写 DeepSeek API 密钥".to_string(),
        ))
    }

    pub async fn deepseek_base_url(&self, env_fallback: &str) -> Result<String> {
        let from_db = self
            .get_optional("deepseek_base_url")
            .await?
            .unwrap_or_default();
        let from_db = from_db.trim();
        if !from_db.is_empty() {
            return Ok(from_db.to_string());
        }
        let from_env = env_fallback.trim();
        if !from_env.is_empty() {
            return Ok(from_env.to_string());
        }
        Ok("https://api.deepseek.com".to_string())
    }

    pub async fn ensure_defaults(&self) -> Result<()> {
        const DEFAULTS: &[(&str, &str)] = &[
            ("consumption_multiplier", "1.0"),
            ("deepseek_model", "deepseek-chat"),
            ("deepseek_api_key", ""),
            ("deepseek_base_url", "https://api.deepseek.com"),
        ];
        for (key, value) in DEFAULTS {
            let exists = self.get_optional(key).await?.is_some();
            if !exists {
                self.set(key, value).await?;
            }
        }
        Ok(())
    }

    pub async fn sync_deepseek_from_env_if_empty(
        &self,
        env_key: &str,
        env_base_url: &str,
    ) -> Result<()> {
        let key_empty = self
            .get_optional("deepseek_api_key")
            .await?
            .map(|s| s.trim().is_empty())
            .unwrap_or(true);
        if key_empty && !env_key.trim().is_empty() {
            self.set("deepseek_api_key", env_key.trim()).await?;
            tracing::info!("Imported DEEPSEEK_API_KEY from env into system_settings");
        }

        let url_missing = self.get_optional("deepseek_base_url").await?.is_none();
        if url_missing && !env_base_url.trim().is_empty() {
            self.set("deepseek_base_url", env_base_url.trim()).await?;
        }
        Ok(())
    }

    pub async fn set(&self, key: &str, value: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            INSERT INTO system_settings (setting_key, setting_value, updated_at)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)
            "#,
        )
        .bind(key)
        .bind(value)
        .bind(now)
        .execute(&self.db)
        .await?;
        Ok(())
    }

    pub async fn billing_settings(&self) -> Result<BillingSettings> {
        use super::wallet_units::normalize_price_per_1m_yuan;
        let raw_in = self
            .get_optional_f64("price_per_1m_input_tokens")
            .await?
            .unwrap_or(1.0);
        let raw_out = self
            .get_optional_f64("price_per_1m_output_tokens")
            .await?
            .unwrap_or(2.0);
        Ok(BillingSettings {
            consumption_multiplier: self
                .get_optional_f64("consumption_multiplier")
                .await?
                .unwrap_or(1.0),
            deepseek_model: self
                .get_optional("deepseek_model")
                .await?
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| "deepseek-chat".to_string()),
            price_per_1m_input_yuan: normalize_price_per_1m_yuan(raw_in),
            price_per_1m_output_yuan: normalize_price_per_1m_yuan(raw_out),
        })
    }

    async fn get_optional_f64(&self, key: &str) -> Result<Option<f64>> {
        Ok(match self.get_optional(key).await? {
            Some(v) if v.trim().is_empty() => None,
            Some(v) => Some(
                v.parse::<f64>()
                    .map_err(|_| AppError::Internal(format!("配置项 {key} 不是有效数字")))?,
            ),
            None => None,
        })
    }
}

/// 本次请求从用户余额扣除的内部 units（元×10000）= 真实 API 成本 × 消耗倍率
pub fn charge_units_for_call(
    prompt_tokens: u32,
    completion_tokens: u32,
    billing: &BillingSettings,
) -> i64 {
    super::wallet_units::charge_units_from_usage(
        prompt_tokens,
        completion_tokens,
        billing.price_per_1m_input_yuan,
        billing.price_per_1m_output_yuan,
        billing.consumption_multiplier,
    )
}

#[allow(dead_code)]
pub async fn updated_at(db: &Pool<MySql>, key: &str) -> Result<DateTime<Utc>> {
    let row: Option<(DateTime<Utc>,)> = sqlx::query_as(
        "SELECT updated_at FROM system_settings WHERE setting_key = ?",
    )
    .bind(key)
    .fetch_optional(db)
    .await?;
    row.map(|(t,)| t)
        .ok_or_else(|| AppError::Internal(format!("缺少配置项: {key}")))
}
