from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# uvicorn --reload 会重启子进程，CWD 可能变化。
# 用基于文件位置的绝对路径，确保始终能加载到 backend/.env。
ENV_FILE = str(Path(__file__).resolve().parents[2] / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    # CORS: 前端默认 Vite 地址
    cors_origins: str = "http://localhost:5173"

    # MySQL 配置
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "novel_db"
    db_user: str = "root"
    db_password: str = ""


settings = Settings()

