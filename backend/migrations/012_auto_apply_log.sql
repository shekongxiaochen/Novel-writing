-- AI 自动入库操作日志 — 独立表,不进 snapshot payload
-- 记录每条 AI 自动采用(create/merge)的可撤销操作,供换设备/清缓存后恢复撤销状态
CREATE TABLE IF NOT EXISTS auto_apply_log (
  id              VARCHAR(64) NOT NULL PRIMARY KEY,
  novel_id        VARCHAR(32) NOT NULL,
  chapter_id      VARCHAR(64) NOT NULL DEFAULT '',
  chapter_no      INT NULL,
  module          VARCHAR(32) NOT NULL,
  action          VARCHAR(16) NOT NULL,
  entity_id       VARCHAR(64) NOT NULL DEFAULT '',
  entity_label    VARCHAR(255) NOT NULL DEFAULT '',
  match_type      VARCHAR(32) NOT NULL DEFAULT 'new',
  before_snapshot LONGTEXT NULL,
  after_summary   TEXT NULL,
  changed_fields  TEXT NULL,
  undone          TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL,
  undone_at       DATETIME NULL,
  INDEX idx_aal_chapter (novel_id, chapter_id),
  INDEX idx_aal_novel (novel_id),
  FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
