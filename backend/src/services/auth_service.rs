use crate::{
    config::Config,
    error::{AppError, Result},
    models::{DeviceStatusResponse, RegisterByDeviceResponse, User, UserInfo},
    services::{CacheService, WalletService},
    utils::{crypto, id, time},
};
use chrono::{DateTime, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use sqlx::{MySql, Pool};

#[derive(Clone)]
pub struct AuthService {
    db: Pool<MySql>,
    cache: CacheService,
    config: Config,
    wallet: WalletService,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: i64,
    iat: i64,
}

type UserRow = (
    String,
    String,
    Option<String>,
    String,
    String,
    Option<String>,
    bool,
    bool,
    DateTime<Utc>,
    DateTime<Utc>,
);

impl AuthService {
    pub fn new(
        db: Pool<MySql>,
        cache: CacheService,
        config: Config,
        wallet: WalletService,
    ) -> Self {
        Self {
            db,
            cache,
            config,
            wallet,
        }
    }

    fn row_to_user(row: UserRow) -> User {
        User {
            id: row.0,
            username: row.1,
            email: row.2,
            password_hash: row.3,
            display_name: row.4,
            device_id_hash: row.5,
            is_active: row.6,
            email_verified: row.7,
            created_at: row.8,
            updated_at: row.9,
        }
    }

    const USER_SELECT: &'static str =
        "SELECT id, username, email, password_hash, display_name, device_id_hash, \
         is_active, email_verified, created_at, updated_at FROM users";

    fn validate_device_id(device_id: &str) -> Result<()> {
        let d = device_id.trim();
        if d.len() < 16 {
            return Err(AppError::Validation("设备标识无效".to_string()));
        }
        Ok(())
    }

    pub async fn device_status(&self, device_id: &str) -> Result<DeviceStatusResponse> {
        Self::validate_device_id(device_id)?;
        let hash = crypto::hash_device_id(device_id);

        let row: Option<(String,)> = sqlx::query_as(
            "SELECT username FROM users WHERE device_id_hash = ? AND is_active = 1",
        )
        .bind(&hash)
        .fetch_optional(&self.db)
        .await?;

        Ok(match row {
            Some((username,)) => DeviceStatusResponse {
                has_account: true,
                username: Some(username),
            },
            None => DeviceStatusResponse {
                has_account: false,
                username: None,
            },
        })
    }

    pub async fn register_by_device(
        &self,
        device_id: &str,
        ip: &str,
    ) -> Result<RegisterByDeviceResponse> {
        Self::validate_device_id(device_id)?;
        let hash = crypto::hash_device_id(device_id);

        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM users WHERE device_id_hash = ?",
        )
        .bind(&hash)
        .fetch_optional(&self.db)
        .await?;

        if existing.is_some() {
            return Err(AppError::Conflict(
                "本设备已注册账号，请直接登录".to_string(),
            ));
        }

        let username = crypto::generate_username();
        let password = crypto::generate_password();
        let password_hash = crypto::hash_password(password.as_str(), self.config.password_hash_iterations)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let user_id = id::generate_id();
        let now = time::now_utc();

        sqlx::query(
            r#"
            INSERT INTO users (
                id, username, device_id_hash, registration_ip,
                email, password_hash, display_name,
                is_active, email_verified, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, NULL, ?, '', 1, 0, ?, ?)
            "#,
        )
        .bind(&user_id)
        .bind(&username)
        .bind(&hash)
        .bind(ip)
        .bind(&password_hash)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;

        self.wallet.ensure_wallet(&user_id).await?;

        let token = self.login(&username, &password, ip).await?;
        let user = self.verify_token(&token).await?;
        let balance = self.wallet.balance(&user.id).await?;

        Ok(RegisterByDeviceResponse {
            username: username.clone(),
            password,
            token,
            user: UserInfo::from(user).with_balance_yuan(crate::services::wallet_units::units_to_yuan(balance)),
        })
    }

    pub async fn login(&self, username: &str, password: &str, ip: &str) -> Result<String> {
        let username = username.trim();
        if username.is_empty() {
            return Err(AppError::Validation("请输入账号".to_string()));
        }

        let failure_key = format!("login_failures:{}", username);
        let failures: Option<i64> = self.cache.get(&failure_key).await?;
        if let Some(count) = failures {
            if count >= self.config.login_failure_limit as i64 {
                return Err(AppError::Validation(
                    "登录失败次数过多，请稍后再试".to_string(),
                ));
            }
        }

        let row: Option<UserRow> = sqlx::query_as(&format!(
            "{} WHERE username = ?",
            Self::USER_SELECT
        ))
        .bind(username)
        .fetch_optional(&self.db)
        .await?;

        let row = row.ok_or(AppError::Validation("账号或密码错误".to_string()))?;
        let user = Self::row_to_user(row);

        let password_valid = crypto::verify_password(password, &user.password_hash)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if !password_valid {
            self.cache.incr(&failure_key).await?;
            self.cache
                .expire(&failure_key, self.config.login_failure_window_minutes * 60)
                .await?;
            self.record_login_attempt(username, ip, false).await?;
            return Err(AppError::Validation("账号或密码错误".to_string()));
        }

        if !user.is_active {
            return Err(AppError::Forbidden("账号已被禁用".to_string()));
        }

        let token = self.create_token(&user.id)?;
        let session_id = id::generate_id();
        let now = time::now_utc();
        let expires_at = time::add_hours(now, self.config.jwt_expiration_hours);

        sqlx::query(
            r#"
            INSERT INTO user_sessions (id, user_id, token, expires_at, created_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&session_id)
        .bind(&user.id)
        .bind(&token)
        .bind(expires_at)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;

        let cache_key = format!("session:{}", token);
        self.cache.set(&cache_key, &user, 1800).await?;
        self.cache.delete(&failure_key).await?;
        self.record_login_attempt(username, ip, true).await?;

        Ok(token)
    }

    pub async fn verify_token(&self, token: &str) -> Result<User> {
        let cache_key = format!("session:{}", token);
        if let Some(user) = self.cache.get::<User>(&cache_key).await? {
            return Ok(user);
        }

        let session: Option<(String, String, DateTime<Utc>)> = sqlx::query_as(
            "SELECT id, user_id, expires_at FROM user_sessions WHERE token = ?",
        )
        .bind(token)
        .fetch_optional(&self.db)
        .await?;

        let (session_id, user_id, expires_at) = session.ok_or(AppError::Unauthorized)?;

        if time::is_expired(expires_at) {
            return Err(AppError::Unauthorized);
        }

        let row: Option<UserRow> = sqlx::query_as(&format!("{} WHERE id = ?", Self::USER_SELECT))
            .bind(&user_id)
            .fetch_optional(&self.db)
            .await?;

        let user = Self::row_to_user(row.ok_or(AppError::Unauthorized)?);

        let now = time::now_utc();
        sqlx::query("UPDATE user_sessions SET last_seen_at = ? WHERE id = ?")
            .bind(now)
            .bind(&session_id)
            .execute(&self.db)
            .await?;

        self.cache.set(&cache_key, &user, 1800).await?;
        Ok(user)
    }

    pub async fn user_info_with_balance(&self, user: &User) -> Result<UserInfo> {
        let balance = self.wallet.balance(&user.id).await?;
        Ok(
            UserInfo::from(user.clone())
                .with_balance_yuan(crate::services::wallet_units::units_to_yuan(balance)),
        )
    }

    fn create_token(&self, user_id: &str) -> Result<String> {
        let now = time::now_utc().timestamp();
        let exp = time::add_hours(time::now_utc(), self.config.jwt_expiration_hours).timestamp();

        let claims = Claims {
            sub: user_id.to_string(),
            exp,
            iat: now,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_bytes()),
        )
        .map_err(AppError::from)
    }

    async fn record_login_attempt(&self, username: &str, ip: &str, success: bool) -> Result<()> {
        let attempt_id = id::generate_id();
        let now = time::now_utc();

        sqlx::query(
            "INSERT INTO login_attempts (id, username, email, ip, success, created_at) VALUES (?, ?, '', ?, ?, ?)",
        )
        .bind(&attempt_id)
        .bind(username)
        .bind(ip)
        .bind(success)
        .bind(now)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    pub async fn logout(&self, token: &str) -> Result<()> {
        sqlx::query("DELETE FROM user_sessions WHERE token = ?")
            .bind(token)
            .execute(&self.db)
            .await?;

        let cache_key = format!("session:{}", token);
        self.cache.delete(&cache_key).await?;
        Ok(())
    }
}




