use chrono::Utc;
use sqlx::MySqlPool;

use crate::error::Result;

/// 角色逐章叙事状态(角色状态机)的持久化服务。
/// 注意:归属校验(get_novel)由 handler 层负责;本服务所有 SQL 一律带 novel_id 过滤,
/// 作为纵深防御,确保不会跨小说读写。
#[derive(Clone)]
pub struct CharacterStateService {
    db: MySqlPool,
}

/// 一条角色状态记录(对应前端 CharacterChangeEvent 中带 narrativeState 的事件)。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CharacterStateRow {
    pub character_id: String,
    #[serde(default)]
    pub chapter_id: String,
    #[serde(default)]
    pub chapter_no: i32,
    /// CharacterNarrativeState 的 JSON 字符串
    pub state_json: String,
}

impl CharacterStateService {
    pub fn new(db: MySqlPool) -> Self {
        Self { db }
    }

    /// 批量 upsert(按 novel_id+character_id+chapter_no 唯一键去重)。
    pub async fn upsert_states(&self, novel_id: &str, rows: &[CharacterStateRow]) -> Result<u64> {
        if rows.is_empty() {
            return Ok(0);
        }
        let now = Utc::now().naive_utc();
        let mut tx = self.db.begin().await?;
        let mut affected = 0u64;
        for row in rows {
            let id = format!("{}-{}-{}", novel_id, row.character_id, row.chapter_no);
            let res = sqlx::query(
                r#"
                INSERT INTO character_states
                    (id, novel_id, character_id, chapter_id, chapter_no, state_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    chapter_id = VALUES(chapter_id),
                    state_json = VALUES(state_json),
                    updated_at = VALUES(updated_at)
                "#,
            )
            .bind(&id)
            .bind(novel_id)
            .bind(&row.character_id)
            .bind(&row.chapter_id)
            .bind(row.chapter_no)
            .bind(&row.state_json)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;
            affected += res.rows_affected();
        }
        tx.commit().await?;
        Ok(affected)
    }

    /// 拉取一本小说的全部角色状态(冷启动/换设备恢复用)。
    pub async fn list_all(&self, novel_id: &str) -> Result<Vec<CharacterStateRow>> {
        let rows: Vec<(String, String, i32, String)> = sqlx::query_as(
            r#"
            SELECT character_id, chapter_id, chapter_no, state_json
            FROM character_states
            WHERE novel_id = ?
            ORDER BY character_id, chapter_no
            "#,
        )
        .bind(novel_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows
            .into_iter()
            .map(|(character_id, chapter_id, chapter_no, state_json)| CharacterStateRow {
                character_id,
                chapter_id,
                chapter_no,
                state_json,
            })
            .collect())
    }
}
