use crate::{
    error::Result,
    models::billing::{AiChatRequest, AiChatResponse},
    services::AppState,
    models::User,
};
use axum::{
    extract::State,
    response::{IntoResponse, Response},
    Extension, Json,
};
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
