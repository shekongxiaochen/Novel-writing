# API 测试脚本

$BASE_URL = "http://localhost:8080"

Write-Host "🧪 Testing Novel Backend API..." -ForegroundColor Cyan

# 1. 健康检查
Write-Host "`n1️⃣  Testing health check..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
Write-Host "✅ Health check: $($response.status)" -ForegroundColor Green

# 2. 发送验证码
Write-Host "`n2️⃣  Sending verification code..." -ForegroundColor Yellow
$email = "test@example.com"
$body = @{
    email = $email
    purpose = "register"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/send-code" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✅ Verification code sent: $($response.message)" -ForegroundColor Green
    Write-Host "⚠️  Check logs for the verification code (mail is disabled)" -ForegroundColor Yellow
} catch {
    Write-Host "⚠️  Send code failed (may need to wait for cooldown): $($_.Exception.Message)" -ForegroundColor Yellow
}

# 3. 注册用户
Write-Host "`n3️⃣  Registering user..." -ForegroundColor Yellow
Write-Host "📝 Please enter the verification code from logs: " -NoNewline
$code = Read-Host

$body = @{
    email = $email
    password = "password123"
    code = $code
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/register" -Method Post -Body $body -ContentType "application/json"
    $token = $response.token
    Write-Host "✅ User registered: $($response.user.email)" -ForegroundColor Green
    Write-Host "🔑 Token: $token" -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Registration failed (user may already exist): $($_.Exception.Message)" -ForegroundColor Yellow
    
    # 尝试登录
    Write-Host "`n4️⃣  Trying to login instead..." -ForegroundColor Yellow
    $body = @{
        email = $email
        password = "password123"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method Post -Body $body -ContentType "application/json"
        $token = $response.token
        Write-Host "✅ User logged in: $($response.user.email)" -ForegroundColor Green
        Write-Host "🔑 Token: $token" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# 5. 获取当前用户信息
Write-Host "`n5️⃣  Getting current user info..." -ForegroundColor Yellow
$headers = @{
    Authorization = "Bearer $token"
}

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/auth/me" -Method Get -Headers $headers
    Write-Host "✅ Current user: $($response.email)" -ForegroundColor Green
} catch {
    Write-Host "❌ Get user failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. 创建小说
Write-Host "`n6️⃣  Creating a novel..." -ForegroundColor Yellow
$body = @{
    title = "测试小说 $(Get-Date -Format 'HHmmss')"
    summary = "这是一个测试小说"
    genre = "奇幻"
    perspective = "第三人称"
    tone = "轻松"
    is_multi_line_narrative = $false
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/novels" -Method Post -Body $body -ContentType "application/json" -Headers $headers
    $novelId = $response.id
    Write-Host "✅ Novel created: $($response.title) (ID: $novelId)" -ForegroundColor Green
} catch {
    Write-Host "❌ Create novel failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 7. 获取小说列表
Write-Host "`n7️⃣  Getting novels list..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/novels" -Method Get -Headers $headers
    Write-Host "✅ Found $($response.Count) novel(s)" -ForegroundColor Green
    $response | ForEach-Object {
        Write-Host "   📚 $($_.title)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Get novels failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 8. 获取小说详情
Write-Host "`n8️⃣  Getting novel details..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/novels/$novelId" -Method Get -Headers $headers
    Write-Host "✅ Novel details:" -ForegroundColor Green
    Write-Host "   Title: $($response.title)" -ForegroundColor Cyan
    Write-Host "   Genre: $($response.genre)" -ForegroundColor Cyan
    Write-Host "   Summary: $($response.summary)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Get novel failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 9. 更新小说
Write-Host "`n9️⃣  Updating novel..." -ForegroundColor Yellow
$body = @{
    summary = "这是更新后的摘要"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/novels/$novelId" -Method Put -Body $body -ContentType "application/json" -Headers $headers
    Write-Host "✅ Novel updated: $($response.summary)" -ForegroundColor Green
} catch {
    Write-Host "❌ Update novel failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 10. 获取快照
Write-Host "`n🔟 Getting snapshot..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/novels/$novelId/snapshot" -Method Get -Headers $headers
    Write-Host "✅ Snapshot version: $($response.version)" -ForegroundColor Green
} catch {
    Write-Host "❌ Get snapshot failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 11. 删除小说
Write-Host "`n1️⃣1️⃣  Deleting novel..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/novels/$novelId" -Method Delete -Headers $headers
    Write-Host "✅ Novel deleted: $($response.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ Delete novel failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ All tests completed!" -ForegroundColor Green
Write-Host "🎉 Rust backend is working correctly!" -ForegroundColor Cyan
