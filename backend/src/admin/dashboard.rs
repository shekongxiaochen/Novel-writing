use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    middleware::{from_fn_with_state, Next},
    response::{Html, IntoResponse, Redirect, Response},
    routing::get,
    Router,
};
use axum_admin::auth::AdminAuth;
use chrono::{DateTime, Utc};
use minijinja::context;
use sqlx::{MySql, Pool};
use tower_cookies::CookieManagerLayer;
use tower_cookies::Cookies;

use crate::services::wallet_units::units_to_yuan;

const SESSION_COOKIE: &str = "axum_admin_session";

#[derive(Clone)]
pub struct DashboardState {
    pub db: Pool<MySql>,
    pub auth: Arc<dyn AdminAuth>,
}

pub fn routes(state: DashboardState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/dashboard", get(show_page))
        .route_layer(from_fn_with_state(arc.clone(), require_admin))
        .layer(CookieManagerLayer::new())
        .with_state(arc)
}

async fn require_admin(
    State(state): State<Arc<DashboardState>>,
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
    Redirect::temporary("/admin/login?next=%2Fadmin%2Fdashboard").into_response()
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

#[derive(Debug, sqlx::FromRow)]
struct RecentUserRow {
    id: String,
    username: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
struct RecentLedgerRow {
    user_id: String,
    username: Option<String>,
    delta: i64,
    reason: String,
    created_at: DateTime<Utc>,
}

async fn show_page(
    State(state): State<Arc<DashboardState>>,
) -> Result<Html<String>, StatusCode> {
    let db = &state.db;
    let fail = |e: sqlx::Error| {
        tracing::error!("dashboard load: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    };

    // ── 用户指标 ──
    let users_total: i64 = scalar(db, "SELECT COUNT(*) FROM users").await.map_err(fail)?;
    let users_today: i64 = scalar(
        db,
        "SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()",
    )
    .await
    .map_err(fail)?;
    let users_month: i64 = scalar(
        db,
        "SELECT COUNT(*) FROM users WHERE YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())",
    )
    .await
    .map_err(fail)?;
    let users_inactive: i64 = scalar(db, "SELECT COUNT(*) FROM users WHERE is_active = 0")
        .await
        .map_err(fail)?;

    // ── 作品指标 ──
    let novels_total: i64 = scalar(db, "SELECT COUNT(*) FROM novels").await.map_err(fail)?;
    let novels_today: i64 = scalar(
        db,
        "SELECT COUNT(*) FROM novels WHERE DATE(created_at) = CURDATE()",
    )
    .await
    .map_err(fail)?;

    // ── AI 消费指标（ai_call 的 delta 为负，取其绝对值汇总）──
    let spend_total: i64 = scalar(
        db,
        "SELECT CAST(COALESCE(-SUM(delta),0) AS SIGNED) FROM ai_wallet_ledger WHERE reason='ai_call'",
    )
    .await
    .map_err(fail)?;
    let spend_today: i64 = scalar(
        db,
        "SELECT CAST(COALESCE(-SUM(delta),0) AS SIGNED) FROM ai_wallet_ledger WHERE reason='ai_call' AND DATE(created_at)=CURDATE()",
    )
    .await
    .map_err(fail)?;
    let spend_month: i64 = scalar(
        db,
        "SELECT CAST(COALESCE(-SUM(delta),0) AS SIGNED) FROM ai_wallet_ledger WHERE reason='ai_call' AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())",
    )
    .await
    .map_err(fail)?;

    // ── 充值指标（admin_recharge + redeem 的正向 delta）──
    let recharge_total: i64 = scalar(
        db,
        "SELECT CAST(COALESCE(SUM(delta),0) AS SIGNED) FROM ai_wallet_ledger WHERE reason IN ('admin_recharge','redeem') AND delta>0",
    )
    .await
    .map_err(fail)?;
    let recharge_today: i64 = scalar(
        db,
        "SELECT CAST(COALESCE(SUM(delta),0) AS SIGNED) FROM ai_wallet_ledger WHERE reason IN ('admin_recharge','redeem') AND delta>0 AND DATE(created_at)=CURDATE()",
    )
    .await
    .map_err(fail)?;

    // ── 卡密指标 ──
    let cards_unused: i64 = scalar(db, "SELECT COUNT(*) FROM card_keys WHERE status='unused'")
        .await
        .map_err(fail)?;
    let cards_used: i64 = scalar(db, "SELECT COUNT(*) FROM card_keys WHERE status='used'")
        .await
        .map_err(fail)?;

    // ── 最近动态 ──
    let recent_users = sqlx::query_as::<_, RecentUserRow>(
        "SELECT id, username, created_at FROM users ORDER BY created_at DESC LIMIT 10",
    )
    .fetch_all(db)
    .await
    .map_err(fail)?;

    let recent_ledger = sqlx::query_as::<_, RecentLedgerRow>(
        r#"
        SELECT l.user_id, u.username, l.delta, l.reason, l.created_at
        FROM ai_wallet_ledger l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.reason = 'ai_call'
        ORDER BY l.created_at DESC
        LIMIT 10
        "#,
    )
    .fetch_all(db)
    .await
    .map_err(fail)?;

    let recent_users_ctx: Vec<_> = recent_users
        .iter()
        .map(|u| {
            context! {
                id => u.id,
                username => u.username,
                created_at => u.created_at.format("%Y-%m-%d %H:%M").to_string(),
            }
        })
        .collect();

    let recent_ledger_ctx: Vec<_> = recent_ledger
        .iter()
        .map(|r| {
            context! {
                user_id => r.user_id,
                username => r.username.clone().unwrap_or_else(|| r.user_id.clone()),
                amount_fmt => format!("{:.4} 元", units_to_yuan(r.delta.abs())),
                reason => reason_label(&r.reason),
                created_at => r.created_at.format("%m-%d %H:%M").to_string(),
            }
        })
        .collect();

    let yuan = |u: i64| format!("{:.2} 元", units_to_yuan(u));

    Ok(super::shell::render_shell_page(
        "dashboard_page.html",
        include_str!("../../admin-templates/dashboard_page.html"),
        "dashboard",
        "数据概览",
        context!(
            users_total => users_total,
            users_today => users_today,
            users_month => users_month,
            users_inactive => users_inactive,
            novels_total => novels_total,
            novels_today => novels_today,
            spend_total => yuan(spend_total),
            spend_today => yuan(spend_today),
            spend_month => yuan(spend_month),
            recharge_total => yuan(recharge_total),
            recharge_today => yuan(recharge_today),
            cards_unused => cards_unused,
            cards_used => cards_used,
            recent_users => recent_users_ctx,
            recent_ledger => recent_ledger_ctx,
        ),
    ))
}

async fn scalar(db: &Pool<MySql>, sql: &str) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(sql).fetch_one(db).await?;
    Ok(row.0)
}



