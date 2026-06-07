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

use crate::services::{embedding_provider_service::EmbeddingProviderService, embedding_service};

const SESSION_COOKIE: &str = "axum_admin_session";

#[derive(Clone)]
pub struct EmbeddingConfigState {
    pub providers: EmbeddingProviderService,
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
    dimension: String,
    consumption_multiplier: String,
    #[serde(default)]
    price_per_1m_input_yuan: String,
}

#[derive(Debug, Deserialize)]
pub struct ActivateForm {
    id: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteForm {
    id: String,
}

pub fn routes(state: EmbeddingConfigState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/embedding-config", get(list_providers))
        .route("/admin/embedding-config/new", get(show_add_form))
        .route("/admin/embedding-config/:id/edit", get(show_edit_form))
        .route("/admin/embedding-config/save", post(save_provider))
        .route("/admin/embedding-config/activate", post(activate_provider))
        .route("/admin/embedding-config/delete", post(delete_provider))
        .route("/admin/embedding-config/test", post(test_connection))
        .route_layer(from_fn_with_state(arc.clone(), require_admin))
        .layer(CookieManagerLayer::new())
        .with_state(arc)
}

async fn require_admin(
    State(state): State<Arc<EmbeddingConfigState>>,
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
    Redirect::temporary("/admin/login?next=%2Fadmin%2Fembedding-config").into_response()
}

// ── 列表 ──

async fn list_providers(
    State(state): State<Arc<EmbeddingConfigState>>,
) -> Result<Html<String>, StatusCode> {
    let providers = state.providers.list_all().await.map_err(|e| {
        tracing::error!("list embedding providers: {:?}", e);
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
                "dimension": p.dimension,
                "price_per_1m_input_yuan": p.price_per_1m_input_yuan,
                "consumption_multiplier": p.consumption_multiplier,
                "is_active": p.is_active,
            })
        })
        .collect();
    let rows_json = serde_json::to_string(&rows).unwrap_or_else(|_| "[]".to_string());

    Ok(super::shell::render_shell_page(
        "embedding_config_page.html",
        include_str!("../../admin-templates/embedding_config_page.html"),
        "embedding-config",
        "向量配置",
        context!(page => "list", rows_json => rows_json),
    ))
}

// ── 增/改表单展示 ──

async fn show_add_form(
    State(state): State<Arc<EmbeddingConfigState>>,
) -> Result<Html<String>, StatusCode> {
    render_form(&state, None, None, None, None)
}

async fn show_edit_form(
    State(state): State<Arc<EmbeddingConfigState>>,
    Path(id): Path<String>,
) -> Result<Html<String>, StatusCode> {
    let provider = state.providers.find_by_id(&id).await.map_err(|e| {
        tracing::error!("find embedding provider: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let provider = match provider {
        Some(p) => p,
        None => return Err(StatusCode::NOT_FOUND),
    };
    render_form(&state, Some(&provider), None, None, None)
}

// ── 保存（创建或更新） ──

async fn save_provider(
    State(state): State<Arc<EmbeddingConfigState>>,
    Form(form): Form<ProviderForm>,
) -> Result<impl IntoResponse, StatusCode> {
    let name = form.name.trim().to_string();
    if name.is_empty() {
        return render_form_error(&state, &form, "请填写实例名称").map(|h| h.into_response());
    }
    let base_url = form.base_url.trim().to_string();
    if base_url.is_empty() {
        return render_form_error(&state, &form, "请填写 API 地址").map(|h| h.into_response());
    }
    let model = form.model.trim().to_string();
    if model.is_empty() {
        return render_form_error(&state, &form, "请填写模型 ID").map(|h| h.into_response());
    }
    let dimension: i32 = form.dimension.trim().parse().unwrap_or(0);
    if dimension < 64 || dimension > 2048 {
        return render_form_error(&state, &form, "向量维度须在 64~2048 之间").map(|h| h.into_response());
    }
    let multiplier: f64 = form.consumption_multiplier.trim().parse().unwrap_or(0.0);
    if multiplier <= 0.0 {
        return render_form_error(&state, &form, "消耗倍率须大于 0").map(|h| h.into_response());
    }
    let price_in: f64 = form.price_per_1m_input_yuan.trim().parse().unwrap_or(-1.0);
    if price_in < 0.0 {
        return render_form_error(&state, &form, "单价不能为负数").map(|h| h.into_response());
    }
    let api_key = form.api_key.trim().to_string();

    if form.id.is_empty() {
        // 新建时必须填 key，否则会存出一个空 key 的服务、激活后静默不工作
        if api_key.is_empty() {
            return render_form_error(&state, &form, "新建向量服务必须填写 API 密钥").map(|h| h.into_response());
        }
        state
            .providers
            .create(&name, &base_url, &api_key, &model, dimension, price_in, multiplier)
            .await
            .map_err(|e| {
                tracing::error!("create embedding provider: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    } else {
        state
            .providers
            .update(&form.id, &name, &base_url, &api_key, &model, dimension, price_in, multiplier)
            .await
            .map_err(|e| {
                tracing::error!("update embedding provider: {:?}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
    }
    Ok(Redirect::to("/admin/embedding-config").into_response())
}

// ── 激活 / 删除 ──

async fn activate_provider(
    State(state): State<Arc<EmbeddingConfigState>>,
    Form(form): Form<ActivateForm>,
) -> Result<impl IntoResponse, StatusCode> {
    // 激活前确认该服务有 key，避免激活一个空 key 的服务后静默不工作
    let provider = state.providers.find_by_id(&form.id).await.map_err(|e| {
        tracing::error!("find embedding provider: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    match provider {
        Some(p) if !p.api_key.is_empty() => {}
        Some(_) => return Ok(Redirect::to("/admin/embedding-config?error=nokey").into_response()),
        None => return Err(StatusCode::NOT_FOUND),
    }
    state.providers.set_active(&form.id).await.map_err(|e| {
        tracing::error!("activate embedding provider: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Redirect::to("/admin/embedding-config").into_response())
}

async fn delete_provider(
    State(state): State<Arc<EmbeddingConfigState>>,
    Form(form): Form<DeleteForm>,
) -> Result<impl IntoResponse, StatusCode> {
    state.providers.delete(&form.id).await.map_err(|e| {
        tracing::error!("delete embedding provider: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Redirect::to("/admin/embedding-config"))
}

// ── 测试连接 ──

async fn test_connection(
    State(state): State<Arc<EmbeddingConfigState>>,
    Form(form): Form<ProviderForm>,
) -> Result<Html<String>, StatusCode> {
    let base_url = form.base_url.trim().to_string();
    let model = if form.model.trim().is_empty() { "text-embedding-v4".to_string() } else { form.model.trim().to_string() };
    let dimension: i32 = form.dimension.trim().parse().unwrap_or(1024);

    // 优先用表单密钥，否则取已保存的密钥
    let api_key = if !form.api_key.trim().is_empty() {
        form.api_key.trim().to_string()
    } else if !form.id.is_empty() {
        state.providers.find_by_id(&form.id).await.ok().flatten().map(|p| p.api_key).unwrap_or_default()
    } else {
        String::new()
    };

    if api_key.is_empty() {
        return render_form(&state, None, Some(&form), None, Some("请先填写 API 密钥再测试"));
    }

    let (test_ok, error) = match embedding_service::test_connection(&api_key, &base_url, &model, dimension).await {
        Ok(msg) => (Some(msg), None),
        Err(msg) => (None, Some(msg)),
    };
    render_form(&state, None, Some(&form), test_ok.as_deref(), error.as_deref())
}

// ── 渲染辅助 ──

fn render_form(
    _state: &EmbeddingConfigState,
    provider: Option<&crate::services::embedding_provider_service::EmbeddingProvider>,
    submitted_form: Option<&ProviderForm>,
    test_ok: Option<&str>,
    error: Option<&str>,
) -> Result<Html<String>, StatusCode> {
    let (id, name, base_url, model, dimension, multiplier, price_in, api_key_set) =
        if let Some(p) = provider {
            (
                p.id.clone(),
                p.name.clone(),
                p.base_url.clone(),
                p.model.clone(),
                p.dimension.to_string(),
                p.consumption_multiplier.to_string(),
                p.price_per_1m_input_yuan.to_string(),
                !p.api_key.is_empty(),
            )
        } else if let Some(f) = submitted_form {
            (
                f.id.clone(),
                f.name.clone(),
                f.base_url.clone(),
                f.model.clone(),
                f.dimension.clone(),
                f.consumption_multiplier.clone(),
                f.price_per_1m_input_yuan.clone(),
                false,
            )
        } else {
            (
                String::new(),
                String::new(),
                "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
                "text-embedding-v4".to_string(),
                "1024".to_string(),
                "1".to_string(),
                "0.5".to_string(),
                false,
            )
        };
    render_form_html(id, name, base_url, model, dimension, multiplier, price_in, api_key_set, test_ok, error)
}

#[allow(clippy::too_many_arguments)]
fn render_form_html(
    id: String,
    name: String,
    base_url: String,
    model: String,
    dimension: String,
    multiplier: String,
    price_in: String,
    api_key_set: bool,
    test_ok: Option<&str>,
    error: Option<&str>,
) -> Result<Html<String>, StatusCode> {
    let api_key_placeholder = if api_key_set {
        "留空表示不修改已保存的密钥"
    } else {
        "sk-..."
    };
    let is_edit = !id.is_empty();
    let page_title = if is_edit { "编辑向量服务" } else { "添加向量服务" };

    Ok(super::shell::render_shell_page_sub(
        "embedding_config_page.html",
        include_str!("../../admin-templates/embedding_config_page.html"),
        "embedding-config",
        "向量配置",
        Some(page_title),
        context!(
            page => "form",
            page_title => page_title,
            is_edit => is_edit,
            id => id,
            name => name,
            base_url => base_url,
            model => model,
            dimension => dimension,
            consumption_multiplier => multiplier,
            price_per_1m_input_yuan => price_in,
            api_key_set => api_key_set,
            api_key_placeholder => api_key_placeholder,
            error => error,
            test_ok => test_ok,
        ),
    ))
}

fn render_form_error(
    state: &EmbeddingConfigState,
    form: &ProviderForm,
    error: &str,
) -> Result<Html<String>, StatusCode> {
    render_form(state, None, Some(form), None, Some(error))
}


