from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import AuthSession, EmailVerificationCode, LoginAttempt, User
from app.schemas import AuthOut, EmailCodeSendIn, EmailCodeSendOut, LoginIn, MessageOut, RegisterIn, ResetPasswordIn, UserOut
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
ALLOWED_CODE_PURPOSES = {"register", "reset_password"}


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
    )


def _auth_out(user: User, session: AuthSession) -> AuthOut:
    return AuthOut(token=session.token, expires_at=session.expires_at, user=_user_out(user))


def _client_ip(request: Request) -> str:
    return request.client.host if request.client and request.client.host else ""


def _latest_valid_code(db: Session, email: str, purpose: str) -> EmailVerificationCode | None:
    return (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == purpose,
            EmailVerificationCode.consumed_at.is_(None),
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )


def _check_send_code_limit(db: Session, email: str, purpose: str) -> None:
    now = datetime.utcnow()
    latest = (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == purpose,
        )
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )
    if latest is not None:
        cooldown_until = latest.created_at + timedelta(seconds=settings.verify_code_send_cooldown_seconds)
        if cooldown_until > now:
            wait_seconds = max(1, int((cooldown_until - now).total_seconds()))
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=f"发送过于频繁，请 {wait_seconds} 秒后再试")

    window_start = now - timedelta(minutes=settings.verify_code_send_window_minutes)
    window_count = (
        db.query(EmailVerificationCode)
        .filter(
            EmailVerificationCode.email == email,
            EmailVerificationCode.purpose == purpose,
            EmailVerificationCode.created_at >= window_start,
        )
        .count()
    )
    if window_count >= settings.verify_code_send_max_per_window:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="验证码请求次数过多，请稍后再试")


def _check_login_limit(db: Session, email: str, ip: str) -> None:
    window_start = datetime.utcnow() - timedelta(minutes=settings.login_failure_window_minutes)
    failure_count = (
        db.query(LoginAttempt)
        .filter(
            LoginAttempt.email == email,
            LoginAttempt.ip == ip,
            LoginAttempt.success.is_(False),
            LoginAttempt.created_at >= window_start,
        )
        .count()
    )
    if failure_count >= settings.login_failure_limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="登录失败次数过多，请稍后再试")


def _record_login_attempt(db: Session, email: str, ip: str, success: bool) -> None:
    db.add(LoginAttempt(email=email, ip=ip, success=success))
    db.commit()


@router.post("/send-code", response_model=EmailCodeSendOut)
def send_code(payload: EmailCodeSendIn, db: Session = Depends(get_db)) -> EmailCodeSendOut:
    email = normalize_email(payload.email)
    purpose = str(payload.purpose or "register").strip().lower() or "register"
    if not validate_email(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确")
    if purpose not in ALLOWED_CODE_PURPOSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的验证码用途")

    if purpose == "register":
        existed = db.query(User).filter(User.email == email).first()
        if existed is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册")
    elif db.query(User).filter(User.email == email, User.is_active.is_(True)).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="该邮箱尚未注册")

    _check_send_code_limit(db, email, purpose)

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
    return EmailCodeSendOut(
        message="验证码已发送",
        debug_code=code if not settings.mail_enabled and settings.app_env != "production" else None,
    )


@router.post("/register", response_model=AuthOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> AuthOut:
    email = normalize_email(payload.email)
    if not validate_email(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确")
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该邮箱已注册")

    code_row = _latest_valid_code(db, email, "register")
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
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)) -> AuthOut:
    email = normalize_email(payload.email)
    ip = _client_ip(request)
    _check_login_limit(db, email, ip)
    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        _record_login_attempt(db, email, ip, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")

    session = AuthSession(
        user_id=user.id,
        token=generate_token(),
        expires_at=auth_expires_at(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    _record_login_attempt(db, email, ip, success=True)
    return _auth_out(user, session)


@router.post("/reset-password", response_model=MessageOut)
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)) -> MessageOut:
    email = normalize_email(payload.email)
    if not validate_email(email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确")

    user = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="该邮箱尚未注册")

    code_row = _latest_valid_code(db, email, "reset_password")
    if code_row is None or code_row.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码不存在或已过期")
    if code_row.code_hash != hash_code(email, payload.code, "reset_password"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误")

    user.password_hash = hash_password(payload.new_password)
    code_row.consumed_at = datetime.utcnow()
    db.add(user)
    db.add(code_row)
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.commit()
    return MessageOut(message="密码已重置，请重新登录")


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

