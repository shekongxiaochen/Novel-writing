use crate::{
    error::{AppError, Result},
    models::User,
    services::AppState,
};
use axum::{extract::{Query, State}, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;

/// 前端生图请求：只发提示词与可选参考图，厂商/Key 由后端按激活的 provider 注入
#[derive(Debug, Deserialize)]
pub struct GenImageRequest {
    pub prompt: String,
    /// 输出尺寸，如 "1024x768"；缺省用 1024x1024
    #[serde(default)]
    pub size: Option<String>,
    /// 图生图参考图（公网 URL 或 data URI），用于锁定角色/风格一致性
    #[serde(default)]
    pub image: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct GenImageResponse {
    pub url: String,
}

/// POST /comic/gen-image
/// 后端代调激活的生图 provider（如 Agnes），前端不接触厂商 URL / Key。
pub async fn gen_image(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<User>,
    Json(req): Json<GenImageRequest>,
) -> Result<impl IntoResponse> {
    let prompt = req.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err(AppError::Validation("提示词不能为空".to_string()));
    }

    let provider = state
        .image_providers
        .active_provider()
        .await?
        .ok_or_else(|| AppError::Validation("未配置生图服务，请在后台「生图配置」中添加并激活".to_string()))?;
    if provider.api_key.is_empty() {
        return Err(AppError::Validation("生图服务未配置 API 密钥".to_string()));
    }

    let size = req.size.clone().unwrap_or_else(|| "1024x1024".to_string());

    // 组装 Agnes 兼容请求体；response_format 与 image 必须放进 extra_body
    let mut extra_body = json!({ "response_format": "url" });
    if !req.image.is_empty() {
        extra_body["image"] = json!(req.image);
    }
    let body = json!({
        "model": provider.model,
        "prompt": prompt,
        "size": size,
        "extra_body": extra_body,
    });

    let url = format!("{}/images/generations", provider.base_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(360))
        .build()
        .map_err(|e| AppError::Internal(format!("构建 HTTP 客户端失败: {e}")))?;

    let resp = client
        .post(&url)
        .bearer_auth(&provider.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("生图请求失败: {e}")))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| AppError::Internal(format!("读取生图响应失败: {e}")))?;
    if !status.is_success() {
        return Err(AppError::Internal(format!(
            "生图服务返回错误（{}）: {}",
            status.as_u16(),
            text.chars().take(300).collect::<String>()
        )));
    }

    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| AppError::Internal(format!("解析生图响应失败: {e}")))?;
    let image_url = parsed
        .get("data")
        .and_then(|d| d.get(0))
        .and_then(|item| item.get("url"))
        .and_then(|u| u.as_str())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Internal("生图响应中没有图片 URL".to_string()))?;

    Ok(Json(GenImageResponse {
        url: image_url.to_string(),
    }))
}

// ── 视频 ──

#[derive(Debug, Deserialize)]
pub struct GenVideoRequest {
    pub prompt: String,
    /// 图生视频：参考图（如关键帧）
    #[serde(default)]
    pub image: Vec<String>,
    /// 视频秒数，默认 5；根据 frame_rate=24 反算 num_frames
    #[serde(default)]
    pub seconds: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct GenVideoResponse {
    pub video_id: String,
}

/// POST /comic/gen-video
pub async fn gen_video(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<User>,
    Json(req): Json<GenVideoRequest>,
) -> Result<impl IntoResponse> {
    let prompt = req.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err(AppError::Validation("提示词不能为空".to_string()));
    }

    let provider = state.video_providers.active_provider().await?
        .ok_or_else(|| AppError::Validation("未配置视频服务，请在后台「视频配置」中添加并激活".to_string()))?;
    if provider.api_key.is_empty() {
        return Err(AppError::Validation("视频服务未配置 API 密钥".to_string()));
    }

    let seconds = req.seconds.unwrap_or(5.0).clamp(2.0, 20.0);
    let raw_frames = (seconds * 24.0).round() as i32;
    // num_frames 必须 ≤ 441 且满足 8n+1
    let num_frames = ((raw_frames.min(441) - 1) / 8).max(0) * 8 + 1;
    let mut body = json!({
        "model": "agnes-video-v2.0",
        "prompt": prompt,
        "num_frames": num_frames.max(9),
        "frame_rate": 24,
    });
    if !req.image.is_empty() {
        body["image"] = json!(req.image[0]);
    }

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::Internal(format!("构建 HTTP 客户端失败: {e}")))?;

    let url = format!("{}/v1/videos", provider.base_url.trim_end_matches('/'));
    let resp = client.post(&url).bearer_auth(&provider.api_key).json(&body).send().await
        .map_err(|e| AppError::Internal(format!("创建视频任务失败: {e}")))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| AppError::Internal(format!("读取响应失败: {e}")))?;
    tracing::debug!("Video API response status={} body_preview={}", status.as_u16(), &text[..text.len().min(500)]);
    if !status.is_success() {
        return Err(AppError::Internal(format!("视频服务错误({}): {}", status.as_u16(), text.chars().take(500).collect::<String>())));
    }

    let parsed: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => {
            return Err(AppError::Internal(format!(
                "视频响应 JSON 解析失败({}): body_preview={}",
                e,
                &text[..text.len().min(400)]
            )));
        }
    };
    let video_id = parsed.get("video_id").and_then(|v| v.as_str()).filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Internal("视频响应中没有 video_id".to_string()))?;

    Ok(Json(GenVideoResponse { video_id: video_id.to_string() }))
}

#[derive(Debug, Deserialize)]
pub struct VideoStatusQuery {
    pub video_id: String,
}

#[derive(Debug, Serialize)]
pub struct VideoStatusResponse {
    pub status: String,
    pub url: Option<String>,
}

/// GET /comic/video-status?video_id=xxx
pub async fn video_status(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<User>,
    Query(q): Query<VideoStatusQuery>,
) -> Result<impl IntoResponse> {
    let provider = state.video_providers.active_provider().await?
        .ok_or_else(|| AppError::Validation("未配置视频服务".to_string()))?;

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| AppError::Internal(format!("构建客户端失败: {e}")))?;

    let url = format!("{}/agnesapi?video_id={}", provider.base_url.trim_end_matches('/'), q.video_id);
    let resp = client.get(&url).bearer_auth(&provider.api_key).send().await
        .map_err(|e| AppError::Internal(format!("查询视频状态失败: {e}")))?;
    let text = resp.text().await.map_err(|e| AppError::Internal(format!("读取响应失败: {e}")))?;
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| AppError::Internal(format!("解析响应失败: {e}")))?;
    let status = parsed.get("status").and_then(|s| s.as_str()).unwrap_or("unknown").to_string();
    let video_url = if status == "completed" {
        parsed.get("remixed_from_video_id").and_then(|u| u.as_str()).map(String::from)
    } else {
        None
    };

    Ok(Json(VideoStatusResponse { status, url: video_url }))
}
