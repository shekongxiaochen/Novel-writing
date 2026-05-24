# Run all SQL migrations in order (idempotent: already-applied steps may error, safe to ignore)
$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "Missing .env" -ForegroundColor Red
    exit 1
}

$DATABASE_URL = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*DATABASE_URL=(.+)$') { $DATABASE_URL = $matches[1].Trim() }
}
if (-not $DATABASE_URL) {
    Write-Host "DATABASE_URL not set in .env" -ForegroundColor Red
    exit 1
}

if ($DATABASE_URL -notmatch '^mysql://([^:]+):([^@]*)@([^:]+):(\d+)/([^?]+)') {
    Write-Host "Invalid DATABASE_URL" -ForegroundColor Red
    exit 1
}

$DB_USER = $matches[1]
$DB_PASS = $matches[2]
$DB_HOST = $matches[3]
$DB_NAME = $matches[5]
$auth = if ($DB_PASS) { "-u$DB_USER -p$DB_PASS" } else { "-u$DB_USER" }

$migrations = @(
    "001_initial_schema.sql",
    "002_rename_auth_sessions_to_user_sessions.sql",
    "003_device_auth_wallet.sql",
    "003b_device_auth_wallet_finish.sql",
    "004_ai_keys_in_settings.sql",
    "005_system_settings_add_id.sql",
    "006_card_keys.sql"
)

Write-Host "Database: $DB_NAME @ ${DB_HOST}" -ForegroundColor Cyan

foreach ($name in $migrations) {
    $path = Join-Path $root "migrations\$name"
    if (-not (Test-Path $path)) {
        Write-Host "Skip missing: $name" -ForegroundColor Yellow
        continue
    }
    Write-Host "`n>> $name" -ForegroundColor Yellow
    $cmd = "mysql -h $DB_HOST $auth $DB_NAME < `"$path`""
    cmd /c $cmd
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK" -ForegroundColor Green
    } else {
        Write-Host "   exit $LASTEXITCODE (often already applied)" -ForegroundColor DarkYellow
    }
}

Write-Host "`n>> Verify system_settings" -ForegroundColor Cyan
mysql -h $DB_HOST $auth $DB_NAME -e "SELECT id, setting_key, updated_at FROM system_settings ORDER BY id;"
Write-Host "`nDone. Restart Rust backend if it was running." -ForegroundColor Green
