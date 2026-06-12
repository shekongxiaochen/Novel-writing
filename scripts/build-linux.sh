#!/usr/bin/env bash
# 在 Docker 容器内为 Tauri 应用打 Linux 安装包（.deb + .AppImage）
#
# 前置：本机已安装并启动 Docker Desktop。
# 用法：从仓库任意位置执行  bash scripts/build-linux.sh
#
# 产物输出到：frontend/src-tauri/target/release/bundle/
#   - deb/*.deb
#   - appimage/*.AppImage
set -euo pipefail

# 定位仓库根目录（脚本所在目录的上一级）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

IMAGE_TAG="lumen-linux-bundler:latest"
OUT_DIR="$ROOT_DIR/dist-linux"
mkdir -p "$OUT_DIR"

# Windows + Git Bash 下，docker -v 的源路径需用 Windows 原生格式（D:\...），
# 否则 MSYS 会改写 /app 这类路径导致挂载错位。转换 /d/x -> D:\x。
to_win_path() {
  # 输入形如 /d/Novel writing/frontend，输出 D:\Novel writing\frontend
  local p="$1"
  echo "$p" | sed -E 's#^/([a-zA-Z])/#\U\1:/#; s#/#\\#g'
}
FRONTEND_WIN="$(to_win_path "$FRONTEND_DIR")"
OUT_WIN="$(to_win_path "$OUT_DIR")"

echo "==> 构建打包镜像（首次较慢，之后有缓存）"
MSYS_NO_PATHCONV=1 docker build -f "$FRONTEND_WIN\\Dockerfile.linux-bundle" -t "$IMAGE_TAG" "$FRONTEND_WIN"

echo "==> 在容器内编译并打包"
# 用命名卷隔离 node_modules 与 Rust target，避免与宿主机 Windows 产物冲突，
# 同时在多次构建之间复用缓存，加快增量编译。
# 产物通过 /out 挂载拷回宿主机 dist-linux/。
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$FRONTEND_WIN":/app \
  -v "$OUT_WIN":/out \
  -v lumen_node_modules:/app/node_modules \
  -v lumen_cargo_target:/app/src-tauri/target \
  -v lumen_cargo_registry:/root/.cargo/registry \
  "$IMAGE_TAG"

echo ""
echo "==> 完成。产物清单（dist-linux/）："
if [ -d "$OUT_DIR" ]; then
  find "$OUT_DIR" -type f \( -name "*.deb" -o -name "*.AppImage" \) -print
else
  echo "（未找到输出目录，构建可能失败，请查看上方日志）"
fi
