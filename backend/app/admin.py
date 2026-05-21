from __future__ import annotations

from pathlib import Path
from typing import Iterable

from sqlalchemy import select
from starlette.requests import Request

from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend

from app.core.config import settings
from app.db import SessionLocal, get_engine
from app.models import (
    AiSubscription,
    AuthSession,
    CategoryRecord,
    CharacterFactionMembershipRecord,
    CharacterRecord,
    CharacterRelationRecord,
    EmailVerificationCode,
    FactionRecord,
    ForeshadowFulfillmentRecord,
    ForeshadowPlantRecord,
    ItemRecord,
    LoginAttempt,
    Novel,
    NovelChapter,
    NovelSnapshot,
    OutlineItemRecord,
    TimelineEventRecord,
    User,
    PaymentOrder,
)
from app.security import normalize_email, verify_password

ADMIN_SESSION_KEY = "sqladmin_authenticated"
ADMIN_USER_KEY = "sqladmin_user_email"
ADMIN_TEMPLATES_DIR = str(Path(__file__).resolve().parents[1] / "templates")


def _admin_email_set() -> set[str]:
    return {
        normalize_email(email)
        for email in settings.admin_emails.split(",")
        if normalize_email(email)
    }


def _is_allowed_admin_email(email: str) -> bool:
    allowed = _admin_email_set()
    normalized = normalize_email(email)
    if allowed:
        return normalized in allowed
    return settings.app_env != "production"


class AdminAuth(AuthenticationBackend):
    def __init__(self) -> None:
        super().__init__(secret_key=settings.admin_secret_key)

    async def login(self, request: Request) -> bool:
        form = await request.form()
        email = normalize_email(str(form.get("username", "")))
        password = str(form.get("password", ""))
        if not email or not password or not _is_allowed_admin_email(email):
            return False

        with SessionLocal() as session:
            user = session.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
            if user is None or not verify_password(password, user.password_hash):
                return False

        request.session.update(
            {
                ADMIN_SESSION_KEY: True,
                ADMIN_USER_KEY: email,
            }
        )
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get(ADMIN_SESSION_KEY))


class SecureModelView(ModelView):
    page_size = 50
    page_size_options = [25, 50, 100, 200]
    can_export = True
    column_labels = {
        "id": "ID",
        "email": "邮箱",
        "display_name": "显示名称",
        "password_hash": "密码哈希",
        "is_active": "启用",
        "email_verified": "已验证邮箱",
        "user_id": "用户 ID",
        "novel_id": "作品 ID",
        "title": "标题",
        "name": "名称",
        "genre": "题材",
        "premise": "故事设定",
        "theme": "主题",
        "worldbuilding": "世界观",
        "writing_style": "写作风格",
        "perspective": "叙事视角",
        "tone": "整体语气",
        "status": "状态",
        "summary": "摘要",
        "content": "内容",
        "version": "版本",
        "chapter_no": "章节号",
        "display_order": "显示顺序",
        "type": "类型",
        "description": "描述",
        "notes": "备注",
        "attributes": "属性",
        "aliases": "别名",
        "category_ids": "分类 ID",
        "created_in_chapter_id": "创建章节 ID",
        "first_appearance_chapter_no": "首次出场章节",
        "age": "年龄",
        "gender": "性别",
        "goal": "目标",
        "secret": "秘密",
        "arc": "人物弧光",
        "leader": "领袖",
        "owner_type": "归属类型",
        "owner_id": "归属对象 ID",
        "from_character_id": "角色 A",
        "to_character_id": "角色 B",
        "relation_type": "关系类型",
        "note": "说明",
        "character_id": "角色 ID",
        "faction_id": "势力 ID",
        "story_label": "剧情线标签",
        "chapter_no_start": "起始章节",
        "chapter_no_end": "结束章节",
        "outline_item_id": "大纲节点 ID",
        "plant_text": "伏笔文本",
        "plant_chapter_id": "埋设章节 ID",
        "plant_chapter_no": "埋设章节号",
        "plant_chapter_title": "埋设章节标题",
        "plant_start": "埋设起始位置",
        "plant_end": "埋设结束位置",
        "expected_fulfill_chapter_no": "预期照应章节",
        "expected_fulfill_notes": "预期照应说明",
        "plant_id": "伏笔 ID",
        "fulfill_text": "照应文本",
        "fulfill_chapter_id": "照应章节 ID",
        "fulfill_chapter_no": "照应章节号",
        "fulfill_chapter_title": "照应章节标题",
        "fulfill_start": "照应起始位置",
        "fulfill_end": "照应结束位置",
        "expires_at": "过期时间",
        "consumed_at": "使用时间",
        "purpose": "用途",
        "token": "令牌",
        "last_seen_at": "最近访问",
        "ip": "IP",
        "success": "是否成功",
        "created_at": "创建时间",
        "updated_at": "更新时间",
        "plan_code": "套餐编码",
        "billing_cycle": "计费周期",
        "price_cents": "价格（分）",
        "currency": "币种",
        "payment_provider": "支付渠道",
        "provider_customer_id": "渠道用户 ID",
        "pending_order_id": "待支付订单",
        "meta_json": "元数据",
        "subscription_id": "订阅 ID",
        "product_code": "商品编码",
        "amount_cents": "金额（分）",
        "provider_trade_no": "渠道订单号",
        "checkout_payload": "收银台参数",
        "paid_at": "支付时间",
    }

    async def is_accessible(self, request: Request) -> bool:
        return bool(request.session.get(ADMIN_SESSION_KEY))

    async def is_visible(self, request: Request) -> bool:
        return await self.is_accessible(request)


class ReadMostlyModelView(SecureModelView):
    can_create = False
    can_edit = False


class UserAdmin(SecureModelView, model=User):
    name = "用户"
    name_plural = "用户"
    icon = "fa-solid fa-users"
    column_list = [User.id, User.email, User.display_name, User.is_active, User.email_verified, User.created_at, User.updated_at]
    column_searchable_list = [User.email, User.display_name]
    column_sortable_list = [User.email, User.created_at, User.updated_at]
    form_columns = [User.email, User.display_name, User.is_active, User.email_verified]
    can_create = False


class NovelAdmin(SecureModelView, model=Novel):
    name = "作品"
    name_plural = "作品"
    icon = "fa-solid fa-book"
    column_list = [Novel.id, Novel.user_id, Novel.title, Novel.genre, Novel.perspective, Novel.tone, Novel.updated_at]
    column_searchable_list = [Novel.title, Novel.genre, Novel.tone]
    column_sortable_list = [Novel.title, Novel.created_at, Novel.updated_at]


class NovelSnapshotAdmin(SecureModelView, model=NovelSnapshot):
    name = "作品快照"
    name_plural = "作品快照"
    icon = "fa-solid fa-camera-retro"
    column_list = [NovelSnapshot.id, NovelSnapshot.novel_id, NovelSnapshot.version, NovelSnapshot.updated_at]
    column_sortable_list = [NovelSnapshot.version, NovelSnapshot.updated_at]


class ChapterAdmin(SecureModelView, model=NovelChapter):
    name = "章节"
    name_plural = "章节"
    icon = "fa-solid fa-file-lines"
    column_list = [NovelChapter.id, NovelChapter.novel_id, NovelChapter.chapter_no, NovelChapter.title, NovelChapter.status, NovelChapter.updated_at]
    column_searchable_list = [NovelChapter.title, NovelChapter.content]
    column_sortable_list = [NovelChapter.chapter_no, NovelChapter.created_at, NovelChapter.updated_at]


class OutlineItemAdmin(SecureModelView, model=OutlineItemRecord):
    name = "大纲节点"
    name_plural = "大纲节点"
    icon = "fa-solid fa-list-check"
    column_list = [OutlineItemRecord.id, OutlineItemRecord.novel_id, OutlineItemRecord.display_order, OutlineItemRecord.title, OutlineItemRecord.status, OutlineItemRecord.updated_at]
    column_searchable_list = [OutlineItemRecord.title, OutlineItemRecord.summary]
    column_sortable_list = [OutlineItemRecord.display_order, OutlineItemRecord.updated_at]


class CategoryAdmin(SecureModelView, model=CategoryRecord):
    name = "分类"
    name_plural = "分类"
    icon = "fa-solid fa-tags"
    column_list = [CategoryRecord.id, CategoryRecord.novel_id, CategoryRecord.name, CategoryRecord.updated_at]
    column_searchable_list = [CategoryRecord.name, CategoryRecord.notes]
    column_sortable_list = [CategoryRecord.name, CategoryRecord.updated_at]


class CharacterAdmin(SecureModelView, model=CharacterRecord):
    name = "角色"
    name_plural = "角色"
    icon = "fa-solid fa-user-pen"
    column_list = [CharacterRecord.id, CharacterRecord.novel_id, CharacterRecord.name, CharacterRecord.first_appearance_chapter_no, CharacterRecord.updated_at]
    column_searchable_list = [CharacterRecord.name, CharacterRecord.goal, CharacterRecord.secret]
    column_sortable_list = [CharacterRecord.name, CharacterRecord.first_appearance_chapter_no, CharacterRecord.updated_at]


class FactionAdmin(SecureModelView, model=FactionRecord):
    name = "势力"
    name_plural = "势力"
    icon = "fa-solid fa-people-group"
    column_list = [FactionRecord.id, FactionRecord.novel_id, FactionRecord.name, FactionRecord.leader, FactionRecord.updated_at]
    column_searchable_list = [FactionRecord.name, FactionRecord.leader, FactionRecord.notes]
    column_sortable_list = [FactionRecord.name, FactionRecord.updated_at]


class ItemAdmin(SecureModelView, model=ItemRecord):
    name = "物品"
    name_plural = "物品"
    icon = "fa-solid fa-box-archive"
    column_list = [ItemRecord.id, ItemRecord.novel_id, ItemRecord.name, ItemRecord.owner_type, ItemRecord.owner_id, ItemRecord.updated_at]
    column_searchable_list = [ItemRecord.name, ItemRecord.summary]
    column_sortable_list = [ItemRecord.name, ItemRecord.updated_at]


class CharacterRelationAdmin(SecureModelView, model=CharacterRelationRecord):
    name = "角色关系"
    name_plural = "角色关系"
    icon = "fa-solid fa-link"
    column_list = [CharacterRelationRecord.id, CharacterRelationRecord.novel_id, CharacterRelationRecord.from_character_id, CharacterRelationRecord.to_character_id, CharacterRelationRecord.relation_type]
    column_searchable_list = [CharacterRelationRecord.relation_type, CharacterRelationRecord.note]
    column_sortable_list = [CharacterRelationRecord.created_at, CharacterRelationRecord.updated_at]


class CharacterFactionMembershipAdmin(SecureModelView, model=CharacterFactionMembershipRecord):
    name = "角色势力归属"
    name_plural = "角色势力归属"
    icon = "fa-solid fa-handshake-angle"
    column_list = [CharacterFactionMembershipRecord.id, CharacterFactionMembershipRecord.novel_id, CharacterFactionMembershipRecord.character_id, CharacterFactionMembershipRecord.faction_id, CharacterFactionMembershipRecord.updated_at]
    column_searchable_list = [CharacterFactionMembershipRecord.description]
    column_sortable_list = [CharacterFactionMembershipRecord.created_at, CharacterFactionMembershipRecord.updated_at]


class TimelineEventAdmin(SecureModelView, model=TimelineEventRecord):
    name = "时间线事件"
    name_plural = "时间线事件"
    icon = "fa-solid fa-timeline"
    column_list = [TimelineEventRecord.id, TimelineEventRecord.novel_id, TimelineEventRecord.display_order, TimelineEventRecord.story_label, TimelineEventRecord.title, TimelineEventRecord.updated_at]
    column_searchable_list = [TimelineEventRecord.title, TimelineEventRecord.summary, TimelineEventRecord.story_label]
    column_sortable_list = [TimelineEventRecord.display_order, TimelineEventRecord.updated_at]


class ForeshadowPlantAdmin(SecureModelView, model=ForeshadowPlantRecord):
    name = "伏笔"
    name_plural = "伏笔"
    icon = "fa-solid fa-seedling"
    column_list = [ForeshadowPlantRecord.id, ForeshadowPlantRecord.novel_id, ForeshadowPlantRecord.title, ForeshadowPlantRecord.status, ForeshadowPlantRecord.plant_chapter_no, ForeshadowPlantRecord.updated_at]
    column_searchable_list = [ForeshadowPlantRecord.title, ForeshadowPlantRecord.description, ForeshadowPlantRecord.plant_text]
    column_sortable_list = [ForeshadowPlantRecord.created_at, ForeshadowPlantRecord.updated_at]


class ForeshadowFulfillmentAdmin(SecureModelView, model=ForeshadowFulfillmentRecord):
    name = "伏笔照应"
    name_plural = "伏笔照应"
    icon = "fa-solid fa-arrow-rotate-right"
    column_list = [ForeshadowFulfillmentRecord.id, ForeshadowFulfillmentRecord.plant_id, ForeshadowFulfillmentRecord.fulfill_chapter_no, ForeshadowFulfillmentRecord.fulfill_chapter_title, ForeshadowFulfillmentRecord.created_at]
    column_searchable_list = [ForeshadowFulfillmentRecord.fulfill_text, ForeshadowFulfillmentRecord.notes]
    column_sortable_list = [ForeshadowFulfillmentRecord.created_at]


class EmailVerificationCodeAdmin(ReadMostlyModelView, model=EmailVerificationCode):
    name = "验证码"
    name_plural = "验证码"
    icon = "fa-solid fa-envelope-open-text"
    column_list = [EmailVerificationCode.id, EmailVerificationCode.email, EmailVerificationCode.purpose, EmailVerificationCode.expires_at, EmailVerificationCode.consumed_at, EmailVerificationCode.created_at]
    column_searchable_list = [EmailVerificationCode.email, EmailVerificationCode.purpose]
    column_sortable_list = [EmailVerificationCode.expires_at, EmailVerificationCode.created_at]


class AuthSessionAdmin(ReadMostlyModelView, model=AuthSession):
    name = "登录会话"
    name_plural = "登录会话"
    icon = "fa-solid fa-key"
    column_list = [AuthSession.id, AuthSession.user_id, AuthSession.token, AuthSession.expires_at, AuthSession.last_seen_at, AuthSession.created_at]
    column_searchable_list = [AuthSession.user_id, AuthSession.token]
    column_sortable_list = [AuthSession.expires_at, AuthSession.last_seen_at, AuthSession.created_at]


class LoginAttemptAdmin(ReadMostlyModelView, model=LoginAttempt):
    name = "登录尝试"
    name_plural = "登录尝试"
    icon = "fa-solid fa-shield-halved"
    column_list = [LoginAttempt.id, LoginAttempt.email, LoginAttempt.ip, LoginAttempt.success, LoginAttempt.created_at]
    column_searchable_list = [LoginAttempt.email, LoginAttempt.ip]
    column_sortable_list = [LoginAttempt.created_at]


class AiSubscriptionAdmin(SecureModelView, model=AiSubscription):
    name = "AI 订阅"
    name_plural = "AI 订阅"
    icon = "fa-solid fa-wallet"
    column_list = [AiSubscription.id, AiSubscription.user_id, AiSubscription.plan_code, AiSubscription.status, AiSubscription.price_cents, AiSubscription.expires_at, AiSubscription.updated_at]
    column_searchable_list = [AiSubscription.user_id, AiSubscription.plan_code, AiSubscription.status]
    column_sortable_list = [AiSubscription.created_at, AiSubscription.updated_at, AiSubscription.expires_at]


class PaymentOrderAdmin(SecureModelView, model=PaymentOrder):
    name = "支付订单"
    name_plural = "支付订单"
    icon = "fa-solid fa-qrcode"
    column_list = [PaymentOrder.id, PaymentOrder.user_id, PaymentOrder.product_code, PaymentOrder.plan_code, PaymentOrder.status, PaymentOrder.amount_cents, PaymentOrder.paid_at, PaymentOrder.created_at]
    column_searchable_list = [PaymentOrder.user_id, PaymentOrder.product_code, PaymentOrder.provider_trade_no, PaymentOrder.status]
    column_sortable_list = [PaymentOrder.created_at, PaymentOrder.updated_at, PaymentOrder.paid_at]


def _register_views(admin: Admin, views: Iterable[type[ModelView]]) -> None:
    for view in views:
        admin.add_view(view)


def init_admin(app) -> Admin:
    admin = Admin(
        app=app,
        engine=get_engine(),
        authentication_backend=AdminAuth(),
        title="小说管理后台",
        templates_dir=ADMIN_TEMPLATES_DIR,
    )
    _register_views(
        admin,
        [
            UserAdmin,
            NovelAdmin,
            NovelSnapshotAdmin,
            ChapterAdmin,
            OutlineItemAdmin,
            CategoryAdmin,
            CharacterAdmin,
            FactionAdmin,
            ItemAdmin,
            CharacterRelationAdmin,
            CharacterFactionMembershipAdmin,
            TimelineEventAdmin,
            ForeshadowPlantAdmin,
            ForeshadowFulfillmentAdmin,
            EmailVerificationCodeAdmin,
            AuthSessionAdmin,
            LoginAttemptAdmin,
            AiSubscriptionAdmin,
            PaymentOrderAdmin,
        ],
    )
    return admin
