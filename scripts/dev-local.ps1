# 本机开发：MySQL(3306) + Redis(6379) + Rust 后端(8080) + 前端(5174)
# 用法：在 PowerShell 中执行  .\scripts\dev-local.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

if (Test-Path "D:\novel-dev\cargo\bin\cargo.exe") {
  $env:RUSTUP_HOME = "D:\novel-dev\rustup"
  $env:CARGO_HOME = "D:\novel-dev\cargo"
  $env:Path = "D:\novel-dev\cargo\bin;" + $env:Path
}

Write-Host "检查 Redis (6379)..." -ForegroundColor Cyan
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $tcp.Connect("127.0.0.1", 6379)
  $tcp.Close()
} catch {
  Write-Host "Redis 未监听 6379。可先: docker start novel-redis  或运行 D:\novel-dev\start-redis.ps1" -ForegroundColor Yellow
}

Write-Host "检查 MySQL (3306)..." -ForegroundColor Cyan
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $tcp.Connect("127.0.0.1", 3306)
  $tcp.Close()
} catch {
  Write-Host "MySQL 未监听 3306，请先启动本机 MySQL 并创建库 novel_db（见 backend\.env）" -ForegroundColor Red
  exit 1
}

Write-Host "启动 Rust 后端（新窗口）..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$Backend'; if (Test-Path 'D:\novel-dev\cargo\bin') { `$env:RUSTUP_HOME='D:\novel-dev\rustup'; `$env:CARGO_HOME='D:\novel-dev\cargo'; `$env:Path='D:\novel-dev\cargo\bin;' + `$env:Path }; cargo run"
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
Write-Host "勿仅用 Docker 起 Redis：还需本机 cargo run 后端，且 Docker 未包含前端页面。" -ForegroundColor Yellow
