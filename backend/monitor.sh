#!/bin/bash

# 性能监控脚本

echo "📊 Novel Backend Performance Monitor"
echo "===================================="

# 检查服务是否运行
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "❌ 服务未运行"
    exit 1
fi

echo "✅ 服务正在运行"
echo ""

# 获取进程信息
PID=$(pgrep -f "novel-backend-rust" | head -1)

if [ -z "$PID" ]; then
    echo "❌ 找不到进程"
    exit 1
fi

echo "🔍 进程 ID: $PID"
echo ""

# 内存使用
echo "💾 内存使用:"
ps -p $PID -o rss,vsz,pmem,comm | tail -1 | awk '{
    rss_mb = $1/1024
    vsz_mb = $2/1024
    printf "  RSS: %.2f MB\n", rss_mb
    printf "  VSZ: %.2f MB\n", vsz_mb
    printf "  MEM%%: %.2f%%\n", $3
}'
echo ""

# CPU使用
echo "⚡ CPU 使用:"
ps -p $PID -o %cpu,comm | tail -1 | awk '{
    printf "  CPU%%: %.2f%%\n", $1
}'
echo ""

# 线程数
echo "🧵 线程数:"
THREADS=$(ps -p $PID -o nlwp | tail -1)
echo "  Threads: $THREADS"
echo ""

# 文件描述符
echo "📁 文件描述符:"
if [ -d "/proc/$PID/fd" ]; then
    FD_COUNT=$(ls /proc/$PID/fd | wc -l)
    echo "  Open FDs: $FD_COUNT"
else
    echo "  无法获取 (需要 Linux)"
fi
echo ""

# 网络连接
echo "🌐 网络连接:"
CONNECTIONS=$(netstat -an 2>/dev/null | grep ":8080" | grep ESTABLISHED | wc -l)
echo "  Active connections: $CONNECTIONS"
echo ""

# 响应时间测试
echo "⏱️  响应时间测试:"
for i in {1..5}; do
    TIME=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:8080/health)
    echo "  Request $i: ${TIME}s"
done
echo ""

# 持续监控模式
if [ "$1" == "--watch" ]; then
    echo "🔄 持续监控模式 (Ctrl+C 退出)"
    echo ""
    
    while true; do
        clear
        echo "📊 Novel Backend Performance Monitor - $(date)"
        echo "===================================="
        
        # 内存
        ps -p $PID -o rss,vsz,pmem | tail -1 | awk '{
            rss_mb = $1/1024
            printf "💾 Memory: %.2f MB (%.2f%%)\n", rss_mb, $3
        }'
        
        # CPU
        ps -p $PID -o %cpu | tail -1 | awk '{
            printf "⚡ CPU: %.2f%%\n", $1
        }'
        
        # 连接数
        CONNECTIONS=$(netstat -an 2>/dev/null | grep ":8080" | grep ESTABLISHED | wc -l)
        echo "🌐 Connections: $CONNECTIONS"
        
        # 响应时间
        TIME=$(curl -o /dev/null -s -w '%{time_total}\n' http://localhost:8080/health)
        echo "⏱️  Response time: ${TIME}s"
        
        sleep 2
    done
fi

echo "✅ 监控完成"
echo ""
echo "提示: 使用 '$0 --watch' 进入持续监控模式"
