use axum::http::{header, HeaderName, Method};
use tower_http::cors::CorsLayer;

/// CORS中间件配置
pub fn cors_layer(origins: &str) -> CorsLayer {
    let origins: Vec<_> = origins
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .filter_map(|s| match s.parse() {
            Ok(origin) => Some(origin),
            Err(_) => {
                // 非法 origin 跳过而非 panic，避免一处配置笔误导致整个服务起不来
                tracing::warn!("忽略非法 CORS origin: {}", s);
                None
            }
        })
        .collect();

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            HeaderName::from_static("x-device-id"),
        ])
        .allow_credentials(true)
}
