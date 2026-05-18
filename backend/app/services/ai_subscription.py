from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import AiSubscription, PaymentOrder, User

AI_PLAN_CODE = "ai_monthly"
AI_PRODUCT_CODE = "ai_sidebar"
AI_PRICE_CENTS = 2900
AI_CURRENCY = "CNY"
AI_PROVIDER = "wechat_qr_mock"


def now_utc() -> datetime:
    return datetime.utcnow()


def get_or_create_ai_subscription(db: Session, user: User) -> AiSubscription:
    row = (
        db.query(AiSubscription)
        .filter(AiSubscription.user_id == user.id, AiSubscription.plan_code == AI_PLAN_CODE)
        .first()
    )
    if row is not None:
        normalize_ai_subscription_state(row)
        return row

    row = AiSubscription(
        user_id=user.id,
        plan_code=AI_PLAN_CODE,
        billing_cycle="monthly",
        status="inactive",
        price_cents=AI_PRICE_CENTS,
        currency=AI_CURRENCY,
        payment_provider=AI_PROVIDER,
    )
    db.add(row)
    db.flush()
    return row


def normalize_ai_subscription_state(row: AiSubscription) -> AiSubscription:
    current = now_utc()
    if row.status == "active" and row.expires_at and row.expires_at <= current:
        row.status = "expired"
        row.pending_order_id = None
    if row.status == "pending" and row.pending_order_id:
        pending = [order for order in row.payment_orders if order.id == row.pending_order_id]
        order = pending[0] if pending else None
        expires_at = order.expires_at if order is not None else None
        if expires_at and expires_at <= current:
            row.status = "inactive"
            row.pending_order_id = None
    return row


def has_active_ai_subscription(row: AiSubscription) -> bool:
    normalize_ai_subscription_state(row)
    return row.status == "active" and row.expires_at is not None and row.expires_at > now_utc()


def create_ai_payment_order(db: Session, user: User) -> tuple[AiSubscription, PaymentOrder]:
    subscription = get_or_create_ai_subscription(db, user)
    current = now_utc()
    order = PaymentOrder(
        user_id=user.id,
        subscription_id=subscription.id,
        product_code=AI_PRODUCT_CODE,
        plan_code=subscription.plan_code,
        status="pending",
        amount_cents=subscription.price_cents,
        currency=subscription.currency,
        payment_provider=subscription.payment_provider,
        provider_trade_no=f"MOCK-{current.strftime('%Y%m%d%H%M%S')}-{user.id[:6].upper()}",
        checkout_payload={
            "display_price": f"{subscription.price_cents / 100:.2f}",
            "currency": subscription.currency,
            "qr_mode": "mock",
            "qr_text": f"AI-SUB-{user.id[:8]}-{current.strftime('%m%d%H%M')}",
        },
        expires_at=current + timedelta(minutes=30),
    )
    db.add(order)
    db.flush()

    subscription.status = "pending"
    subscription.pending_order_id = order.id
    subscription.payment_provider = order.payment_provider
    subscription.meta_json = {
        **(subscription.meta_json or {}),
        "last_order_id": order.id,
        "last_order_created_at": current.isoformat(),
    }
    db.add(subscription)
    db.flush()
    return subscription, order


def activate_ai_subscription_from_order(db: Session, order: PaymentOrder) -> AiSubscription:
    subscription = order.subscription
    if subscription is None:
        raise ValueError("payment order missing subscription")
    current = now_utc()
    order.status = "paid"
    order.paid_at = current
    db.add(order)

    subscription.status = "active"
    subscription.started_at = current
    base = subscription.expires_at if subscription.expires_at and subscription.expires_at > current else current
    subscription.expires_at = base + timedelta(days=30)
    subscription.pending_order_id = None
    subscription.payment_provider = order.payment_provider
    subscription.meta_json = {
        **(subscription.meta_json or {}),
        "last_paid_order_id": order.id,
        "last_paid_at": current.isoformat(),
    }
    db.add(subscription)
    db.flush()
    return subscription


def reset_ai_subscription(db: Session, user: User) -> AiSubscription:
    subscription = get_or_create_ai_subscription(db, user)
    subscription.status = "inactive"
    subscription.started_at = None
    subscription.expires_at = None
    subscription.pending_order_id = None
    subscription.meta_json = {}
    db.add(subscription)
    db.flush()
    return subscription
