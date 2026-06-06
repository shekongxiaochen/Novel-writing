use chrono::{NaiveDateTime, Utc};
use sqlx::MySqlPool;

use crate::error::Result;

/// AI 自动入库操作日志的持久化服务。
/// 归属校验(get_novel)由 handler 层负责;本服务所有 SQL 一律带 novel_id 过滤,作为纵深防御。
#[derive(Clone)]
pub struct AutoApplyLogService {
    db: MySqlPool,
}

/// 一条自动入库日志(对应前端 AutoApplyLogEntry)。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AutoApplyLogRow {
    pub id: String,
    pub chapter_id: String,
    #[serde(default)]
    pub chapter_no: Option<i32>,
    pub module: String,
    pub action: String,
    #[serde(default)]
    pub entity_id: String,
    #[serde(default)]
    pub entity_label: String,
    #[serde(default)]
    pub match_type: String,
    #[serde(default)]
    pub before_snapshot: Option<String>,
    #[serde(default)]
    pub after_summary: Option<String>,
    #[serde(default)]
    pub changed_fields: Option<String>,
    #[serde(default)]
    pub undone: bool,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub undone_at: Option<String>,
}

impl AutoApplyLogService {
    pub fn new(db: MySqlPool) -> Self {
        Self { db }
    }

    /// 批量 upsert(按 id 主键去重)。整体替换前端某 novel 的日志快照。
    pub async fn upsert_logs(&self, novel_id: &str, rows: &[AutoApplyLogRow]) -> Result<u64> {
        if rows.is_empty() {
            return Ok(0);
        }
        let now = Utc::now().naive_utc();
        let mut tx = self.db.begin().await?;
        let mut affected = 0u64;
        for row in rows {
            let created_at = parse_dt(&row.created_at).unwrap_or(now);
            let undone_at = row.undone_at.as_deref().and_then(parse_dt);
            let res = sqlx::query(
                r#"
                INSERT INTO auto_apply_log
                    (id, novel_id, chapter_id, chapter_no, module, action, entity_id,
                     entity_label, match_type, before_snapshot, after_summary, changed_fields,
                     undone, created_at, undone_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    undone = VALUES(undone),
                    undone_at = VALUES(undone_at),
                    entity_label = VALUES(entity_label),
                    after_summary = VALUES(after_summary),
                    changed_fields = VALUES(changed_fields)
                "#,
            )
            .bind(&row.id)
            .bind(novel_id)
            .bind(&row.chapter_id)
            .bind(row.chapter_no)
            .bind(&row.module)
            .bind(&row.action)
            .bind(&row.entity_id)
            .bind(&row.entity_label)
            .bind(&row.match_type)
            .bind(&row.before_snapshot)
            .bind(&row.after_summary)
            .bind(&row.changed_fields)
            .bind(row.undone)
            .bind(created_at)
            .bind(undone_at)
            .execute(&mut *tx)
            .await?;
            affected += res.rows_affected();
        }
        tx.commit().await?;
        Ok(affected)
    }

    /// 拉取一本小说的全部自动入库日志(冷启动/换设备恢复用)。
    pub async fn list_all(&self, novel_id: &str) -> Result<Vec<AutoApplyLogRow>> {
        let rows: Vec<(
            String,
            String,
            Option<i32>,
            String,
            String,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            bool,
            NaiveDateTime,
            Option<NaiveDateTime>,
        )> = sqlx::query_as(
            r#"
            SELECT id, chapter_id, chapter_no, module, action, entity_id, entity_label,
                   match_type, before_snapshot, after_summary, changed_fields,
                   undone, created_at, undone_at
            FROM auto_apply_log
            WHERE novel_id = ?
            ORDER BY created_at
            "#,
        )
        .bind(novel_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| AutoApplyLogRow {
                id: r.0,
                chapter_id: r.1,
                chapter_no: r.2,
                module: r.3,
                action: r.4,
                entity_id: r.5,
                entity_label: r.6,
                match_type: r.7,
                before_snapshot: r.8,
                after_summary: r.9,
                changed_fields: r.10,
                undone: r.11,
                created_at: r.12.and_utc().to_rfc3339(),
                undone_at: r.13.map(|d| d.and_utc().to_rfc3339()),
            })
            .collect())
    }
}

fn parse_dt(s: &str) -> Option<NaiveDateTime> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.naive_utc())
        .ok()
        .or_else(|| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").ok())
}

