use std::pin::Pin;

use crate::models::billing::AiChatMessage;
use bytes::Bytes;
use futures_util::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Default)]
pub struct DeepSeekUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
}

#[derive(Debug, Clone, Default)]
pub struct CompletionOptions {
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub tools: Option<Value>,
    pub tool_choice: Option<Value>,
    pub response_format: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<UsageDto>,
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Choice {
    pub(crate) message: AssistantMessage,
    pub(crate) finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct AssistantMessage {
    pub(crate) role: Option<String>,
    pub(crate) content: Option<String>,
    pub(crate) tool_calls: Option<Value>,
    pub(crate) reasoning_content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsageDto {
    prompt_tokens: u32,
    completion_tokens: u32,
}

#[derive(Debug, Serialize)]
struct StreamOptions {
    include_usage: bool,
}

#[derive(Debug, Serialize)]
struct ChatRequestBody {
    model: String,
    messages: Vec<AiChatMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_choice: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream_options: Option<StreamOptions>,
}

pub struct CompletionResult {
    pub(crate) choices: Vec<Choice>,
    pub usage: DeepSeekUsage,
    pub model: Option<String>,
}

/// 测试 DeepSeek 连通性（极短对话，不扣用户余额）
pub async fn test_connection(api_key: &str, base_url: &str, model: &str) -> Result<String, String> {
    let messages = vec![AiChatMessage {
        role: "user".to_string(),
        content: Some("请只回复 OK".to_string()),
        tool_calls: None,
        tool_call_id: None,
        name: None,
        reasoning_content: None,
    }];
    let opts = CompletionOptions {
        max_tokens: Some(16),
        ..Default::default()
    };
    let result = chat_completion(api_key, base_url, model, messages, &opts).await?;
    let content = result
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default();
    let model_label = result.model.unwrap_or_else(|| model.to_string());
    Ok(format!(
        "连接成功。模型：{}；本次测试用量 {} + {} token；回复：{}",
        model_label,
        result.usage.prompt_tokens,
        result.usage.completion_tokens,
        content.trim()
    ))
}

pub async fn chat_completion(
    api_key: &str,
    base_url: &str,
    model: &str,
    messages: Vec<AiChatMessage>,
    options: &CompletionOptions,
) -> Result<CompletionResult, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("未配置 API 密钥".to_string());
    }
    let url = completions_url(base_url);

    let body = ChatRequestBody {
        model: model.to_string(),
        messages,
        stream: false,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        tools: options.tools.clone(),
        tool_choice: options.tool_choice.clone(),
        response_format: options.response_format.clone(),
        stream_options: None,
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败：{e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败：{e}"))?;

    if !status.is_success() {
        let detail = parse_error_message(&text);
        return Err(format!("API 返回 {}：{}", status.as_u16(), detail));
    }

    let parsed: ChatResponse =
        serde_json::from_str(&text).map_err(|_| "响应 JSON 解析失败".to_string())?;

    let usage = parsed.usage.unwrap_or(UsageDto {
        prompt_tokens: 0,
        completion_tokens: 0,
    });

    Ok(CompletionResult {
        choices: parsed.choices,
        usage: DeepSeekUsage {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
        },
        model: parsed.model,
    })
}

pub type ByteStream = Pin<Box<dyn Stream<Item = Result<Bytes, String>> + Send>>;

pub async fn chat_completion_stream(
    api_key: &str,
    base_url: &str,
    model: &str,
    messages: Vec<AiChatMessage>,
    options: &CompletionOptions,
) -> Result<ByteStream, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("未配置 API 密钥".to_string());
    }
    let url = completions_url(base_url);

    let body = ChatRequestBody {
        model: model.to_string(),
        messages,
        stream: true,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        tools: options.tools.clone(),
        tool_choice: options.tool_choice.clone(),
        response_format: options.response_format.clone(),
        stream_options: Some(StreamOptions { include_usage: true }),
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求失败：{e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp
            .text()
            .await
            .unwrap_or_else(|_| "读取错误响应失败".to_string());
        let detail = parse_error_message(&text);
        return Err(format!("API 返回 {}：{}", status.as_u16(), detail));
    }

    let stream = resp
        .bytes_stream()
        .map(|result| result.map_err(|e| format!("读取流失败：{e}")));
    Ok(Box::pin(stream))
}

pub fn usage_from_sse_buffer(buffer: &str) -> DeepSeekUsage {
    let mut usage = DeepSeekUsage::default();
    for line in buffer.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("data: ") {
            continue;
        }
        let data = trimmed.trim_start_matches("data: ").trim();
        if data.is_empty() || data == "[DONE]" {
            continue;
        }
        if let Ok(parsed) = serde_json::from_str::<Value>(data) {
            if let Some(u) = parsed.get("usage") {
                usage.prompt_tokens = u
                    .get("prompt_tokens")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as u32;
                usage.completion_tokens = u
                    .get("completion_tokens")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as u32;
            }
        }
    }
    usage
}

pub fn append_balance_meta_event(balance_units: i64) -> String {
    let balance_yuan = crate::services::wallet_units::units_to_yuan(balance_units);
    format!(
        "data: {}\n\n",
        json!({ "novel_meta": { "balance_yuan": balance_yuan } })
    )
}

fn completions_url(base_url: &str) -> String {
    format!(
        "{}/chat/completions",
        base_url.trim().trim_end_matches('/')
    )
}

fn parse_error_message(text: &str) -> String {
    #[derive(Deserialize)]
    struct ErrBody {
        error: Option<ErrDetail>,
    }
    #[derive(Deserialize)]
    struct ErrDetail {
        message: Option<String>,
    }
    if let Ok(body) = serde_json::from_str::<ErrBody>(text) {
        if let Some(msg) = body.error.and_then(|e| e.message) {
            return msg;
        }
    }
    if text.len() > 200 {
        format!("{}…", &text[..200])
    } else {
        text.to_string()
    }
}
