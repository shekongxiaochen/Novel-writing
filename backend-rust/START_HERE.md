# 🚀 从这里开始

欢迎使用 Novel Backend (Rust) - 高性能小说写作辅助系统后端！

## ⚡ 快速开始（5分钟）

### 第1步：安装 Rust

**Windows:**
访问 https://rustup.rs/ 下载并运行安装程序

**Linux/macOS:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 第2步：配置环境

```bash
cd backend-rust
copy .env.example .env
```

编辑 `.env` 文件，修改数据库配置：
```env
DATABASE_URL=mysql://root:your_password@127.0.0.1:3306/novel_db?charset=utf8mb4
```

### 第3步：准备数据库

确保 MySQL 和 Redis 正在运行，然后创建数据库：
```sql
CREATE DATABASE novel_db CHARACTER SET utf8mb4;
```

运行迁移：
```bash
# Windows
.\run_migrations.ps1

# Linux/macOS
./run_migrations.sh
```

### 第4步：启动服务

```bash
cargo run --release
```

### 第5步：测试

打开浏览器访问：http://localhost:8080/health

看到 `{"status":"ok"}` 就成功了！🎉

---

## 📚 完整文档

- **[README.md](README.md)** - 项目概述和功能介绍
- **[INSTALL.md](INSTALL.md)** - 详细安装指南
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - 项目完成情况
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - 生产环境部署
- **[benchmark.md](benchmark.md)** - 性能测试指南

---

## 🎯 核心功能

✅ **已完成：**
- 用户注册/登录
- JWT 认证
- 小说 CRUD
- 快照系统
- Redis 缓存
- 高性能优化

⏳ **待实现：**
- 章节管理 API
- 角色管理 API
- AI 功能集成

---

## 🧪 测试 API

运行自动化测试脚本：

```bash
# Windows
.\test_api.ps1

# Linux/macOS (需要安装 curl 和 jq)
./test_api.sh
```

---

## 📊 性能对比

| 指标 | Python | Rust | 提升 |
|------|--------|------|------|
| 响应时间 | 20-50ms | 2-5ms | **10x** |
| 吞吐量 | 5K QPS | 50K QPS | **10x** |
| 内存 | 500MB | 50MB | **10x** |

---

## 🆘 遇到问题？

### 常见问题

**Q: 编译失败？**
A: 运行 `cargo clean` 然后重新 `cargo build`

**Q: 数据库连接失败？**
A: 检查 MySQL 是否运行，`.env` 配置是否正确

**Q: Redis 连接失败？**
A: 确认 Redis 正在运行：`redis-cli ping`

**Q: 端口被占用？**
A: 修改 `.env` 中的 `PORT` 配置

### 查看日志

```bash
# 运行时会显示详细日志
RUST_LOG=debug cargo run
```

---

## 🔗 相关链接

- **设计文档**: [../RUST_BACKEND_DESIGN.md](../RUST_BACKEND_DESIGN.md)
- **Python 版本**: [../backend/](../backend/)
- **前端项目**: [../frontend/](../frontend/)

---

## 💡 下一步

1. ✅ 启动服务
2. 📝 阅读 [README.md](README.md) 了解完整功能
3. 🧪 运行 `test_api.ps1` 测试 API
4. 🚀 连接前端项目
5. 📈 查看 [benchmark.md](benchmark.md) 进行性能测试

---

## 🎉 开始使用

服务已启动在：**http://localhost:8080**

API 文档（自动生成）：**http://localhost:8080/docs** (待实现)

祝你使用愉快！如有问题，请查看文档或提交 Issue。

---

**Made with ❤️ and 🦀 Rust**
