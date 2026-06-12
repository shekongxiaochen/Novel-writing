use crate::{
    error::Result,
    models::{AuthResponse, DeviceStatusResponse, LoginRequest, RegisterByDeviceResponse, User, UserInfo},
    services::AppState,
};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Extension, Json,
};
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize)]
pub struct MessageResponse {
    message: String,
}

fn client_ip(headers: &HeaderMap) -> &str {
    headers
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(str::trim)
        .filter(|s| is_valid_ip(s))
        .or_else(|| {
            headers
                .get("X-Real-IP")
                .and_then(|v| v.to_str().ok())
                .map(str::trim)
                .filter(|s| is_valid_ip(s))
        })
        .unwrap_or("0.0.0.0")
}

/// 校验是否为合法 IPv4/IPv6。X-Forwarded-For/X-Real-IP 客户端可伪造，
/// 非法值（如注入的 `<script>`）一律丢弃，回落 0.0.0.0，防止脏数据入库后
/// 在管理后台被无害化前触发存储型 XSS。
fn is_valid_ip(s: &str) -> bool {
    !s.is_empty() && s.parse::<std::net::IpAddr>().is_ok()
}

fn device_id_from_headers(headers: &HeaderMap) -> Option<String> {
    headers
        .get("X-Device-Id")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(str::to_string)
}

/// GET /auth/device-status
pub async fn device_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<DeviceStatusResponse>> {
    let device_id = device_id_from_headers(&headers)
        .ok_or_else(|| crate::error::AppError::Validation("缺少 X-Device-Id".to_string()))?;
    let status = state.auth.device_status(&device_id).await?;
    Ok(Json(status))
}

/// POST /auth/register-by-device
pub async fn register_by_device(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<(StatusCode, Json<RegisterByDeviceResponse>)> {
    let device_id = device_id_from_headers(&headers)
        .ok_or_else(|| crate::error::AppError::Validation("缺少 X-Device-Id".to_string()))?;
    let ip = client_ip(&headers);
    tracing::info!("Device registration for device_id prefix={}", &device_id[..device_id.len().min(8)]);
    let resp = state.auth.register_by_device(&device_id, ip).await?;
    Ok((StatusCode::CREATED, Json(resp)))
}

/// POST /auth/login
pub async fn login(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    let ip = client_ip(&headers);
    let token = state
        .auth
        .login(&req.username, &req.password, ip)
        .await?;
    let user = state.auth.verify_token(&token).await?;
    let user_info = state.auth.user_info_with_balance(&user).await?;
    Ok(Json(AuthResponse {
        token,
        user: user_info,
    }))
}

/// GET /auth/me
pub async fn get_current_user(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<Json<UserInfo>> {
    let info = state.auth.user_info_with_balance(&user).await?;
    Ok(Json(info))
}

/// POST /auth/logout
pub async fn logout(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    headers: HeaderMap,
) -> Result<Json<MessageResponse>> {
    if let Some(token) = bearer_token(&headers) {
        state.auth.logout(&token).await?;
    }
    tracing::info!("User logout: {}", user.id);
    Ok(Json(MessageResponse {
        message: "已登出".to_string(),
    }))
}
