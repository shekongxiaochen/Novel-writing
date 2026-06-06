#!/usr/bin/env bash
# 一键更新后端：拉取最新代码后，重新构建并平滑重启容器。
# 用法：在服务器项目目录运行  ./update.sh
# 数据库/Redis 数据保存在 docker volume 中，更新不会丢数据。

set -euo pipefail

# ---- 配置（与服务器实际部署一致）----
COMPOSE_FILE="docker-compose.iponly.yml"
ENV_FILE=".env.prod"

cd "$(dirname "$0")"

echo "==> [1/4] 检查必要文件"
for f in "$COMPOSE_FILE" "$ENV_FILE" Dockerfile; do
    if [ ! -f "$f" ]; then
        echo "缺少文件: $f —— 请确认在项目目录运行" >&2
        exit 1
    fi
done

echo "==> [2/4] 记录当前镜像（失败可回滚参考）"
docker images novel-backend-backend --format '当前镜像: {{.ID}}  {{.CreatedSince}}' || true

echo "==> [3/4] 重新构建并启动（Rust 增量编译，通常 1-3 分钟）"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "==> [4/4] 等待后端健康检查"
# 最多等 90 秒，期间轮询 health
for i in $(seq 1 18); do
    sleep 5
    status=$(docker inspect --format '{{.State.Health.Status}}' novel-backend 2>/dev/null || echo "unknown")
    echo "    后端状态: $status (${i}/18)"
    if [ "$status" = "healthy" ]; then
        echo ""
        echo "✅ 更新完成，后端已健康运行。"
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
        exit 0
    fi
done

echo ""
echo "⚠️ 后端在 90 秒内未变 healthy，可能更新有问题。查看日志：" >&2
echo "    docker logs novel-backend --tail 50" >&2
exit 1
