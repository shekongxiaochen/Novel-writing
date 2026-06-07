use std::sync::Arc;

use axum::{
    extract::{Path, State},
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

use crate::services::{prompt_registry, SettingsService};

const SESSION_COOKIE: &str = "axum_admin_session";

#[derive(Clone)]
pub struct PromptsState {
    pub settings: SettingsService,
    pub auth: Arc<dyn AdminAuth>,
}

#[derive(Debug, Deserialize)]
pub struct SaveForm {
    prompt_type: String,
    content: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetForm {
    prompt_type: String,
}

pub fn routes(state: PromptsState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/prompts", get(list_prompts))
        .route("/admin/prompts/:ptype/edit", get(show_edit_form))
        .route("/admin/prompts/save", post(save_prompt))
        .route("/admin/prompts/reset", post(reset_prompt))
        .route_layer(from_fn_with_state(arc.clone(), require_admin))
        .layer(CookieManagerLayer::new())
        .with_state(arc)
}

async fn require_admin(
    State(state): State<Arc<PromptsState>>,
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
    Redirect::temporary("/admin/login?next=%2Fadmin%2Fprompts").into_response()
}

// ── 列表页 ──

async fn list_prompts(
    State(state): State<Arc<PromptsState>>,
) -> Result<Html<String>, StatusCode> {
    let mut rows: Vec<serde_json::Value> = Vec::new();
    for (ptype, label) in prompt_registry::PROMPT_CATALOG {
        let key = prompt_registry::prompt_setting_key(ptype);
        let custom = matches!(
            state.settings.get_optional(&key).await,
            Ok(Some(ref v)) if !v.trim().is_empty()
        );
        rows.push(serde_json::json!({
            "prompt_type": ptype,
            "label": label,
            "customized": custom,
        }));
    }
    let rows_json = serde_json::to_string(&rows).unwrap_or_else(|_| "[]".to_string());

    Ok(super::shell::render_shell_page(
        "prompts_page.html",
        include_str!("../../admin-templates/prompts_page.html"),
        "prompts",
        "AI 提示词",
        context!(
            page => "list",
            rows_json => rows_json,
        ),
    ))
}

// ── 编辑页 ──

async fn show_edit_form(
    State(state): State<Arc<PromptsState>>,
    Path(ptype): Path<String>,
) -> Result<Html<String>, StatusCode> {
    let default = prompt_registry::default_system_prompt(&ptype).ok_or(StatusCode::NOT_FOUND)?;
    let label = prompt_registry::PROMPT_CATALOG
        .iter()
        .find(|(t, _)| *t == ptype)
        .map(|(_, l)| *l)
        .unwrap_or("");

    let key = prompt_registry::prompt_setting_key(&ptype);
    let stored = state.settings.get_optional(&key).await.ok().flatten();
    let customized = stored.as_deref().map(|s| !s.trim().is_empty()).unwrap_or(false);
    // 文本框展示当前生效内容：自定义优先，否则默认
    let current = stored.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| default.to_string());

    Ok(super::shell::render_shell_page_sub(
        "prompts_page.html",
        include_str!("../../admin-templates/prompts_page.html"),
        "prompts",
        "AI 提示词",
        Some(label),
        context!(
            page => "edit",
            prompt_type => ptype,
            label => label,
            current => current,
            default_text => default,
            customized => customized,
        ),
    ))
}

// ── 保存 / 恢复默认 ──

async fn save_prompt(
    State(state): State<Arc<PromptsState>>,
    Form(form): Form<SaveForm>,
) -> Response {
    if !prompt_registry::is_valid_prompt_type(&form.prompt_type) {
        return (StatusCode::BAD_REQUEST, "无效的 prompt_type").into_response();
    }
    let key = prompt_registry::prompt_setting_key(&form.prompt_type);
    match state.settings.set(&key, form.content.trim()).await {
        Ok(_) => Redirect::to("/admin/prompts?ok=1").into_response(),
        Err(e) => {
            tracing::error!("save prompt {}: {:?}", form.prompt_type, e);
            (StatusCode::INTERNAL_SERVER_ERROR, "保存失败").into_response()
        }
    }
}

async fn reset_prompt(
    State(state): State<Arc<PromptsState>>,
    Form(form): Form<ResetForm>,
) -> Response {
    if !prompt_registry::is_valid_prompt_type(&form.prompt_type) {
        return (StatusCode::BAD_REQUEST, "无效的 prompt_type").into_response();
    }
    let key = prompt_registry::prompt_setting_key(&form.prompt_type);
    // 恢复默认 = 清空数据库覆盖值（存空串，resolve 时回退到代码默认）
    match state.settings.set(&key, "").await {
        Ok(_) => Redirect::to("/admin/prompts?reset=1").into_response(),
        Err(e) => {
            tracing::error!("reset prompt {}: {:?}", form.prompt_type, e);
            (StatusCode::INTERNAL_SERVER_ERROR, "恢复失败").into_response()
        }
    }
}


