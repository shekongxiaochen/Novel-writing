.PHONY: help build run test clean fmt clippy migrate docker-build docker-run

help: ## 显示帮助信息
	@echo "可用命令:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## 编译项目
	cargo build --release

run: ## 运行项目
	cargo run --release

dev: ## 开发模式运行（带热重载）
	cargo watch -x run

test: ## 运行测试
	cargo test

test-verbose: ## 运行测试（详细输出）
	cargo test -- --nocapture

clean: ## 清理构建文件
	cargo clean

fmt: ## 格式化代码
	cargo fmt

clippy: ## 代码检查
	cargo clippy -- -D warnings

check: fmt clippy test ## 完整检查（格式化+Clippy+测试）

migrate: ## 运行数据库迁移
	@if [ -f run_migrations.sh ]; then \
		./run_migrations.sh; \
	else \
		echo "请先创建 .env 文件"; \
	fi

docker-build: ## 构建 Docker 镜像
	docker build -t novel-backend-rust:latest .

docker-run: ## 运行 Docker 容器
	docker run -p 8080:8080 --env-file .env novel-backend-rust:latest

docker-compose-up: ## 使用 docker-compose 启动
	docker-compose up -d

docker-compose-down: ## 停止 docker-compose
	docker-compose down

bench: ## 性能测试
	@echo "运行性能测试..."
	@if command -v wrk > /dev/null; then \
		wrk -t12 -c400 -d30s --latency http://localhost:8080/health; \
	else \
		echo "请先安装 wrk: https://github.com/wg/wrk"; \
	fi

install-tools: ## 安装开发工具
	cargo install cargo-watch
	cargo install cargo-edit

setup: ## 初始化项目
	@echo "初始化项目..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ 已创建 .env 文件，请编辑配置"; \
	fi
	@echo "✅ 运行 'make migrate' 来初始化数据库"
	@echo "✅ 运行 'make run' 来启动服务"

all: fmt clippy test build ## 完整构建流程
