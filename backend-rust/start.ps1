# 快速启动脚本

Write-Host "🚀 Starting Novel Backend (Rust)..." -ForegroundColor Cyan

# 检查 Rust 是否安装
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Rust not installed. Please install from https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# 检查 .env 文件
if (-not (Test-Path .env)) {
    Write-Host "⚠️  .env file not found. Creating from template..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "📝 Please edit .env file with your configuration" -ForegroundColor Yellow
    exit 1
}

# 运行数据库迁移
Write-Host "📊 Running database migrations..." -ForegroundColor Cyan
.\run_migrations.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration failed. Please check your database configuration." -ForegroundColor Red
    exit 1
}

# 启动服务器
Write-Host "🔨 Building and starting server..." -ForegroundColor Cyan
cargo run --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Server failed to start" -ForegroundColor Red
    exit 1
}
