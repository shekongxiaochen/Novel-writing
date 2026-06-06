use chrono::Utc;
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::MySqlPool;

use crate::error::Result;
use crate::services::{embedding_provider_service::EmbeddingProviderService, embedding_service};

/// 章节正文切段：超过该字符数则按段落切分，便于检索精确定位。
const MAX_PARA_CHARS: usize = 800;

/// 检索命中的一段旧文。
pub struct RetrievedPara {
    pub chapter_no: i32,
    pub content: String,
    pub score: f32,
}

#[derive(Clone)]
pub struct EmbeddingIndexService {
    db: MySqlPool,
    providers: EmbeddingProviderService,
}

/// 从 snapshot payload 中解析出的单个章节。
struct ChapterInput {
    id: String,
    chapter_no: i32,
    title: String,
    content: String,
}

fn content_hash(text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

impl EmbeddingIndexService {
    pub fn new(db: MySqlPool, providers: EmbeddingProviderService) -> Self {
        Self { db, providers }
    }

    /// 从 payload.chapters 解析章节（只取有正文的）。
    fn parse_chapters(payload: &Value) -> Vec<ChapterInput> {
        let arr = match payload.get("chapters").and_then(|c| c.as_array()) {
            Some(a) => a,
            None => return Vec::new(),
        };
        let mut out = Vec::new();
        for ch in arr {
            let id = ch.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let content = ch.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if id.is_empty() || content.trim().is_empty() {
                continue;
            }
            let chapter_no = ch.get("chapterNo").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let title = ch.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
            out.push(ChapterInput { id, chapter_no, title, content });
        }
        out
    }

    /// 把一章正文切成段落（按空行/长度）。
    fn split_paragraphs(content: &str) -> Vec<String> {
        let mut paras: Vec<String> = Vec::new();
        for block in content.split("\n\n") {
            let block = block.trim();
            if block.is_empty() {
                continue;
            }
            if block.chars().count() <= MAX_PARA_CHARS {
                paras.push(block.to_string());
            } else {
                // 超长段落按字符窗口再切
                let chars: Vec<char> = block.chars().collect();
                let mut i = 0;
                while i < chars.len() {
                    let end = (i + MAX_PARA_CHARS).min(chars.len());
                    paras.push(chars[i..end].iter().collect());
                    i = end;
                }
            }
        }
        paras
    }

    /// 增量同步整本书的章节向量。
    /// 隔离：调用方已校验 novel 归属（user_id）；本方法所有读写均带 novel_id。
    /// 只对「新增」或「正文变化」的章节重转，未变章节跳过（不花钱）。
    pub async fn sync_novel(&self, novel_id: &str, payload: &Value) -> Result<()> {
        let provider = match self.providers.active_provider().await? {
            Some(p) if !p.api_key.is_empty() => p,
            _ => {
                tracing::debug!("无可用向量服务，跳过 novel {} 的向量索引", novel_id);
                return Ok(());
            }
        };

        let chapters = Self::parse_chapters(payload);
        if chapters.is_empty() {
            return Ok(());
        }

        // 当前 payload 里每章的内容哈希
        let mut current: std::collections::HashMap<String, (String, &ChapterInput)> =
            std::collections::HashMap::new();
        for ch in &chapters {
            current.insert(ch.id.clone(), (content_hash(&ch.content), ch));
        }

        // 已入库的章节哈希（按 chapter_id 取一条代表，整章用同一 hash）
        let existing: Vec<(String, String)> = sqlx::query_as(
            "SELECT DISTINCT chapter_id, content_hash FROM chapter_embeddings \
             WHERE novel_id = ? AND source_type = 'chapter_para' AND chapter_id IS NOT NULL",
        )
        .bind(novel_id)
        .fetch_all(&self.db)
        .await?;
        let mut existing_hash: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();
        for (cid, h) in existing {
            existing_hash.insert(cid, h);
        }

        // 删除「已不存在的章节」的向量（章节被删掉的情况）
        let current_ids: std::collections::HashSet<&str> =
            chapters.iter().map(|c| c.id.as_str()).collect();
        for cid in existing_hash.keys() {
            if !current_ids.contains(cid.as_str()) {
                sqlx::query(
                    "DELETE FROM chapter_embeddings WHERE novel_id = ? AND chapter_id = ?",
                )
                .bind(novel_id)
                .bind(cid)
                .execute(&self.db)
                .await?;
            }
        }

        // 逐章：只处理新增/变化的
        for ch in &chapters {
            let new_hash = content_hash(&ch.content);
            if existing_hash.get(&ch.id).map(|h| h == &new_hash).unwrap_or(false) {
                continue; // 未变，跳过
            }
            self.reindex_chapter(novel_id, ch, &new_hash, &provider).await?;
        }

        Ok(())
    }

    /// 重建单章向量：先删旧，再切段转向量入库。
    async fn reindex_chapter(
        &self,
        novel_id: &str,
        ch: &ChapterInput,
        hash: &str,
        provider: &crate::services::embedding_provider_service::EmbeddingProvider,
    ) -> Result<()> {
        let paras = Self::split_paragraphs(&ch.content);
        if paras.is_empty() {
            return Ok(());
        }

        // 转向量（失败则保留旧向量、直接返回，下次保存再试）
        let result = match embedding_service::embed_texts(
            &provider.api_key,
            &provider.base_url,
            &provider.model,
            provider.dimension,
            &paras,
        )
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("章节 {} 转向量失败：{}", ch.id, e);
                return Ok(());
            }
        };

        // 删旧 + 写新，放进事务（隔离：WHERE novel_id 双重限定）
        let mut tx = self.db.begin().await?;
        sqlx::query("DELETE FROM chapter_embeddings WHERE novel_id = ? AND chapter_id = ?")
            .bind(novel_id)
            .bind(&ch.id)
            .execute(&mut *tx)
            .await?;

        let now = Utc::now().naive_utc();
        for (idx, (para, vec)) in paras.iter().zip(result.vectors.iter()).enumerate() {
            let row_id = crate::utils::id::generate_id();
            let embedding_json = serde_json::to_string(vec).unwrap_or_else(|_| "[]".to_string());
            sqlx::query(
                "INSERT INTO chapter_embeddings \
                 (id, novel_id, source_type, source_id, chapter_id, chapter_no, para_index, \
                  content, content_hash, model, dimension, embedding, created_at, updated_at) \
                 VALUES (?, ?, 'chapter_para', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&row_id)
            .bind(novel_id)
            .bind(&ch.id)
            .bind(&ch.id)
            .bind(ch.chapter_no)
            .bind(idx as i32)
            .bind(para)
            .bind(hash)
            .bind(&provider.model)
            .bind(provider.dimension)
            .bind(&embedding_json)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        let _ = &ch.title;
        tracing::info!(
            "已索引章节 {}（第 {} 章），{} 段，{} tokens",
            ch.id,
            ch.chapter_no,
            paras.len(),
            result.total_tokens
        );
        Ok(())
    }

    /// 检索与 query 最相关的旧文段落（语义检索的读取端）。
    /// 隔离：强制 WHERE novel_id = ?；调用方须已校验该 novel 归属当前用户。
    /// 任何失败（无服务/无向量/转向量出错）都返回空 Vec，让调用方安全回退。
    pub async fn search(&self, novel_id: &str, query: &str, top_k: usize) -> Vec<RetrievedPara> {
        if query.trim().is_empty() {
            return Vec::new();
        }
        let provider = match self.providers.active_provider().await {
            Ok(Some(p)) if !p.api_key.is_empty() => p,
            _ => return Vec::new(),
        };

        // 1. query 转向量
        let q = match embedding_service::embed_texts(
            &provider.api_key,
            &provider.base_url,
            &provider.model,
            provider.dimension,
            &[query.to_string()],
        )
        .await
        {
            Ok(r) => match r.vectors.into_iter().next() {
                Some(v) => v,
                None => return Vec::new(),
            },
            Err(e) => {
                tracing::warn!("检索时 query 转向量失败：{}", e);
                return Vec::new();
            }
        };

        // 2. 拉该书所有段落向量（隔离：WHERE novel_id）
        let rows: Vec<(i32, String, String)> = match sqlx::query_as(
            "SELECT chapter_no, content, embedding FROM chapter_embeddings \
             WHERE novel_id = ? AND source_type = 'chapter_para'",
        )
        .bind(novel_id)
        .fetch_all(&self.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("检索读取向量失败：{}", e);
                return Vec::new();
            }
        };
        if rows.is_empty() {
            return Vec::new();
        }

        // 3. 内存算余弦，取 top_k
        let mut scored: Vec<RetrievedPara> = Vec::with_capacity(rows.len());
        for (chapter_no, content, emb_json) in rows {
            let vec: Vec<f32> = match serde_json::from_str(&emb_json) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let score = embedding_service::cosine_similarity(&q, &vec);
            if score > -1.0 {
                scored.push(RetrievedPara { chapter_no, content, score });
            }
        }
        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(top_k);
        scored
    }
}
