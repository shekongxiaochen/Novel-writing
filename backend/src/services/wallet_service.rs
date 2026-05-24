use crate::{
    error::{AppError, Result},
    utils::{id, time},
};
use chrono::{DateTime, Utc};
use sqlx::{MySql, Pool};

use crate::services::settings_service::BillingSettings;

#[derive(Clone)]
pub struct WalletService {
    db: Pool<MySql>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct LedgerRow {
    pub id: String,
    pub delta: i64,
    pub reason: String,
    pub created_at: DateTime<Utc>,
}

impl WalletService {
    pub fn new(db: Pool<MySql>) -> Self {
        Self { db }
    }

    pub async fn ensure_wallet(&self, user_id: &str) -> Result<()> {
        let now = time::now_utc();
        sqlx::query(
            r#"
            INSERT INTO ai_wallets (user_id, balance_tokens, updated_at)
            VALUES (?, 0, ?)
            ON DUPLICATE KEY UPDATE user_id = user_id
            "#,
        )
        .bind(user_id)
        .bind(now)
        .execute(&self.db)
        .await?;
        Ok(())
    }

    pub async fn balance(&self, user_id: &str) -> Result<i64> {
        self.ensure_wallet(user_id).await?;
        let row: Option<(i64,)> =
            sqlx::query_as("SELECT balance_tokens FROM ai_wallets WHERE user_id = ?")
                .bind(user_id)
                .fetch_optional(&self.db)
                .await?;
        Ok(row.map(|(b,)| b).unwrap_or(0))
    }

    pub async fn list_ledger_public(
        &self,
        user_id: &str,
        limit: u32,
    ) -> Result<Vec<LedgerRow>> {
        let rows = sqlx::query_as::<_, LedgerRow>(
            r#"
            SELECT id, delta, reason, created_at
            FROM ai_wallet_ledger
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            "#,
        )
        .bind(user_id)
        .bind(limit.min(100))
        .fetch_all(&self.db)
        .await?;
        Ok(rows)
    }

    /// AI 调用扣费（amount 已为 真实用量×倍率）
    pub async fn deduct_tokens(
        &self,
        user_id: &str,
        deducted: i64,
        settings: &BillingSettings,
        ref_id: &str,
    ) -> Result<i64> {
        if deducted <= 0 {
            return self.balance(user_id).await;
        }

        let mut tx = self.db.begin().await?;
        let balance: Option<(i64,)> = sqlx::query_as(
            "SELECT balance_tokens FROM ai_wallets WHERE user_id = ? FOR UPDATE",
        )
        .bind(user_id)
        .fetch_optional(&mut *tx)
        .await?;

        let current = balance.map(|(b,)| b).unwrap_or(0);
        if current < deducted {
            return Err(AppError::InsufficientBalance);
        }

        let new_balance = current - deducted;
        let now = time::now_utc();
        sqlx::query("UPDATE ai_wallets SET balance_tokens = ?, updated_at = ? WHERE user_id = ?")
            .bind(new_balance)
            .bind(now)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        let ledger_id = id::generate_id();
        let multiplier_str = format!("{:.4}", settings.consumption_multiplier);
        sqlx::query(
            r#"
            INSERT INTO ai_wallet_ledger
                (id, user_id, delta, reason, ref_id, consumption_multiplier_applied, created_at)
            VALUES (?, ?, ?, 'ai_call', ?, ?, ?)
            "#,
        )
        .bind(&ledger_id)
        .bind(user_id)
        .bind(-deducted)
        .bind(ref_id)
        .bind(&multiplier_str)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(new_balance)
    }

    /// 管理后台为用户充值（写入流水，时间戳自动生成）
    pub async fn admin_recharge(
        &self,
        user_id: &str,
        amount: i64,
        note: &str,
    ) -> Result<i64> {
        if amount <= 0 {
            return Err(AppError::Validation("充值数额须大于 0".to_string()));
        }
        self.ensure_wallet(user_id).await?;
        let ref_id = {
            let base = id::generate_id();
            let note = note.trim();
            if note.is_empty() {
                base
            } else {
                format!("{base}|{note}")
            }
        };
        self.apply_ledger_delta(user_id, amount, "admin_recharge", &ref_id)
            .await
    }

    /// 运营人工调账（正数充值）
    pub async fn admin_adjust(
        &self,
        user_id: &str,
        delta: i64,
        ref_id: &str,
    ) -> Result<i64> {
        if delta == 0 {
            return self.balance(user_id).await;
        }
        self.apply_ledger_delta(user_id, delta, "admin_adjust", ref_id)
            .await
    }

    async fn apply_ledger_delta(
        &self,
        user_id: &str,
        delta: i64,
        reason: &str,
        ref_id: &str,
    ) -> Result<i64> {
        self.ensure_wallet(user_id).await?;
        let mut tx = self.db.begin().await?;
        let balance: (i64,) = sqlx::query_as(
            "SELECT balance_tokens FROM ai_wallets WHERE user_id = ? FOR UPDATE",
        )
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        let new_balance = balance.0.saturating_add(delta);
        if delta < 0 && new_balance < 0 {
            return Err(AppError::Validation("余额不足".to_string()));
        }

        let now = time::now_utc();
        sqlx::query("UPDATE ai_wallets SET balance_tokens = ?, updated_at = ? WHERE user_id = ?")
            .bind(new_balance)
            .bind(now)
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        let ledger_id = id::generate_id();
        sqlx::query(
            r#"
            INSERT INTO ai_wallet_ledger (id, user_id, delta, reason, ref_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&ledger_id)
        .bind(user_id)
        .bind(delta)
        .bind(reason)
        .bind(ref_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(new_balance)
    }

    pub async fn credit_redeem(
        &self,
        user_id: &str,
        tokens: i64,
        ref_id: &str,
    ) -> Result<i64> {
        self.admin_adjust(user_id, tokens, ref_id).await
    }
}
