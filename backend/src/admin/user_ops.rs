use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    middleware::{from_fn_with_state, Next},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
    Form, Router,
};
use axum_admin::auth::AdminAuth;
use chrono::{DateTime, Utc};
use minijinja::context;
use serde::Deserialize;
use sqlx::{MySql, Pool};
use tower_cookies::CookieManagerLayer;
use tower_cookies::Cookies;

use crate::services::{
    wallet_service::WalletService,
    wallet_units::{units_to_yuan, yuan_i64_to_units},
};
use crate::utils::crypto;

const SESSION_COOKIE: &str = "axum_admin_session";

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
    q: Option<String>,
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
    search: String,
}

pub fn routes(state: UserOpsState) -> Router {
    let arc = Arc::new(state);
    Router::new()
        .route("/admin/user-ops", get(show_page).post(recharge))
        .route("/admin/users/:id", get(show_user_detail))
        .route("/admin/users/:id/toggle-active", post(toggle_active))
        .route("/admin/users/:id/reset-password", post(reset_password))
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
    let view = load_view(
        &state,
        query.recharge.clone(),
        query.ok.is_some(),
        None,
        query.q.clone(),
    )
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
        let view = load_view(&state, None, false, Some("请选择用户".to_string()), None)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok((StatusCode::BAD_REQUEST, Html(render_page(view))).into_response());
    }

    let amount: i64 = match form.amount.trim().parse() {
        Ok(n) => n,
        Err(_) => {
            let view = load_view(&state, Some(user_id), false, Some("充值数额无效".to_string()), None)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            return Ok((StatusCode::BAD_REQUEST, Html(render_page(view))).into_response());
        }
    };

    if amount <= 0 {
        let view = load_view(&state, Some(user_id), false, Some("充值数额须大于 0".to_string()), None)
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
            let view = load_view(&state, Some(user_id), false, Some(msg), None)
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
    search: Option<String>,
) -> Result<UserOpsView, crate::error::AppError> {
    let search = search.map(|s| s.trim().to_string()).unwrap_or_default();

    let users = if search.is_empty() {
        sqlx::query_as::<_, UserBalanceRow>(
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
        .await?
    } else {
        // 按账号或昵称模糊搜索（参数化，转义 LIKE 通配符防注入）
        let escaped = search.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_");
        let pattern = format!("%{}%", escaped);
        sqlx::query_as::<_, UserBalanceRow>(
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
            WHERE u.username LIKE ? OR u.display_name LIKE ?
            ORDER BY u.created_at DESC
            LIMIT 500
            "#,
        )
        .bind(&pattern)
        .bind(&pattern)
        .fetch_all(&state.db)
        .await?
    };

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
        search,
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

#[derive(Debug, sqlx::FromRow)]
struct UserDetailRow {
    id: String,
    username: String,
    display_name: String,
    email: Option<String>,
    registration_ip: String,
    device_id_hash: Option<String>,
    is_active: bool,
    created_at: DateTime<Utc>,
    balance: i64,
}

#[derive(Debug, sqlx::FromRow)]
struct NovelRow {
    title: String,
    genre: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Default)]
struct DetailQuery {
    pwd: Option<String>,
}

async fn show_user_detail(
    State(state): State<Arc<UserOpsState>>,
    Path(uid): Path<String>,
    query: Query<DetailQuery>,
) -> Result<Html<String>, StatusCode> {
    let fail = |e: sqlx::Error| {
        tracing::error!("user detail load: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    };

    let user = sqlx::query_as::<_, UserDetailRow>(
        r#"
        SELECT u.id, u.username, u.display_name, u.email, u.registration_ip,
               u.device_id_hash, u.is_active, u.created_at,
               COALESCE(w.balance_tokens, 0) AS balance
        FROM users u
        LEFT JOIN ai_wallets w ON w.user_id = u.id
        WHERE u.id = ?
        "#,
    )
    .bind(&uid)
    .fetch_optional(&state.db)
    .await
    .map_err(fail)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let novels = sqlx::query_as::<_, NovelRow>(
        "SELECT title, genre, created_at FROM novels WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
    )
    .bind(&uid)
    .fetch_all(&state.db)
    .await
    .map_err(fail)?;

    let ledger = sqlx::query_as::<_, LedgerRow>(
        r#"
        SELECT l.id, l.user_id, u.username, l.delta, l.reason, l.ref_id, l.created_at
        FROM ai_wallet_ledger l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.user_id = ?
        ORDER BY l.created_at DESC
        LIMIT 50
        "#,
    )
    .bind(&uid)
    .fetch_all(&state.db)
    .await
    .map_err(fail)?;

    Ok(render_user_detail(user, novels, ledger, query.pwd.clone()))
}

async fn toggle_active(
    State(state): State<Arc<UserOpsState>>,
    Path(uid): Path<String>,
) -> Result<Redirect, StatusCode> {
    let fail = |e: sqlx::Error| {
        tracing::error!("toggle active: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    };

    sqlx::query("UPDATE users SET is_active = NOT is_active WHERE id = ?")
        .bind(&uid)
        .execute(&state.db)
        .await
        .map_err(fail)?;

    // 若该用户现在处于停用状态，立即删除其所有未过期 session，
    // 使封禁尽快生效（配合 60 秒 session 缓存，最迟 60 秒后彻底失效）。
    let is_active: Option<bool> = sqlx::query_scalar("SELECT is_active FROM users WHERE id = ?")
        .bind(&uid)
        .fetch_optional(&state.db)
        .await
        .map_err(fail)?;
    if is_active == Some(false) {
        sqlx::query("DELETE FROM user_sessions WHERE user_id = ?")
            .bind(&uid)
            .execute(&state.db)
            .await
            .map_err(fail)?;
    }

    Ok(Redirect::to(&format!("/admin/users/{}", uid)))
}

async fn reset_password(
    State(state): State<Arc<UserOpsState>>,
    Path(uid): Path<String>,
) -> Result<Redirect, StatusCode> {
    let fail = |e: sqlx::Error| {
        tracing::error!("reset password: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    };

    // 确认用户存在
    let exists: Option<String> = sqlx::query_scalar("SELECT id FROM users WHERE id = ?")
        .bind(&uid)
        .fetch_optional(&state.db)
        .await
        .map_err(fail)?;
    if exists.is_none() {
        return Err(StatusCode::NOT_FOUND);
    }

    // 生成新随机密码并哈希存储（明文仅在本次重定向后展示一次，不落库）
    let new_password = crypto::generate_password();
    let iterations: u32 = std::env::var("PASSWORD_HASH_ITERATIONS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(120_000);
    let password_hash = crypto::hash_password(&new_password, iterations).map_err(|e| {
        tracing::error!("reset password hash: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(&password_hash)
        .bind(&uid)
        .execute(&state.db)
        .await
        .map_err(fail)?;

    // 重置密码后使该用户所有现有 session 失效，强制用新密码重新登录
    sqlx::query("DELETE FROM user_sessions WHERE user_id = ?")
        .bind(&uid)
        .execute(&state.db)
        .await
        .map_err(fail)?;

    Ok(Redirect::to(&format!(
        "/admin/users/{}?pwd={}",
        uid, new_password
    )))
}

fn render_user_detail(
    user: UserDetailRow,
    novels: Vec<NovelRow>,
    ledger: Vec<LedgerRow>,
    new_password: Option<String>,
) -> Html<String> {
    let novels_ctx: Vec<_> = novels
        .iter()
        .map(|n| {
            context! {
                title => n.title,
                genre => n.genre,
                created_at => n.created_at.format("%Y-%m-%d %H:%M").to_string(),
            }
        })
        .collect();

    let ledger_ctx: Vec<_> = ledger
        .iter()
        .map(|row| {
            let note = row
                .ref_id
                .as_ref()
                .and_then(|r| r.split_once('|'))
                .map(|(_, n)| n.to_string())
                .unwrap_or_default();
            context! {
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

    let username = user.username.clone();
    Html(
        super::shell::render_shell_page_sub(
            "user_detail_page.html",
            include_str!("../../admin-templates/user_detail_page.html"),
            "user-ops",
            "用户与余额",
            Some(&username),
            context!(
                id => user.id,
                username => user.username,
                display_name => user.display_name,
                email => user.email.unwrap_or_default(),
                registration_ip => user.registration_ip,
                device_bound => user.device_id_hash.map(|h| !h.is_empty()).unwrap_or(false),
                is_active => user.is_active,
                created_at => user.created_at.format("%Y-%m-%d %H:%M").to_string(),
                balance_fmt => format!("{:.4} 元", units_to_yuan(user.balance)),
                novels => novels_ctx,
                ledger => ledger_ctx,
                new_password => new_password.unwrap_or_default(),
            ),
        )
        .0,
    )
}

fn render_page(view: UserOpsView) -> String {
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

    super::shell::render_shell_page(
        "user_ops_page.html",
        include_str!("../../admin-templates/user_ops_page.html"),
        "user-ops",
        "用户与余额",
        context!(
            users => users,
            ledger => ledger,
            recharge_user_id => view.recharge_user_id,
            ok => view.ok,
            error => view.error,
            search => view.search,
        ),
    )
    .0
}
