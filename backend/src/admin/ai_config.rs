use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    middleware::{from_fn_with_state, Next},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
    Form, Router,
};
use tower_cookies::CookieManagerLayer;
use axum_admin::auth::AdminAuth;
use minijinja::{context, Environment};
use serde::Deserialize;
use tower_cookies::Cookies;

use crate::services::{deepseek_client, SettingsService};

const SESSION_COOKIE: &str = "axum_admin_session";
const ADMIN_TITLE: &str = "Novel 管理后台";

#[derive(Clone)]
pub struct AiConfigState {
    pub settings: SettingsService,
    pub auth: Arc<dyn AdminAuth>,
    pub env_api_key: String,
    pub env_base_url: String,
}

#[derive(Debug, Deserialize)]
pub struct AiConfigForm {
    #[serde(default)]
    deepseek_api_key: String,
    deepseek_base_url: String,
    deepseek_model: String,
    consumption_multiplier: String,
    #[serde(default)]
    price_per_1m_input_tokens: String,
    #[serde(default)]
    price_per_1m_output_tokens: String,
}

struct AiConfigView {
    saved: bool,
    error: Option<String>,
    test_ok: Option<String>,
    deepseek_base_url: String,
    deepseek_model: String,
    consumption_multiplier: String,
    price_per_1m_input_yuan: String,
    price_per_1m_output_yuan: String,
    api_key_set: bool,
}

pub fn routes(state: AiConfigState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route(
            "/admin/ai-config",
            get(show_form).post(save_form),
        )
        .route("/admin/ai-config/test", post(test_connection))
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

#[derive(Debug, Deserialize, Default)]
struct PageQuery {
    saved: Option<String>,
}

async fn show_form(
    State(state): State<Arc<AiConfigState>>,
    query: axum::extract::Query<PageQuery>,
) -> Result<Html<String>, StatusCode> {
    let saved = query.saved.as_deref() == Some("1");
    let view = load_view(&state.settings, saved, None, None).await.map_err(|e| {
        tracing::error!("ai-config load: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Html(render_page(view)))
}

async fn save_form(
    State(state): State<Arc<AiConfigState>>,
    Form(form): Form<AiConfigForm>,
) -> Result<impl IntoResponse, StatusCode> {
    if let Err(msg) = validate_and_save(&state.settings, &form).await {
        let view = load_view(&state.settings, false, Some(msg), None)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok((StatusCode::BAD_REQUEST, Html(render_page(view))).into_response());
    }
    Ok(Redirect::to("/admin/ai-config?saved=1").into_response())
}

async fn test_connection(
    State(state): State<Arc<AiConfigState>>,
    Form(form): Form<AiConfigForm>,
) -> Result<Html<String>, StatusCode> {
    let (api_key, base_url, model) = resolve_credentials(&state, &form).await;
    let view = match api_key {
        Err(msg) => load_view(&state.settings, false, Some(msg), None).await,
        Ok(key) => match deepseek_client::test_connection(&key, &base_url, &model).await {
            Ok(msg) => load_view(&state.settings, false, None, Some(msg)).await,
            Err(msg) => load_view(&state.settings, false, Some(msg), None).await,
        },
    }
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Html(render_page(view)))
}

async fn resolve_credentials(
    state: &AiConfigState,
    form: &AiConfigForm,
) -> (Result<String, String>, String, String) {
    let base_url = match form.deepseek_base_url.trim() {
        "" => state
            .settings
            .deepseek_base_url(&state.env_base_url)
            .await
            .unwrap_or_else(|_| "https://api.deepseek.com".to_string()),
        s => s.to_string(),
    };

    let model = if form.deepseek_model.trim().is_empty() {
        state
            .settings
            .billing_settings()
            .await
            .map(|b| b.deepseek_model)
            .unwrap_or_else(|_| "deepseek-chat".to_string())
    } else {
        form.deepseek_model.trim().to_string()
    };

    let key = if !form.deepseek_api_key.trim().is_empty() {
        Ok(form.deepseek_api_key.trim().to_string())
    } else {
        state
            .settings
            .deepseek_api_key(&state.env_api_key)
            .await
            .map_err(|e| e.to_string())
    };

    (key, base_url, model)
}

async fn validate_and_save(settings: &SettingsService, form: &AiConfigForm) -> Result<(), String> {
    let base_url = form.deepseek_base_url.trim();
    if base_url.is_empty() {
        return Err("请填写 API 地址".to_string());
    }
    let model = form.deepseek_model.trim();
    if model.is_empty() {
        return Err("请填写模型 ID".to_string());
    }

    let multiplier: f64 = form
        .consumption_multiplier
        .trim()
        .parse()
        .map_err(|_| "消耗倍率无效".to_string())?;
    if multiplier <= 0.0 {
        return Err("消耗倍率须大于 0".to_string());
    }

    let key = form.deepseek_api_key.trim();
    if !key.is_empty() {
        settings
            .set("deepseek_api_key", key)
            .await
            .map_err(|_| "保存 API 密钥失败".to_string())?;
    } else {
        let existing = settings
            .get_optional("deepseek_api_key")
            .await
            .map_err(|_| "读取配置失败".to_string())?
            .unwrap_or_default();
        if existing.trim().is_empty() {
            return Err("请填写 API 密钥".to_string());
        }
    }

    settings
        .set("deepseek_base_url", base_url)
        .await
        .map_err(|_| "保存失败".to_string())?;
    settings
        .set("deepseek_model", model)
        .await
        .map_err(|_| "保存失败".to_string())?;
    settings
        .set("consumption_multiplier", &multiplier.to_string())
        .await
        .map_err(|_| "保存失败".to_string())?;

    let price_in: f64 = form
        .price_per_1m_input_tokens
        .trim()
        .parse()
        .map_err(|_| "输入单价无效".to_string())?;
    let price_out: f64 = form
        .price_per_1m_output_tokens
        .trim()
        .parse()
        .map_err(|_| "输出单价无效".to_string())?;
    if price_in < 0.0 || price_out < 0.0 {
        return Err("单价不能为负数".to_string());
    }
    settings
        .set("price_per_1m_input_tokens", &price_in.to_string())
        .await
        .map_err(|_| "保存失败".to_string())?;
    settings
        .set("price_per_1m_output_tokens", &price_out.to_string())
        .await
        .map_err(|_| "保存失败".to_string())?;

    Ok(())
}

async fn load_view(
    settings: &SettingsService,
    saved: bool,
    error: Option<String>,
    test_ok: Option<String>,
) -> Result<AiConfigView, crate::error::AppError> {
    let billing = settings.billing_settings().await?;
    let api_key = settings.get_optional("deepseek_api_key").await?;
    let api_key_set = api_key.as_ref().is_some_and(|k| !k.trim().is_empty());

    Ok(AiConfigView {
        saved,
        error,
        test_ok,
        deepseek_base_url: settings
            .get_optional("deepseek_base_url")
            .await?
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "https://api.deepseek.com".to_string()),
        deepseek_model: billing.deepseek_model,
        consumption_multiplier: billing.consumption_multiplier.to_string(),
        price_per_1m_input_yuan: billing.price_per_1m_input_yuan.to_string(),
        price_per_1m_output_yuan: billing.price_per_1m_output_yuan.to_string(),
        api_key_set,
    })
}

fn render_page(view: AiConfigView) -> String {
    let env = Environment::new();
    let tpl = env
        .template_from_str(include_str!("../../admin-templates/ai_config_page.html"))
        .expect("ai_config template");

    let api_key_placeholder = if view.api_key_set {
        "留空表示不修改已保存的密钥"
    } else {
        "sk-..."
    };

    tpl.render(context!(
        admin_title => ADMIN_TITLE,
        saved => view.saved,
        error => view.error,
        test_ok => view.test_ok,
        deepseek_base_url => view.deepseek_base_url,
        deepseek_model => view.deepseek_model,
        consumption_multiplier => view.consumption_multiplier,
        price_per_1m_input_yuan => view.price_per_1m_input_yuan,
        price_per_1m_output_yuan => view.price_per_1m_output_yuan,
        api_key_set => view.api_key_set,
        api_key_placeholder => api_key_placeholder,
    ))
    .expect("render ai_config")
}
