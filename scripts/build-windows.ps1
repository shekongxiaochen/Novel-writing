# 在 Windows 上为 Tauri 应用打包成 exe 安装程序 (NSIS)
#
# 前置要求（需手动安装一次）：
#   1) Rust 工具链 (MSVC)：
#        winget install Rustlang.Rustup
#        rustup default stable-x86_64-pc-windows-msvc
#   2) Visual Studio Build Tools + "使用 C++ 的桌面开发" 工作负载：
#        winget install Microsoft.VisualStudio.2022.BuildTools
#        然后在 Visual Studio Installer 中勾选 “使用 C++ 的桌面开发”
#      （或安装完整 Visual Studio 2022 并勾选同一工作负载）
#   3) Node.js（已具备）
#
# 用法（在 PowerShell 中，从仓库根目录执行）：
#   ./scripts/build-windows.ps1
#
# 产物输出到：
#   frontend/src-tauri/target/release/bundle/nsis/*.exe

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RootDir "frontend"

Write-Host "==> 检查工具链" -ForegroundColor Cyan
function Require-Cmd($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Error "缺少 '$name'。$hint"
        exit 1
    }
}
Require-Cmd "node"  "请安装 Node.js"
Require-Cmd "cargo" "请安装 Rust：winget install Rustlang.Rustup，并执行 rustup default stable-x86_64-pc-windows-msvc"

Push-Location $FrontendDir
try {
    Write-Host "==> 安装前端依赖" -ForegroundColor Cyan
    if (Test-Path "package-lock.json") { npm ci } else { npm install }

    Write-Host "==> Tauri 构建 (nsis exe 安装程序)" -ForegroundColor Cyan
    npx tauri build --bundles nsis

    $nsisDir = Join-Path $FrontendDir "src-tauri/target/release/bundle/nsis"
    Write-Host ""
    Write-Host "==> 完成。产物清单：" -ForegroundColor Green
    if (Test-Path $nsisDir) {
        Get-ChildItem $nsisDir -Filter *.exe | ForEach-Object { Write-Host "  $($_.FullName)" }
    } else {
        Write-Warning "未找到 nsis 目录，构建可能失败，请查看上方日志。"
    }
}
finally {
    Pop-Location
}
