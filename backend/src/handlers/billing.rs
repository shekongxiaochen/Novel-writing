use crate::{
    error::Result,
    models::{
        billing::{LedgerEntryPublic, LedgerResponse, RedeemRequest, RedeemResponse, WalletResponse},
        User,
    },
    services::AppState,
};
use axum::{extract::State, Extension, Json};
use std::sync::Arc;

pub async fn get_wallet(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<Json<WalletResponse>> {
    let balance = state.wallet.balance(&user.id).await?;
    Ok(Json(WalletResponse {
        balance_yuan: crate::services::wallet_units::units_to_yuan(balance),
    }))
}

pub async fn get_ledger(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<User>,
) -> Result<Json<LedgerResponse>> {
    let rows = state.wallet.list_ledger_public(&user.id, 50).await?;
    let items = rows
        .into_iter()
        .map(|r| LedgerEntryPublic {
            id: r.id,
            delta: r.delta,
            reason: public_reason_label(&r.reason),
            created_at: r.created_at,
        })
        .collect();
    Ok(Json(LedgerResponse { items }))
}

pub async fn redeem_card_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Json(body): Json<RedeemRequest>,
) -> Result<Json<RedeemResponse>> {
    let result = state.card_keys.redeem(&user.id, &body.code).await?;
    Ok(Json(RedeemResponse {
        balance_yuan: crate::services::wallet_units::units_to_yuan(result.balance_units),
        credited_yuan: crate::services::wallet_units::units_to_yuan(result.credited_units),
        amount_yuan: result.amount_yuan,
    }))
}

fn public_reason_label(reason: &str) -> String {
    match reason {
        "ai_call" => "AI 消费",
        "redeem" => "兑换入账",
        "admin_recharge" => "充值",
        "admin_adjust" => "调整",
        _ => "变动",
    }
    .to_string()
}
