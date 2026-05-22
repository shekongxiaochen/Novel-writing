use crate::{
    error::Result,
    models::{
        CreateNovelRequest, Novel, NovelResponse, Snapshot, SnapshotResponse,
        UpdateNovelRequest, UpdateSnapshotRequest, User, WorkspaceResponse,
    },
    services::NovelService,
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
    State(novel_service): State<Arc<NovelService>>,
) -> Result<Json<Vec<NovelResponse>>> {
    tracing::debug!("Listing novels for user: {}", user.id);
    
    let novels = novel_service.list_novels(&user.id).await?;
    let responses: Vec<NovelResponse> = novels.into_iter().map(|n| n.into()).collect();
    
    Ok(Json(responses))
}

/// POST /novels - 创建小说
pub async fn create_novel(
    Extension(user): Extension<User>,
    State(novel_service): State<Arc<NovelService>>,
    Json(req): Json<CreateNovelRequest>,
) -> Result<(StatusCode, Json<NovelResponse>)> {
    tracing::info!("Creating novel for user {}: {}", user.id, req.title);
    
    let novel = novel_service.create_novel(&user.id, req).await?;
    
    tracing::info!("Novel created: {}", novel.id);
    
    Ok((StatusCode::CREATED, Json(novel.into())))
}

/// GET /novels/:id - 获取小说详情
pub async fn get_novel(
    Extension(user): Extension<User>,
    State(novel_service): State<Arc<NovelService>>,
    Path(novel_id): Path<String>,
) -> Result<Json<NovelResponse>> {
    tracing::debug!("Getting novel: {}", novel_id);
    
    let novel = novel_service.get_novel(&novel_id, &user.id).await?;
    
    Ok(Json(novel.into()))
}

/// PUT /novels/:id - 更新小说
pub async fn update_novel(
    Extension(user): Extension<User>,
    State(novel_service): State<Arc<NovelService>>,
    Path(novel_id): Path<String>,
    Json(req): Json<UpdateNovelRequest>,
) -> Result<Json<NovelResponse>> {
    tracing::info!("Updating novel: {}", novel_id);
    
    let novel = novel_service.update_novel(&novel_id, &user.id, req).await?;
    
    Ok(Json(novel.into()))
}

/// DELETE /novels/:id - 删除小说
pub async fn delete_novel(
    Extension(user): Extension<User>,
    State(novel_service): State<Arc<NovelService>>,
    Path(novel_id): Path<String>,
) -> Result<Json<MessageResponse>> {
    tracing::info!("Deleting novel: {}", novel_id);
    
    novel_service.delete_novel(&novel_id, &user.id).await?;
    
    Ok(Json(MessageResponse {
        message: "作品已删除".to_string(),
    }))
}

/// GET /novels/:id/snapshot - 获取快照
pub async fn get_snapshot(
    Extension(user): Extension<User>,
    State(novel_service): State<Arc<NovelService>>,
    Path(novel_id): Path<String>,
) -> Result<Json<SnapshotResponse>> {
    tracing::debug!("Getting snapshot for novel: {}", novel_id);
    
    let snapshot = novel_service.get_snapshot(&novel_id, &user.id).await?;
    
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
    State(novel_service): State<Arc<NovelService>>,
    Path(novel_id): Path<String>,
    Json(req): Json<UpdateSnapshotRequest>,
) -> Result<Json<SnapshotResponse>> {
    tracing::info!("Updating snapshot for novel: {}", novel_id);
    
    let snapshot = novel_service.update_snapshot(&novel_id, &user.id, req.payload).await?;
    
    Ok(Json(SnapshotResponse {
        novel_id: snapshot.novel_id,
        version: snapshot.version,
        payload: snapshot.payload,
        updated_at: snapshot.updated_at,
    }))
}
