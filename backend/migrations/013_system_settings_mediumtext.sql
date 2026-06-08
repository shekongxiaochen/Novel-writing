-- 公告支持图片（base64 data URL）后，setting_value 可能超过 TEXT 的 64KB 上限。
-- 改为 MEDIUMTEXT（最大 16MB），足够容纳二维码/小图的 base64。
ALTER TABLE system_settings MODIFY COLUMN setting_value MEDIUMTEXT NOT NULL;
