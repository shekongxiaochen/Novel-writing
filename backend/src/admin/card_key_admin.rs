use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    middleware::{from_fn_with_state, Next},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
    Form, Router,
};
use axum_admin::auth::AdminAuth;
use chrono::{DateTime, Utc};
use minijinja::{context, Environment};
use serde::Deserialize;
use sqlx::{MySql, Pool};
use tower_cookies::CookieManagerLayer;
use tower_cookies::Cookies;

use crate::services::card_key_service::CardKeyService;

const SESSION_COOKIE: &str = "axum_admin_session";
const ADMIN_TITLE: &str = "Novel 管理后台";
const PAGE_SIZE: i64 = 50;

#[derive(Clone)]
pub struct CardKeyAdminState {
    pub db: Pool<MySql>,
    pub card_keys: CardKeyService,
    pub auth: Arc<dyn AdminAuth>,
}

#[derive(Debug, Deserialize)]
struct GenerateForm {
    amount_yuan: String,
    count: String,
}

#[derive(Debug, Deserialize, Default)]
struct PageQuery {
    status: Option<String>,
    amount: Option<String>,
    page: Option<String>,
    ok: Option<String>,
    error: Option<String>,
    /// 新生成的卡密（以换行分隔，URL 编码后通过 redirect 传递）
    new_codes: Option<String>,
    new_count: Option<String>,
    new_amount: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct CardKeyRow {
    id: String,
    code: String,
    amount_yuan: i32,
    status: String,
    used_by_user_id: Option<String>,
    used_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct StatsRow {
    total: i64,
    unused: i64,
    used: i64,
    unused_value: i64,
}

pub fn routes(state: CardKeyAdminState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/card-keys", get(show_page))
        .route("/admin/card-keys/generate", post(generate))
        .route("/admin/card-keys/export", get(export_codes))
        .route_layer(from_fn_with_state(arc.clone(), require_admin))
        .layer(CookieManagerLayer::new())
        .with_state(arc)
}

async fn require_admin(
    State(state): State<Arc<CardKeyAdminState>>,
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
    Redirect::temporary("/admin/login?next=%2Fadmin%2Fcard-keys").into_response()
}

async fn show_page(
    State(state): State<Arc<CardKeyAdminState>>,
    query: Query<PageQuery>,
) -> Result<Html<String>, StatusCode> {
    let filter_status = query.status.clone().unwrap_or_default();
    let filter_amount = query.amount.clone().unwrap_or_default();
    let page: i64 = query
        .page
        .as_ref()
        .and_then(|p| p.parse().ok())
        .unwrap_or(1)
        .max(1);

    let stats = load_stats(&state)
        .await
        .map_err(|e| {
            tracing::error!("card-keys stats: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let total_count = load_count(&state, &filter_status, &filter_amount)
        .await
        .map_err(|e| {
            tracing::error!("card-keys count: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let total_pages = ((total_count + PAGE_SIZE - 1) / PAGE_SIZE).max(1);
    let page = page.min(total_pages);

    let cards = load_cards(&state, &filter_status, &filter_amount, page)
        .await
        .map_err(|e| {
            tracing::error!("card-keys list: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let new_codes_str = query.new_codes.clone().unwrap_or_default();
    let new_codes_count: i32 = query
        .new_count
        .as_ref()
        .and_then(|c| c.parse().ok())
        .unwrap_or(0);
    let new_codes_amount: i32 = query
        .new_amount
        .as_ref()
        .and_then(|a| a.parse().ok())
        .unwrap_or(0);

    Ok(Html(render_page(
        &stats,
        &cards,
        total_count,
        total_pages,
        page,
        &filter_status,
        &filter_amount,
        &query.ok,
        &query.error,
        if new_codes_str.is_empty() {
            None
        } else {
            Some(&new_codes_str)
        },
        new_codes_count,
        new_codes_amount,
    )))
}

async fn generate(
    State(state): State<Arc<CardKeyAdminState>>,
    Form(form): Form<GenerateForm>,
) -> Result<impl IntoResponse, StatusCode> {
    let amount_yuan: i32 = form.amount_yuan.trim().parse().map_err(|_| {
        StatusCode::BAD_REQUEST
    })?;

    let count: u32 = form.count.trim().parse().map_err(|_| {
        StatusCode::BAD_REQUEST
    })?;

    match state.card_keys.generate_batch(amount_yuan, count).await {
        Ok(codes) => {
            let n = codes.len();
            let joined = codes.join("\n");
            // 通过 redirect query 参数传递新生成的卡密
            let redirect_url = format!(
                "/admin/card-keys?ok=生成了+{}+张+{}+元卡密&new_codes={}&new_count={}&new_amount={}",
                n,
                amount_yuan,
                urlencoding::encode(&joined),
                n,
                amount_yuan,
            );
            Ok(Redirect::to(&redirect_url).into_response())
        }
        Err(e) => {
            let msg = match &e {
                crate::error::AppError::Validation(m) => m.clone(),
                _ => "生成失败，请稍后重试".to_string(),
            };
            let redirect_url = format!(
                "/admin/card-keys?error={}",
                urlencoding::encode(&msg),
            );
            Ok(Redirect::to(&redirect_url).into_response())
        }
    }
}

async fn export_codes(
    State(state): State<Arc<CardKeyAdminState>>,
    query: Query<PageQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let filter_status = query.status.clone().unwrap_or_default();
    let filter_amount = query.amount.clone().unwrap_or_default();

    let mut sql = "SELECT code FROM card_keys WHERE 1=1".to_string();
    if !filter_status.is_empty() {
        sql.push_str(" AND status = ?");
    }
    let amount_val = parse_amount_filter(&filter_amount);
    if amount_val.is_some() {
        sql.push_str(" AND amount_yuan = ?");
    }
    sql.push_str(" ORDER BY created_at DESC");

    let mut q = sqlx::query_as::<_, (String,)>(&sql);
    if !filter_status.is_empty() {
        q = q.bind(&filter_status);
    }
    if let Some(a) = amount_val {
        q = q.bind(a);
    }
    let rows: Vec<(String,)> = q
        .fetch_all(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("card-keys export: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let text = rows.iter().map(|(c,)| c.as_str()).collect::<Vec<_>>().join("\n");
    Ok((
        [(axum::http::header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        text,
    ))
}

/// 把前端传来的金额过滤参数解析成整数;非法值返回 None(忽略该过滤),杜绝 SQL 注入
fn parse_amount_filter(raw: &str) -> Option<i64> {
    let t = raw.trim();
    if t.is_empty() {
        return None;
    }
    t.parse::<i64>().ok()
}

async fn load_stats(state: &CardKeyAdminState) -> Result<StatsRow, crate::error::AppError> {
    let row = sqlx::query_as::<_, StatsRow>(
        r#"
        SELECT
            COUNT(*) AS total,
            CAST(COALESCE(SUM(status = 'unused'), 0) AS SIGNED) AS unused,
            CAST(COALESCE(SUM(status = 'used'), 0) AS SIGNED) AS used,
            CAST(COALESCE(SUM(CASE WHEN status = 'unused' THEN amount_yuan ELSE 0 END), 0) AS SIGNED) AS unused_value
        FROM card_keys
        "#,
    )
    .fetch_one(&state.db)
    .await?;
    Ok(row)
}

async fn load_count(
    state: &CardKeyAdminState,
    filter_status: &str,
    filter_amount: &str,
) -> Result<i64, crate::error::AppError> {
    let mut sql = "SELECT COUNT(*) AS c FROM card_keys WHERE 1=1".to_string();
    if !filter_status.is_empty() {
        sql.push_str(" AND status = ?");
    }
    let amount_val = parse_amount_filter(filter_amount);
    if amount_val.is_some() {
        sql.push_str(" AND amount_yuan = ?");
    }
    let mut q = sqlx::query_as::<_, (i64,)>(&sql);
    if !filter_status.is_empty() {
        q = q.bind(filter_status);
    }
    if let Some(a) = amount_val {
        q = q.bind(a);
    }
    let row: (i64,) = q.fetch_one(&state.db).await?;
    Ok(row.0)
}

async fn load_cards(
    state: &CardKeyAdminState,
    filter_status: &str,
    filter_amount: &str,
    page: i64,
) -> Result<Vec<CardKeyRow>, crate::error::AppError> {
    let mut sql = "SELECT id, code, amount_yuan, status, used_by_user_id, used_at, created_at FROM card_keys WHERE 1=1".to_string();
    if !filter_status.is_empty() {
        sql.push_str(" AND status = ?");
    }
    let amount_val = parse_amount_filter(filter_amount);
    if amount_val.is_some() {
        sql.push_str(" AND amount_yuan = ?");
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let mut q = sqlx::query_as::<_, CardKeyRow>(&sql);
    if !filter_status.is_empty() {
        q = q.bind(filter_status);
    }
    if let Some(a) = amount_val {
        q = q.bind(a);
    }
    let rows = q
        .bind(PAGE_SIZE)
        .bind((page - 1) * PAGE_SIZE)
        .fetch_all(&state.db)
        .await?;
    Ok(rows)
}

fn render_page(
    stats: &StatsRow,
    cards: &[CardKeyRow],
    total_count: i64,
    total_pages: i64,
    page: i64,
    filter_status: &str,
    filter_amount: &str,
    ok: &Option<String>,
    error: &Option<String>,
    new_codes: Option<&str>,
    new_codes_count: i32,
    new_codes_amount: i32,
) -> String {
    let env = Environment::new();
    let tpl = env
        .template_from_str(include_str!("../../admin-templates/card_key_page.html"))
        .expect("card_key template");

    let card_rows: Vec<_> = cards
        .iter()
        .map(|c| {
            context! {
                code => c.code,
                amount_yuan => c.amount_yuan,
                status => c.status,
                used_by => c.used_by_user_id.as_deref().unwrap_or("—"),
                used_at => c
                    .used_at
                    .map(|t| t.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_else(|| "—".to_string()),
                created_at => c.created_at.format("%Y-%m-%d %H:%M").to_string(),
            }
        })
        .collect();

    tpl.render(context!(
        admin_title => ADMIN_TITLE,
        stats => context! {
            total => stats.total,
            unused => stats.unused,
            used => stats.used,
            unused_value => stats.unused_value,
        },
        cards => card_rows,
        total_count => total_count,
        total_pages => total_pages,
        page => page,
        filter_status => filter_status,
        filter_amount => filter_amount,
        ok_msg => ok.clone().unwrap_or_default(),
        error => error.clone().unwrap_or_default(),
        new_codes => new_codes.unwrap_or(""),
        new_codes_count => new_codes_count,
        new_codes_amount => new_codes_amount,
    ))
    .expect("render card_key")
}
