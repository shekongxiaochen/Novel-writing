use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize)]
pub struct WalletResponse {
    pub balance_yuan: f64,
}

#[derive(Debug, Serialize)]
pub struct LedgerEntryPublic {
    pub id: String,
    pub delta: i64,
    pub reason: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct LedgerResponse {
    pub items: Vec<LedgerEntryPublic>,
}

#[derive(Debug, Deserialize)]
pub struct RedeemRequest {
    pub code: String,
}

#[derive(Debug, Serialize)]
pub struct RedeemResponse {
    pub balance_yuan: f64,
    /// 本次入账金额（元）
    pub credited_yuan: f64,
    pub amount_yuan: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AiChatMessage {
    pub role: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AiChatRequest {
    pub messages: Vec<AiChatMessage>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub stream: Option<bool>,
    #[serde(default)]
    pub tools: Option<Value>,
    #[serde(default)]
    pub tool_choice: Option<Value>,
    #[serde(default)]
    pub response_format: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct AiUsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
}

#[derive(Debug, Serialize)]
pub struct AiChatMessageOut {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AiChatChoice {
    pub message: AiChatMessageOut,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AiChatResponse {
    pub choices: Vec<AiChatChoice>,
    pub usage: AiUsageInfo,
    pub balance_yuan: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}
