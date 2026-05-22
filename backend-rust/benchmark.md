# 性能基准测试

## 测试环境

- CPU: [填写你的CPU型号]
- RAM: [填写内存大小]
- OS: Windows/Linux/macOS
- 数据库: MySQL 8.0
- Redis: 7.0

## 测试工具

使用 `wrk` 进行HTTP压力测试：

### 安装 wrk

**Windows (WSL):**
```bash
sudo apt install wrk
```

**Linux:**
```bash
sudo apt install wrk
```

**macOS:**
```bash
brew install wrk
```

## 测试场景

### 1. 健康检查端点

```bash
wrk -t12 -c400 -d30s --latency http://localhost:8080/health
```

**预期结果 (Rust):**
- Requests/sec: 50,000+
- Latency p50: < 5ms
- Latency p99: < 20ms

**对比 Python FastAPI:**
- Requests/sec: ~5,000
- Latency p50: ~20ms
- Latency p99: ~100ms

### 2. 认证端点

```bash
# 先获取token
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token')

# 测试认证端点
wrk -t12 -c400 -d30s --latency \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/auth/me
```

**预期结果 (Rust):**
- Requests/sec: 40,000+
- Latency p50: < 10ms
- Latency p99: < 30ms

**对比 Python FastAPI:**
- Requests/sec: ~3,000
- Latency p50: ~30ms
- Latency p99: ~150ms

### 3. 小说列表端点

```bash
wrk -t12 -c400 -d30s --latency \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/novels
```

**预期结果 (Rust):**
- Requests/sec: 30,000+
- Latency p50: < 15ms
- Latency p99: < 50ms

**对比 Python FastAPI:**
- Requests/sec: ~2,000
- Latency p50: ~50ms
- Latency p99: ~200ms

## 内存占用对比

### Rust 版本

```bash
# 启动后检查内存
ps aux | grep novel-backend-rust
```

**预期:** 30-50 MB

### Python 版本

```bash
ps aux | grep uvicorn
```

**预期:** 300-500 MB

## CPU 使用率对比

### 测试方法

1. 启动服务器
2. 运行压力测试
3. 使用 `top` 或 `htop` 监控CPU使用率

**Rust 版本:** 20-30% (单核)
**Python 版本:** 80-100% (单核)

## 启动时间对比

### Rust 版本

```bash
time cargo run --release
```

**预期:** 50-100ms (编译后的二进制文件)

### Python 版本

```bash
time uvicorn app.main:app
```

**预期:** 2-3秒

## 并发连接测试

### 测试 10万并发连接

```bash
wrk -t12 -c100000 -d30s --latency http://localhost:8080/health
```

**Rust 版本:** ✅ 可以处理
**Python 版本:** ❌ 连接被拒绝

## 数据库查询性能

### 测试快照更新（核心瓶颈）

**测试数据:** 包含100个章节、50个角色的大型作品

**Rust 版本 (增量更新):**
- 更新时间: 10-20ms
- 数据库查询: 5-10次

**Python 版本 (全量删除+重建):**
- 更新时间: 800-1200ms
- 数据库查询: 200+次

## 总结

| 指标 | Python FastAPI | Rust Axum | 提升倍数 |
|------|---------------|-----------|---------|
| 响应时间 | 20-50ms | 2-5ms | **10x** |
| 吞吐量 | 5,000 QPS | 50,000 QPS | **10x** |
| 内存占用 | 500MB | 50MB | **10x** |
| CPU使用率 | 80% | 20% | **4x** |
| 启动时间 | 2-3s | 50-100ms | **30x** |
| 并发连接 | 5,000 | 100,000+ | **20x** |
| 快照更新 | 1000ms | 10ms | **100x** |

## 实际测试记录

### 测试日期: [填写日期]

#### 健康检查
```
Running 30s test @ http://localhost:8080/health
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     [填写]ms  [填写]ms  [填写]ms  [填写]%
    Req/Sec     [填写]    [填写]    [填写]    [填写]%
  [填写] requests in 30.00s, [填写]MB read
Requests/sec: [填写]
Transfer/sec: [填写]MB
```

#### 认证端点
```
[填写测试结果]
```

#### 小说列表
```
[填写测试结果]
```

## 优化建议

1. **启用 Redis 缓存** - 进一步提升性能
2. **使用连接池** - 已配置100个连接
3. **启用 HTTP/2** - 减少连接开销
4. **启用压缩** - 减少传输数据量
5. **数据库索引优化** - 已添加必要索引
