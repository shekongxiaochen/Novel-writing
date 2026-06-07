#!/usr/bin/env bash
# 服务器端一键部署脚本（方案 A：git pull + 重新构建）
#
# 首次使用前，服务器上要先把 /opt/novel-backend 变成 git 仓库（只做一次）：
#   cd /opt/novel-backend
#   git init
#   git remote add origin https://github.com/shekongxiaochen/Novel-writing.git
#   git fetch origin main
#   git reset --hard origin/main      # 用远程代码覆盖现有文件（.env 不受影响，已被忽略）
#
# 之后每次更新后端，只要在服务器上跑：
#   cd /opt/novel-backend && bash scripts/deploy.sh
#
# 脚本只换后端程序，绝不动数据库。用户数据全部保留。

set -euo pipefail

# ── 配置（与更新手册的固定信息一致）──
PROJECT_DIR="/opt/novel-backend"
BRANCH="main"
COMPOSE_FILE="docker-compose.iponly.yml"
ENV_FILE=".env.prod"

cd "$PROJECT_DIR"

echo "==> [1/4] 拉取最新代码（分支：$BRANCH）"
git fetch origin "$BRANCH"
# 用远程覆盖本地，避免服务器上手改导致的冲突。.env.prod 已被 .gitignore 忽略，不受影响。
git reset --hard "origin/$BRANCH"
echo "    当前提交：$(git log --oneline -1)"

# ── 校验生产配置存在（这两个文件不在 git 里，由服务器本地维护）──
if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "!! 找不到 $COMPOSE_FILE —— 生产编排文件不在仓库，需服务器本地保留。中止。" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "!! 找不到 $ENV_FILE —— 生产环境变量不在仓库，需服务器本地保留。中止。" >&2
  exit 1
fi

echo "==> [2/4] 重新构建并重启后端（重新编译 Rust，约 2-10 分钟）"
# 不加 --no-cache：保留依赖缓存，避免国内网络重下全部依赖超时。
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "==> [3/4] 等待后端就绪"
sleep 8
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo "==> [4/4] 健康检查"
for i in $(seq 1 10); do
  if curl -fsS http://localhost:8080/health >/dev/null 2>&1; then
    echo "    ✓ /health 正常，部署成功。"
    exit 0
  fi
  echo "    等待中（$i/10）…"
  sleep 3
done

echo "!! 健康检查未通过。查看日志排查：" >&2
echo "   docker logs novel-backend --tail 40" >&2
exit 1

