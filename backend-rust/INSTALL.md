# 安装和运行指南

## 📋 前置要求

1. **Rust** (1.75+)
2. **MySQL** (8.0+)
3. **Redis** (6.0+)

## 🔧 步骤 1: 安装 Rust

### Windows

访问 https://rustup.rs/ 下载并运行 `rustup-init.exe`

或使用 PowerShell：
```powershell
# 下载安装脚本
Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile rustup-init.exe

# 运行安装
.\rustup-init.exe
```

安装完成后，重启终端并验证：
```bash
rustc --version
cargo --version
```

### Linux/macOS

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

## 🗄️ 步骤 2: 准备数据库

### 启动 MySQL

确保 MySQL 正在运行，并创建数据库：

```sql
CREATE DATABASE novel_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 启动 Redis

```bash
# Windows: 下载 Redis for Windows
# https://github.com/microsoftarchive/redis/releases

# Linux
sudo systemctl start redis

# macOS
brew services start redis

# Docker (推荐)
docker run -d -p 6379:6379 redis:7-alpine
```

## ⚙️ 步骤 3: 配置环境变量

```bash
cd backend-rust
copy .env.example .env
```

编辑 `.env` 文件：

```env
# 修改为你的数据库配置
DATABASE_URL=mysql://root:your_password@127.0.0.1:3306/novel_db?charset=utf8mb4

# Redis 配置（通常不需要修改）
REDIS_URL=redis://127.0.0.1:6379

# 生成一个安全的密钥
JWT_SECRET=请替换为随机字符串

# 其他配置保持默认即可
```

## 📦 步骤 4: 编译项目

```bash
# 首次编译（需要 5-10 分钟）
cargo build --release
```

编译过程中会下载并编译所有依赖。请耐心等待。

## 🚀 步骤 5: 运行

### 开发模式（推荐）

```bash
cargo run
```

### 生产模式

```bash
cargo run --release
```

### 带热重载（可选）

```bash
# 安装 cargo-watch
cargo install cargo-watch

# 运行
cargo watch -x run
```

## ✅ 步骤 6: 验证

打开浏览器访问：

- 健康检查: http://localhost:8080/health

应该看到：
```json
{
  "status": "ok",
  "message": "服务运行正常"
}
```

## 🧪 测试 API

### 使用 curl

```bash
# 健康检查
curl http://localhost:8080/health

# 发送验证码
curl -X POST http://localhost:8080/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"register"}'

# 注册用户（需要先收到验证码）
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","code":"123456"}'
```

### 使用 Postman

导入以下 API 集合：

1. 健康检查: `GET http://localhost:8080/health`
2. 注册: `POST http://localhost:8080/auth/register`
3. 登录: `POST http://localhost:8080/auth/login`
4. 获取小说列表: `GET http://localhost:8080/novels` (需要 Bearer Token)

## 🔧 常见问题

### 1. 编译错误：找不到 OpenSSL

**Windows:**
```bash
# 使用 vcpkg 安装
vcpkg install openssl:x64-windows
```

**Linux:**
```bash
sudo apt-get install pkg-config libssl-dev
```

**macOS:**
```bash
brew install openssl
```

### 2. 数据库连接失败

检查：
- MySQL 是否正在运行
- `.env` 中的数据库配置是否正确
- 数据库 `novel_db` 是否已创建
- 用户名和密码是否正确

### 3. Redis 连接失败

检查：
- Redis 是否正在运行
- 端口 6379 是否被占用

### 4. 端口 8080 被占用

修改 `.env` 中的 `PORT` 配置：
```env
PORT=8081
```

## 📊 性能测试

安装 wrk 后进行压力测试：

```bash
# 测试健康检查端点
wrk -t12 -c400 -d30s --latency http://localhost:8080/health
```

预期结果：
- Requests/sec: 50,000+
- Latency p50: < 5ms
- Latency p99: < 20ms

## 🐳 使用 Docker（可选）

```bash
# 构建镜像
docker build -t novel-backend-rust .

# 运行容器
docker run -p 8080:8080 --env-file .env novel-backend-rust
```

## 📝 下一步

1. 查看 [README.md](README.md) 了解完整功能
2. 查看 [RUST_BACKEND_DESIGN.md](../RUST_BACKEND_DESIGN.md) 了解架构设计
3. 启动前端项目连接到 Rust 后端

## 🆘 需要帮助？

如果遇到问题：
1. 检查日志输出
2. 确认所有服务（MySQL, Redis）正在运行
3. 验证 `.env` 配置正确
4. 查看 [故障排除](README.md#故障排除) 章节
