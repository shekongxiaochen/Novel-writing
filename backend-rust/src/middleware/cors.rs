use tower_http::cors::{Any, CorsLayer};

/// CORS中间件配置
pub fn cors_layer(origins: &str) -> CorsLayer {
    let origins: Vec<_> = origins
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().parse().unwrap())
        .collect();
    
    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(true)
}
