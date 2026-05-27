//! 钱包内部单位：1 unit = 0.0001 元人民币（万分之一元），避免浮点误差。

pub const UNITS_PER_YUAN: i64 = 10_000;

pub fn yuan_to_units(yuan: f64) -> i64 {
    if !yuan.is_finite() || yuan <= 0.0 {
        return 0;
    }
    (yuan * UNITS_PER_YUAN as f64).round() as i64
}

pub fn yuan_i64_to_units(yuan: i64) -> i64 {
    if yuan <= 0 {
        return 0;
    }
    yuan.saturating_mul(UNITS_PER_YUAN)
}

pub fn units_to_yuan(units: i64) -> f64 {
    units as f64 / UNITS_PER_YUAN as f64
}

/// 按 usage 与「元/百万 token」单价计算本次应扣 units（已含倍率，向上取整到 0.0001 元）
/// cached_tokens 为 prompt 中命中缓存的部分，按 cache-hit 价格计费
pub fn charge_units_from_usage(
    prompt_tokens: u32,
    completion_tokens: u32,
    cached_tokens: u32,
    price_per_1m_input_miss_yuan: f64,
    price_per_1m_input_hit_yuan: f64,
    price_per_1m_output_yuan: f64,
    consumption_multiplier: f64,
) -> i64 {
    let cached = cached_tokens.min(prompt_tokens);
    let non_cached = prompt_tokens - cached;
    let cost_yuan = (non_cached as f64 / 1_000_000.0) * price_per_1m_input_miss_yuan.max(0.0)
        + (cached as f64 / 1_000_000.0) * price_per_1m_input_hit_yuan.max(0.0)
        + (completion_tokens as f64 / 1_000_000.0) * price_per_1m_output_yuan.max(0.0);
    if cost_yuan <= 0.0 || !cost_yuan.is_finite() {
        return 0;
    }
    let charged_yuan = cost_yuan * consumption_multiplier.max(0.0);
    if charged_yuan <= 0.0 {
        return 0;
    }
    (charged_yuan * UNITS_PER_YUAN as f64).ceil() as i64
}

/// 将库里旧版「按百万 token 的 micro-yuan」配置转为「元/百万 token」
pub fn normalize_price_per_1m_yuan(stored: f64) -> f64 {
    if !stored.is_finite() || stored <= 0.0 {
        return 1.0;
    }
    if stored >= 50.0 {
        return stored / UNITS_PER_YUAN as f64;
    }
    stored
}
