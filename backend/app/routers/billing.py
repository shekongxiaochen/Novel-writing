from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import PaymentOrder, User
from app.schemas import (
    AiAccessOut,
    AiSubscriptionCreateOrderIn,
    AiSubscriptionCreateOrderOut,
    AiSubscriptionOut,
    AiSubscriptionStatusOut,
    PaymentOrderOut,
)
from app.services.ai_subscription import (
    activate_ai_subscription_from_order,
    create_ai_payment_order,
    get_or_create_ai_subscription,
    has_active_ai_subscription,
    normalize_ai_subscription_state,
    reset_ai_subscription,
)

router = APIRouter(prefix="/billing", tags=["billing"])


def _subscription_out(row) -> AiSubscriptionOut:
    return AiSubscriptionOut(
        id=row.id,
        plan_code=row.plan_code,
        billing_cycle=row.billing_cycle,
        status=row.status,
        price_cents=row.price_cents,
        currency=row.currency,
        payment_provider=row.payment_provider,
        started_at=row.started_at,
        expires_at=row.expires_at,
        pending_order_id=row.pending_order_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _order_out(row: PaymentOrder) -> PaymentOrderOut:
    return PaymentOrderOut(
        id=row.id,
        subscription_id=row.subscription_id,
        product_code=row.product_code,
        plan_code=row.plan_code,
        status=row.status,
        amount_cents=row.amount_cents,
        currency=row.currency,
        payment_provider=row.payment_provider,
        provider_trade_no=row.provider_trade_no,
        checkout_payload=row.checkout_payload if isinstance(row.checkout_payload, dict) else {},
        paid_at=row.paid_at,
        expires_at=row.expires_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _latest_user_order(db: Session, user_id: str) -> PaymentOrder | None:
    return (
        db.query(PaymentOrder)
        .filter(PaymentOrder.user_id == user_id)
        .order_by(PaymentOrder.created_at.desc())
        .first()
    )


@router.get("/ai-subscription", response_model=AiSubscriptionStatusOut)
def get_ai_subscription_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AiSubscriptionStatusOut:
    subscription = get_or_create_ai_subscription(db, user)
    normalize_ai_subscription_state(subscription)
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    latest_order = _latest_user_order(db, user.id)
    active = has_active_ai_subscription(subscription)
    return AiSubscriptionStatusOut(
        subscription=_subscription_out(subscription),
        active=active,
        requires_payment=not active,
        latest_order=_order_out(latest_order) if latest_order is not None else None,
    )


@router.get("/ai-access", response_model=AiAccessOut)
def get_ai_access(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AiAccessOut:
    subscription = get_or_create_ai_subscription(db, user)
    normalize_ai_subscription_state(subscription)
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    allowed = has_active_ai_subscription(subscription)
    return AiAccessOut(
        allowed=allowed,
        reason="active_subscription" if allowed else "subscription_required",
        subscription=_subscription_out(subscription),
    )


@router.post("/ai-subscription/orders", response_model=AiSubscriptionCreateOrderOut)
def create_subscription_order(
    payload: AiSubscriptionCreateOrderIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AiSubscriptionCreateOrderOut:
    if payload.refresh_existing_pending:
        latest_order = _latest_user_order(db, user.id)
        if latest_order is not None and latest_order.status == "pending":
            latest_order.status = "expired"
            db.add(latest_order)
            db.flush()

    subscription, order = create_ai_payment_order(db, user)
    db.commit()
    db.refresh(subscription)
    db.refresh(order)
    return AiSubscriptionCreateOrderOut(
        subscription=_subscription_out(subscription),
        order=_order_out(order),
    )


@router.get("/ai-subscription/orders/{order_id}", response_model=PaymentOrderOut)
def get_subscription_order(
    order_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaymentOrderOut:
    order = db.query(PaymentOrder).filter(PaymentOrder.id == order_id, PaymentOrder.user_id == user.id).first()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")
    return _order_out(order)


@router.post("/ai-subscription/orders/{order_id}/mock-activate", response_model=AiSubscriptionStatusOut)
def mock_activate_subscription_order(
    order_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AiSubscriptionStatusOut:
    order = db.query(PaymentOrder).filter(PaymentOrder.id == order_id, PaymentOrder.user_id == user.id).first()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")
    if order.status == "paid":
        subscription = order.subscription
        if subscription is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="订单缺少订阅记录")
    else:
        subscription = activate_ai_subscription_from_order(db, order)
    db.commit()
    db.refresh(subscription)
    db.refresh(order)
    return AiSubscriptionStatusOut(
        subscription=_subscription_out(subscription),
        active=True,
        requires_payment=False,
        latest_order=_order_out(order),
    )


@router.post("/ai-subscription/reset", response_model=AiSubscriptionStatusOut)
def reset_subscription_state(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AiSubscriptionStatusOut:
    subscription = reset_ai_subscription(db, user)
    db.commit()
    db.refresh(subscription)
    latest_order = _latest_user_order(db, user.id)
    return AiSubscriptionStatusOut(
        subscription=_subscription_out(subscription),
        active=False,
        requires_payment=True,
        latest_order=_order_out(latest_order) if latest_order is not None else None,
    )
