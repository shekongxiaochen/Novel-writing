-- 009: novels 表补充 ai_style_prompt 列（代码已使用但早期 schema 未包含）
-- 幂等：仅当列不存在时才添加；列须 NOT NULL（实体解码为 String，不接受 NULL）

SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'novels'
      AND COLUMN_NAME = 'ai_style_prompt'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE novels ADD COLUMN ai_style_prompt TEXT NOT NULL AFTER is_multi_line_narrative',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 既有行的 NULL 回填为空串，并把列约束改为 NOT NULL（兼容此前已用 NULL 版本建过列的库）
UPDATE novels SET ai_style_prompt = '' WHERE ai_style_prompt IS NULL;
ALTER TABLE novels MODIFY ai_style_prompt TEXT NOT NULL;
