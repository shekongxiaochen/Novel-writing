from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False)


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        # 使用 pymysql 连接 MySQL
        url = (
            f"mysql+pymysql://{settings.db_user}:{settings.db_password}"
            f"@{settings.db_host}:{settings.db_port}/{settings.db_name}?charset=utf8mb4"
        )
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        SessionLocal.configure(bind=_engine)
    return _engine


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ping_db() -> None:
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))


def remove_legacy_outline_storyline_schema() -> None:
    engine = get_engine()
    with engine.begin() as conn:
        has_storyline_table = conn.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = DATABASE() AND table_name = 'outline_storylines'
                """
            )
        ).scalar()
        if has_storyline_table:
            conn.execute(text("DROP TABLE outline_storylines"))

        has_storyline_column = conn.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = 'outline_items'
                  AND column_name = 'storyline_ids'
                """
            )
        ).scalar()
        if has_storyline_column:
            conn.execute(text("ALTER TABLE outline_items DROP COLUMN storyline_ids"))


def init_db() -> None:
    from app import models  # noqa: F401  # 确保模型被注册
    from app.services.novel_sync import backfill_all_novels_from_snapshots

    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    remove_legacy_outline_storyline_schema()

    with SessionLocal() as db:
        backfill_all_novels_from_snapshots(db)
        db.commit()
