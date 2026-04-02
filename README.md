# Novel Writing Assistant（本地开发）

当前已搭建：
- 前端：Vue（Vite）
- 后端：FastAPI（含 `GET /health` 与 `GET /health/db`）
- 数据库：MySQL（本机 MySQL；后续可改为 Docker 部署）

## 1. 启动后端

```powershell
cd "D:\Novel writing\backend"
& .venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

验证：
- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/health/db`（需要 MySQL 配置正确）

## 2. 启动前端

```powershell
cd "D:\Novel writing\frontend"
npm run dev
```

默认访问：
- `http://localhost:5173`

## 3. 配置 MySQL

配置文件：`backend/.env`

当前 `/health/db` 可能返回 `Access denied ... (using password: NO)`，说明 `backend/.env` 里的：
- `db_user` / `db_password` / `db_name`

没有和你本机 MySQL 一致。按你的 MySQL 实际信息修改后重启后端即可。

## 4. 下一步做什么

当 `/health/db` 返回 `db_connected` 后，就可以开始按你第一期功能清单做业务模块（作品/章节/大纲/角色/势力/伏笔/坑点）。

