use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub novel_id: String,
    pub name: String,
    pub created_in_chapter_id: Option<String>,
    pub first_appearance_chapter_no: Option<i32>,
    pub age: String,
    pub gender: String,
    pub goal: String,
    pub secret: String,
    pub arc: String,
    pub notes: String,
    pub attributes: Vec<String>,
    pub aliases: Vec<String>,
    pub category_ids: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCharacterRequest {
    pub id: String,
    pub name: String,
    pub created_in_chapter_id: Option<String>,
    pub first_appearance_chapter_no: Option<i32>,
    pub age: String,
    pub gender: String,
    pub goal: String,
    pub secret: String,
    pub arc: String,
    pub notes: String,
    pub attributes: Vec<String>,
    pub aliases: Vec<String>,
    pub category_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCharacterRequest {
    pub name: Option<String>,
    pub created_in_chapter_id: Option<String>,
    pub first_appearance_chapter_no: Option<i32>,
    pub age: Option<String>,
    pub gender: Option<String>,
    pub goal: Option<String>,
    pub secret: Option<String>,
    pub arc: Option<String>,
    pub notes: Option<String>,
    pub attributes: Option<Vec<String>>,
    pub aliases: Option<Vec<String>>,
    pub category_ids: Option<Vec<String>>,
}
