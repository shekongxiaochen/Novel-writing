CREATE TABLE IF NOT EXISTS ai_providers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    base_url VARCHAR(512) NOT NULL,
    api_key VARCHAR(512) NOT NULL,
    model VARCHAR(128) NOT NULL,
    price_per_1m_input_yuan DOUBLE NOT NULL DEFAULT 1.0,
    price_per_1m_output_yuan DOUBLE NOT NULL DEFAULT 2.0,
    consumption_multiplier DOUBLE NOT NULL DEFAULT 1.0,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_ai_providers_name (name),
    INDEX idx_ai_providers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing DeepSeek config from system_settings as the first provider
INSERT INTO ai_providers (id, name, base_url, api_key, model, price_per_1m_input_yuan, price_per_1m_output_yuan, consumption_multiplier, is_active, created_at, updated_at)
SELECT
    'migrated-deepseek',
    'DeepSeek (migrated)',
    COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = 'deepseek_base_url' LIMIT 1), 'https://api.deepseek.com'),
    COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = 'deepseek_api_key' LIMIT 1), ''),
    COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = 'deepseek_model' LIMIT 1), 'deepseek-chat'),
    COALESCE(CAST((SELECT setting_value FROM system_settings WHERE setting_key = 'price_per_1m_input_tokens' LIMIT 1) AS DOUBLE), 1.0),
    COALESCE(CAST((SELECT setting_value FROM system_settings WHERE setting_key = 'price_per_1m_output_tokens' LIMIT 1) AS DOUBLE), 2.0),
    COALESCE(CAST((SELECT setting_value FROM system_settings WHERE setting_key = 'consumption_multiplier' LIMIT 1) AS DOUBLE), 1.0),
    1,
    NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'deepseek_api_key')
AND NOT EXISTS (SELECT 1 FROM ai_providers LIMIT 1);
