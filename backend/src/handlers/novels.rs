use crate::{
    error::Result,
    models::{
        CreateNovelRequest, NovelResponse, SnapshotResponse, UpdateNovelRequest,
        UpdateSnapshotRequest, User,
    },
    services::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize)]
pub struct MessageResponse {
    message: String,
}

/// GET /novels - 获取小说列表
pub async fn list_novels(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<NovelResponse>>> {
    tracing::debug!("Listing novels for user: {}", user.id);
    
    let novels = state.novels.list_novels(&user.id).await?;
    let responses: Vec<NovelResponse> = novels.into_iter().map(|n| n.into()).collect();
    
    Ok(Json(responses))
}

/// POST /novels - 创建小说
pub async fn create_novel(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateNovelRequest>,
) -> Result<(StatusCode, Json<NovelResponse>)> {
    tracing::info!("Creating novel for user {}: {}", user.id, req.title);
    
    let novel = state.novels.create_novel(&user.id, req).await?;
    
    tracing::info!("Novel created: {}", novel.id);
    
    Ok((StatusCode::CREATED, Json(novel.into())))
}

/// GET /novels/:id - 获取小说详情
pub async fn get_novel(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
) -> Result<Json<NovelResponse>> {
    tracing::debug!("Getting novel: {}", novel_id);
    
    let novel = state.novels.get_novel(&novel_id, &user.id).await?;
    
    Ok(Json(novel.into()))
}

/// PUT /novels/:id - 更新小说
pub async fn update_novel(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
    Json(req): Json<UpdateNovelRequest>,
) -> Result<Json<NovelResponse>> {
    tracing::info!("Updating novel: {}", novel_id);
    
    let novel = state.novels.update_novel(&novel_id, &user.id, req).await?;
    
    Ok(Json(novel.into()))
}

/// DELETE /novels/:id - 删除小说
pub async fn delete_novel(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
) -> Result<Json<MessageResponse>> {
    tracing::info!("Deleting novel: {}", novel_id);
    
    state.novels.delete_novel(&novel_id, &user.id).await?;
    
    Ok(Json(MessageResponse {
        message: "作品已删除".to_string(),
    }))
}

/// GET /novels/:id/snapshot - 获取快照
pub async fn get_snapshot(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
) -> Result<Json<SnapshotResponse>> {
    tracing::debug!("Getting snapshot for novel: {}", novel_id);
    
    let snapshot = state.novels.get_snapshot(&novel_id, &user.id).await?;
    
    Ok(Json(SnapshotResponse {
        novel_id: snapshot.novel_id,
        version: snapshot.version,
        payload: snapshot.payload,
        updated_at: snapshot.updated_at,
    }))
}

/// PUT /novels/:id/snapshot - 更新快照
pub async fn update_snapshot(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
    Json(req): Json<UpdateSnapshotRequest>,
) -> Result<Json<SnapshotResponse>> {
    tracing::info!("Updating snapshot for novel: {}", novel_id);

    let snapshot = state.novels.update_snapshot(&novel_id, &user.id, req.payload).await?;

    // 保存成功后，后台异步增量索引章节向量（不阻塞保存返回）。
    // 隔离：update_snapshot 已校验 novel 归属(user_id)，此处仅在已授权的快照上工作。
    {
        let index = state.embedding_index.clone();
        let nid = snapshot.novel_id.clone();
        let payload = snapshot.payload.clone();
        tokio::spawn(async move {
            if let Err(e) = index.sync_novel(&nid, &payload).await {
                tracing::warn!("后台索引向量失败 novel {}: {:?}", nid, e);
            }
        });
    }

    Ok(Json(SnapshotResponse {
        novel_id: snapshot.novel_id,
        version: snapshot.version,
        payload: snapshot.payload,
        updated_at: snapshot.updated_at,
    }))
}

#[derive(serde::Serialize)]
pub struct CharacterStatesResponse {
    states: Vec<crate::services::character_state_service::CharacterStateRow>,
}

#[derive(serde::Deserialize)]
pub struct PutCharacterStatesRequest {
    states: Vec<crate::services::character_state_service::CharacterStateRow>,
}

/// GET /novels/:id/character-states - 拉取角色逐章状态(冷启动/换设备恢复)
pub async fn get_character_states(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
) -> Result<Json<CharacterStatesResponse>> {
    // 隔离:先校验小说归属
    state.novels.get_novel(&novel_id, &user.id).await?;
    let states = state.character_states.list_all(&novel_id).await?;
    Ok(Json(CharacterStatesResponse { states }))
}

/// PUT /novels/:id/character-states - 批量 upsert 角色逐章状态
pub async fn put_character_states(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
    Json(req): Json<PutCharacterStatesRequest>,
) -> Result<Json<MessageResponse>> {
    // 隔离:先校验小说归属
    state.novels.get_novel(&novel_id, &user.id).await?;
    let n = state.character_states.upsert_states(&novel_id, &req.states).await?;
    Ok(Json(MessageResponse {
        message: format!("已保存 {} 条角色状态", n),
    }))
}

#[derive(serde::Serialize)]
pub struct AutoApplyLogResponse {
    logs: Vec<crate::services::auto_apply_log_service::AutoApplyLogRow>,
}

#[derive(serde::Deserialize)]
pub struct PutAutoApplyLogRequest {
    logs: Vec<crate::services::auto_apply_log_service::AutoApplyLogRow>,
}

/// GET /novels/:id/auto-apply-log - 拉取自动入库日志(冷启动/换设备恢复)
pub async fn get_auto_apply_log(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
) -> Result<Json<AutoApplyLogResponse>> {
    state.novels.get_novel(&novel_id, &user.id).await?;
    let logs = state.auto_apply_log.list_all(&novel_id).await?;
    Ok(Json(AutoApplyLogResponse { logs }))
}

/// PUT /novels/:id/auto-apply-log - 批量 upsert 自动入库日志
pub async fn put_auto_apply_log(
    Extension(user): Extension<User>,
    State(state): State<Arc<AppState>>,
    Path(novel_id): Path<String>,
    Json(req): Json<PutAutoApplyLogRequest>,
) -> Result<Json<MessageResponse>> {
    state.novels.get_novel(&novel_id, &user.id).await?;
    let n = state.auto_apply_log.upsert_logs(&novel_id, &req.logs).await?;
    Ok(Json(MessageResponse {
        message: format!("已保存 {} 条自动入库日志", n),
    }))
}
