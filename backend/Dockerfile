# 构建阶段（与本地工具链一致，避免依赖 MSRV 报错）
FROM rust:1.95-slim as builder

WORKDIR /app

# 安装依赖
RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY Cargo.toml Cargo.lock ./

# 预构建依赖（缓存优化）
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# 复制源代码
COPY src ./src

# 构建应用（触碰 main.rs 确保重新编译真实代码而非占位）
RUN touch src/main.rs && cargo build --release

# 运行阶段
FROM debian:bookworm-slim

# 安装运行时依赖（curl 供 HEALTHCHECK 使用）
RUN apt-get update && \
    apt-get install -y ca-certificates libssl3 curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /app/target/release/novel-backend-rust .

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 启动应用
CMD ["./novel-backend-rust"]
