from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import AuthSession, EmailVerificationCode, User
from app.schemas import AuthOut, EmailCodeSendIn, LoginIn, MessageOut, RegisterIn, UserOut
from app.security import (
    auth_expires_at,
    code_expires_at,
    generate_code,
    generate_token,
    hash_code,
    hash_password,
    normalize_email,
    validate_email,
    verify_password,
)
from app.services.email_service import send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
    )


def _auth_out(user: User, session: AuthSession) -> AuthOut:
    return AuthOut(token=session.token, expires_at=session.expires_at, user=_user_out(user))


@router.post("/send-code", response_model=MessageOut)
def send_code(payload: EmailCodeSendIn, db: Session = Depends(get_db)) -> MessageOut:
    email = normalize_email(payload.email)
    purpose = str(payload.purpose or "register").strip().lower() or "register"
    if not validate_email(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确")

    if purpose == "register":
        existed = db.query(User).filter(User.email == email).first()
        if existed is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册")

    code = generate_code()
    row = EmailVerificationCode(
        email=email,
        purpose=purpose,
        code_hash=hash_code(email, code, purpose),
        expires_at=code_expires_at(),
    )
    db.add(row)
    db.commit()

    send_verification_email(email, code)
    return MessageOut(message="验证码已发送")


@router.post("/register", response_model=AuthOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> AuthOut:
    email = normalize_email(payload.email)
    if not validate_email(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确")
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册")

    code_row = (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == "register",
            EmailVerificationCode.consumed_at.is_(None),
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )
    if code_row is None or code_row.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码不存在或已过期")
    if code_row.code_hash != hash_code(email, payload.code, "register"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        display_name=(payload.display_name or "").strip() or email.split("@")[0],
        email_verified=True,
    )
    db.add(user)
    code_row.consumed_at = datetime.utcnow()
    db.add(code_row)
    db.flush()

    session = AuthSession(
        user_id=user.id,
        token=generate_token(),
        expires_at=auth_expires_at(),
    )
    db.add(session)
    db.commit()
    db.refresh(user)
    db.refresh(session)
    return _auth_out(user, session)


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> AuthOut:
    email = normalize_email(payload.email)
    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")

    session = AuthSession(
        user_id=user.id,
        token=generate_token(),
        expires_at=auth_expires_at(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _auth_out(user, session)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return _user_out(user)


@router.post("/logout", response_model=MessageOut)
def logout(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> MessageOut:
    token = (authorization or "").replace("Bearer", "").strip()
    if token:
        db.query(AuthSession).filter(AuthSession.token == token, AuthSession.user_id == user.id).delete()
        db.commit()
    return MessageOut(message="已退出登录")

