use crate::{error::AppError, models::User, services::AuthService};
use axum::{
    body::Body,
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

/// 认证中间件 - 验证Bearer token并注入用户信息
pub async fn auth_middleware(
    State(auth_service): State<Arc<AuthService>>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // 1. 从Header提取Bearer token
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // 2. 验证token并获取用户
    let user = auth_service
        .verify_token(token)
        .await
        .map_err(|e| {
            tracing::warn!("Token verification failed: {:?}", e);
            StatusCode::UNAUTHORIZED
        })?;
    
    // 3. 将用户信息注入到request extensions
    req.extensions_mut().insert(user);
    
    // 4. 继续处理请求
    Ok(next.run(req).await)
}
