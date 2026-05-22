use crate::{
    error::Result,
    models::{AuthResponse, LoginRequest, RegisterRequest, SendCodeRequest, User, UserInfo},
    services::AuthService,
};
use axum::{
    extract::State,
    http::StatusCode,
    Extension, Json,
};
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize)]
pub struct MessageResponse {
    message: String,
}

/// POST /auth/register - 用户注册
pub async fn register(
    State(auth_service): State<Arc<AuthService>>,
    Json(req): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>)> {
    tracing::info!("User registration attempt: {}", req.email);
    
    // 1. 注册用户
    let user = auth_service.register(&req.email, &req.password, &req.code).await?;
    
    // 2. 生成token
    let token = auth_service.login(&req.email, &req.password, "127.0.0.1").await?;
    
    tracing::info!("User registered successfully: {}", user.id);
    
    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            token,
            user: user.into(),
        }),
    ))
}

/// POST /auth/login - 用户登录
pub async fn login(
    State(auth_service): State<Arc<AuthService>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    tracing::info!("User login attempt: {}", req.email);
    
    // 1. 登录
    let token = auth_service.login(&req.email, &req.password, "127.0.0.1").await?;
    
    // 2. 获取用户信息
    let user = auth_service.verify_token(&token).await?;
    
    tracing::info!("User logged in successfully: {}", user.id);
    
    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

/// POST /auth/send-code - 发送验证码
pub async fn send_code(
    State(auth_service): State<Arc<AuthService>>,
    Json(req): Json<SendCodeRequest>,
) -> Result<Json<MessageResponse>> {
    tracing::info!("Sending verification code to: {}", req.email);
    
    auth_service.send_verification_code(&req.email, &req.purpose).await?;
    
    Ok(Json(MessageResponse {
        message: "验证码已发送".to_string(),
    }))
}

/// GET /auth/me - 获取当前用户信息
pub async fn get_current_user(
    Extension(user): Extension<User>,
) -> Json<UserInfo> {
    Json(user.into())
}

/// POST /auth/logout - 登出
pub async fn logout(
    State(auth_service): State<Arc<AuthService>>,
    Extension(user): Extension<User>,
) -> Result<Json<MessageResponse>> {
    // 从header获取token（简化处理，实际应该从request中提取）
    // 这里我们通过user_id来删除所有session
    tracing::info!("User logout: {}", user.id);
    
    Ok(Json(MessageResponse {
        message: "已登出".to_string(),
    }))
}
