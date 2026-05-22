use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 应用登录会话（表 `user_sessions`），路由接入后使用。
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub id: String,
    pub user_id: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
}
