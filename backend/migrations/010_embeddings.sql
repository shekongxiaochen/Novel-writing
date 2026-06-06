-- 语义检索（embedding）改造：向量服务配置表 + 章节/设定向量表
-- 隔离规则严格照抄现有业务表：挂 novel_id + 外键 CASCADE，检索强制按 novel_id 过滤。

-- 向量服务提供商配置表（后台「向量服务」菜单管理，照抄 ai_providers 风格）
-- 注意：embedding 只有输入计费、无输出价；额外有 dimension（向量维度）字段。
CREATE TABLE IF NOT EXISTS embedding_providers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    base_url VARCHAR(512) NOT NULL,
    api_key VARCHAR(512) NOT NULL,
    model VARCHAR(128) NOT NULL,
    dimension INT NOT NULL DEFAULT 1024,
    price_per_1m_input_yuan DOUBLE NOT NULL DEFAULT 0.5,
    consumption_multiplier DOUBLE NOT NULL DEFAULT 1.0,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_embedding_providers_name (name),
    INDEX idx_embedding_providers_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 章节/设定向量表
-- source_type: 'chapter_para'(正文段落) | 'character'(角色) | 'foreshadow'(伏笔) | 'outline'(大纲)
-- source_id:   该向量来源的业务主键（章节段落用 chapter_id；设定类用对应档案 id）
-- 隔离三道锁：
--   1) novel_id NOT NULL + 外键 CASCADE —— 数据天生属于某本书，删书自动清向量
--   2) 检索 SQL 强制 WHERE novel_id = ? —— 物理隔离，防本人不同书互相污染
--   3) 接口层先校验 novel 归属（user_id）—— 防跨用户访问
-- 向量以 JSON 数组存储（一本书数千段，量小；检索在后端内存算余弦相似度，毫秒级）
CREATE TABLE IF NOT EXISTS chapter_embeddings (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    novel_id VARCHAR(32) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_id VARCHAR(64) NOT NULL DEFAULT '',
    chapter_id VARCHAR(64) NULL,
    chapter_no INT NOT NULL DEFAULT 0,
    para_index INT NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL DEFAULT '',
    model VARCHAR(128) NOT NULL DEFAULT '',
    dimension INT NOT NULL DEFAULT 1024,
    embedding MEDIUMTEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_chapter_embeddings_novel (novel_id, source_type),
    INDEX idx_chapter_embeddings_source (novel_id, source_type, source_id),
    INDEX idx_chapter_embeddings_chapter (novel_id, chapter_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
