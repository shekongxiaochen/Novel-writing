use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    // 数据库
    pub database_url: String,
    
    // Redis
    pub redis_url: String,
    
    // 服务器
    pub host: String,
    pub port: u16,
    
    // JWT
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    
    // 密码
    pub password_hash_iterations: u32,
    
    // CORS
    pub cors_origins: String,
    
    // DeepSeek（密钥仅服务端，勿暴露给用户 API）
    pub deepseek_api_key: String,
    pub deepseek_base_url: String,

    // 邮件（预留 SMTP 字段；当前仅 mail_enabled 参与逻辑）
    #[allow(dead_code)]
    pub smtp_host: String,
    #[allow(dead_code)]
    pub smtp_port: u16,
    #[allow(dead_code)]
    pub smtp_username: String,
    #[allow(dead_code)]
    pub smtp_password: String,
    #[allow(dead_code)]
    pub smtp_from_email: String,
    #[allow(dead_code)]
    pub smtp_from_name: String,
    #[allow(dead_code)]
    pub smtp_use_ssl: bool,
    pub mail_enabled: bool,
    
    // 验证码
    pub verify_code_ttl_minutes: i64,
    pub verify_code_cooldown_seconds: i64,
    pub verify_code_max_per_window: i32,
    pub verify_code_window_minutes: i64,
    
    // 登录限制
    pub login_failure_limit: i32,
    pub login_failure_window_minutes: i64,

    // 管理后台 /admin（axum-admin，与业务 users 表无关）
    pub admin_username: String,
    pub admin_password: String,
    /// 为 true 时，每次启动将 `ADMIN_PASSWORD` 写入 `auth_users`（仅建议本机开发）
    pub admin_sync_password: bool,
    pub admin_enabled: bool,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        dotenvy::dotenv().ok();

        let config = Config {
            database_url: env::var("DATABASE_URL")?,
            redis_url: env::var("REDIS_URL")?,
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()?,
            jwt_secret: env::var("JWT_SECRET")?,
            jwt_expiration_hours: env::var("JWT_EXPIRATION_HOURS")
                .unwrap_or_else(|_| "720".to_string())
                .parse()?,
            password_hash_iterations: env::var("PASSWORD_HASH_ITERATIONS")
                .unwrap_or_else(|_| "120000".to_string())
                .parse()?,
            cors_origins: env::var("CORS_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),
            deepseek_api_key: env::var("DEEPSEEK_API_KEY").unwrap_or_default(),
            deepseek_base_url: env::var("DEEPSEEK_BASE_URL")
                .unwrap_or_else(|_| "https://api.deepseek.com".to_string()),
            smtp_host: env::var("SMTP_HOST").unwrap_or_default(),
            smtp_port: env::var("SMTP_PORT")
                .unwrap_or_else(|_| "465".to_string())
                .parse()?,
            smtp_username: env::var("SMTP_USERNAME").unwrap_or_default(),
            smtp_password: env::var("SMTP_PASSWORD").unwrap_or_default(),
            smtp_from_email: env::var("SMTP_FROM_EMAIL")
                .unwrap_or_else(|_| "noreply@example.com".to_string()),
            smtp_from_name: env::var("SMTP_FROM_NAME")
                .unwrap_or_else(|_| "Novel Writing".to_string()),
            smtp_use_ssl: env::var("SMTP_USE_SSL")
                .unwrap_or_else(|_| "true".to_string())
                .parse()?,
            mail_enabled: env::var("MAIL_ENABLED")
                .unwrap_or_else(|_| "false".to_string())
                .parse()?,
            verify_code_ttl_minutes: env::var("VERIFY_CODE_TTL_MINUTES")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,
            verify_code_cooldown_seconds: env::var("VERIFY_CODE_COOLDOWN_SECONDS")
                .unwrap_or_else(|_| "60".to_string())
                .parse()?,
            verify_code_max_per_window: env::var("VERIFY_CODE_MAX_PER_WINDOW")
                .unwrap_or_else(|_| "5".to_string())
                .parse()?,
            verify_code_window_minutes: env::var("VERIFY_CODE_WINDOW_MINUTES")
                .unwrap_or_else(|_| "10".to_string())
                .parse()?,
            login_failure_limit: env::var("LOGIN_FAILURE_LIMIT")
                .unwrap_or_else(|_| "5".to_string())
                .parse()?,
            login_failure_window_minutes: env::var("LOGIN_FAILURE_WINDOW_MINUTES")
                .unwrap_or_else(|_| "15".to_string())
                .parse()?,
            admin_username: env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".to_string()),
            admin_password: env::var("ADMIN_PASSWORD").unwrap_or_default(),
            admin_sync_password: env::var("ADMIN_SYNC_PASSWORD")
                .unwrap_or_else(|_| "true".to_string())
                .parse()?,
            admin_enabled: env::var("ADMIN_ENABLED")
                .unwrap_or_else(|_| "true".to_string())
                .parse()?,
        };

        // 安全校验：管理后台启用时，ADMIN_PASSWORD 必须显式设置且足够强，
        // 拒绝空值与历史弱口令兜底，避免后台被默认密码接管（发卡密/改余额）。
        if config.admin_enabled {
            let pw = config.admin_password.trim();
            const WEAK: &[&str] = &["", "change-me-admin", "admin", "password", "123456"];
            if WEAK.contains(&pw) || pw.len() < 8 {
                return Err(
                    "ADMIN_ENABLED=true 时必须设置强 ADMIN_PASSWORD（至少 8 位，且不能为默认弱口令）。\
                     若无需管理后台，请设置 ADMIN_ENABLED=false。"
                        .into(),
                );
            }
        }

        Ok(config)
    }
}
