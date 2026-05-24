-- DeepSeek 密钥/地址改由管理后台 system_settings 配置（.env 仅作首次导入备用）

INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES
    ('deepseek_api_key', '', UTC_TIMESTAMP()),
    ('deepseek_base_url', 'https://api.deepseek.com', UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE setting_value = setting_value;
