# Lumen 流明

- 前端：Vue + Vite（`frontend/`）
- 后端：Rust + Axum（`backend/`，端口 `8080`）
- 写作数据：本地存储 + 可选云同步（对接 Rust API）
- AI：用户自行配置 `API Key / Base URL / Model`

## 启动

详见 [启动说明.md](启动说明.md)。

```powershell
# Redis → Rust 后端 → 前端
D:\novel-dev\start-redis.ps1
D:\novel-dev\start-rust-backend.ps1
cd "D:\Novel writing\frontend"
npm run dev
```

- 前端：`http://127.0.0.1:5174`
- 后端健康检查：`http://127.0.0.1:8080/health`

## AI 使用方式

1. 打开应用右上角 `AI 设置`
2. 填写 `API Key`
3. 按需要补充 `Base URL` 和 `Model`
4. 在章节页点击 `AI 整理档案`

AI 会结合当前本地的角色、势力、物品、分类、伏笔和章节正文，给出新增、更新、关系和所属势力等建议，再由用户确认写回档案。

## 设计文档

- [docs/AI实体抽取设计方案.md](docs/AI实体抽取设计方案.md)
- [docs/认证后端设计方案.md](docs/认证后端设计方案.md)
