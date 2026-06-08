use std::sync::Arc;

use axum::{extract::State, Json};
use serde::Serialize;

use crate::services::AppState;

#[derive(Serialize)]
pub struct AnnouncementResponse {
    pub enabled: bool,
    pub title: String,
    pub body: String,
    pub image: String,
    pub version: String,
}

/// GET /announcement - 公开接口：客户端启动时拉取弹窗公告。
/// 即使公告关闭也返回 200（enabled:false），由前端判断是否弹窗。
pub async fn get_announcement(State(state): State<Arc<AppState>>) -> Json<AnnouncementResponse> {
    let get = |key: &'static str| {
        let settings = state.settings.clone();
        async move { settings.get_optional(key).await.ok().flatten().unwrap_or_default() }
    };

    let enabled = get("announcement.enabled").await.trim() == "1";
    let title = get("announcement.title").await;
    let body = get("announcement.body").await;
    let image = get("announcement.image").await;
    let version = {
        let v = get("announcement.version").await;
        if v.trim().is_empty() { "0".to_string() } else { v }
    };

    Json(AnnouncementResponse {
        enabled,
        title,
        body,
        image,
        version,
    })
}
