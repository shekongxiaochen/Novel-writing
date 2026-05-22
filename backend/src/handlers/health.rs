use axum::{
    http::StatusCode,
    response::{Html, IntoResponse},
    Json,
};
use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    status: String,
    message: String,
}

/// GET / - 浏览器打开 8080 时的说明页（本服务是 API，不是写作界面）
pub async fn root() -> impl IntoResponse {
    Html(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Novel API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
    h1 { font-size: 1.25rem; }
    a { color: #2563eb; }
    code { background: #f1f5f9; padding: 0.1rem 0.35rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Novel 写作助手 — Rust API</h1>
  <p>这个地址是<strong>后端接口</strong>，没有写作界面。服务若正常，说明 API 已在运行。</p>
  <ul>
    <li>健康检查：<a href="/health">/health</a>（应返回 JSON）</li>
    <li>管理后台：<a href="/admin/">/admin/</a>（账号见 <code>ADMIN_USERNAME</code> / <code>ADMIN_PASSWORD</code>）</li>
    <li>写作软件界面请打开：<a href="http://127.0.0.1:5174">http://127.0.0.1:5174</a>（需先 <code>npm run dev</code>）</li>
  </ul>
</body>
</html>"#,
    )
    .into_response()
}

/// GET /health - 健康检查
pub async fn health_check() -> (StatusCode, Json<HealthResponse>) {
    (
        StatusCode::OK,
        Json(HealthResponse {
            status: "ok".to_string(),
            message: "服务运行正常".to_string(),
        }),
    )
}
