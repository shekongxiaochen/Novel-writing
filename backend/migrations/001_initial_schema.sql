-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(120) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 邮箱验证码表
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    purpose VARCHAR(32) NOT NULL DEFAULT 'register',
    code_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_email_codes_email_purpose (email, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 应用登录会话（勿与 axum-admin 的 auth_sessions 同名）
CREATE TABLE IF NOT EXISTS user_sessions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    INDEX idx_user_sessions_token (token),
    INDEX idx_user_sessions_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 登录尝试记录表
CREATE TABLE IF NOT EXISTS login_attempts (
    id VARCHAR(32) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    INDEX idx_login_attempts_email_created (email, created_at),
    INDEX idx_login_attempts_ip_created (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AI订阅表
CREATE TABLE IF NOT EXISTS ai_subscriptions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    plan_code VARCHAR(64) NOT NULL DEFAULT 'ai_monthly',
    billing_cycle VARCHAR(32) NOT NULL DEFAULT 'monthly',
    status VARCHAR(32) NOT NULL DEFAULT 'inactive',
    price_cents INT NOT NULL DEFAULT 2900,
    currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
    payment_provider VARCHAR(32) NOT NULL DEFAULT 'wechat_qr_mock',
    provider_customer_id VARCHAR(128) NOT NULL DEFAULT '',
    started_at DATETIME NULL,
    expires_at DATETIME NULL,
    pending_order_id VARCHAR(32) NULL,
    meta_json JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_ai_subscriptions_user_id (user_id),
    INDEX idx_ai_subscriptions_status_expires (status, expires_at),
    UNIQUE KEY uq_ai_subscription_user_plan (user_id, plan_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 支付订单表
CREATE TABLE IF NOT EXISTS payment_orders (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    subscription_id VARCHAR(32) NULL,
    product_code VARCHAR(64) NOT NULL DEFAULT 'ai_sidebar',
    plan_code VARCHAR(64) NOT NULL DEFAULT 'ai_monthly',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    amount_cents INT NOT NULL DEFAULT 2900,
    currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
    payment_provider VARCHAR(32) NOT NULL DEFAULT 'wechat_qr_mock',
    provider_trade_no VARCHAR(128) NOT NULL DEFAULT '',
    checkout_payload JSON,
    paid_at DATETIME NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_payment_orders_user_status_created (user_id, status, created_at),
    INDEX idx_payment_orders_subscription_created (subscription_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES ai_subscriptions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 小说表
CREATE TABLE IF NOT EXISTS novels (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL,
    title VARCHAR(120) NOT NULL,
    summary TEXT NOT NULL,
    genre VARCHAR(60) NOT NULL DEFAULT '',
    perspective VARCHAR(60) NOT NULL DEFAULT '',
    tone VARCHAR(60) NOT NULL DEFAULT '',
    is_multi_line_narrative BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_novels_user_id (user_id),
    UNIQUE KEY uq_user_novel_title (user_id, title),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 小说快照表
CREATE TABLE IF NOT EXISTS novel_snapshots (
    id VARCHAR(32) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL UNIQUE,
    version INT NOT NULL DEFAULT 1,
    payload JSON NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_novel_snapshots_novel_id (novel_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 章节表
CREATE TABLE IF NOT EXISTS novel_chapters (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    chapter_no INT NOT NULL DEFAULT 1,
    title VARCHAR(120) NOT NULL DEFAULT '',
    notes TEXT NOT NULL,
    annotation TEXT NOT NULL,
    content TEXT NOT NULL,
    outline_item_ids JSON,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_novel_chapters_novel_order (novel_id, chapter_no),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 大纲节点表
CREATE TABLE IF NOT EXISTS outline_items (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    title VARCHAR(160) NOT NULL DEFAULT '',
    summary TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'todo',
    level VARCHAR(32) NOT NULL DEFAULT '',
    goal TEXT NOT NULL,
    conflict TEXT NOT NULL,
    twist TEXT NOT NULL,
    result TEXT NOT NULL,
    suspense TEXT NOT NULL,
    plot_stage VARCHAR(32) NOT NULL DEFAULT '',
    parent_id VARCHAR(64) NULL,
    location VARCHAR(255) NOT NULL DEFAULT '',
    time_label VARCHAR(120) NOT NULL DEFAULT '',
    pov_character_id VARCHAR(64) NULL,
    tension INT NULL,
    character_ids JSON,
    faction_ids JSON,
    foreshadow_ids JSON,
    issue_ids JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_outline_items_novel_order (novel_id, display_order),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    notes TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_categories_novel_name (novel_id, name),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    created_in_chapter_id VARCHAR(64) NULL,
    first_appearance_chapter_no INT NULL,
    age VARCHAR(60) NOT NULL DEFAULT '',
    gender VARCHAR(30) NOT NULL DEFAULT '',
    goal TEXT NOT NULL,
    secret TEXT NOT NULL,
    arc TEXT NOT NULL,
    notes TEXT NOT NULL,
    attributes JSON,
    aliases JSON,
    category_ids JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_characters_novel_name (novel_id, name),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 势力表
CREATE TABLE IF NOT EXISTS factions (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    created_in_chapter_id VARCHAR(64) NULL,
    leader VARCHAR(120) NOT NULL DEFAULT '',
    notes TEXT NOT NULL,
    attributes JSON,
    category_ids JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_factions_novel_name (novel_id, name),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 物品表
CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    summary TEXT NOT NULL,
    owner_type VARCHAR(30) NULL,
    owner_id VARCHAR(64) NULL,
    first_appearance_chapter_no INT NULL,
    attributes JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_items_novel_name (novel_id, name),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 角色关系表
CREATE TABLE IF NOT EXISTS character_relations (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    from_character_id VARCHAR(64) NOT NULL,
    to_character_id VARCHAR(64) NOT NULL,
    relation_type VARCHAR(120) NOT NULL DEFAULT '',
    note TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_character_relations_novel_from_to (novel_id, from_character_id, to_character_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 角色势力归属表
CREATE TABLE IF NOT EXISTS character_faction_memberships (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    character_id VARCHAR(64) NOT NULL,
    faction_id VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_character_faction_memberships_novel_pair (novel_id, character_id, faction_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 时间线事件表
CREATE TABLE IF NOT EXISTS timeline_events (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    story_label VARCHAR(120) NOT NULL DEFAULT '',
    title VARCHAR(160) NOT NULL DEFAULT '',
    summary TEXT NOT NULL,
    chapter_no_start INT NULL,
    chapter_no_end INT NULL,
    outline_item_id VARCHAR(64) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_timeline_events_novel_order (novel_id, display_order),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 伏笔表
CREATE TABLE IF NOT EXISTS foreshadow_plants (
    id VARCHAR(64) PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    title VARCHAR(160) NOT NULL DEFAULT '',
    plant_text TEXT NOT NULL,
    plant_chapter_id VARCHAR(64) NOT NULL DEFAULT '',
    plant_chapter_no INT NOT NULL DEFAULT 0,
    plant_chapter_title VARCHAR(160) NOT NULL DEFAULT '',
    plant_start INT NULL,
    plant_end INT NULL,
    description TEXT NOT NULL,
    expected_fulfill_chapter_no INT NULL,
    expected_fulfill_notes TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_foreshadow_plants_novel_chapter (novel_id, plant_chapter_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 伏笔照应表
CREATE TABLE IF NOT EXISTS foreshadow_fulfillments (
    id VARCHAR(64) PRIMARY KEY,
    plant_id VARCHAR(64) NOT NULL,
    fulfill_text TEXT NOT NULL,
    fulfill_chapter_id VARCHAR(64) NOT NULL DEFAULT '',
    fulfill_chapter_no INT NOT NULL DEFAULT 0,
    fulfill_chapter_title VARCHAR(160) NOT NULL DEFAULT '',
    fulfill_start INT NULL,
    fulfill_end INT NULL,
    notes TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_foreshadow_fulfillments_plant_created (plant_id, created_at),
    FOREIGN KEY (plant_id) REFERENCES foreshadow_plants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
