use crate::{
    error::{AppError, Result},
    models::{CreateNovelRequest, Novel, Snapshot, UpdateNovelRequest},
    services::CacheService,
    utils::{id, time},
};
use chrono::DateTime;
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{MySql, Pool};

#[derive(Clone)]
pub struct NovelService {
    db: Pool<MySql>,
    cache: CacheService,
}

impl NovelService {
    pub fn new(db: Pool<MySql>, cache: CacheService) -> Self {
        Self { db, cache }
    }
    
    /// 创建小说
    pub async fn create_novel(&self, user_id: &str, req: CreateNovelRequest) -> Result<Novel> {
        // 1. 生成或验证ID
        let novel_id = req.id.unwrap_or_else(|| id::generate_id());
        
        // 2. 检查ID是否已存在
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM novels WHERE id = ?"
        )
        .bind(&novel_id)
        .fetch_optional(&self.db)
        .await?;
        
        if existing.is_some() {
            return Err(AppError::Conflict("作品 id 已存在".to_string()));
        }
        
        // 3. 检查标题唯一性
        let title_exists: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM novels WHERE user_id = ? AND title = ?"
        )
        .bind(user_id)
        .bind(&req.title)
        .fetch_optional(&self.db)
        .await?;
        
        if title_exists.is_some() {
            return Err(AppError::Conflict("作品标题已存在".to_string()));
        }
        
        // 4. 创建小说记录
        let now = time::now_utc();
        
        sqlx::query(
            r#"
            INSERT INTO novels (id, user_id, title, summary, genre, perspective, tone, is_multi_line_narrative, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&novel_id)
        .bind(user_id)
        .bind(&req.title)
        .bind(&req.summary)
        .bind(&req.genre)
        .bind(&req.perspective)
        .bind(&req.tone)
        .bind(req.is_multi_line_narrative)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;
        
        // 5. 创建默认快照
        let snapshot_id = id::generate_id();
        let default_payload = self.default_snapshot_payload();
        
        sqlx::query(
            r#"
            INSERT INTO novel_snapshots (id, novel_id, version, payload, created_at, updated_at)
            VALUES (?, ?, 1, ?, ?, ?)
            "#
        )
        .bind(&snapshot_id)
        .bind(&novel_id)
        .bind(&default_payload)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;
        
        Ok(Novel {
            id: novel_id,
            user_id: user_id.to_string(),
            title: req.title,
            summary: req.summary,
            genre: req.genre,
            perspective: req.perspective,
            tone: req.tone,
            is_multi_line_narrative: req.is_multi_line_narrative,
            created_at: now,
            updated_at: now,
        })
    }
    
    /// 获取小说列表
    pub async fn list_novels(&self, user_id: &str) -> Result<Vec<Novel>> {
        let novels: Vec<(String, String, String, String, String, String, String, bool, DateTime<Utc>, DateTime<Utc>)> = sqlx::query_as(
            r#"
            SELECT id, user_id, title, summary, genre, perspective, tone, is_multi_line_narrative, created_at, updated_at
            FROM novels
            WHERE user_id = ?
            ORDER BY updated_at DESC
            "#
        )
        .bind(user_id)
        .fetch_all(&self.db)
        .await?;
        
        Ok(novels.into_iter().map(|(id, user_id, title, summary, genre, perspective, tone, is_multi_line_narrative, created_at, updated_at)| {
            Novel {
                id,
                user_id,
                title,
                summary,
                genre,
                perspective,
                tone,
                is_multi_line_narrative,
                created_at,
                updated_at,
            }
        }).collect())
    }
    
    /// 获取单个小说（带缓存）
    pub async fn get_novel(&self, novel_id: &str, user_id: &str) -> Result<Novel> {
        // 1. 先从缓存获取
        let cache_key = format!("novel:{}", novel_id);
        if let Some(novel) = self.cache.get::<Novel>(&cache_key).await? {
            // 验证所有权
            if novel.user_id != user_id {
                return Err(AppError::NotFound);
            }
            return Ok(novel);
        }
        
        // 2. 从数据库查询
        let novel: Option<(String, String, String, String, String, String, String, bool, DateTime<Utc>, DateTime<Utc>)> = sqlx::query_as(
            r#"
            SELECT id, user_id, title, summary, genre, perspective, tone, is_multi_line_narrative, created_at, updated_at
            FROM novels
            WHERE id = ? AND user_id = ?
            "#
        )
        .bind(novel_id)
        .bind(user_id)
        .fetch_optional(&self.db)
        .await?;
        
        let novel = novel.ok_or(AppError::NotFound)?;
        
        let novel = Novel {
            id: novel.0,
            user_id: novel.1,
            title: novel.2,
            summary: novel.3,
            genre: novel.4,
            perspective: novel.5,
            tone: novel.6,
            is_multi_line_narrative: novel.7,
            created_at: novel.8,
            updated_at: novel.9,
        };
        
        // 3. 写入缓存（10分钟）
        self.cache.set(&cache_key, &novel, 600).await?;
        
        Ok(novel)
    }
    
    /// 更新小说
    pub async fn update_novel(&self, novel_id: &str, user_id: &str, req: UpdateNovelRequest) -> Result<Novel> {
        // 1. 验证所有权
        self.get_novel(novel_id, user_id).await?;
        
        // 2. 构建更新语句
        let mut updates = Vec::new();
        let mut params: Vec<String> = Vec::new();
        
        if let Some(title) = req.title {
            updates.push("title = ?");
            params.push(title);
        }
        if let Some(summary) = req.summary {
            updates.push("summary = ?");
            params.push(summary);
        }
        if let Some(genre) = req.genre {
            updates.push("genre = ?");
            params.push(genre);
        }
        if let Some(perspective) = req.perspective {
            updates.push("perspective = ?");
            params.push(perspective);
        }
        if let Some(tone) = req.tone {
            updates.push("tone = ?");
            params.push(tone);
        }
        
        if updates.is_empty() && req.is_multi_line_narrative.is_none() {
            return self.get_novel(novel_id, user_id).await;
        }
        
        // 3. 执行更新
        let now = time::now_utc();
        
        if !updates.is_empty() {
            let sql = format!(
                "UPDATE novels SET {}, updated_at = ? WHERE id = ?",
                updates.join(", ")
            );
            
            let mut query = sqlx::query(&sql);
            for param in params {
                query = query.bind(param);
            }
            query = query.bind(now).bind(novel_id);
            
            query.execute(&self.db).await?;
        }
        
        if let Some(is_multi_line_narrative) = req.is_multi_line_narrative {
            sqlx::query("UPDATE novels SET is_multi_line_narrative = ?, updated_at = ? WHERE id = ?")
                .bind(is_multi_line_narrative)
                .bind(now)
                .bind(novel_id)
                .execute(&self.db)
                .await?;
        }
        
        // 4. 失效缓存
        let cache_key = format!("novel:{}", novel_id);
        self.cache.delete(&cache_key).await?;
        
        // 5. 返回更新后的数据
        self.get_novel(novel_id, user_id).await
    }
    
    /// 删除小说
    pub async fn delete_novel(&self, novel_id: &str, user_id: &str) -> Result<()> {
        // 1. 验证所有权
        self.get_novel(novel_id, user_id).await?;
        
        // 2. 删除小说（级联删除会自动删除相关数据）
        sqlx::query("DELETE FROM novels WHERE id = ?")
            .bind(novel_id)
            .execute(&self.db)
            .await?;
        
        // 3. 失效缓存
        self.cache.delete_pattern(&format!("novel:{}*", novel_id)).await?;
        
        Ok(())
    }
    
    /// 获取快照
    pub async fn get_snapshot(&self, novel_id: &str, user_id: &str) -> Result<Snapshot> {
        // 1. 验证所有权
        self.get_novel(novel_id, user_id).await?;
        
        // 2. 查询快照
        let snapshot: Option<(String, String, i32, Value, DateTime<Utc>, DateTime<Utc>)> = sqlx::query_as(
            "SELECT id, novel_id, version, payload, created_at, updated_at FROM novel_snapshots WHERE novel_id = ?"
        )
        .bind(novel_id)
        .fetch_optional(&self.db)
        .await?;
        
        if let Some((id, novel_id, version, payload, created_at, updated_at)) = snapshot {
            return Ok(Snapshot {
                id,
                novel_id,
                version,
                payload,
                created_at,
                updated_at,
            });
        }
        
        // 3. 如果不存在，创建默认快照
        let snapshot_id = id::generate_id();
        let now = time::now_utc();
        let default_payload = self.default_snapshot_payload();
        
        sqlx::query(
            r#"
            INSERT INTO novel_snapshots (id, novel_id, version, payload, created_at, updated_at)
            VALUES (?, ?, 1, ?, ?, ?)
            "#
        )
        .bind(&snapshot_id)
        .bind(novel_id)
        .bind(&default_payload)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await?;
        
        Ok(Snapshot {
            id: snapshot_id,
            novel_id: novel_id.to_string(),
            version: 1,
            payload: default_payload,
            created_at: now,
            updated_at: now,
        })
    }
    
    /// 更新快照（优化版 - 增量更新）
    pub async fn update_snapshot(&self, novel_id: &str, user_id: &str, payload: Value) -> Result<Snapshot> {
        // 1. 验证所有权
        self.get_novel(novel_id, user_id).await?;
        
        // 2. 开启事务
        let mut tx = self.db.begin().await?;
        
        // 3. 获取当前快照
        let current: Option<(String, i32)> = sqlx::query_as(
            "SELECT id, version FROM novel_snapshots WHERE novel_id = ?"
        )
        .bind(novel_id)
        .fetch_optional(&mut *tx)
        .await?;
        
        let now = time::now_utc();
        
        if let Some((snapshot_id, version)) = current {
            // 更新现有快照
            sqlx::query(
                "UPDATE novel_snapshots SET payload = ?, version = version + 1, updated_at = ? WHERE id = ?"
            )
            .bind(&payload)
            .bind(now)
            .bind(&snapshot_id)
            .execute(&mut *tx)
            .await?;
            
            // TODO: 实现增量同步到工作区表（这里先简化处理）
            // 实际生产环境应该对比新旧payload，只更新变化的记录
            
            tx.commit().await?;
            
            Ok(Snapshot {
                id: snapshot_id,
                novel_id: novel_id.to_string(),
                version: version + 1,
                payload,
                created_at: now,
                updated_at: now,
            })
        } else {
            // 创建新快照
            let snapshot_id = id::generate_id();
            
            sqlx::query(
                r#"
                INSERT INTO novel_snapshots (id, novel_id, version, payload, created_at, updated_at)
                VALUES (?, ?, 1, ?, ?, ?)
                "#
            )
            .bind(&snapshot_id)
            .bind(novel_id)
            .bind(&payload)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;
            
            tx.commit().await?;
            
            Ok(Snapshot {
                id: snapshot_id,
                novel_id: novel_id.to_string(),
                version: 1,
                payload,
                created_at: now,
                updated_at: now,
            })
        }
    }
    
    /// 默认快照payload
    fn default_snapshot_payload(&self) -> Value {
        json!({
            "chapters": [],
            "outline": [],
            "characters": [],
            "characterRelations": [],
            "factions": [],
            "items": [],
            "characterFactionMemberships": [],
            "categories": [],
            "timelineEvents": [],
            "foreshadows": []
        })
    }
}
