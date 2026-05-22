use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: String,
    pub novel_id: String,
    pub chapter_no: i32,
    pub title: String,
    pub notes: String,
    pub annotation: String,
    pub content: String,
    pub outline_item_ids: Vec<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct CreateChapterRequest {
    pub id: String,
    pub chapter_no: i32,
    pub title: String,
    pub notes: String,
    pub annotation: String,
    pub content: String,
    pub outline_item_ids: Vec<String>,
    pub status: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct UpdateChapterRequest {
    pub chapter_no: Option<i32>,
    pub title: Option<String>,
    pub notes: Option<String>,
    pub annotation: Option<String>,
    pub content: Option<String>,
    pub outline_item_ids: Option<Vec<String>>,
    pub status: Option<String>,
}
