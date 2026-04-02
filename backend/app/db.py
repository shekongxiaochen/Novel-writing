from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.core.config import settings


def get_engine() -> Engine:
    # 使用 pymysql 连接 MySQL（后续可替换为更完善的迁移/连接池策略）
    url = (
        f"mysql+pymysql://{settings.db_user}:{settings.db_password}"
        f"@{settings.db_host}:{settings.db_port}/{settings.db_name}?charset=utf8mb4"
    )
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=3600,
    )


def ping_db() -> None:
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

