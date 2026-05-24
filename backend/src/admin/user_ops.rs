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

use crate::services::{
    wallet_service::WalletService,
    wallet_units::{units_to_yuan, yuan_i64_to_units},
};

const SESSION_COOKIE: &str = "axum_admin_session";
const ADMIN_TITLE: &str = "Novel 管理后台";

#[derive(Clone)]
pub struct UserOpsState {
    pub db: Pool<MySql>,
    pub wallet: WalletService,
    pub auth: Arc<dyn AdminAuth>,
}

#[derive(Debug, Deserialize)]
struct RechargeForm {
    user_id: String,
    amount: String,
    #[serde(default)]
    note: String,
}

#[derive(Debug, Deserialize, Default)]
struct PageQuery {
    recharge: Option<String>,
    ok: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct UserBalanceRow {
    id: String,
    username: String,
    display_name: String,
    is_active: bool,
    created_at: DateTime<Utc>,
    balance: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct LedgerRow {
    id: String,
    user_id: String,
    username: Option<String>,
    delta: i64,
    reason: String,
    ref_id: Option<String>,
    created_at: DateTime<Utc>,
}

struct UserOpsView {
    users: Vec<UserBalanceRow>,
    ledger: Vec<LedgerRow>,
    recharge_user_id: String,
    ok: bool,
    error: Option<String>,
}

pub fn routes(state: UserOpsState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/user-ops", get(show_page).post(recharge))
        .route_layer(from_fn_with_state(arc.clone(), require_admin))
        .layer(CookieManagerLayer::new())
        .with_state(arc)
}

async fn require_admin(
    State(state): State<Arc<UserOpsState>>,
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
    Redirect::temporary("/admin/login?next=%2Fadmin%2Fuser-ops").into_response()
}

async fn show_page(
    State(state): State<Arc<UserOpsState>>,
    query: Query<PageQuery>,
) -> Result<Html<String>, StatusCode> {
    let view = load_view(&state, query.recharge.clone(), query.ok.is_some(), None)
        .await
        .map_err(|e| {
            tracing::error!("user-ops load: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Html(render_page(view)))
}

async fn recharge(
    State(state): State<Arc<UserOpsState>>,
    Form(form): Form<RechargeForm>,
) -> Result<impl IntoResponse, StatusCode> {
    let user_id = form.user_id.trim().to_string();
    if user_id.is_empty() {
        let view = load_view(&state, None, false, Some("请选择用户".to_string()))
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok((StatusCode::BAD_REQUEST, Html(render_page(view))).into_response());
    }

    let amount: i64 = match form.amount.trim().parse() {
        Ok(n) => n,
        Err(_) => {
            let view = load_view(&state, Some(user_id), false, Some("充值数额无效".to_string()))
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            return Ok((StatusCode::BAD_REQUEST, Html(render_page(view))).into_response());
        }
    };

    if amount <= 0 {
        let view = load_view(&state, Some(user_id), false, Some("充值数额须大于 0".to_string()))
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok((StatusCode::BAD_REQUEST, Html(render_page(view))).into_response());
    }

    let credited = yuan_i64_to_units(amount);

    match state
        .wallet
        .admin_recharge(&user_id, credited, form.note.trim())
        .await
    {
        Ok(_) => Ok(Redirect::to("/admin/user-ops?ok=1").into_response()),
        Err(e) => {
            let msg = match &e {
                crate::error::AppError::Validation(m) => m.clone(),
                crate::error::AppError::NotFound => "用户不存在".to_string(),
                _ => "充值失败，请稍后重试".to_string(),
            };
            let view = load_view(&state, Some(user_id), false, Some(msg))
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok((StatusCode::BAD_REQUEST, Html(render_page(view))).into_response())
        }
    }
}

async fn load_view(
    state: &UserOpsState,
    recharge_user_id: Option<String>,
    ok: bool,
    error: Option<String>,
) -> Result<UserOpsView, crate::error::AppError> {
    let users = sqlx::query_as::<_, UserBalanceRow>(
        r#"
        SELECT
            u.id,
            u.username,
            u.display_name,
            u.is_active,
            u.created_at,
            COALESCE(w.balance_tokens, 0) AS balance
        FROM users u
        LEFT JOIN ai_wallets w ON w.user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT 500
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    let ledger = sqlx::query_as::<_, LedgerRow>(
        r#"
        SELECT
            l.id,
            l.user_id,
            u.username,
            l.delta,
            l.reason,
            l.ref_id,
            l.created_at
        FROM ai_wallet_ledger l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.reason IN ('admin_recharge', 'admin_adjust', 'ai_call', 'redeem')
        ORDER BY l.created_at DESC
        LIMIT 80
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(UserOpsView {
        recharge_user_id: recharge_user_id.unwrap_or_default(),
        users,
        ledger,
        ok,
        error,
    })
}

fn reason_label(reason: &str) -> &'static str {
    match reason {
        "admin_recharge" => "充值",
        "admin_adjust" => "调整",
        "ai_call" => "AI 消费",
        "redeem" => "兑换",
        _ => "其他",
    }
}

fn render_page(view: UserOpsView) -> String {
    let env = Environment::new();
    let tpl = env
        .template_from_str(include_str!("../../admin-templates/user_ops_page.html"))
        .expect("user_ops template");

    let users: Vec<_> = view
        .users
        .iter()
        .map(|u| {
            context! {
                id => u.id,
                username => u.username,
                display_name => u.display_name,
                is_active => u.is_active,
                created_at => u.created_at.format("%Y-%m-%d %H:%M").to_string(),
                balance => u.balance,
                balance_fmt => format!("{:.4} 元", units_to_yuan(u.balance)),
            }
        })
        .collect();

    let ledger: Vec<_> = view
        .ledger
        .iter()
        .map(|row| {
            let note = row
                .ref_id
                .as_ref()
                .and_then(|r| r.split_once('|'))
                .map(|(_, n)| n.to_string())
                .unwrap_or_default();
            context! {
                id => row.id,
                user_id => row.user_id,
                username => row.username.clone().unwrap_or_else(|| row.user_id.clone()),
                delta => row.delta,
                delta_fmt => {
                    let y = units_to_yuan(row.delta);
                    if y >= 0.0 { format!("+{:.4} 元", y) } else { format!("{:.4} 元", y) }
                },
                reason => reason_label(&row.reason),
                note => note,
                created_at => row.created_at.format("%Y-%m-%d %H:%M").to_string(),
            }
        })
        .collect();

    tpl.render(context!(
        admin_title => ADMIN_TITLE,
        users => users,
        ledger => ledger,
        recharge_user_id => view.recharge_user_id,
        ok => view.ok,
        error => view.error,
    ))
    .expect("render user_ops")
}
