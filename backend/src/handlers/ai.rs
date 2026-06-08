use crate::{
    error::{AppError, Result},
    models::billing::{AiChatRequest, AiChatResponse},
    models::prompt::AiPromptRequest,
    services::{prompt_registry, AppState},
    models::User,
};
use axum::{
    extract::State,
    response::{IntoResponse, Response},
    Extension, Json,
};
use serde_json::json;
use std::sync::Arc;

/// POST /ai/chat — 非流式返回 JSON；`stream: true` 时返回 SSE
pub async fn chat(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Json(req): Json<AiChatRequest>,
) -> Result<Response> {
    if req.stream.unwrap_or(false) {
        return state.ai.chat_stream(&user.id, req).await;
    }
    let body: AiChatResponse = state.ai.chat(&user.id, req).await?;
    Ok(Json(body).into_response())
}

/// POST /ai/prompt — 后端组装系统提示词，前端只发 prompt_type + user_prompt
pub async fn prompt_chat(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<User>,
    Json(req): Json<AiPromptRequest>,
) -> Result<Response> {
    // 1. 验证 prompt_type 有效
    if !prompt_registry::is_valid_prompt_type(&req.prompt_type) {
        return Err(AppError::Validation(format!(
            "无效的 prompt_type: {}",
            req.prompt_type
        )));
    }

    // 2. 验证 user_prompt 非空且长度合理（防 denial-of-wallet）
    if req.user_prompt.trim().is_empty() {
        return Err(AppError::Validation("user_prompt 不能为空".to_string()));
    }
    if req.user_prompt.len() > 200_000 {
        return Err(AppError::Validation(
            "user_prompt 超出长度限制（最大 200KB）".to_string(),
        ));
    }
    if let Some(ctx) = req.context_prompt.as_deref() {
        if ctx.len() > 200_000 {
            return Err(AppError::Validation(
                "context_prompt 超出长度限制（最大 200KB）".to_string(),
            ));
        }
    }

    // 3. 语义检索：续写类调用且带 novel_id 时，检索相关旧文拼进上下文（失败则静默跳过）
    let mut effective_context = req.context_prompt.clone();
    if req.prompt_type == "continue" {
        if let Some(nid) = req.novel_id.as_deref() {
            // 隔离：先校验该 novel 归属当前用户，越权直接跳过（不报错、不检索）
            if state.novels.get_novel(nid, &user.id).await.is_ok() {
                let hits = state.embedding_index.search(nid, &req.user_prompt, 5).await;
                if !hits.is_empty() {
                    let mut recap = String::from("【相关前文回顾】（系统按语义自动检索，供保持连贯，勿照抄）\n");
                    for h in &hits {
                        recap.push_str(&format!("- 第{}章：{}\n", h.chapter_no, h.content.trim()));
                    }
                    effective_context = Some(match effective_context {
                        Some(c) if !c.trim().is_empty() => format!("{}\n\n{}", recap, c),
                        _ => recap,
                    });
                    tracing::info!("续写检索命中 {} 段相关前文 (novel {})", hits.len(), nid);
                }
            }
        }
    }

    // 4. 构造 messages（系统提示词支持后台自定义，实时从数据库读取）
    let messages = prompt_registry::build_messages(
        &state.settings,
        &req.prompt_type,
        &req.user_prompt,
        req.ai_style_prompt.as_deref(),
        req.response_format.as_deref(),
        effective_context.as_deref(),
    )
    .await
    .ok_or_else(|| AppError::Validation(format!("无效的 prompt_type: {}", req.prompt_type)))?;

    // 5. 构造 response_format
    let response_format = req.response_format.as_deref().and_then(|f| {
        if f == "json" {
            Some(json!({ "type": "json_object" }))
        } else {
            None
        }
    });

    // 6. 钳制 temperature 和 max_tokens（防止滥用）
    let temperature = req.temperature.map(|t| t.clamp(0.0, 2.0));
    let max_tokens = req.max_tokens.map(|m| m.min(16384));
    // 惩罚项钳制在 DeepSeek 合法区间 [-2.0, 2.0]
    let presence_penalty = req.presence_penalty.map(|p| p.clamp(-2.0, 2.0));
    let frequency_penalty = req.frequency_penalty.map(|p| p.clamp(-2.0, 2.0));

    // 7. 构造 AiChatRequest 并调用现有 AI 服务
    let chat_req = AiChatRequest {
        messages,
        temperature,
        max_tokens,
        presence_penalty,
        frequency_penalty,
        stream: req.stream,
        tools: req.tools,
        tool_choice: req.tool_choice,
        response_format,
    };

    if chat_req.stream.unwrap_or(false) {
        return state.ai.chat_stream(&user.id, chat_req).await;
    }

    let body: AiChatResponse = state.ai.chat(&user.id, chat_req).await?;
    Ok(Json(body).into_response())
}
