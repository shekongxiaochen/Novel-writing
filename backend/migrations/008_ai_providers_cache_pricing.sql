-- Split input pricing into cache-miss and cache-hit
ALTER TABLE ai_providers
    ADD COLUMN price_per_1m_input_miss_yuan DOUBLE NOT NULL DEFAULT 1.0 AFTER api_key,
    ADD COLUMN price_per_1m_input_hit_yuan DOUBLE NOT NULL DEFAULT 0.5 AFTER price_per_1m_input_miss_yuan;

-- Migrate existing data: old input price -> miss price, hit price = 50% of miss
UPDATE ai_providers
SET price_per_1m_input_miss_yuan = price_per_1m_input_yuan,
    price_per_1m_input_hit_yuan = price_per_1m_input_yuan * 0.5;

-- Drop old column
ALTER TABLE ai_providers DROP COLUMN price_per_1m_input_yuan;
