from __future__ import annotations

from datetime import datetime

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AiSubscription, AuthSession, User
from app.services.ai_subscription import get_or_create_ai_subscription, has_active_ai_subscription


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


def get_current_user_ai_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AiSubscription:
    subscription = get_or_create_ai_subscription(db, user)
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def require_active_ai_subscription(
    subscription: AiSubscription = Depends(get_current_user_ai_subscription),
) -> AiSubscription:
    if not has_active_ai_subscription(subscription):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI 订阅未开通或已过期",
        )
    return subscription

