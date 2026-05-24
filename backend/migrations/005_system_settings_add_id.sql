-- axum-admin 列表需要数值主键 id；原 setting_key 仍作业务唯一键

ALTER TABLE system_settings DROP PRIMARY KEY;
ALTER TABLE system_settings
    ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
    ADD UNIQUE KEY uq_system_settings_key (setting_key);
