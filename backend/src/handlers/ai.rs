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
    if prompt_registry::get_system_prompt(&req.prompt_type).is_none() {
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

    // 3. 构造 messages
    let messages = prompt_registry::build_messages(
        &req.prompt_type,
        &req.user_prompt,
        req.ai_style_prompt.as_deref(),
        req.response_format.as_deref(),
        req.context_prompt.as_deref(),
    )
    .ok_or_else(|| AppError::Validation(format!("无效的 prompt_type: {}", req.prompt_type)))?;

    // 4. 构造 response_format
    let response_format = req.response_format.as_deref().and_then(|f| {
        if f == "json" {
            Some(json!({ "type": "json_object" }))
        } else {
            None
        }
    });

    // 5. 钳制 temperature 和 max_tokens（防止滥用）
    let temperature = req.temperature.map(|t| t.clamp(0.0, 2.0));
    let max_tokens = req.max_tokens.map(|m| m.min(16384));

    // 6. 构造 AiChatRequest 并调用现有 AI 服务
    let chat_req = AiChatRequest {
        messages,
        temperature,
        max_tokens,
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
