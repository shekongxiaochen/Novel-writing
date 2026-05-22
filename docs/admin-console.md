# 管理后台（axum-admin）

Rust 后端内置 [axum-admin](https://github.com/rinnguyen711/axum-admin) 管理控制台，体验接近 Django Admin：登录、列表、搜索、增删改、RBAC。

界面为**简体中文**（模板在 `backend/admin-templates/`，字段标签在 `backend/src/admin/labels.rs`）。

## 访问地址

后端启动后打开：

- http://127.0.0.1:8080/admin/

## 登录账号

在 `backend/.env` 中配置（与业务用户表 `users` **无关**）：

```env
ADMIN_ENABLED=true
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-admin
```

首次启动会自动创建该管理员。

**登录失败（Invalid username or password）** 常见原因：

1. **表名冲突（已修复）**：业务登录会话原表名 `auth_sessions` 与 axum-admin 冲突。启动时会自动 `RENAME` 为 `user_sessions`，并新建管理后台用的 `auth_sessions`。
2. **密码与 `.env` 不一致**：本机设 `ADMIN_SYNC_PASSWORD=true` 并重启，会把 `ADMIN_PASSWORD` 写入 `auth_users`。生产环境请设 `false`，在后台 **Users** 里改密码。

## 可管理的数据

| 菜单 | 数据表 | 说明 |
|------|--------|------|
| 应用用户 | `users` | 注册邮箱、昵称、启用状态等（密码哈希默认隐藏） |
| 小说 | `novels` | 作品元数据 |
| 支付订单 | `payment_orders` | 订阅相关订单 |

另含 axum-admin 自带的 **后台用户 / 角色**（`auth_users` 等），用于控制台登录与权限，不是 App 用户。

## 关闭后台

```env
ADMIN_ENABLED=false
```

## 技术说明

- 依赖 `sea-orm` 1.x（与 axum-admin 一致）
- 首次启动会执行 axum-admin 迁移（`auth_users`、`casbin_rule` 等）
- MySQL 下会自动将部分 `TIMESTAMP` 列调整为 `DATETIME`，避免 SeaORM 解码错误
