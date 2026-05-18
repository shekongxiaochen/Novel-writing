from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def now_utc() -> datetime:
    return datetime.utcnow()


def new_id() -> str:
    return uuid4().hex


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    sessions: Mapped[list["AuthSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ai_subscriptions: Mapped[list["AiSubscription"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    payment_orders: Mapped[list["PaymentOrder"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    novels: Mapped[list["Novel"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class EmailVerificationCode(Base):
    __tablename__ = "email_verification_codes"
    __table_args__ = (
        Index("ix_email_codes_email_purpose", "email", "purpose"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), index=True)
    purpose: Mapped[str] = mapped_column(String(32), default="register")
    code_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        Index("ix_auth_sessions_token", "token"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    user: Mapped["User"] = relationship(back_populates="sessions")


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_attempts_email_created", "email", "created_at"),
        Index("ix_login_attempts_ip_created", "ip", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), index=True)
    ip: Mapped[str] = mapped_column(String(64), default="")
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)


class AiSubscription(Base):
    __tablename__ = "ai_subscriptions"
    __table_args__ = (
        UniqueConstraint("user_id", "plan_code", name="uq_ai_subscription_user_plan"),
        Index("ix_ai_subscriptions_status_expires", "status", "expires_at"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    plan_code: Mapped[str] = mapped_column(String(64), default="ai_monthly")
    billing_cycle: Mapped[str] = mapped_column(String(32), default="monthly")
    status: Mapped[str] = mapped_column(String(32), default="inactive")
    price_cents: Mapped[int] = mapped_column(Integer, default=2900)
    currency: Mapped[str] = mapped_column(String(16), default="CNY")
    payment_provider: Mapped[str] = mapped_column(String(32), default="wechat_qr_mock")
    provider_customer_id: Mapped[str] = mapped_column(String(128), default="")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    pending_order_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    meta_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    user: Mapped["User"] = relationship(back_populates="ai_subscriptions")
    payment_orders: Mapped[list["PaymentOrder"]] = relationship(back_populates="subscription")


class PaymentOrder(Base):
    __tablename__ = "payment_orders"
    __table_args__ = (
        Index("ix_payment_orders_user_status_created", "user_id", "status", "created_at"),
        Index("ix_payment_orders_subscription_created", "subscription_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    subscription_id: Mapped[str | None] = mapped_column(ForeignKey("ai_subscriptions.id", ondelete="SET NULL"), nullable=True)
    product_code: Mapped[str] = mapped_column(String(64), default="ai_sidebar")
    plan_code: Mapped[str] = mapped_column(String(64), default="ai_monthly")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    amount_cents: Mapped[int] = mapped_column(Integer, default=2900)
    currency: Mapped[str] = mapped_column(String(16), default="CNY")
    payment_provider: Mapped[str] = mapped_column(String(32), default="wechat_qr_mock")
    provider_trade_no: Mapped[str] = mapped_column(String(128), default="")
    checkout_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    user: Mapped["User"] = relationship(back_populates="payment_orders")
    subscription: Mapped["AiSubscription | None"] = relationship(back_populates="payment_orders")


class Novel(Base):
    __tablename__ = "novels"
    __table_args__ = (
        UniqueConstraint("user_id", "title", name="uq_user_novel_title"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    summary: Mapped[str] = mapped_column(Text, default="")
    genre: Mapped[str] = mapped_column(String(60), default="")
    perspective: Mapped[str] = mapped_column(String(60), default="")
    tone: Mapped[str] = mapped_column(String(60), default="")
    is_multi_line_narrative: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    user: Mapped["User"] = relationship(back_populates="novels")
    snapshot: Mapped["NovelSnapshot | None"] = relationship(
        back_populates="novel",
        cascade="all, delete-orphan",
        uselist=False,
    )
    chapters: Mapped[list["NovelChapter"]] = relationship(back_populates="novel", cascade="all, delete-orphan")
    outline_storylines: Mapped[list["OutlineStorylineRecord"]] = relationship(
        back_populates="novel",
        cascade="all, delete-orphan",
    )
    outline_items: Mapped[list["OutlineItemRecord"]] = relationship(back_populates="novel", cascade="all, delete-orphan")
    categories: Mapped[list["CategoryRecord"]] = relationship(back_populates="novel", cascade="all, delete-orphan")
    characters: Mapped[list["CharacterRecord"]] = relationship(back_populates="novel", cascade="all, delete-orphan")
    factions: Mapped[list["FactionRecord"]] = relationship(back_populates="novel", cascade="all, delete-orphan")
    items: Mapped[list["ItemRecord"]] = relationship(back_populates="novel", cascade="all, delete-orphan")
    character_relations: Mapped[list["CharacterRelationRecord"]] = relationship(
        back_populates="novel",
        cascade="all, delete-orphan",
    )
    character_faction_memberships: Mapped[list["CharacterFactionMembershipRecord"]] = relationship(
        back_populates="novel",
        cascade="all, delete-orphan",
    )
    timeline_events: Mapped[list["TimelineEventRecord"]] = relationship(
        back_populates="novel",
        cascade="all, delete-orphan",
    )
    foreshadow_plants: Mapped[list["ForeshadowPlantRecord"]] = relationship(
        back_populates="novel",
        cascade="all, delete-orphan",
    )


class NovelSnapshot(Base):
    __tablename__ = "novel_snapshots"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), unique=True, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc, onupdate=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="snapshot")


class NovelChapter(Base):
    __tablename__ = "novel_chapters"
    __table_args__ = (
        Index("ix_novel_chapters_novel_order", "novel_id", "chapter_no"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    chapter_no: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    annotation: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    outline_item_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="chapters")


class OutlineStorylineRecord(Base):
    __tablename__ = "outline_storylines"
    __table_args__ = (
        Index("ix_outline_storylines_novel_order", "novel_id", "display_order"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    type: Mapped[str] = mapped_column(String(32), default="custom")
    color: Mapped[str] = mapped_column(String(32), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="outline_storylines")


class OutlineItemRecord(Base):
    __tablename__ = "outline_items"
    __table_args__ = (
        Index("ix_outline_items_novel_order", "novel_id", "display_order"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(160), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="todo")
    level: Mapped[str] = mapped_column(String(32), default="")
    goal: Mapped[str] = mapped_column(Text, default="")
    conflict: Mapped[str] = mapped_column(Text, default="")
    twist: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(Text, default="")
    suspense: Mapped[str] = mapped_column(Text, default="")
    plot_stage: Mapped[str] = mapped_column(String(32), default="")
    storyline_ids: Mapped[list] = mapped_column(JSON, default=list)
    parent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    location: Mapped[str] = mapped_column(String(255), default="")
    time_label: Mapped[str] = mapped_column(String(120), default="")
    pov_character_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tension: Mapped[int | None] = mapped_column(Integer, nullable=True)
    character_ids: Mapped[list] = mapped_column(JSON, default=list)
    faction_ids: Mapped[list] = mapped_column(JSON, default=list)
    foreshadow_ids: Mapped[list] = mapped_column(JSON, default=list)
    issue_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="outline_items")


class CategoryRecord(Base):
    __tablename__ = "categories"
    __table_args__ = (
        Index("ix_categories_novel_name", "novel_id", "name"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="categories")


class CharacterRecord(Base):
    __tablename__ = "characters"
    __table_args__ = (
        Index("ix_characters_novel_name", "novel_id", "name"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    created_in_chapter_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_appearance_chapter_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age: Mapped[str] = mapped_column(String(60), default="")
    gender: Mapped[str] = mapped_column(String(30), default="")
    goal: Mapped[str] = mapped_column(Text, default="")
    secret: Mapped[str] = mapped_column(Text, default="")
    arc: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    attributes: Mapped[list] = mapped_column(JSON, default=list)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    category_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="characters")


class FactionRecord(Base):
    __tablename__ = "factions"
    __table_args__ = (
        Index("ix_factions_novel_name", "novel_id", "name"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    created_in_chapter_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    leader: Mapped[str] = mapped_column(String(120), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    attributes: Mapped[list] = mapped_column(JSON, default=list)
    category_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="factions")


class ItemRecord(Base):
    __tablename__ = "items"
    __table_args__ = (
        Index("ix_items_novel_name", "novel_id", "name"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    owner_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    owner_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_appearance_chapter_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attributes: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="items")


class CharacterRelationRecord(Base):
    __tablename__ = "character_relations"
    __table_args__ = (
        Index("ix_character_relations_novel_from_to", "novel_id", "from_character_id", "to_character_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    from_character_id: Mapped[str] = mapped_column(String(64))
    to_character_id: Mapped[str] = mapped_column(String(64))
    relation_type: Mapped[str] = mapped_column(String(120), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="character_relations")


class CharacterFactionMembershipRecord(Base):
    __tablename__ = "character_faction_memberships"
    __table_args__ = (
        Index("ix_character_faction_memberships_novel_pair", "novel_id", "character_id", "faction_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    character_id: Mapped[str] = mapped_column(String(64))
    faction_id: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="character_faction_memberships")


class TimelineEventRecord(Base):
    __tablename__ = "timeline_events"
    __table_args__ = (
        Index("ix_timeline_events_novel_order", "novel_id", "display_order"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    story_label: Mapped[str] = mapped_column(String(120), default="")
    title: Mapped[str] = mapped_column(String(160), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    chapter_no_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chapter_no_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outline_item_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="timeline_events")


class ForeshadowPlantRecord(Base):
    __tablename__ = "foreshadow_plants"
    __table_args__ = (
        Index("ix_foreshadow_plants_novel_chapter", "novel_id", "plant_chapter_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    novel_id: Mapped[str] = mapped_column(ForeignKey("novels.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160), default="")
    plant_text: Mapped[str] = mapped_column(Text, default="")
    plant_chapter_id: Mapped[str] = mapped_column(String(64), default="")
    plant_chapter_no: Mapped[int] = mapped_column(Integer, default=0)
    plant_chapter_title: Mapped[str] = mapped_column(String(160), default="")
    plant_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    plant_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    expected_fulfill_chapter_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expected_fulfill_notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    novel: Mapped["Novel"] = relationship(back_populates="foreshadow_plants")
    fulfillments: Mapped[list["ForeshadowFulfillmentRecord"]] = relationship(
        back_populates="plant",
        cascade="all, delete-orphan",
    )


class ForeshadowFulfillmentRecord(Base):
    __tablename__ = "foreshadow_fulfillments"
    __table_args__ = (
        Index("ix_foreshadow_fulfillments_plant_created", "plant_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plant_id: Mapped[str] = mapped_column(ForeignKey("foreshadow_plants.id", ondelete="CASCADE"), index=True)
    fulfill_text: Mapped[str] = mapped_column(Text, default="")
    fulfill_chapter_id: Mapped[str] = mapped_column(String(64), default="")
    fulfill_chapter_no: Mapped[int] = mapped_column(Integer, default=0)
    fulfill_chapter_title: Mapped[str] = mapped_column(String(160), default="")
    fulfill_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fulfill_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_utc)

    plant: Mapped["ForeshadowPlantRecord"] = relationship(back_populates="fulfillments")
