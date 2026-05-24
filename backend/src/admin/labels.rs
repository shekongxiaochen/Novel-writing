use axum_admin::{EntityAdmin, Field};

fn label_field(name: &str, label: &str) -> Field {
    let f = match name {
        "email" => Field::email(name),
        "is_active" | "email_verified" | "is_multi_line_narrative" => Field::boolean(name),
        "created_at" | "updated_at" | "paid_at" | "expires_at" => {
            Field::datetime(name).label(label).readonly()
        }
        "amount_cents" => Field::number(name),
        "summary" | "checkout_payload" => Field::textarea(name),
        "password_hash" => Field::password(name),
        "setting_value" => Field::textarea(name),
        _ => Field::text(name),
    };
    f.label(label)
}

/// 为实体表单/列表字段设置中文标签（按字段名覆盖 axum-admin 默认英文标签）。
pub fn apply_field_labels(mut admin: EntityAdmin, labels: &[(&str, &str)]) -> EntityAdmin {
    for (name, label) in labels {
        admin = admin.field(label_field(name, label));
    }
    admin
}

pub const USER_FIELDS: &[(&str, &str)] = &[
    ("id", "ID"),
    ("username", "账号"),
    ("device_id_hash", "设备哈希"),
    ("registration_ip", "注册 IP"),
    ("email", "邮箱（遗留）"),
    ("password_hash", "密码哈希"),
    ("display_name", "昵称"),
    ("is_active", "启用"),
    ("email_verified", "邮箱已验证"),
    ("created_at", "创建时间"),
    ("updated_at", "更新时间"),
];

pub const SYSTEM_SETTING_FIELDS: &[(&str, &str)] = &[
    ("id", "ID"),
    ("setting_key", "配置键（勿改键名，只改值）"),
    ("setting_value", "配置值"),
    ("updated_at", "更新时间"),
];

pub const AI_WALLET_LEDGER_FIELDS: &[(&str, &str)] = &[
    ("id", "ID"),
    ("user_id", "用户 ID"),
    ("delta", "变动数额"),
    ("reason", "类型"),
    ("ref_id", "备注/关联"),
    ("consumption_multiplier_applied", "消耗倍率（审计）"),
    ("created_at", "时间"),
];

pub const NOVEL_FIELDS: &[(&str, &str)] = &[
    ("id", "ID"),
    ("user_id", "用户 ID"),
    ("title", "标题"),
    ("summary", "简介"),
    ("genre", "类型"),
    ("perspective", "视角"),
    ("tone", "基调"),
    ("is_multi_line_narrative", "多线叙事"),
    ("created_at", "创建时间"),
    ("updated_at", "更新时间"),
];

pub const PAYMENT_ORDER_FIELDS: &[(&str, &str)] = &[
    ("id", "ID"),
    ("user_id", "用户 ID"),
    ("subscription_id", "订阅 ID"),
    ("product_code", "商品代码"),
    ("plan_code", "套餐"),
    ("status", "状态"),
    ("amount_cents", "金额（分）"),
    ("currency", "货币"),
    ("payment_provider", "支付渠道"),
    ("provider_trade_no", "第三方单号"),
    ("checkout_payload", "结账数据"),
    ("paid_at", "支付时间"),
    ("expires_at", "过期时间"),
    ("created_at", "创建时间"),
    ("updated_at", "更新时间"),
];
