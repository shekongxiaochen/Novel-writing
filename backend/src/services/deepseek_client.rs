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
    pub cached_tokens: u32,
}

#[derive(Debug, Clone, Default)]
pub struct CompletionOptions {
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    pub presence_penalty: Option<f64>,
    pub frequency_penalty: Option<f64>,
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
    #[serde(default)]
    prompt_tokens_details: Option<PromptTokensDetails>,
}

#[derive(Debug, Deserialize)]
struct PromptTokensDetails {
    #[serde(default)]
    cached_tokens: u32,
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
    presence_penalty: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    frequency_penalty: Option<f64>,
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
        presence_penalty: options.presence_penalty,
        frequency_penalty: options.frequency_penalty,
        tools: options.tools.clone(),
        tool_choice: options.tool_choice.clone(),
        response_format: options.response_format.clone(),
        stream_options: None,
    };

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败：{e}"))?;
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
        prompt_tokens_details: None,
    });

    let cached_tokens = usage
        .prompt_tokens_details
        .as_ref()
        .map(|d| d.cached_tokens)
        .unwrap_or(0);

    Ok(CompletionResult {
        choices: parsed.choices,
        usage: DeepSeekUsage {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            cached_tokens,
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
        presence_penalty: options.presence_penalty,
        frequency_penalty: options.frequency_penalty,
        tools: options.tools.clone(),
        tool_choice: options.tool_choice.clone(),
        response_format: options.response_format.clone(),
        stream_options: Some(StreamOptions { include_usage: true }),
    };

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败：{e}"))?;
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
                usage.cached_tokens = u
                    .get("prompt_tokens_details")
                    .and_then(|d| d.get("cached_tokens"))
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

/// 查询提供商账户余额（兼容 DeepSeek /user/balance 接口）
pub async fn check_balance(api_key: &str, base_url: &str) -> Result<BalanceInfo, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("未配置 API 密钥".to_string());
    }
    // /user/balance 不带 /v1 前缀
    let base = base_url.trim().trim_end_matches('/');
    let url = if base.ends_with("/v1") {
        format!("{}/user/balance", &base[..base.len() - 3])
    } else {
        format!("{}/user/balance", base)
    };

    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败：{e}"))?;
    let resp = client
        .get(&url)
        .bearer_auth(key)
        .send()
        .await
        .map_err(|e| format!("网络请求失败：{e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取响应失败：{e}"))?;

    if !status.is_success() {
        if status.as_u16() == 404 {
            return Err("该提供商不支持余额查询".to_string());
        }
        let detail = parse_error_message(&text);
        return Err(format!("API 返回 {}：{}", status.as_u16(), detail));
    }

    let parsed: Value =
        serde_json::from_str(&text).map_err(|_| format!("余额响应解析失败: {}", &text[..text.len().min(200)]))?;

    let is_available = parsed
        .get("is_available")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    // DeepSeek 格式: { "balance_infos": [{ "currency": "CNY", "total_balance": "2.73" }] }
    // 通用格式: { "balance": "10.50", "currency": "CNY" }
    let (balance, currency) = if let Some(infos) = parsed.get("balance_infos").and_then(|v| v.as_array()) {
        let first = infos.first();
        let bal = first
            .and_then(|i| i.get("total_balance"))
            .and_then(|v| v.as_str())
            .unwrap_or("0")
            .to_string();
        let cur = first
            .and_then(|i| i.get("currency"))
            .and_then(|v| v.as_str())
            .unwrap_or("CNY")
            .to_string();
        (bal, cur)
    } else {
        let bal = parsed
            .get("balance")
            .and_then(|v| v.as_str())
            .or_else(|| parsed.get("balance").and_then(|v| v.as_f64()).map(|_| ""))
            .unwrap_or("0")
            .to_string();
        // 如果 balance 是数字，转成字符串
        let bal = if bal.is_empty() {
            parsed
                .get("balance")
                .and_then(|v| v.as_f64())
                .map(|f| format!("{:.2}", f))
                .unwrap_or_else(|| "0".to_string())
        } else {
            bal
        };
        let cur = parsed
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("CNY")
            .to_string();
        (bal, cur)
    };

    Ok(BalanceInfo {
        balance,
        currency,
        is_available,
    })
}

#[derive(Debug, Serialize)]
pub struct BalanceInfo {
    pub balance: String,
    pub currency: String,
    pub is_available: bool,
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
