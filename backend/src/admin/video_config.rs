use std::sync::Arc;

use axum::{
    extract::Path,
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

use crate::services::video_provider_service::VideoProviderService;

const SESSION_COOKIE: &str = "axum_admin_session";

#[derive(Clone)]
pub struct VideoConfigState {
    pub providers: VideoProviderService,
    pub auth: Arc<dyn AdminAuth>,
}

#[derive(Debug, Deserialize)]
pub struct ProviderForm {
    #[serde(default)]
    id: String,
    name: String,
    base_url: String,
    #[serde(default)]
    api_key: String,
    model: String,
    consumption_multiplier: String,
    #[serde(default)]
    price_per_second_yuan: String,
}

#[derive(Debug, Deserialize)]
pub struct ActivateForm {
    id: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteForm {
    id: String,
}

pub fn routes(state: VideoConfigState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/video-config", get(list_providers))
        .route("/admin/video-config/new", get(show_add_form))
        .route("/admin/video-config/:id/edit", get(show_edit_form))
        .route("/admin/video-config/save", post(save_provider))
        .route("/admin/video-config/activate", post(activate_provider))
        .route("/admin/video-config/delete", post(delete_provider))
        .route_layer(from_fn_with_state(arc.clone(), require_admin))
        .layer(CookieManagerLayer::new())
        .with_state(arc)
}

async fn require_admin(
    State(state): State<Arc<VideoConfigState>>,
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
    Redirect::temporary("/admin/login?next=%2Fadmin%2Fvideo-config").into_response()
}

async fn list_providers(
    State(state): State<Arc<VideoConfigState>>,
) -> Result<Html<String>, StatusCode> {
    let providers = state.providers.list_all().await.map_err(|e| {
        tracing::error!("list video providers: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let rows: Vec<serde_json::Value> = providers.iter().map(|p| serde_json::json!({
        "id": p.id, "name": p.name, "base_url": p.base_url, "model": p.model,
        "price_per_second_yuan": p.price_per_second_yuan,
        "consumption_multiplier": p.consumption_multiplier,
        "is_active": p.is_active, "has_api_key": !p.api_key.is_empty(),
    })).collect();
    let rows_json = serde_json::to_string(&rows).unwrap_or_else(|_| "[]".to_string());
    Ok(super::shell::render_shell_page(
        "video_config_page.html",
        include_str!("../../admin-templates/video_config_page.html"),
        "video-config", "视频配置",
        context!(page => "list", rows_json => rows_json),
    ))
}

async fn show_add_form(State(_): State<Arc<VideoConfigState>>) -> Result<Html<String>, StatusCode> {
    render_form(None, None, None, None)
}
async fn show_edit_form(
    State(state): State<Arc<VideoConfigState>>,
    Path(id): Path<String>,
) -> Result<Html<String>, StatusCode> {
    let p = state.providers.find_by_id(&id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    render_form(p.as_ref(), None, None, None)
}

async fn save_provider(
    State(state): State<Arc<VideoConfigState>>,
    Form(form): Form<ProviderForm>,
) -> Result<impl IntoResponse, StatusCode> {
    let name = form.name.trim().to_string();
    if name.is_empty() { return render_form_error(&form, "请填写名称").map(|h| h.into_response()); }
    let base_url = form.base_url.trim().to_string();
    if base_url.is_empty() { return render_form_error(&form, "请填写 API 地址").map(|h| h.into_response()); }
    let model = form.model.trim().to_string();
    if model.is_empty() { return render_form_error(&form, "请填写模型 ID").map(|h| h.into_response()); }
    let multiplier: f64 = form.consumption_multiplier.trim().parse().unwrap_or(0.0);
    if multiplier <= 0.0 { return render_form_error(&form, "消耗倍率须大于 0").map(|h| h.into_response()); }
    let price: f64 = form.price_per_second_yuan.trim().parse().unwrap_or(-1.0);
    if price < 0.0 { return render_form_error(&form, "单价不能为负数").map(|h| h.into_response()); }
    let api_key = form.api_key.trim().to_string();
    if form.id.is_empty() {
        if api_key.is_empty() { return render_form_error(&form, "新建必须填写密钥").map(|h| h.into_response()); }
        state.providers.create(&name, &base_url, &api_key, &model, price, multiplier).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    } else {
        state.providers.update(&form.id, &name, &base_url, &api_key, &model, price, multiplier).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    Ok(Redirect::to("/admin/video-config").into_response())
}

async fn activate_provider(
    State(state): State<Arc<VideoConfigState>>, Form(form): Form<ActivateForm>,
) -> Result<impl IntoResponse, StatusCode> {
    let p = state.providers.find_by_id(&form.id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    match p { Some(ref p) if !p.api_key.is_empty() => {}, Some(_) => return Ok(Redirect::to("/admin/video-config?error=nokey")), None => return Err(StatusCode::NOT_FOUND) }
    state.providers.set_active(&form.id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Redirect::to("/admin/video-config"))
}

async fn delete_provider(
    State(state): State<Arc<VideoConfigState>>, Form(form): Form<DeleteForm>,
) -> Result<impl IntoResponse, StatusCode> {
    state.providers.delete(&form.id).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Redirect::to("/admin/video-config"))
}

fn render_form(
    provider: Option<&crate::services::video_provider_service::VideoProvider>,
    submitted: Option<&ProviderForm>, _test_ok: Option<&str>, error: Option<&str>,
) -> Result<Html<String>, StatusCode> {
    let (id, name, base_url, model, multiplier, price, api_key_set) = if let Some(p) = provider {
        (p.id.clone(), p.name.clone(), p.base_url.clone(), p.model.clone(), p.consumption_multiplier.to_string(), p.price_per_second_yuan.to_string(), !p.api_key.is_empty())
    } else if let Some(f) = submitted {
        (f.id.clone(), f.name.clone(), f.base_url.clone(), f.model.clone(), f.consumption_multiplier.clone(), f.price_per_second_yuan.clone(), false)
    } else {
        ("".into(), "".into(), "https://apihub.agnes-ai.com".into(), "agnes-video-v2.0".into(), "1".into(), "0.005".into(), false)
    };
    let api_key_placeholder = if api_key_set { "留空不修改" } else { "sk-..." };
    let is_edit = !id.is_empty();
    Ok(super::shell::render_shell_page_sub(
        "video_config_page.html", include_str!("../../admin-templates/video_config_page.html"),
        "video-config", "视频配置", Some(if is_edit { "编辑" } else { "添加" }),
        context!(
            page => "form", page_title => if is_edit { "编辑视频服务" } else { "添加视频服务" },
            is_edit, id, name, base_url, model, consumption_multiplier => multiplier,
            price_per_second_yuan => price, api_key_set, api_key_placeholder, error, test_ok => _test_ok,
        ),
    ))
}

fn render_form_error(form: &ProviderForm, error: &str) -> Result<Html<String>, StatusCode> {
    render_form(None, Some(form), None, Some(error))
}
