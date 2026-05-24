use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    /// 写入 Redis 会话缓存时不序列化；读回时用 default，避免反序列化失败
    #[serde(skip_serializing, default)]
    pub password_hash: String,
    pub display_name: String,
    pub device_id_hash: Option<String>,
    pub is_active: bool,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct DeviceStatusResponse {
    pub has_account: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RegisterByDeviceResponse {
    pub username: String,
    pub password: String,
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub display_name: String,
    pub is_active: bool,
    /// 账户余额（元人民币）
    pub balance_yuan: f64,
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserInfo {
    fn from(user: User) -> Self {
        UserInfo {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            is_active: user.is_active,
            balance_yuan: 0.0,
            created_at: user.created_at,
        }
    }
}

impl UserInfo {
    pub fn with_balance_yuan(mut self, balance_yuan: f64) -> Self {
        self.balance_yuan = if balance_yuan.is_finite() {
            balance_yuan.max(0.0)
        } else {
            0.0
        };
        self
    }
}
