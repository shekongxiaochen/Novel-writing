use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(#[from] sea_orm::DbErr),

    #[error("SQLx错误: {0}")]
    Sqlx(#[from] sqlx::Error),
    
    #[error("Redis错误: {0}")]
    Redis(#[from] redis::RedisError),
    
    #[error("未找到资源")]
    NotFound,
    
    #[error("未授权")]
    Unauthorized,
    
    #[error("权限不足: {0}")]
    Forbidden(String),
    
    #[error("验证失败: {0}")]
    Validation(String),
    
    #[error("冲突: {0}")]
    Conflict(String),
    
    #[error("内部错误: {0}")]
    Internal(String),
    
    #[error("JWT错误: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    
    #[error("序列化错误: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Serialize)]
struct ErrorResponse {
    detail: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "资源不存在".to_string()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "未授权".to_string()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            AppError::Sqlx(e) => {
                tracing::error!("SQLx error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "数据库错误".to_string())
            }
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg),
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "数据库错误".to_string())
            }
            AppError::Redis(e) => {
                tracing::error!("Redis error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "缓存错误".to_string())
            }
            AppError::Jwt(e) => {
                tracing::error!("JWT error: {:?}", e);
                (StatusCode::UNAUTHORIZED, "认证失败".to_string())
            }
            AppError::Serialization(e) => {
                tracing::error!("Serialization error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "数据序列化错误".to_string())
            }
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "内部错误".to_string())
            }
        };
        
        (status, Json(ErrorResponse { detail: message })).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
