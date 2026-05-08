from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# uvicorn --reload 会重启子进程，CWD 可能变化。
# 用基于文件位置的绝对路径，确保始终能加载到 backend/.env。
ENV_FILE = str(Path(__file__).resolve().parents[2] / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    # CORS: 前端默认 Vite 地址
    cors_origins: str = "http://localhost:5173,http://localhost:5174"

    # MySQL 配置
    db_host: str = "127.0.0.1"
    db_port: int = 3306
    db_name: str = "novel_db"
    db_user: str = "root"
    db_password: str = ""

    # 安全 / 鉴权
    app_env: str = "development"
    auth_token_ttl_hours: int = 24 * 30
    verify_code_ttl_minutes: int = 10
    password_hash_iterations: int = 120_000

    # 邮件验证码
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Novel Writing"
    smtp_use_ssl: bool = True
    smtp_use_tls: bool = False
    mail_enabled: bool = False

    # AI（DashScope 兼容）
    dashscope_api_key: str = ""
    dashscope_model: str = "qwen-plus"
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"


settings = Settings()

