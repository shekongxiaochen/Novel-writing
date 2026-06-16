# 本机开发：MySQL(3306) + Redis(6379) + Rust 后端(8080) + 前端(5174)
# 用法：在 PowerShell 中执行  .\scripts\dev-local.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

# 检查 cargo（Rust）是否已安装
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    Write-Host "未检测到 cargo，请先安装 Rust：https://rustup.rs/" -ForegroundColor Red
    exit 1
}

Write-Host "检查 Redis (6379)..." -ForegroundColor Cyan
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $tcp.Connect("127.0.0.1", 6379)
  $tcp.Close()
} catch {
  Write-Host "Redis 未监听 6379。可先: docker run -d --name novel-redis -p 6379:6379 redis:7" -ForegroundColor Yellow
}

Write-Host "检查 MySQL (3306)..." -ForegroundColor Cyan
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $tcp.Connect("127.0.0.1", 3306)
  $tcp.Close()
} catch {
  Write-Host "MySQL 未监听 3306，请先启动本机 MySQL 并创建库 novel_db（见 backend\.env.example）" -ForegroundColor Red
  exit 1
}

Write-Host "启动 Rust 后端（新窗口）..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$Backend'; cargo run"
)

Write-Host "等待 http://127.0.0.1:8080/health ..." -ForegroundColor Cyan
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
}
if (-not $ok) {
  Write-Host "后端未在 90s 内就绪，请查看后端窗口中的 cargo 报错。" -ForegroundColor Red
  exit 1
}
Write-Host "后端已就绪: http://127.0.0.1:8080/health" -ForegroundColor Green

Write-Host "启动前端（新窗口）..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$Frontend'; npm run dev"
)

Write-Host ""
Write-Host "请在浏览器打开: http://127.0.0.1:5174" -ForegroundColor Green
Write-Host "管理后台: http://127.0.0.1:8080/admin/  (admin / change-me-admin)" -ForegroundColor Green
