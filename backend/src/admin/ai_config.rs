use std::sync::Arc;

use axum::{
    extract::Path,
    extract::State,
    http::StatusCode,
    middleware::{from_fn_with_state, Next},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
    Form, Json, Router,
};
use axum_admin::auth::AdminAuth;
use minijinja::{context, Environment};
use serde::Deserialize;
use tower_cookies::CookieManagerLayer;
use tower_cookies::Cookies;

use crate::services::{ai_provider_service::AiProviderService, deepseek_client};

const SESSION_COOKIE: &str = "axum_admin_session";
const ADMIN_TITLE: &str = "Novel 管理后台";

#[derive(Clone)]
pub struct AiConfigState {
    pub providers: AiProviderService,
    pub auth: Arc<dyn AdminAuth>,
    pub env_api_key: String,
    pub env_base_url: String,
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
    price_per_1m_input_miss_yuan: String,
    #[serde(default)]
    price_per_1m_input_hit_yuan: String,
    #[serde(default)]
    price_per_1m_output_yuan: String,
}

#[derive(Debug, Deserialize)]
pub struct ActivateForm {
    id: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteForm {
    id: String,
}

pub fn routes(state: AiConfigState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/ai-config", get(list_providers))
        .route("/admin/ai-config/new", get(show_add_form))
        .route("/admin/ai-config/:id/edit", get(show_edit_form))
        .route("/admin/ai-config/save", post(save_provider))
        .route("/admin/ai-config/activate", post(activate_provider))
        .route("/admin/ai-config/delete", post(delete_provider))
        .route("/admin/ai-config/test", post(test_connection))
        .route("/admin/ai-config/balance/:id", get(check_balance))
        .route_layer(from_fn_with_state(arc.clone(), require_admin))
        .layer(CookieManagerLayer::new())
        .with_state(arc)
}

async fn require_admin(
    State(state): State<Arc<AiConfigState>>,
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
    Redirect::temporary("/admin/login?next=%2Fadmin%2Fai-config").into_response()
}

// ── List view ──

async fn list_providers(
    State(state): State<Arc<AiConfigState>>,
) -> Result<Html<String>, StatusCode> {
    let providers = state.providers.list_all().await.map_err(|e| {
        tracing::error!("list providers: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let rows: Vec<serde_json::Value> = providers
        .iter()
        .map(|p| {
            serde_json::json!({
                "id": p.id,
                "name": p.name,
                "base_url": p.base_url,
                "model": p.model,
                "price_per_1m_input_miss_yuan": p.price_per_1m_input_miss_yuan,
                "price_per_1m_input_hit_yuan": p.price_per_1m_input_hit_yuan,
                "price_per_1m_output_yuan": p.price_per_1m_output_yuan,
                "consumption_multiplier": p.consumption_multiplier,
                "is_active": p.is_active,
                "has_api_key": !p.api_key.is_empty(),
            })
        })
        .collect();

    let rows_json = serde_json::to_string(&rows).unwrap_or_else(|_| "[]".to_string());

    let env = Environment::new();
    let tpl = env
        .template_from_str(include_str!("../../admin-templates/ai_config_page.html"))
        .expect("ai_config template");

    let html = tpl
        .render(context!(
            admin_title => ADMIN_TITLE,
            page => "list",
            rows_json => rows_json,
        ))
        .expect("render ai_config list");

    Ok(Html(html))
}

// ── Add form ──

async fn show_add_form(
    State(state): State<Arc<AiConfigState>>,
) -> Result<Html<String>, StatusCode> {
    render_form(
        &state,
        None,
        None,
        None,
        None,
    )
}

// ── Edit form ──

async fn show_edit_form(
    State(state): State<Arc<AiConfigState>>,
    Path(id): Path<String>,
) -> Result<Html<String>, StatusCode> {
    let provider = state.providers.find_by_id(&id).await.map_err(|e| {
        tracing::error!("find provider: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let provider = match provider {
        Some(p) => p,
        None => return Err(StatusCode::NOT_FOUND),
    };

    render_form(
        &state,
        Some(&provider),
        None,
        None,
        None,
    )
}

// ── Save (create or update) ──

async fn save_provider(
    State(state): State<Arc<AiConfigState>>,
    Form(form): Form<ProviderForm>,
) -> Result<impl IntoResponse, StatusCode> {
    // Validate
    let name = form.name.trim().to_string();
    if name.is_empty() {
        return render_form_error(&state, &form, "请填写提供商名称").map(|h| h.into_response());
    }
    let base_url = form.base_url.trim().to_string();
    if base_url.is_empty() {
        return render_form_error(&state, &form, "请填写 API 地址").map(|h| h.into_response());
    }
    let model = form.model.trim().to_string();
    if model.is_empty() {
        return render_form_error(&state, &form, "请填写模型 ID").map(|h| h.into_response());
    }
    let multiplier: f64 = form
        .consumption_multiplier
        .trim()
        .parse()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    if multiplier <= 0.0 {
        return render_form_error(&state, &form, "消耗倍率须大于 0").map(|h| h.into_response());
    }
    let price_in_miss: f64 = form
        .price_per_1m_input_miss_yuan
        .trim()
        .parse()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let price_in_hit: f64 = form
        .price_per_1m_input_hit_yuan
        .trim()
        .parse()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let price_out: f64 = form
        .price_per_1m_output_yuan
        .trim()
        .parse()
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    if price_in_miss < 0.0 || price_in_hit < 0.0 || price_out < 0.0 {
        return render_form_error(&state, &form, "单价不能为负数").map(|h| h.into_response());
    }

    let api_key = form.api_key.trim().to_string();

    if form.id.is_empty() {
        // Create new
        state
            .providers
            .create(&name, &base_url, &api_key, &model, price_in_miss, price_in_hit, price_out, multiplier)
            .await
            .map_err(|e| {
                tracing::error!("create provider: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    } else {
        // Update existing
        state
            .providers
            .update(&form.id, &name, &base_url, &api_key, &model, price_in_miss, price_in_hit, price_out, multiplier)
            .await
            .map_err(|e| {
                tracing::error!("update provider: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    }

    Ok(Redirect::to("/admin/ai-config").into_response())
}

// ── Activate ──

async fn activate_provider(
    State(state): State<Arc<AiConfigState>>,
    Form(form): Form<ActivateForm>,
) -> Result<impl IntoResponse, StatusCode> {
    state.providers.set_active(&form.id).await.map_err(|e| {
        tracing::error!("activate provider: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Redirect::to("/admin/ai-config"))
}

// ── Delete ──

async fn delete_provider(
    State(state): State<Arc<AiConfigState>>,
    Form(form): Form<DeleteForm>,
) -> Result<impl IntoResponse, StatusCode> {
    state.providers.delete(&form.id).await.map_err(|e| {
        tracing::error!("delete provider: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Redirect::to("/admin/ai-config"))
}

// ── Test connection ──

async fn test_connection(
    State(state): State<Arc<AiConfigState>>,
    Form(form): Form<ProviderForm>,
) -> Result<Html<String>, StatusCode> {
    let base_url = if form.base_url.trim().is_empty() {
        state
            .env_base_url
            .clone()
    } else {
        form.base_url.trim().to_string()
    };
    let model = if form.model.trim().is_empty() {
        "deepseek-chat".to_string()
    } else {
        form.model.trim().to_string()
    };

    // Try form api_key first, then existing provider's key, then env fallback
    let api_key = if !form.api_key.trim().is_empty() {
        form.api_key.trim().to_string()
    } else if !form.id.is_empty() {
        state
            .providers
            .find_by_id(&form.id)
            .await
            .ok()
            .flatten()
            .map(|p| p.api_key)
            .filter(|k| !k.is_empty())
            .unwrap_or_else(|| state.env_api_key.clone())
    } else {
        state.env_api_key.clone()
    };

    let (test_ok, error) = match deepseek_client::test_connection(&api_key, &base_url, &model).await
    {
        Ok(msg) => (Some(msg), None),
        Err(msg) => (None, Some(msg)),
    };

    render_form(
        &state,
        None,
        Some(&form),
        test_ok.as_deref(),
        error.as_deref(),
    )
}

// ── Check balance ──

async fn check_balance(
    State(state): State<Arc<AiConfigState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let provider = state.providers.find_by_id(&id).await.map_err(|e| {
        tracing::error!("find provider: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let provider = match provider {
        Some(p) => p,
        None => return Err(StatusCode::NOT_FOUND),
    };

    let api_key = if provider.api_key.is_empty() {
        state.env_api_key.clone()
    } else {
        provider.api_key.clone()
    };

    match deepseek_client::check_balance(&api_key, &provider.base_url).await {
        Ok(info) => Ok(axum::Json(serde_json::json!({
            "balance": info.balance,
            "currency": info.currency,
            "is_available": info.is_available,
        }))
        .into_response()),
        Err(msg) => Ok(axum::Json(serde_json::json!({
            "error": msg,
        }))
        .into_response()),
    }
}

// ── Render helpers ──

fn render_form(
    state: &AiConfigState,
    provider: Option<&crate::services::ai_provider_service::AiProvider>,
    submitted_form: Option<&ProviderForm>,
    test_ok: Option<&str>,
    error: Option<&str>,
) -> Result<Html<String>, StatusCode> {
    let env = Environment::new();
    let tpl = env
        .template_from_str(include_str!("../../admin-templates/ai_config_page.html"))
        .expect("ai_config template");

    let (id, name, base_url, model, multiplier, price_in_miss, price_in_hit, price_out, api_key_set) =
        if let Some(p) = provider {
            (
                p.id.clone(),
                p.name.clone(),
                p.base_url.clone(),
                p.model.clone(),
                p.consumption_multiplier.to_string(),
                p.price_per_1m_input_miss_yuan.to_string(),
                p.price_per_1m_input_hit_yuan.to_string(),
                p.price_per_1m_output_yuan.to_string(),
                !p.api_key.is_empty(),
            )
        } else if let Some(f) = submitted_form {
            (
                f.id.clone(),
                f.name.clone(),
                f.base_url.clone(),
                f.model.clone(),
                f.consumption_multiplier.clone(),
                f.price_per_1m_input_miss_yuan.clone(),
                f.price_per_1m_input_hit_yuan.clone(),
                f.price_per_1m_output_yuan.clone(),
                false,
            )
        } else {
            (
                String::new(),
                String::new(),
                "https://api.xiaomimimo.com/v1".to_string(),
                "mimo-v2.5-pro".to_string(),
                "1".to_string(),
                "2".to_string(),
                "1".to_string(),
                "8".to_string(),
                false,
            )
        };

    let api_key_placeholder = if api_key_set {
        "留空表示不修改已保存的密钥"
    } else {
        "sk-..."
    };

    let is_edit = !id.is_empty();
    let page_title = if is_edit { "编辑提供商" } else { "添加提供商" };

    let html = tpl
        .render(context!(
            admin_title => ADMIN_TITLE,
            page => "form",
            page_title => page_title,
            is_edit => is_edit,
            id => id,
            name => name,
            base_url => base_url,
            model => model,
            consumption_multiplier => multiplier,
            price_per_1m_input_miss_yuan => price_in_miss,
            price_per_1m_input_hit_yuan => price_in_hit,
            price_per_1m_output_yuan => price_out,
            api_key_set => api_key_set,
            api_key_placeholder => api_key_placeholder,
            error => error,
            test_ok => test_ok,
        ))
        .expect("render ai_config form");

    Ok(Html(html))
}

fn render_form_error(
    state: &AiConfigState,
    form: &ProviderForm,
    error: &str,
) -> Result<Html<String>, StatusCode> {
    render_form(
        state,
        None,
        Some(form),
        None,
        Some(error),
    )
}
