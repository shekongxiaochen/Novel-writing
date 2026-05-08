from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_verification_email(to_email: str, code: str) -> None:
    if not settings.mail_enabled:
        print(f"[mail-disabled] send code {code} to {to_email}")
        return

    msg = EmailMessage()
    msg["Subject"] = "Novel Writing 注册验证码"
    msg["From"] = settings.smtp_from_email or settings.smtp_username
    msg["To"] = to_email
    msg.set_content(
        f"你的 Novel Writing 注册验证码是：{code}\n\n"
        f"验证码 {settings.verify_code_ttl_minutes} 分钟内有效，请勿泄露给他人。"
    )

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
        return

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)

