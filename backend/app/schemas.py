from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class EmailCodeSendIn(BaseModel):
    email: str
    purpose: str = "register"


class EmailCodeSendOut(BaseModel):
    message: str
    debug_code: str | None = None


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)
    code: str = Field(min_length=4, max_length=12)
    display_name: str = Field(default="", max_length=120)


class LoginIn(BaseModel):
    email: str
    password: str = Field(min_length=6, max_length=128)


class ResetPasswordIn(BaseModel):
    email: str
    code: str = Field(min_length=4, max_length=12)
    new_password: str = Field(min_length=6, max_length=128)


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: datetime


class AuthOut(BaseModel):
    token: str
    expires_at: datetime
    user: UserOut


class NovelBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    summary: str = ""
    genre: str = ""
    perspective: str = ""
    tone: str = ""
    is_multi_line_narrative: bool = False


class NovelCreateIn(NovelBase):
    id: str | None = Field(default=None, min_length=1, max_length=64)


class NovelUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    summary: str | None = None
    genre: str | None = None
    perspective: str | None = None
    tone: str | None = None
    is_multi_line_narrative: bool | None = None


class NovelOut(NovelBase):
    id: str
    created_at: datetime
    updated_at: datetime


class SnapshotPutIn(BaseModel):
    payload: dict[str, Any]


class SnapshotOut(BaseModel):
    novel_id: str
    version: int
    payload: dict[str, Any]
    updated_at: datetime


class WorkspaceOut(BaseModel):
    novel_id: str
    snapshot_version: int
    payload: dict[str, Any]
    updated_at: datetime


class ChapterBase(BaseModel):
    chapter_no: int = Field(ge=1)
    title: str = Field(default="", max_length=120)
    notes: str = ""
    annotation: str = ""
    content: str = ""
    outline_item_ids: list[str] = Field(default_factory=list)
    status: str = Field(default="draft", max_length=32)


class ChapterCreateIn(ChapterBase):
    id: str = Field(min_length=1, max_length=64)


class ChapterUpdateIn(BaseModel):
    chapter_no: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    annotation: str | None = None
    content: str | None = None
    outline_item_ids: list[str] | None = None
    status: str | None = Field(default=None, max_length=32)


class ChapterOut(ChapterBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class CharacterBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    created_in_chapter_id: str | None = None
    first_appearance_chapter_no: int | None = Field(default=None, ge=1)
    age: str = Field(default="", max_length=60)
    gender: str = Field(default="", max_length=30)
    goal: str = ""
    secret: str = ""
    arc: str = ""
    notes: str = ""
    attributes: list[dict[str, Any]] = Field(default_factory=list)
    aliases: list[str] = Field(default_factory=list)
    category_ids: list[str] = Field(default_factory=list)


class CharacterCreateIn(CharacterBase):
    id: str = Field(min_length=1, max_length=64)


class CharacterUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    created_in_chapter_id: str | None = None
    first_appearance_chapter_no: int | None = Field(default=None, ge=1)
    age: str | None = Field(default=None, max_length=60)
    gender: str | None = Field(default=None, max_length=30)
    goal: str | None = None
    secret: str | None = None
    arc: str | None = None
    notes: str | None = None
    attributes: list[dict[str, Any]] | None = None
    aliases: list[str] | None = None
    category_ids: list[str] | None = None


class CharacterOut(CharacterBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class FactionBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    created_in_chapter_id: str | None = None
    leader: str = Field(default="", max_length=120)
    notes: str = ""
    attributes: list[dict[str, Any]] = Field(default_factory=list)
    category_ids: list[str] = Field(default_factory=list)


class FactionCreateIn(FactionBase):
    id: str = Field(min_length=1, max_length=64)


class FactionUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    created_in_chapter_id: str | None = None
    leader: str | None = Field(default=None, max_length=120)
    notes: str | None = None
    attributes: list[dict[str, Any]] | None = None
    category_ids: list[str] | None = None


class FactionOut(FactionBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    summary: str = ""
    owner_type: str | None = Field(default=None, max_length=30)
    owner_id: str | None = Field(default=None, max_length=64)
    first_appearance_chapter_no: int | None = Field(default=None, ge=1)
    attributes: list[dict[str, Any]] = Field(default_factory=list)


class ItemCreateIn(ItemBase):
    id: str = Field(min_length=1, max_length=64)


class ItemUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    summary: str | None = None
    owner_type: str | None = Field(default=None, max_length=30)
    owner_id: str | None = Field(default=None, max_length=64)
    first_appearance_chapter_no: int | None = Field(default=None, ge=1)
    attributes: list[dict[str, Any]] | None = None


class ItemOut(ItemBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    notes: str = ""


class CategoryCreateIn(CategoryBase):
    id: str = Field(min_length=1, max_length=64)


class CategoryUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = None


class CategoryOut(CategoryBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class CharacterRelationBase(BaseModel):
    from_character_id: str = Field(min_length=1, max_length=64)
    to_character_id: str = Field(min_length=1, max_length=64)
    relation_type: str = Field(default="", max_length=120)
    note: str = ""


class CharacterRelationCreateIn(CharacterRelationBase):
    id: str = Field(min_length=1, max_length=64)


class CharacterRelationUpdateIn(BaseModel):
    from_character_id: str | None = Field(default=None, min_length=1, max_length=64)
    to_character_id: str | None = Field(default=None, min_length=1, max_length=64)
    relation_type: str | None = Field(default=None, max_length=120)
    note: str | None = None


class CharacterRelationOut(CharacterRelationBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class CharacterFactionMembershipBase(BaseModel):
    character_id: str = Field(min_length=1, max_length=64)
    faction_id: str = Field(min_length=1, max_length=64)
    description: str = ""


class CharacterFactionMembershipCreateIn(CharacterFactionMembershipBase):
    id: str = Field(min_length=1, max_length=64)


class CharacterFactionMembershipUpdateIn(BaseModel):
    character_id: str | None = Field(default=None, min_length=1, max_length=64)
    faction_id: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = None


class CharacterFactionMembershipOut(CharacterFactionMembershipBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class OutlineStorylineBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(default="custom", max_length=32)
    color: str = Field(default="", max_length=32)
    description: str = ""
    order: int = Field(default=0, ge=0)


class OutlineStorylineCreateIn(OutlineStorylineBase):
    id: str = Field(min_length=1, max_length=64)


class OutlineStorylineUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: str | None = Field(default=None, max_length=32)
    color: str | None = Field(default=None, max_length=32)
    description: str | None = None
    order: int | None = Field(default=None, ge=0)


class OutlineStorylineOut(OutlineStorylineBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class OutlineItemBase(BaseModel):
    order: int = Field(default=0, ge=0)
    title: str = Field(min_length=1, max_length=160)
    summary: str = ""
    status: str = Field(default="todo", max_length=32)
    level: str | None = Field(default=None, max_length=32)
    goal: str = ""
    conflict: str = ""
    twist: str = ""
    result: str = ""
    suspense: str = ""
    plot_stage: str | None = Field(default=None, max_length=32)
    storyline_ids: list[str] = Field(default_factory=list)
    parent_id: str | None = Field(default=None, max_length=64)
    location: str = Field(default="", max_length=255)
    time_label: str = Field(default="", max_length=120)
    pov_character_id: str | None = Field(default=None, max_length=64)
    tension: int | None = Field(default=None, ge=1, le=5)
    character_ids: list[str] = Field(default_factory=list)
    faction_ids: list[str] = Field(default_factory=list)
    foreshadow_ids: list[str] = Field(default_factory=list)
    issue_ids: list[str] = Field(default_factory=list)


class OutlineItemCreateIn(OutlineItemBase):
    id: str = Field(min_length=1, max_length=64)


class OutlineItemUpdateIn(BaseModel):
    order: int | None = Field(default=None, ge=0)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    summary: str | None = None
    status: str | None = Field(default=None, max_length=32)
    level: str | None = Field(default=None, max_length=32)
    goal: str | None = None
    conflict: str | None = None
    twist: str | None = None
    result: str | None = None
    suspense: str | None = None
    plot_stage: str | None = Field(default=None, max_length=32)
    storyline_ids: list[str] | None = None
    parent_id: str | None = Field(default=None, max_length=64)
    location: str | None = Field(default=None, max_length=255)
    time_label: str | None = Field(default=None, max_length=120)
    pov_character_id: str | None = Field(default=None, max_length=64)
    tension: int | None = Field(default=None, ge=1, le=5)
    character_ids: list[str] | None = None
    faction_ids: list[str] | None = None
    foreshadow_ids: list[str] | None = None
    issue_ids: list[str] | None = None


class OutlineItemOut(OutlineItemBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class TimelineEventBase(BaseModel):
    order: int = Field(default=0, ge=0)
    story_label: str = Field(default="", max_length=120)
    title: str = Field(min_length=1, max_length=160)
    summary: str = ""
    chapter_no_start: int | None = Field(default=None, ge=1)
    chapter_no_end: int | None = Field(default=None, ge=1)
    chapter_no: int | None = Field(default=None, ge=1)
    outline_item_id: str | None = Field(default=None, max_length=64)


class TimelineEventCreateIn(TimelineEventBase):
    id: str = Field(min_length=1, max_length=64)


class TimelineEventUpdateIn(BaseModel):
    order: int | None = Field(default=None, ge=0)
    story_label: str | None = Field(default=None, max_length=120)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    summary: str | None = None
    chapter_no_start: int | None = Field(default=None, ge=1)
    chapter_no_end: int | None = Field(default=None, ge=1)
    chapter_no: int | None = Field(default=None, ge=1)
    outline_item_id: str | None = Field(default=None, max_length=64)


class TimelineEventOut(TimelineEventBase):
    id: str
    novel_id: str
    created_at: datetime
    updated_at: datetime


class ForeshadowFulfillmentBase(BaseModel):
    fulfill_text: str = ""
    fulfill_chapter_id: str = Field(min_length=1, max_length=64)
    fulfill_chapter_no: int = Field(ge=1)
    fulfill_chapter_title: str = Field(default="", max_length=160)
    fulfill_start: int | None = Field(default=None, ge=0)
    fulfill_end: int | None = Field(default=None, ge=0)
    notes: str = ""


class ForeshadowFulfillmentCreateIn(ForeshadowFulfillmentBase):
    id: str = Field(min_length=1, max_length=64)


class ForeshadowFulfillmentUpdateIn(BaseModel):
    fulfill_text: str | None = None
    fulfill_chapter_id: str | None = Field(default=None, min_length=1, max_length=64)
    fulfill_chapter_no: int | None = Field(default=None, ge=1)
    fulfill_chapter_title: str | None = Field(default=None, max_length=160)
    fulfill_start: int | None = Field(default=None, ge=0)
    fulfill_end: int | None = Field(default=None, ge=0)
    notes: str | None = None


class ForeshadowFulfillmentOut(ForeshadowFulfillmentBase):
    id: str
    created_at: datetime


class ForeshadowPlantBase(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    plant_text: str = ""
    plant_chapter_id: str = Field(min_length=1, max_length=64)
    plant_chapter_no: int = Field(ge=1)
    plant_chapter_title: str = Field(default="", max_length=160)
    plant_start: int | None = Field(default=None, ge=0)
    plant_end: int | None = Field(default=None, ge=0)
    description: str = ""
    expected_fulfill_chapter_no: int | None = Field(default=None, ge=1)
    expected_fulfill_notes: str = ""
    status: str = Field(default="open", max_length=32)


class ForeshadowPlantCreateIn(ForeshadowPlantBase):
    id: str = Field(min_length=1, max_length=64)


class ForeshadowPlantUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    plant_text: str | None = None
    plant_chapter_id: str | None = Field(default=None, min_length=1, max_length=64)
    plant_chapter_no: int | None = Field(default=None, ge=1)
    plant_chapter_title: str | None = Field(default=None, max_length=160)
    plant_start: int | None = Field(default=None, ge=0)
    plant_end: int | None = Field(default=None, ge=0)
    description: str | None = None
    expected_fulfill_chapter_no: int | None = Field(default=None, ge=1)
    expected_fulfill_notes: str | None = None
    status: str | None = Field(default=None, max_length=32)


class ForeshadowPlantOut(ForeshadowPlantBase):
    id: str
    novel_id: str
    fulfillments: list[ForeshadowFulfillmentOut]
    created_at: datetime
    updated_at: datetime


class MessageOut(BaseModel):
    message: str


class OutlineAiExpandIn(BaseModel):
    title: str = Field(default="", max_length=120)
    summary: str = Field(default="", max_length=500)
    goal: str = Field(default="", max_length=500)
    conflict: str = Field(default="", max_length=500)
    twist: str = Field(default="", max_length=500)
    result: str = Field(default="", max_length=500)
    suspense: str = Field(default="", max_length=500)
    mode: str = Field(default="full", pattern="^(full|conflict|twist|suspense)$")


class OutlineAiExpandOut(BaseModel):
    conflict: str = ""
    twist: str = ""
    suspense: str = ""


class EntityEvidence(BaseModel):
    chapter_id: str
    chapter_no: int | None = None
    quote: str = ""


class EntityMatch(BaseModel):
    type: Literal["new", "update", "possible_duplicate", "conflict"] = "new"
    target_id: str | None = None
    target_name: str | None = None


class ExtractedCharacter(BaseModel):
    name: str = ""
    aliases: list[str] = Field(default_factory=list)
    gender: str = ""
    age: str = ""
    goal: str = ""
    secret: str = ""
    notes: str = ""
    first_appearance_chapter_no: int | None = None
    confidence: float = 0.0
    match: EntityMatch = Field(default_factory=EntityMatch)
    evidences: list[EntityEvidence] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ExtractedFaction(BaseModel):
    name: str = ""
    leader: str = ""
    notes: str = ""
    confidence: float = 0.0
    match: EntityMatch = Field(default_factory=EntityMatch)
    evidences: list[EntityEvidence] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ExtractedItem(BaseModel):
    name: str = ""
    summary: str = ""
    owner_type: str | None = None
    owner_id: str | None = None
    owner_name: str = ""
    first_appearance_chapter_no: int | None = None
    confidence: float = 0.0
    match: EntityMatch = Field(default_factory=EntityMatch)
    evidences: list[EntityEvidence] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ExtractedMembership(BaseModel):
    character_name: str = ""
    faction_name: str = ""
    description: str = ""
    confidence: float = 0.0
    match: EntityMatch = Field(default_factory=EntityMatch)
    evidences: list[EntityEvidence] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ExtractedRelation(BaseModel):
    from_character_name: str = ""
    to_character_name: str = ""
    relation_type: str = ""
    note: str = ""
    confidence: float = 0.0
    match: EntityMatch = Field(default_factory=EntityMatch)
    evidences: list[EntityEvidence] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class NovelEntityExtractIn(BaseModel):
    mode: Literal["current", "recent", "all"] = "current"
    chapter_ids: list[str] = Field(default_factory=list)
    include_existing_entities: bool = True


class NovelEntityExtractOut(BaseModel):
    characters: list[ExtractedCharacter] = Field(default_factory=list)
    factions: list[ExtractedFaction] = Field(default_factory=list)
    items: list[ExtractedItem] = Field(default_factory=list)
    memberships: list[ExtractedMembership] = Field(default_factory=list)
    relations: list[ExtractedRelation] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AiSubscriptionOut(BaseModel):
    id: str
    plan_code: str
    billing_cycle: str
    status: str
    price_cents: int
    currency: str
    payment_provider: str
    started_at: datetime | None = None
    expires_at: datetime | None = None
    pending_order_id: str | None = None
    created_at: datetime
    updated_at: datetime


class PaymentOrderOut(BaseModel):
    id: str
    subscription_id: str | None = None
    product_code: str
    plan_code: str
    status: str
    amount_cents: int
    currency: str
    payment_provider: str
    provider_trade_no: str
    checkout_payload: dict[str, Any] = Field(default_factory=dict)
    paid_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AiSubscriptionStatusOut(BaseModel):
    subscription: AiSubscriptionOut
    active: bool
    requires_payment: bool
    latest_order: PaymentOrderOut | None = None


class AiSubscriptionCreateOrderIn(BaseModel):
    refresh_existing_pending: bool = True


class AiSubscriptionCreateOrderOut(BaseModel):
    subscription: AiSubscriptionOut
    order: PaymentOrderOut


class AiAccessOut(BaseModel):
    allowed: bool
    reason: str
    subscription: AiSubscriptionOut
