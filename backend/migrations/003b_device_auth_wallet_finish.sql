-- 补全 003（若 003 在 DROP INDEX email 处中断）

-- 邮箱唯一索引在本库名为 ix_users_email，非 email
ALTER TABLE users DROP INDEX ix_users_email;
ALTER TABLE users MODIFY email VARCHAR(255) NULL;

ALTER TABLE login_attempts
    ADD COLUMN username VARCHAR(64) NOT NULL DEFAULT '' AFTER id;

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES
    ('tokens_per_yuan_base', '10000', UTC_TIMESTAMP()),
    ('consumption_multiplier', '1.0', UTC_TIMESTAMP()),
    ('deepseek_model', 'deepseek-chat', UTC_TIMESTAMP()),
    ('price_per_1m_input_tokens', '1000', UTC_TIMESTAMP()),
    ('price_per_1m_output_tokens', '2000', UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE setting_value = setting_value;

CREATE TABLE IF NOT EXISTS ai_wallets (
    user_id VARCHAR(32) PRIMARY KEY,
    balance_tokens BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE users SET username = CONCAT('legacy_', id) WHERE username IS NULL;
ALTER TABLE users MODIFY username VARCHAR(64) NOT NULL;

CREATE TABLE IF NOT EXISTS ai_wallet_ledger (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    delta BIGINT NOT NULL,
    reason VARCHAR(32) NOT NULL,
    ref_id VARCHAR(64) NOT NULL DEFAULT '',
    consumption_multiplier_applied DECIMAL(10, 4) NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_ai_wallet_ledger_user_created (user_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
