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
        ai_provider_service::AiProviderService,
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
    providers: AiProviderService,
}

impl AiService {
    pub fn new(
        config: Config,
        settings: SettingsService,
        wallet: WalletService,
        providers: AiProviderService,
    ) -> Self {
        Self {
            config,
            settings,
            wallet,
            providers,
        }
    }

    async fn resolve_billing(&self) -> Result<(String, String, String, BillingSettings)> {
        if let Some(p) = self.providers.active_provider().await? {
            let billing = BillingSettings {
                deepseek_model: p.model.clone(),
                consumption_multiplier: p.consumption_multiplier,
                price_per_1m_input_miss_yuan: p.price_per_1m_input_miss_yuan,
                price_per_1m_input_hit_yuan: p.price_per_1m_input_hit_yuan,
                price_per_1m_output_yuan: p.price_per_1m_output_yuan,
            };
            return Ok((p.api_key, p.base_url, p.model, billing));
        }

        // Fallback to legacy system_settings
        let api_key = self
            .settings
            .deepseek_api_key(&self.config.deepseek_api_key)
            .await?;
        let base_url = self
            .settings
            .deepseek_base_url(&self.config.deepseek_base_url)
            .await?;
        let billing = self.settings.billing_settings().await?;
        let model = billing.deepseek_model.clone();
        Ok((api_key, base_url, model, billing))
    }

    pub async fn chat(&self, user_id: &str, req: AiChatRequest) -> Result<AiChatResponse> {
        if req.messages.is_empty() {
            return Err(AppError::Validation("messages 不能为空".to_string()));
        }

        let (api_key, base_url, model, billing) = self.resolve_billing().await?;

        let balance = self.wallet.balance(user_id).await?;
        if balance <= 0 {
            return Err(AppError::InsufficientBalance);
        }

        let options = completion_options_from_request(&req);
        let result = chat_completion(&api_key, &base_url, &model, req.messages, &options)
            .await
            .map_err(AppError::Internal)?;

        let charge = charge_units_for_call(
            result.usage.prompt_tokens,
            result.usage.completion_tokens,
            result.usage.cached_tokens,
            &billing,
        );
        // 余额不足以支付全部费用时扣光剩余余额，而非一分不扣后直接返回错误，
        // 否则用户保留极小正余额即可反复发起请求白嫖上游成本（denial-of-wallet）。
        let new_balance = charge_billable(&self.wallet, user_id, charge, &billing).await?;

        Ok(to_chat_response(result, new_balance))
    }

    pub async fn chat_stream(&self, user_id: &str, req: AiChatRequest) -> Result<Response> {
        if req.messages.is_empty() {
            return Err(AppError::Validation("messages 不能为空".to_string()));
        }

        let (api_key, base_url, model, billing) = self.resolve_billing().await?;

        let balance = self.wallet.balance(user_id).await?;
        if balance <= 0 {
            return Err(AppError::InsufficientBalance);
        }

        let options = completion_options_from_request(&req);
        let upstream = chat_completion_stream(&api_key, &base_url, &model, req.messages, &options)
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
                        tracing::error!("AI 流式上游读取失败: {}", e);
                        let msg = format!(
                            "data: {}\n\n",
                            serde_json::json!({ "error": { "message": "AI 服务暂时不可用，请稍后重试。" } })
                        );
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
                usage.cached_tokens,
                &billing_clone,
            );

            let new_balance = match charge_billable(&wallet, &user_id, charge, &billing_clone).await {
                Ok(b) => b,
                Err(e) => {
                    // 扣费时发生数据库等异常：记录日志便于对账，不再静默忽略
                    tracing::error!("stream charge failed for user {}: {:?}", user_id, e);
                    wallet.balance(&user_id).await.unwrap_or(balance)
                }
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
    // 余额不足以支付全部费用时，扣光剩余余额（而非一分不扣），
    // 这样用户无法靠“扣费失败被吞掉”反复白嫖；扣到 0 后下次调用会被 balance<=0 拦截。
    let effective = charge.min(balance);
    if effective <= 0 {
        return Ok(balance);
    }
    let job_id = id::generate_id();
    wallet
        .deduct_tokens(user_id, effective, billing, &job_id)
        .await
}

fn completion_options_from_request(req: &AiChatRequest) -> CompletionOptions {
    CompletionOptions {
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        presence_penalty: req.presence_penalty,
        frequency_penalty: req.frequency_penalty,
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
