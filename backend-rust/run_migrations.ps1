# PowerShell 数据库迁移脚本

Write-Host "🔄 Running database migrations..." -ForegroundColor Cyan

# 加载环境变量
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# 检查 DATABASE_URL
$DATABASE_URL = $env:DATABASE_URL
if (-not $DATABASE_URL) {
    Write-Host "❌ DATABASE_URL not set in .env" -ForegroundColor Red
    exit 1
}

# 解析数据库连接信息
if ($DATABASE_URL -match 'mysql://([^:]+):([^@]*)@([^:]+):(\d+)/([^?]+)') {
    $DB_USER = $matches[1]
    $DB_PASSWORD = $matches[2]
    $DB_HOST = $matches[3]
    $DB_PORT = $matches[4]
    $DB_NAME = $matches[5]
} else {
    Write-Host "❌ Invalid DATABASE_URL format" -ForegroundColor Red
    exit 1
}

# 运行迁移
Get-ChildItem migrations\*.sql | Sort-Object Name | ForEach-Object {
    Write-Host "📝 Running $($_.Name)..." -ForegroundColor Yellow
    
    $content = Get-Content $_.FullName -Raw
    
    # 使用 mysql 命令行工具
    $mysqlCmd = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER"
    if ($DB_PASSWORD) {
        $mysqlCmd += " -p$DB_PASSWORD"
    }
    $mysqlCmd += " $DB_NAME"
    
    $content | & cmd /c $mysqlCmd 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $($_.Name) completed" -ForegroundColor Green
    } else {
        Write-Host "❌ $($_.Name) failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ All migrations completed successfully!" -ForegroundColor Green
