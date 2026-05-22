use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub novel_id: String,
    pub version: i32,
    pub payload: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSnapshotRequest {
    pub payload: Value,
}

#[derive(Debug, Serialize)]
pub struct SnapshotResponse {
    pub novel_id: String,
    pub version: i32,
    pub payload: Value,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceResponse {
    pub novel_id: String,
    pub snapshot_version: i32,
    pub payload: Value,
    pub updated_at: DateTime<Utc>,
}
