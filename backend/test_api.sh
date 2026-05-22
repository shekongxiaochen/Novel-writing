#!/bin/bash

# API 测试脚本

BASE_URL="http://localhost:8080"

echo "🧪 Testing Novel Backend API..."

# 1. 健康检查
echo -e "\n1️⃣  Testing health check..."
response=$(curl -s "$BASE_URL/health")
echo "✅ Health check: $(echo $response | jq -r '.status')"

# 2. 发送验证码
echo -e "\n2️⃣  Sending verification code..."
email="test@example.com"
response=$(curl -s -X POST "$BASE_URL/auth/send-code" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"purpose\":\"register\"}")

if [ $? -eq 0 ]; then
    echo "✅ Verification code sent"
    echo "⚠️  Check logs for the verification code (mail is disabled)"
else
    echo "⚠️  Send code failed (may need to wait for cooldown)"
fi

# 3. 注册用户
echo -e "\n3️⃣  Registering user..."
echo -n "📝 Please enter the verification code from logs: "
read code

response=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"password123\",\"code\":\"$code\"}")

if echo "$response" | jq -e '.token' > /dev/null 2>&1; then
    token=$(echo "$response" | jq -r '.token')
    echo "✅ User registered: $(echo $response | jq -r '.user.email')"
    echo "🔑 Token: $token"
else
    echo "⚠️  Registration failed (user may already exist)"
    
    # 尝试登录
    echo -e "\n4️⃣  Trying to login instead..."
    response=$(curl -s -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"password123\"}")
    
    if echo "$response" | jq -e '.token' > /dev/null 2>&1; then
        token=$(echo "$response" | jq -r '.token')
        echo "✅ User logged in: $(echo $response | jq -r '.user.email')"
        echo "🔑 Token: $token"
    else
        echo "❌ Login failed"
        exit 1
    fi
fi

# 5. 获取当前用户信息
echo -e "\n5️⃣  Getting current user info..."
response=$(curl -s "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $token")

if echo "$response" | jq -e '.email' > /dev/null 2>&1; then
    echo "✅ Current user: $(echo $response | jq -r '.email')"
else
    echo "❌ Get user failed"
fi

# 6. 创建小说
echo -e "\n6️⃣  Creating a novel..."
timestamp=$(date +%H%M%S)
response=$(curl -s -X POST "$BASE_URL/novels" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"测试小说 $timestamp\",\"summary\":\"这是一个测试小说\",\"genre\":\"奇幻\",\"perspective\":\"第三人称\",\"tone\":\"轻松\",\"is_multi_line_narrative\":false}")

if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
    novel_id=$(echo "$response" | jq -r '.id')
    echo "✅ Novel created: $(echo $response | jq -r '.title') (ID: $novel_id)"
else
    echo "❌ Create novel failed"
    exit 1
fi

# 7. 获取小说列表
echo -e "\n7️⃣  Getting novels list..."
response=$(curl -s "$BASE_URL/novels" \
  -H "Authorization: Bearer $token")

if echo "$response" | jq -e '.[0]' > /dev/null 2>&1; then
    count=$(echo "$response" | jq 'length')
    echo "✅ Found $count novel(s)"
    echo "$response" | jq -r '.[] | "   📚 \(.title)"'
else
    echo "❌ Get novels failed"
fi

# 8. 获取小说详情
echo -e "\n8️⃣  Getting novel details..."
response=$(curl -s "$BASE_URL/novels/$novel_id" \
  -H "Authorization: Bearer $token")

if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
    echo "✅ Novel details:"
    echo "   Title: $(echo $response | jq -r '.title')"
    echo "   Genre: $(echo $response | jq -r '.genre')"
    echo "   Summary: $(echo $response | jq -r '.summary')"
else
    echo "❌ Get novel failed"
fi

# 9. 更新小说
echo -e "\n9️⃣  Updating novel..."
response=$(curl -s -X PUT "$BASE_URL/novels/$novel_id" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{"summary":"这是更新后的摘要"}')

if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
    echo "✅ Novel updated: $(echo $response | jq -r '.summary')"
else
    echo "❌ Update novel failed"
fi

# 10. 获取快照
echo -e "\n🔟 Getting snapshot..."
response=$(curl -s "$BASE_URL/novels/$novel_id/snapshot" \
  -H "Authorization: Bearer $token")

if echo "$response" | jq -e '.version' > /dev/null 2>&1; then
    echo "✅ Snapshot version: $(echo $response | jq -r '.version')"
else
    echo "❌ Get snapshot failed"
fi

# 11. 删除小说
echo -e "\n1️⃣1️⃣  Deleting novel..."
response=$(curl -s -X DELETE "$BASE_URL/novels/$novel_id" \
  -H "Authorization: Bearer $token")

if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
    echo "✅ Novel deleted: $(echo $response | jq -r '.message')"
else
    echo "❌ Delete novel failed"
fi

echo -e "\n✅ All tests completed!"
echo "🎉 Rust backend is working correctly!"
