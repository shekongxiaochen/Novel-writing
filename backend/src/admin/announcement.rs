use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    middleware::{from_fn_with_state, Next},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
    Form, Router,
};
use axum_admin::auth::AdminAuth;
use minijinja::context;
use serde::Deserialize;
use tower_cookies::CookieManagerLayer;
use tower_cookies::Cookies;

use crate::services::SettingsService;

const SESSION_COOKIE: &str = "axum_admin_session";

#[derive(Clone)]
pub struct AnnouncementAdminState {
    pub settings: SettingsService,
    pub auth: Arc<dyn AdminAuth>,
}

#[derive(Debug, Deserialize)]
pub struct SaveForm {
    title: String,
    body: String,
    // 复选框未勾选时浏览器不提交该字段，故用 Option
    enabled: Option<String>,
    // 图片为 base64 data URL（data:image/...;base64,...），可为空
    #[serde(default)]
    image: String,
}

pub fn routes(state: AnnouncementAdminState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/announcement", get(show_form))
        .route("/admin/announcement/save", post(save_announcement))
        .route_layer(from_fn_with_state(arc.clone(), require_admin))
        .layer(CookieManagerLayer::new())
        .with_state(arc)
}

async fn require_admin(
    State(state): State<Arc<AnnouncementAdminState>>,
    cookies: Cookies,
    req: axum::extract::Request,
    next: Next,
) -> Response {
    let session_id = cookies.get(SESSION_COOKIE).map(|c| c.value().to_string());
    if let Some(sid) = session_id {
        if let Ok(Some(_)) = state.auth.get_session(&sid).await {
            return next.run(req).await;
        }
    }
    Redirect::temporary("/admin/login?next=%2Fadmin%2Fannouncement").into_response()
}

// ── 编辑页 ──

async fn show_form(
    State(state): State<Arc<AnnouncementAdminState>>,
) -> Result<Html<String>, StatusCode> {
    let read = |key: &'static str| {
        let settings = state.settings.clone();
        async move { settings.get_optional(key).await.ok().flatten().unwrap_or_default() }
    };

    let title = read("announcement.title").await;
    let body = read("announcement.body").await;
    let image = read("announcement.image").await;
    let enabled = read("announcement.enabled").await.trim() == "1";
    let version = {
        let v = read("announcement.version").await;
        if v.trim().is_empty() { "0".to_string() } else { v }
    };

    Ok(super::shell::render_shell_page(
        "announcement_page.html",
        include_str!("../../admin-templates/announcement_page.html"),
        "announcement",
        "公告",
        context!(
            title => title,
            body => body,
            image => image,
            enabled => enabled,
            version => version,
        ),
    ))
}

// ── 保存 ──

async fn save_announcement(
    State(state): State<Arc<AnnouncementAdminState>>,
    Form(form): Form<SaveForm>,
) -> Response {
    let enabled = form.enabled.as_deref() == Some("1");

    // version 自动递增：内容一变就触发客户端重新弹窗
    let old_version = state
        .settings
        .get_optional("announcement.version")
        .await
        .ok()
        .flatten()
        .and_then(|v| v.trim().parse::<u64>().ok())
        .unwrap_or(0);
    let next_version = old_version.wrapping_add(1);

    // 校验图片：必须为空或合法的 image data URL，且不超过 ~2MB（base64 后）
    let image = form.image.trim();
    if !image.is_empty() {
        if !image.starts_with("data:image/") || !image.contains(";base64,") {
            return (StatusCode::BAD_REQUEST, "图片格式无效，请重新上传").into_response();
        }
        if image.len() > 1_500_000 {
            return (StatusCode::BAD_REQUEST, "图片过大，请压缩到 1MB 以内").into_response();
        }
    }

    let writes = [
        ("announcement.title", form.title.trim().to_string()),
        ("announcement.body", form.body.trim().to_string()),
        ("announcement.image", image.to_string()),
        ("announcement.enabled", if enabled { "1".to_string() } else { "0".to_string() }),
        ("announcement.version", next_version.to_string()),
    ];
    for (key, value) in writes {
        if let Err(e) = state.settings.set(key, &value).await {
            tracing::error!("save announcement {}: {:?}", key, e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "保存失败").into_response();
        }
    }

    Redirect::to("/admin/announcement?ok=1").into_response()
}
