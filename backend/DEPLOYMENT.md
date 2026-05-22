# 生产环境部署指南

## 🎯 部署选项

### 选项 1: 直接部署（推荐用于小型项目）
### 选项 2: Docker 部署（推荐用于容器化环境）
### 选项 3: Systemd 服务（推荐用于 Linux 服务器）

---

## 📦 选项 1: 直接部署

### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装依赖
sudo apt install -y build-essential pkg-config libssl-dev mysql-client redis-tools
```

### 2. 安装 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 3. 部署应用

```bash
# 克隆代码
cd /opt
sudo git clone <your-repo> novel-backend-rust
cd novel-backend-rust

# 配置环境变量
sudo cp .env.example .env
sudo nano .env  # 编辑配置

# 编译发布版本
cargo build --release

# 运行迁移
./run_migrations.sh

# 启动服务
./target/release/novel-backend-rust
```

### 4. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. 配置 SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## 🐳 选项 2: Docker 部署

### 1. 构建镜像

```bash
docker build -t novel-backend-rust:latest .
```

### 2. 使用 Docker Compose

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    image: novel-backend-rust:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=mysql://root:password@mysql:3306/novel_db
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mysql
      - redis
    restart: unless-stopped
    networks:
      - novel-network
  
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=novel_db
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - novel-network
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - novel-network
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
    networks:
      - novel-network

volumes:
  mysql_data:
  redis_data:

networks:
  novel-network:
    driver: bridge
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 查看日志

```bash
docker-compose logs -f backend
```

---

## ⚙️ 选项 3: Systemd 服务

### 1. 创建服务文件

```bash
sudo nano /etc/systemd/system/novel-backend.service
```

内容：

```ini
[Unit]
Description=Novel Backend (Rust)
After=network.target mysql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/novel-backend-rust
Environment="RUST_LOG=info"
EnvironmentFile=/opt/novel-backend-rust/.env
ExecStart=/opt/novel-backend-rust/target/release/novel-backend-rust
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 2. 启动服务

```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start novel-backend

# 设置开机自启
sudo systemctl enable novel-backend

# 查看状态
sudo systemctl status novel-backend

# 查看日志
sudo journalctl -u novel-backend -f
```

---

## 🔒 安全加固

### 1. 防火墙配置

```bash
# 只允许必要的端口
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. 限制数据库访问

```sql
-- 只允许本地连接
CREATE USER 'novel_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON novel_db.* TO 'novel_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. 配置 Redis 密码

```bash
# 编辑 redis.conf
sudo nano /etc/redis/redis.conf

# 添加
requirepass your_strong_password

# 重启 Redis
sudo systemctl restart redis
```

### 4. 环境变量安全

```bash
# 设置文件权限
sudo chmod 600 /opt/novel-backend-rust/.env
sudo chown www-data:www-data /opt/novel-backend-rust/.env
```

---

## 📊 监控和日志

### 1. 日志管理

```bash
# 查看实时日志
sudo journalctl -u novel-backend -f

# 查看最近的错误
sudo journalctl -u novel-backend -p err

# 按时间范围查看
sudo journalctl -u novel-backend --since "1 hour ago"
```

### 2. 性能监控

使用 `htop` 监控资源使用：

```bash
sudo apt install htop
htop
```

### 3. 应用监控

推荐使用：
- **Prometheus** - 指标收集
- **Grafana** - 可视化
- **Sentry** - 错误追踪

---

## 🔄 更新部署

### 1. 零停机更新

```bash
# 拉取最新代码
cd /opt/novel-backend-rust
sudo git pull

# 编译新版本
cargo build --release

# 运行迁移
./run_migrations.sh

# 重启服务
sudo systemctl restart novel-backend
```

### 2. 回滚

```bash
# 回滚到上一个版本
sudo git checkout <previous-commit>
cargo build --release
sudo systemctl restart novel-backend
```

---

## 🧪 健康检查

### 1. 自动健康检查脚本

创建 `/opt/health-check.sh`:

```bash
#!/bin/bash

HEALTH_URL="http://localhost:8080/health"
MAX_RETRIES=3
RETRY_DELAY=5

for i in $(seq 1 $MAX_RETRIES); do
    if curl -f -s $HEALTH_URL > /dev/null; then
        echo "✅ Health check passed"
        exit 0
    fi
    echo "⚠️  Health check failed (attempt $i/$MAX_RETRIES)"
    sleep $RETRY_DELAY
done

echo "❌ Health check failed after $MAX_RETRIES attempts"
# 可以在这里添加告警逻辑
exit 1
```

### 2. 配置 Cron 定时检查

```bash
# 编辑 crontab
sudo crontab -e

# 每5分钟检查一次
*/5 * * * * /opt/health-check.sh
```

---

## 📈 性能优化

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_novels_user_updated ON novels(user_id, updated_at);
CREATE INDEX idx_chapters_novel_no ON novel_chapters(novel_id, chapter_no);

-- 优化查询缓存
SET GLOBAL query_cache_size = 268435456;  -- 256MB
```

### 2. Redis 优化

```bash
# 编辑 redis.conf
maxmemory 512mb
maxmemory-policy allkeys-lru
```

### 3. Nginx 优化

```nginx
# 启用 gzip 压缩
gzip on;
gzip_types text/plain application/json;

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;
proxy_cache my_cache;
```

---

## 🆘 故障排除

### 服务无法启动

```bash
# 检查日志
sudo journalctl -u novel-backend -n 50

# 检查端口占用
sudo netstat -tlnp | grep 8080

# 检查配置文件
cat /opt/novel-backend-rust/.env
```

### 数据库连接失败

```bash
# 测试数据库连接
mysql -h 127.0.0.1 -u novel_user -p novel_db

# 检查 MySQL 状态
sudo systemctl status mysql
```

### Redis 连接失败

```bash
# 测试 Redis 连接
redis-cli ping

# 检查 Redis 状态
sudo systemctl status redis
```

---

## 📋 部署检查清单

- [ ] 服务器准备完成
- [ ] Rust 安装完成
- [ ] MySQL 配置完成
- [ ] Redis 配置完成
- [ ] 环境变量配置完成
- [ ] 数据库迁移完成
- [ ] 应用编译完成
- [ ] Nginx 配置完成
- [ ] SSL 证书配置完成
- [ ] 防火墙配置完成
- [ ] Systemd 服务配置完成
- [ ] 健康检查配置完成
- [ ] 监控配置完成
- [ ] 备份策略配置完成

---

## 🎉 部署完成

访问你的 API：
- HTTP: `http://your-domain.com/health`
- HTTPS: `https://your-domain.com/health`

应该看到：
```json
{
  "status": "ok",
  "message": "服务运行正常"
}
```

恭喜！你的 Rust 后端已成功部署！🚀
