use std::convert::Infallible;

use axum::body::Body;
use axum::response::Response;
use bytes::Bytes;
use futures_util::StreamExt;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

use crate::{
    config::Config,
    error::{AppError, Result},
    models::billing::{
        AiChatChoice, AiChatMessageOut, AiChatRequest, AiChatResponse, AiUsageInfo,
    },
    services::{
        deepseek_client::{
            self, append_balance_meta_event, chat_completion, chat_completion_stream,
            usage_from_sse_buffer, CompletionOptions,
        },
        settings_service::{charge_units_for_call, BillingSettings, SettingsService},
        wallet_service::WalletService,
        wallet_units::units_to_yuan,
    },
    utils::id,
};

#[derive(Clone)]
pub struct AiService {
    config: Config,
    settings: SettingsService,
    wallet: WalletService,
}

impl AiService {
    pub fn new(config: Config, settings: SettingsService, wallet: WalletService) -> Self {
        Self {
            config,
            settings,
            wallet,
        }
    }

    pub async fn chat(&self, user_id: &str, req: AiChatRequest) -> Result<AiChatResponse> {
        if req.messages.is_empty() {
            return Err(AppError::Validation("messages 不能为空".to_string()));
        }

        let api_key = self
            .settings
            .deepseek_api_key(&self.config.deepseek_api_key)
            .await?;
        let base = self
            .settings
            .deepseek_base_url(&self.config.deepseek_base_url)
            .await?;
        let billing = self.settings.billing_settings().await?;

        let balance = self.wallet.balance(user_id).await?;
        if balance <= 0 {
            return Err(AppError::InsufficientBalance);
        }

        let options = completion_options_from_request(&req);
        let result = chat_completion(
            &api_key,
            &base,
            &billing.deepseek_model,
            req.messages,
            &options,
        )
        .await
        .map_err(AppError::Internal)?;

        let charge = charge_units_for_call(
            result.usage.prompt_tokens,
            result.usage.completion_tokens,
            &billing,
        );
        if charge > balance {
            return Err(AppError::InsufficientBalance);
        }

        let job_id = id::generate_id();
        let new_balance = self
            .wallet
            .deduct_tokens(user_id, charge, &billing, &job_id)
            .await?;

        Ok(to_chat_response(result, new_balance))
    }

    pub async fn chat_stream(&self, user_id: &str, req: AiChatRequest) -> Result<Response> {
        if req.messages.is_empty() {
            return Err(AppError::Validation("messages 不能为空".to_string()));
        }

        let api_key = self
            .settings
            .deepseek_api_key(&self.config.deepseek_api_key)
            .await?;
        let base = self
            .settings
            .deepseek_base_url(&self.config.deepseek_base_url)
            .await?;
        let billing = self.settings.billing_settings().await?;

        let balance = self.wallet.balance(user_id).await?;
        if balance <= 0 {
            return Err(AppError::InsufficientBalance);
        }

        let options = completion_options_from_request(&req);
        let upstream = chat_completion_stream(
            &api_key,
            &base,
            &billing.deepseek_model,
            req.messages,
            &options,
        )
        .await
        .map_err(AppError::Internal)?;

        let user_id = user_id.to_string();
        let wallet = self.wallet.clone();
        let billing_clone = billing.clone();

        let (tx, rx) = mpsc::channel::<std::result::Result<Bytes, Infallible>>(64);

        tokio::spawn(async move {
            let mut upstream = upstream;
            let mut sse_buffer = String::new();
            let mut upstream_ok = true;

            while let Some(chunk) = upstream.next().await {
                match chunk {
                    Ok(bytes) => {
                        if let Ok(text) = std::str::from_utf8(&bytes) {
                            sse_buffer.push_str(text);
                        }
                        if tx.send(Ok(bytes)).await.is_err() {
                            return;
                        }
                    }
                    Err(e) => {
                        upstream_ok = false;
                        let msg = format!("data: {}\n\n", serde_json::json!({ "error": { "message": e } }));
                        let _ = tx.send(Ok(Bytes::from(msg))).await;
                        return;
                    }
                }
            }

            if !upstream_ok {
                return;
            }

            let usage = usage_from_sse_buffer(&sse_buffer);
            let charge = charge_units_for_call(
                usage.prompt_tokens,
                usage.completion_tokens,
                &billing_clone,
            );

            let new_balance = match charge_billable(&wallet, &user_id, charge, &billing_clone).await {
                Ok(b) => b,
                Err(_) => balance,
            };

            let meta = append_balance_meta_event(new_balance);
            let _ = tx.send(Ok(Bytes::from(meta))).await;
        });

        let stream = ReceiverStream::new(rx);
        let body = Body::from_stream(stream);

        Ok(Response::builder()
            .header("Content-Type", "text/event-stream; charset=utf-8")
            .header("Cache-Control", "no-cache")
            .header("Connection", "keep-alive")
            .body(body)
            .unwrap())
    }
}

async fn charge_billable(
    wallet: &WalletService,
    user_id: &str,
    charge: i64,
    billing: &BillingSettings,
) -> Result<i64> {
    if charge <= 0 {
        return wallet.balance(user_id).await;
    }
    let balance = wallet.balance(user_id).await?;
    if balance < charge {
        return Err(AppError::InsufficientBalance);
    }
    let job_id = id::generate_id();
    wallet
        .deduct_tokens(user_id, charge, billing, &job_id)
        .await
}

fn completion_options_from_request(req: &AiChatRequest) -> CompletionOptions {
    CompletionOptions {
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        tools: req.tools.clone(),
        tool_choice: req.tool_choice.clone(),
        response_format: req.response_format.clone(),
    }
}

fn to_chat_response(
    result: deepseek_client::CompletionResult,
    balance_units: i64,
) -> AiChatResponse {
    let choices = result
        .choices
        .into_iter()
        .map(|c| AiChatChoice {
            message: AiChatMessageOut {
                role: c
                    .message
                    .role
                    .unwrap_or_else(|| "assistant".to_string()),
                content: c.message.content,
                tool_calls: c.message.tool_calls,
                reasoning_content: c.message.reasoning_content,
            },
            finish_reason: c.finish_reason,
        })
        .collect();

    AiChatResponse {
        choices,
        usage: AiUsageInfo {
            prompt_tokens: result.usage.prompt_tokens,
            completion_tokens: result.usage.completion_tokens,
        },
        balance_yuan: units_to_yuan(balance_units),
        model: result.model,
    }
}
