use chrono::{DateTime, Duration, Utc};

/// 获取当前UTC时间
pub fn now_utc() -> DateTime<Utc> {
    Utc::now()
}

/// 添加小时数
pub fn add_hours(dt: DateTime<Utc>, hours: i64) -> DateTime<Utc> {
    dt + Duration::hours(hours)
}

/// 添加分钟数
pub fn add_minutes(dt: DateTime<Utc>, minutes: i64) -> DateTime<Utc> {
    dt + Duration::minutes(minutes)
}

/// 添加秒数
#[allow(dead_code)]
pub fn add_seconds(dt: DateTime<Utc>, seconds: i64) -> DateTime<Utc> {
    dt + Duration::seconds(seconds)
}

/// 检查是否过期
pub fn is_expired(expires_at: DateTime<Utc>) -> bool {
    expires_at < now_utc()
}
