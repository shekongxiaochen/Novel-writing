CREATE TABLE IF NOT EXISTS video_providers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    base_url VARCHAR(512) NOT NULL,
    api_key VARCHAR(512) NOT NULL,
    model VARCHAR(128) NOT NULL,
    price_per_second_yuan DOUBLE NOT NULL DEFAULT 0.005,
    consumption_multiplier DOUBLE NOT NULL DEFAULT 1.0,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_video_providers_name (name),
    INDEX idx_video_providers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
