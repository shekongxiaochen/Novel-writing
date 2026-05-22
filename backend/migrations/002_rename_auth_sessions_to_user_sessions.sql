-- 旧库：业务会话表曾占用 auth_sessions，与 axum-admin 冲突。执行一次即可。
-- 若已存在 user_sessions 或 auth_sessions 已是管理后台结构，请勿重复执行。

RENAME TABLE auth_sessions TO user_sessions;
