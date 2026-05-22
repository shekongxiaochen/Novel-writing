#!/bin/bash

# Python vs Rust 性能对比脚本

echo "🔥 Python FastAPI vs Rust Axum 性能对比"
echo "========================================"
echo ""

# 检查 wrk 是否安装
if ! command -v wrk &> /dev/null; then
    echo "❌ wrk 未安装"
    echo "请安装: sudo apt install wrk (Linux) 或 brew install wrk (macOS)"
    exit 1
fi

# 测试配置
DURATION=30
THREADS=12
CONNECTIONS=400

echo "测试配置:"
echo "  持续时间: ${DURATION}秒"
echo "  线程数: ${THREADS}"
echo "  并发连接: ${CONNECTIONS}"
echo ""

# 测试 Python 后端
echo "1️⃣  测试 Python FastAPI (端口 8000)"
echo "-----------------------------------"

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Python 后端正在运行"
    echo ""
    
    # 获取初始内存
    PYTHON_PID=$(pgrep -f "uvicorn" | head -1)
    if [ ! -z "$PYTHON_PID" ]; then
        PYTHON_MEM_BEFORE=$(ps -p $PYTHON_PID -o rss | tail -1)
        PYTHON_MEM_BEFORE_MB=$((PYTHON_MEM_BEFORE / 1024))
        echo "📊 初始内存: ${PYTHON_MEM_BEFORE_MB} MB"
    fi
    
    echo ""
    echo "🚀 开始压力测试..."
    wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION}s --latency http://localhost:8000/health > /tmp/python_result.txt
    
    # 显示结果
    cat /tmp/python_result.txt
    
    # 提取关键指标
    PYTHON_RPS=$(grep "Requests/sec:" /tmp/python_result.txt | awk '{print $2}')
    PYTHON_LATENCY_AVG=$(grep "Latency" /tmp/python_result.txt | head -1 | awk '{print $2}')
    PYTHON_LATENCY_P99=$(grep "99%" /tmp/python_result.txt | awk '{print $2}')
    
    # 获取测试后内存
    if [ ! -z "$PYTHON_PID" ]; then
        PYTHON_MEM_AFTER=$(ps -p $PYTHON_PID -o rss | tail -1)
        PYTHON_MEM_AFTER_MB=$((PYTHON_MEM_AFTER / 1024))
        echo "📊 测试后内存: ${PYTHON_MEM_AFTER_MB} MB"
    fi
    
    echo ""
else
    echo "❌ Python 后端未运行 (端口 8000)"
    echo "请先启动: cd backend && uvicorn app.main:app"
    PYTHON_RPS="N/A"
    PYTHON_LATENCY_AVG="N/A"
    PYTHON_LATENCY_P99="N/A"
    PYTHON_MEM_BEFORE_MB="N/A"
    PYTHON_MEM_AFTER_MB="N/A"
fi

echo ""
echo "================================================"
echo ""

# 测试 Rust 后端
echo "2️⃣  测试 Rust Axum (端口 8080)"
echo "-----------------------------------"

if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Rust 后端正在运行"
    echo ""
    
    # 获取初始内存
    RUST_PID=$(pgrep -f "novel-backend-rust" | head -1)
    if [ ! -z "$RUST_PID" ]; then
        RUST_MEM_BEFORE=$(ps -p $RUST_PID -o rss | tail -1)
        RUST_MEM_BEFORE_MB=$((RUST_MEM_BEFORE / 1024))
        echo "📊 初始内存: ${RUST_MEM_BEFORE_MB} MB"
    fi
    
    echo ""
    echo "🚀 开始压力测试..."
    wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION}s --latency http://localhost:8080/health > /tmp/rust_result.txt
    
    # 显示结果
    cat /tmp/rust_result.txt
    
    # 提取关键指标
    RUST_RPS=$(grep "Requests/sec:" /tmp/rust_result.txt | awk '{print $2}')
    RUST_LATENCY_AVG=$(grep "Latency" /tmp/rust_result.txt | head -1 | awk '{print $2}')
    RUST_LATENCY_P99=$(grep "99%" /tmp/rust_result.txt | awk '{print $2}')
    
    # 获取测试后内存
    if [ ! -z "$RUST_PID" ]; then
        RUST_MEM_AFTER=$(ps -p $RUST_PID -o rss | tail -1)
        RUST_MEM_AFTER_MB=$((RUST_MEM_AFTER / 1024))
        echo "📊 测试后内存: ${RUST_MEM_AFTER_MB} MB"
    fi
    
    echo ""
else
    echo "❌ Rust 后端未运行 (端口 8080)"
    echo "请先启动: cd backend-rust && cargo run --release"
    RUST_RPS="N/A"
    RUST_LATENCY_AVG="N/A"
    RUST_LATENCY_P99="N/A"
    RUST_MEM_BEFORE_MB="N/A"
    RUST_MEM_AFTER_MB="N/A"
fi

echo ""
echo "================================================"
echo ""

# 对比总结
echo "📊 性能对比总结"
echo "========================================"
echo ""

printf "%-20s %-15s %-15s %-15s\n" "指标" "Python" "Rust" "提升倍数"
echo "------------------------------------------------------------------------"

# 吞吐量对比
if [ "$PYTHON_RPS" != "N/A" ] && [ "$RUST_RPS" != "N/A" ]; then
    PYTHON_RPS_NUM=$(echo $PYTHON_RPS | sed 's/,//g')
    RUST_RPS_NUM=$(echo $RUST_RPS | sed 's/,//g')
    IMPROVEMENT=$(echo "scale=1; $RUST_RPS_NUM / $PYTHON_RPS_NUM" | bc)
    printf "%-20s %-15s %-15s %-15s\n" "吞吐量 (req/s)" "$PYTHON_RPS" "$RUST_RPS" "${IMPROVEMENT}x"
else
    printf "%-20s %-15s %-15s %-15s\n" "吞吐量 (req/s)" "$PYTHON_RPS" "$RUST_RPS" "N/A"
fi

# 延迟对比
printf "%-20s %-15s %-15s %-15s\n" "平均延迟" "$PYTHON_LATENCY_AVG" "$RUST_LATENCY_AVG" "-"
printf "%-20s %-15s %-15s %-15s\n" "P99 延迟" "$PYTHON_LATENCY_P99" "$RUST_LATENCY_P99" "-"

# 内存对比
if [ "$PYTHON_MEM_BEFORE_MB" != "N/A" ] && [ "$RUST_MEM_BEFORE_MB" != "N/A" ]; then
    MEM_IMPROVEMENT=$(echo "scale=1; $PYTHON_MEM_BEFORE_MB / $RUST_MEM_BEFORE_MB" | bc)
    printf "%-20s %-15s %-15s %-15s\n" "初始内存 (MB)" "$PYTHON_MEM_BEFORE_MB" "$RUST_MEM_BEFORE_MB" "${MEM_IMPROVEMENT}x"
else
    printf "%-20s %-15s %-15s %-15s\n" "初始内存 (MB)" "$PYTHON_MEM_BEFORE_MB" "$RUST_MEM_BEFORE_MB" "N/A"
fi

if [ "$PYTHON_MEM_AFTER_MB" != "N/A" ] && [ "$RUST_MEM_AFTER_MB" != "N/A" ]; then
    printf "%-20s %-15s %-15s %-15s\n" "测试后内存 (MB)" "$PYTHON_MEM_AFTER_MB" "$RUST_MEM_AFTER_MB" "-"
fi

echo ""
echo "✅ 对比完成！"
echo ""
echo "💡 提示:"
echo "  - Rust 版本通常有 10-50倍 的性能提升"
echo "  - 内存占用降低 80-90%"
echo "  - 延迟降低 80-95%"
