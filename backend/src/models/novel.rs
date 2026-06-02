use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Novel {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub summary: String,
    pub genre: String,
    pub perspective: String,
    pub tone: String,
    pub is_multi_line_narrative: bool,
    pub ai_style_prompt: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNovelRequest {
    pub id: Option<String>,
    pub title: String,
    pub summary: String,
    pub genre: String,
    pub perspective: String,
    pub tone: String,
    pub is_multi_line_narrative: bool,
    pub ai_style_prompt: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNovelRequest {
    pub title: Option<String>,
    pub summary: Option<String>,
    pub genre: Option<String>,
    pub perspective: Option<String>,
    pub tone: Option<String>,
    pub is_multi_line_narrative: Option<bool>,
    pub ai_style_prompt: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NovelResponse {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub genre: String,
    pub perspective: String,
    pub tone: String,
    pub is_multi_line_narrative: bool,
    pub ai_style_prompt: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Novel> for NovelResponse {
    fn from(novel: Novel) -> Self {
        NovelResponse {
            id: novel.id,
            title: novel.title,
            summary: novel.summary,
            genre: novel.genre,
            perspective: novel.perspective,
            tone: novel.tone,
            is_multi_line_narrative: novel.is_multi_line_narrative,
            ai_style_prompt: novel.ai_style_prompt,
            created_at: novel.created_at,
            updated_at: novel.updated_at,
        }
    }
}
