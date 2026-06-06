-- 角色逐章叙事状态(角色状态机) — 独立表,不进 snapshot payload
-- 只在角色本章真有变化时存增量行;注入续写时取每角色截至当前章的最新一条
CREATE TABLE IF NOT EXISTS character_states (
  id           VARCHAR(64) NOT NULL PRIMARY KEY,
  novel_id     VARCHAR(32) NOT NULL,
  character_id VARCHAR(64) NOT NULL,
  chapter_id   VARCHAR(64) NOT NULL DEFAULT '',
  chapter_no   INT NOT NULL DEFAULT 0,
  state_json   TEXT NOT NULL,
  created_at   DATETIME NOT NULL,
  updated_at   DATETIME NOT NULL,
  UNIQUE KEY uk_char_state (novel_id, character_id, chapter_no),
  INDEX idx_char_state_latest (novel_id, character_id, chapter_no),
  FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
