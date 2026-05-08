from __future__ import annotations

from datetime import datetime

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AuthSession, User


def _extract_bearer_token(authorization: str | None) -> str:
    raw = (authorization or "").strip()
    if not raw.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少 Bearer token")
    token = raw[7:].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效 token")
    return token


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_bearer_token(authorization)
    session = db.query(AuthSession).filter(AuthSession.token == token).first()
    if session is None or session.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效")

    user = db.query(User).filter(User.id == session.user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")

    session.last_seen_at = datetime.utcnow()
    db.add(session)
    db.commit()
    return user

