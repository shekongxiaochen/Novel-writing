use crate::{
    error::{AppError, Result},
    services::{
        cache_service::CacheService,
        wallet_service::WalletService,
        wallet_units::yuan_i64_to_units,
    },
    utils::{id, time},
};
use rand::Rng;
use sqlx::{MySql, Pool};

const VALID_YUAN: [i32; 6] = [1, 3, 5, 10, 50, 100];

#[derive(Clone)]
pub struct CardKeyService {
    db: Pool<MySql>,
    wallet: WalletService,
    cache: CacheService,
}

pub struct RedeemResult {
    pub balance_units: i64,
    pub credited_units: i64,
    pub amount_yuan: i32,
}

impl CardKeyService {
    pub fn new(db: Pool<MySql>, wallet: WalletService, cache: CacheService) -> Self {
        Self { db, wallet, cache }
    }

    pub fn normalize_code(raw: &str) -> String {
        raw.trim()
            .replace([' ', '-', '_'], "")
            .to_uppercase()
    }

    pub async fn redeem(&self, user_id: &str, code_raw: &str) -> Result<RedeemResult> {
        // 限流：兑换是直接发钱的接口，卡密格式可预测，必须防高速枚举爆破。
        // 按用户维度每分钟最多 RATE_LIMIT 次尝试（无论成败都计数），
        // 与登录/注册的限流策略保持一致，不给爆破留缺口。
        const RATE_LIMIT: i64 = 10;
        let rl_key = format!("redeem_rate:{}", user_id);
        let attempts = self.cache.incr(&rl_key).await?;
        if attempts == 1 {
            self.cache.expire(&rl_key, 60).await?;
        }
        if attempts > RATE_LIMIT {
            return Err(AppError::Validation(
                "兑换过于频繁，请稍后再试".to_string(),
            ));
        }

        let code = Self::normalize_code(code_raw);
        if code.len() < 8 {
            return Err(AppError::Validation("卡密格式无效".to_string()));
        }

        let mut tx = self.db.begin().await?;

        let row: Option<(String, i32, String)> = sqlx::query_as(
            "SELECT id, amount_yuan, status FROM card_keys WHERE code = ? FOR UPDATE",
        )
        .bind(&code)
        .fetch_optional(&mut *tx)
        .await?;

        let (card_id, amount_yuan, status) = row.ok_or_else(|| {
            AppError::Validation("卡密不存在或已失效".to_string())
        })?;

        if status != "unused" {
            return Err(AppError::Validation("该卡密已被使用".to_string()));
        }

        if !VALID_YUAN.contains(&amount_yuan) {
            return Err(AppError::Internal("卡密面额配置异常".to_string()));
        }

        let credited = yuan_i64_to_units(amount_yuan as i64);
        if credited <= 0 {
            return Err(AppError::Validation("卡密面额无效".to_string()));
        }

        self.wallet.ensure_wallet(user_id).await?;

        let balance: (i64,) = sqlx::query_as(
            "SELECT balance_tokens FROM ai_wallets WHERE user_id = ? FOR UPDATE",
        )
        .bind(user_id)
        .fetch_one(&mut *tx)
        .await?;

        let new_balance = balance.0.saturating_add(credited);
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
            VALUES (?, ?, ?, 'redeem', ?, ?)
            "#,
        )
        .bind(&ledger_id)
        .bind(user_id)
        .bind(credited)
        .bind(&card_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE card_keys SET status = 'used', used_by_user_id = ?, used_at = ? WHERE id = ?",
        )
        .bind(user_id)
        .bind(now)
        .bind(&card_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(RedeemResult {
            balance_units: new_balance,
            credited_units: credited,
            amount_yuan,
        })
    }

    /// 管理后台批量生成卡密
    pub async fn generate_batch(
        &self,
        amount_yuan: i32,
        count: u32,
    ) -> Result<Vec<String>> {
        if !VALID_YUAN.contains(&amount_yuan) {
            return Err(AppError::Validation(
                "面额须为 1、3、5、10、50、100 之一".to_string(),
            ));
        }
        let count = count.clamp(1, 200);
        let mut codes = Vec::with_capacity(count as usize);
        let now = time::now_utc();

        for _ in 0..count {
            let mut inserted = false;
            for _attempt in 0..8 {
                let code = format!("NW{:02}{}", amount_yuan, random_card_suffix());
                let id = id::generate_id();
                let result = sqlx::query(
                    r#"
                    INSERT INTO card_keys (id, code, amount_yuan, status, created_at)
                    VALUES (?, ?, ?, 'unused', ?)
                    "#,
                )
                .bind(&id)
                .bind(&code)
                .bind(amount_yuan)
                .bind(now)
                .execute(&self.db)
                .await;
                match result {
                    Ok(_) => {
                        codes.push(code);
                        inserted = true;
                        break;
                    }
                    Err(sqlx::Error::Database(db_err)) if db_err.code() == Some("23000".into()) => {
                        continue;
                    }
                    Err(e) => return Err(e.into()),
                }
            }
            if !inserted {
                return Err(AppError::Internal("生成卡密失败，请重试".to_string()));
            }
        }

        Ok(codes)
    }
}

fn random_card_suffix() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..14)
        .map(|_| {
            let i = rng.gen_range(0..CHARSET.len());
            CHARSET[i] as char
        })
        .collect()
}
