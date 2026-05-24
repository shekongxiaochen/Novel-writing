-- 本地卡密库（聚发货对接前可先手工/后台生成卡密）
CREATE TABLE IF NOT EXISTS card_keys (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    amount_yuan INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'unused',
    used_by_user_id VARCHAR(36) NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uk_card_keys_code (code),
    INDEX idx_card_keys_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
