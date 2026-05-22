use crate::{
    config::Config,
    error::{AppError, Result},
    models::{AuthSession, User, UserInfo},
    services::CacheService,
    utils::{crypto, id, time},
};
use chrono::{DateTime, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::{MySql, Pool};

#[derive(Clone)]
pub struct AuthService {
    db: Pool<MySql>,
    cache: CacheService,
    config: Config,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,  // user_id
    exp: i64,     // expiration timestamp
    iat: i64,     // issued at timestamp
}

impl AuthService {
    pub fn new(db: Pool<MySql>, cache: CacheService, config: Config) -> Self {
        Self { db, cache, config }
    }
    
    /// 用户注册
    pub async fn register(&self, email: &str, password: &str, code: &str) -> Result<User> {
        // 1. 验证邮箱格式
        if !email.contains('@') {
            return Err(AppError::Validation("邮箱格式不正确".to_string()));
        }
        
        // 2. 验证密码长度
        if password.len() < 6 {
            return Err(AppError::Validation("密码至少6位".to_string()));
        }
        
        // 3. 验证验证码
        self.verify_code(email, code, "register").await?;
        
        // 4. 检查邮箱是否已存在
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM users WHERE email = ?"
        )
        .bind(email)
        .fetch_optional(&self.db)
        .await?;
        
        if existing.is_some() {
            return Err(AppError::Conflict("邮箱已被注册".to_string()));
        }
        
        // 5. 哈希密码
        let password_hash = crypto::hash_password(password, self.config.password_hash_iterations)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        
        // 6. 创建用户
        let user_id = id::generate_id();
        let now = time::now_utc();
        
        sqlx::query(
            r#"
            INSERT INTO users (id, email, password_hash, display_name, is_active, email_verified, created_at, updated_at)
            VALUES (?, ?, ?, '', 1, 1, ?, ?)
            "#
        )
        .bind(&user_id)
        .bind(email)
        .bind(&password_hash)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;
        
        // 7. 标记验证码为已使用
        sqlx::query(
            "UPDATE email_verification_codes SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL"
        )
        .bind(now)
        .bind(email)
        .bind("register")
        .execute(&self.db)
        .await?;
        
        Ok(User {
            id: user_id,
            email: email.to_string(),
            password_hash,
            display_name: String::new(),
            is_active: true,
            email_verified: true,
            created_at: now,
            updated_at: now,
        })
    }
    
    /// 用户登录
    pub async fn login(&self, email: &str, password: &str, ip: &str) -> Result<String> {
        // 1. 检查登录失败次数
        let failure_key = format!("login_failures:{}", email);
        let failures: Option<i64> = self.cache.get(&failure_key).await?;
        
        if let Some(count) = failures {
            if count >= self.config.login_failure_limit as i64 {
                return Err(AppError::Validation("登录失败次数过多，请稍后再试".to_string()));
            }
        }
        
        // 2. 查询用户
        let user: Option<User> = sqlx::query_as::<_, (String, String, String, String, bool, bool, DateTime<Utc>, DateTime<Utc>)>(
            "SELECT id, email, password_hash, display_name, is_active, email_verified, created_at, updated_at FROM users WHERE email = ?"
        )
        .bind(email)
        .fetch_optional(&self.db)
        .await?
        .map(|(id, email, password_hash, display_name, is_active, email_verified, created_at, updated_at)| {
            User {
                id,
                email,
                password_hash,
                display_name,
                is_active,
                email_verified,
                created_at,
                updated_at,
            }
        });
        
        let user = user.ok_or(AppError::Validation("邮箱或密码错误".to_string()))?;
        
        // 3. 验证密码
        let password_valid = crypto::verify_password(password, &user.password_hash)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        
        if !password_valid {
            // 记录失败次数
            self.cache.incr(&failure_key).await?;
            self.cache.expire(&failure_key, self.config.login_failure_window_minutes * 60).await?;
            
            // 记录登录尝试
            self.record_login_attempt(email, ip, false).await?;
            
            return Err(AppError::Validation("邮箱或密码错误".to_string()));
        }
        
        // 4. 检查用户状态
        if !user.is_active {
            return Err(AppError::Forbidden("账号已被禁用".to_string()));
        }
        
        // 5. 生成token
        let token = self.create_token(&user.id)?;
        
        // 6. 创建session
        let session_id = id::generate_id();
        let now = time::now_utc();
        let expires_at = time::add_hours(now, self.config.jwt_expiration_hours);
        
        sqlx::query(
            r#"
            INSERT INTO auth_sessions (id, user_id, token, expires_at, created_at, last_seen_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&session_id)
        .bind(&user.id)
        .bind(&token)
        .bind(expires_at)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;
        
        // 7. 缓存session (30分钟)
        let cache_key = format!("session:{}", token);
        self.cache.set(&cache_key, &user, 1800).await?;
        
        // 8. 清除失败次数
        self.cache.delete(&failure_key).await?;
        
        // 9. 记录成功登录
        self.record_login_attempt(email, ip, true).await?;
        
        Ok(token)
    }
    
    /// 验证token并获取用户
    pub async fn verify_token(&self, token: &str) -> Result<User> {
        // 1. 先从缓存获取
        let cache_key = format!("session:{}", token);
        if let Some(user) = self.cache.get::<User>(&cache_key).await? {
            return Ok(user);
        }
        
        // 2. 从数据库查询
        let session: Option<(String, String, DateTime<Utc>)> = sqlx::query_as(
            "SELECT id, user_id, expires_at FROM auth_sessions WHERE token = ?"
        )
        .bind(token)
        .fetch_optional(&self.db)
        .await?;
        
        let (session_id, user_id, expires_at) = session.ok_or(AppError::Unauthorized)?;
        
        // 3. 检查是否过期
        if time::is_expired(expires_at) {
            return Err(AppError::Unauthorized);
        }
        
        // 4. 获取用户信息
        let user: Option<User> = sqlx::query_as::<_, (String, String, String, String, bool, bool, DateTime<Utc>, DateTime<Utc>)>(
            "SELECT id, email, password_hash, display_name, is_active, email_verified, created_at, updated_at FROM users WHERE id = ?"
        )
        .bind(&user_id)
        .fetch_optional(&self.db)
        .await?
        .map(|(id, email, password_hash, display_name, is_active, email_verified, created_at, updated_at)| {
            User {
                id,
                email,
                password_hash,
                display_name,
                is_active,
                email_verified,
                created_at,
                updated_at,
            }
        });
        
        let user = user.ok_or(AppError::Unauthorized)?;
        
        // 5. 更新last_seen_at
        let now = time::now_utc();
        sqlx::query("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?")
            .bind(now)
            .bind(&session_id)
            .execute(&self.db)
            .await?;
        
        // 6. 写入缓存
        self.cache.set(&cache_key, &user, 1800).await?;
        
        Ok(user)
    }
    
    /// 创建JWT token
    fn create_token(&self, user_id: &str) -> Result<String> {
        let now = time::now_utc().timestamp();
        let exp = time::add_hours(time::now_utc(), self.config.jwt_expiration_hours).timestamp();
        
        let claims = Claims {
            sub: user_id.to_string(),
            exp,
            iat: now,
        };
        
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_bytes()),
        )?;
        
        Ok(token)
    }
    
    /// 发送验证码
    pub async fn send_verification_code(&self, email: &str, purpose: &str) -> Result<()> {
        // 1. 检查发送频率（冷却时间）
        let cooldown_key = format!("verify_code_cooldown:{}", email);
        if self.cache.get::<String>(&cooldown_key).await?.is_some() {
            return Err(AppError::Validation("发送过于频繁，请稍后再试".to_string()));
        }
        
        // 2. 检查发送次数限制
        let window_key = format!("verify_code_window:{}", email);
        let count: Option<i64> = self.cache.get(&window_key).await?;
        
        if let Some(c) = count {
            if c >= self.config.verify_code_max_per_window as i64 {
                return Err(AppError::Validation("发送次数过多，请稍后再试".to_string()));
            }
        }
        
        // 3. 生成验证码
        let code = crypto::generate_verification_code();
        let code_hash = crypto::hash_verification_code(&code);
        
        // 4. 保存到数据库
        let code_id = id::generate_id();
        let now = time::now_utc();
        let expires_at = time::add_minutes(now, self.config.verify_code_ttl_minutes);
        
        sqlx::query(
            r#"
            INSERT INTO email_verification_codes (id, email, purpose, code_hash, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&code_id)
        .bind(email)
        .bind(purpose)
        .bind(&code_hash)
        .bind(expires_at)
        .bind(now)
        .execute(&self.db)
        .await?;
        
        // 5. 发送邮件（如果启用）
        if self.config.mail_enabled {
            // TODO: 实现邮件发送
            tracing::info!("Sending verification code {} to {}", code, email);
        } else {
            tracing::info!("Mail disabled. Verification code for {}: {}", email, code);
        }
        
        // 6. 设置冷却时间
        self.cache.set(&cooldown_key, &"1", self.config.verify_code_cooldown_seconds as u64).await?;
        
        // 7. 增加发送次数
        self.cache.incr(&window_key).await?;
        self.cache.expire(&window_key, self.config.verify_code_window_minutes * 60).await?;
        
        Ok(())
    }
    
    /// 验证验证码
    async fn verify_code(&self, email: &str, code: &str, purpose: &str) -> Result<()> {
        let code_hash = crypto::hash_verification_code(code);
        
        let record: Option<(String, DateTime<Utc>, Option<DateTime<Utc>>)> = sqlx::query_as(
            r#"
            SELECT id, expires_at, consumed_at 
            FROM email_verification_codes 
            WHERE email = ? AND purpose = ? AND code_hash = ?
            ORDER BY created_at DESC
            LIMIT 1
            "#
        )
        .bind(email)
        .bind(purpose)
        .bind(&code_hash)
        .fetch_optional(&self.db)
        .await?;
        
        let (_, expires_at, consumed_at) = record.ok_or(AppError::Validation("验证码错误".to_string()))?;
        
        if consumed_at.is_some() {
            return Err(AppError::Validation("验证码已被使用".to_string()));
        }
        
        if time::is_expired(expires_at) {
            return Err(AppError::Validation("验证码已过期".to_string()));
        }
        
        Ok(())
    }
    
    /// 记录登录尝试
    async fn record_login_attempt(&self, email: &str, ip: &str, success: bool) -> Result<()> {
        let attempt_id = id::generate_id();
        let now = time::now_utc();
        
        sqlx::query(
            "INSERT INTO login_attempts (id, email, ip, success, created_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&attempt_id)
        .bind(email)
        .bind(ip)
        .bind(success)
        .bind(now)
        .execute(&self.db)
        .await?;
        
        Ok(())
    }
    
    /// 登出
    pub async fn logout(&self, token: &str) -> Result<()> {
        // 1. 删除session
        sqlx::query("DELETE FROM auth_sessions WHERE token = ?")
            .bind(token)
            .execute(&self.db)
            .await?;
        
        // 2. 删除缓存
        let cache_key = format!("session:{}", token);
        self.cache.delete(&cache_key).await?;
        
        Ok(())
    }
}
