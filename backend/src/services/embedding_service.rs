use serde::{Deserialize, Serialize};

/// 调用 OpenAI 兼容的 embeddings 接口（阿里百炼 text-embedding-v4 等）
/// 单段最长 8192 tokens；一次最多 10 段，超出需分批。
const MAX_BATCH: usize = 10;

#[derive(Debug, Serialize)]
struct EmbeddingRequest<'a> {
    model: &'a str,
    input: Vec<String>,
    dimensions: i32,
    encoding_format: &'a str,
}

#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingItem>,
    #[serde(default)]
    usage: Option<EmbeddingUsage>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingItem {
    embedding: Vec<f32>,
    index: usize,
}

#[derive(Debug, Default, Deserialize)]
pub struct EmbeddingUsage {
    #[serde(default)]
    pub total_tokens: u32,
}

pub struct EmbedResult {
    pub vectors: Vec<Vec<f32>>,
    pub total_tokens: u32,
}

fn embeddings_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    if trimmed.ends_with("/embeddings") {
        trimmed.to_string()
    } else {
        format!("{}/embeddings", trimmed)
    }
}

/// 把一组文本转成向量。自动按 MAX_BATCH 分批，保持输入顺序。
pub async fn embed_texts(
    api_key: &str,
    base_url: &str,
    model: &str,
    dimensions: i32,
    texts: &[String],
) -> Result<EmbedResult, String> {
    if texts.is_empty() {
        return Ok(EmbedResult { vectors: Vec::new(), total_tokens: 0 });
    }
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败：{e}"))?;
    let url = embeddings_url(base_url);
    let mut vectors: Vec<Vec<f32>> = Vec::with_capacity(texts.len());
    let mut total_tokens: u32 = 0;

    for chunk in texts.chunks(MAX_BATCH) {
        let body = EmbeddingRequest {
            model,
            input: chunk.to_vec(),
            dimensions,
            encoding_format: "float",
        };
        let resp = client
            .post(&url)
            .bearer_auth(api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("请求向量服务失败：{}", e))?;

        let status = resp.status();
        let text = resp.text().await.map_err(|e| format!("读取向量响应失败：{}", e))?;
        if !status.is_success() {
            return Err(format!("向量服务返回错误（{}）：{}", status, text));
        }

        let parsed: EmbeddingResponse = serde_json::from_str(&text)
            .map_err(|e| format!("解析向量响应失败：{}（原始：{})", e, text))?;

        // 按 index 对齐，保证顺序与输入一致
        let mut ordered: Vec<Option<Vec<f32>>> = vec![None; chunk.len()];
        for item in parsed.data {
            if item.index < ordered.len() {
                ordered[item.index] = Some(item.embedding);
            }
        }
        for v in ordered {
            vectors.push(v.ok_or_else(|| "向量服务返回缺少部分结果".to_string())?);
        }
        if let Some(u) = parsed.usage {
            total_tokens = total_tokens.saturating_add(u.total_tokens);
        }
    }

    Ok(EmbedResult { vectors, total_tokens })
}

/// 测试向量服务连通性（转一小段文本，不入库）。返回向量维度作为成功凭证。
pub async fn test_connection(
    api_key: &str,
    base_url: &str,
    model: &str,
    dimensions: i32,
) -> Result<String, String> {
    let probe = vec!["连接测试".to_string()];
    let result = embed_texts(api_key, base_url, model, dimensions, &probe).await?;
    match result.vectors.first() {
        Some(v) => Ok(format!("连接成功，返回 {} 维向量", v.len())),
        None => Err("向量服务无返回".to_string()),
    }
}

/// 余弦相似度。两个向量维度不一致时返回 -1（视为不相关）。
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return -1.0;
    }
    let mut dot = 0.0f32;
    let mut na = 0.0f32;
    let mut nb = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if na == 0.0 || nb == 0.0 {
        return -1.0;
    }
    dot / (na.sqrt() * nb.sqrt())
}

/// 从候选向量中取与 query 最相似的 top_k 个，返回 (候选下标, 相似度)，按相似度降序。
pub fn top_k_similar(query: &[f32], candidates: &[Vec<f32>], top_k: usize) -> Vec<(usize, f32)> {
    let mut scored: Vec<(usize, f32)> = candidates
        .iter()
        .enumerate()
        .map(|(i, c)| (i, cosine_similarity(query, c)))
        .filter(|(_, s)| *s > -1.0)
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(top_k);
    scored
}
