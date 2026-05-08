from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta

from app.core.config import settings

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(email: str) -> str:
    return str(email or "").strip().lower()


def validate_email(email: str) -> bool:
    return bool(EMAIL_RE.match(normalize_email(email)))


def generate_code() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_password(password: str, salt: str | None = None) -> str:
    use_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        use_salt.encode("utf-8"),
        settings.password_hash_iterations,
    )
    return f"pbkdf2_sha256${settings.password_hash_iterations}${use_salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        _algo, iter_s, salt, hex_digest = password_hash.split("$", 3)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iter_s),
        ).hex()
        return hmac.compare_digest(digest, hex_digest)
    except Exception:
        return False


def hash_code(email: str, code: str, purpose: str) -> str:
    raw = f"{normalize_email(email)}:{purpose}:{code}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def auth_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(hours=settings.auth_token_ttl_hours)


def code_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(minutes=settings.verify_code_ttl_minutes)

