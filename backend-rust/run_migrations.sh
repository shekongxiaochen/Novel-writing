#!/bin/bash

# 数据库迁移脚本

echo "🔄 Running database migrations..."

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 检查 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env"
    exit 1
fi

# 提取数据库连接信息
DB_URL=$DATABASE_URL

# 运行迁移
for migration in migrations/*.sql; do
    echo "📝 Running $migration..."
    mysql --defaults-extra-file=<(echo "[client]"; echo "password=$DB_PASSWORD") \
          -h $DB_HOST -u $DB_USER $DB_NAME < "$migration"
    
    if [ $? -eq 0 ]; then
        echo "✅ $migration completed"
    else
        echo "❌ $migration failed"
        exit 1
    fi
done

echo "✅ All migrations completed successfully!"
