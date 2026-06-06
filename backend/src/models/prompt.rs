use serde::Deserialize;

/// POST /ai/prompt 请求体
/// 前端只发送 prompt 类型标识 + 用户提示词，后端组装完整 messages
#[derive(Debug, Deserialize)]
pub struct AiPromptRequest {
    /// 提示词类型标识，如 "continue", "outline_options", "extract" 等
    pub prompt_type: String,
    /// 当前小说 ID（可选）。续写类调用传入后，后端会做语义检索补充相关前文。
    #[serde(default)]
    pub novel_id: Option<String>,
    /// 前端组装好的用户提示词全文（每次调用都会变化的动态内容）
    pub user_prompt: String,
    /// 稳定的作品上下文（角色档案/大纲/作品信息等），同一本书内多次调用基本不变。
    /// 单独作为一条消息置于动态 user_prompt 之前，以命中 DeepSeek 前缀缓存。
    #[serde(default)]
    pub context_prompt: Option<String>,
    /// 用户自定义风格（可选，从 novel 表读取或前端传入）
    #[serde(default)]
    pub ai_style_prompt: Option<String>,
    /// 温度参数
    #[serde(default)]
    pub temperature: Option<f64>,
    /// 最大 token 数
    #[serde(default)]
    pub max_tokens: Option<u32>,
    /// 是否流式输出
    #[serde(default)]
    pub stream: Option<bool>,
    /// 响应格式（"json" 或 null）
    #[serde(default)]
    pub response_format: Option<String>,
    /// 工具定义（仅 qa_tools 类型使用）
    #[serde(default)]
    pub tools: Option<serde_json::Value>,
    /// 工具选择策略
    #[serde(default)]
    pub tool_choice: Option<serde_json::Value>,
}
