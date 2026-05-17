from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import (
    CategoryRecord,
    CharacterFactionMembershipRecord,
    CharacterRecord,
    CharacterRelationRecord,
    FactionRecord,
    ForeshadowFulfillmentRecord,
    ForeshadowPlantRecord,
    ItemRecord,
    Novel,
    NovelChapter,
    NovelSnapshot,
    OutlineItemRecord,
    OutlineStorylineRecord,
    TimelineEventRecord,
    User,
)
from app.schemas import (
    CategoryCreateIn,
    CategoryOut,
    CategoryUpdateIn,
    ChapterCreateIn,
    ChapterOut,
    ChapterUpdateIn,
    CharacterFactionMembershipCreateIn,
    CharacterFactionMembershipOut,
    CharacterFactionMembershipUpdateIn,
    CharacterCreateIn,
    CharacterOut,
    CharacterRelationCreateIn,
    CharacterRelationOut,
    CharacterRelationUpdateIn,
    CharacterUpdateIn,
    FactionCreateIn,
    FactionOut,
    FactionUpdateIn,
    ForeshadowFulfillmentCreateIn,
    ForeshadowFulfillmentOut,
    ForeshadowFulfillmentUpdateIn,
    ForeshadowPlantCreateIn,
    ForeshadowPlantOut,
    ForeshadowPlantUpdateIn,
    ItemCreateIn,
    ItemOut,
    ItemUpdateIn,
    MessageOut,
    NovelCreateIn,
    NovelOut,
    NovelUpdateIn,
    OutlineItemCreateIn,
    OutlineItemOut,
    OutlineItemUpdateIn,
    OutlineStorylineCreateIn,
    OutlineStorylineOut,
    OutlineStorylineUpdateIn,
    SnapshotOut,
    SnapshotPutIn,
    TimelineEventCreateIn,
    TimelineEventOut,
    TimelineEventUpdateIn,
    WorkspaceOut,
)
from app.services.novel_sync import (
    build_workspace_payload_from_db,
    default_snapshot_payload,
    normalize_snapshot_payload,
    sync_snapshot_from_workspace_tables,
    sync_novel_workspace_from_snapshot,
)

router = APIRouter(prefix="/novels", tags=["novels"])


def _novel_out(novel: Novel) -> NovelOut:
    return NovelOut(
        id=novel.id,
        title=novel.title,
        summary=novel.summary,
        genre=novel.genre,
        perspective=novel.perspective,
        tone=novel.tone,
        is_multi_line_narrative=novel.is_multi_line_narrative,
        created_at=novel.created_at,
        updated_at=novel.updated_at,
    )


def _owned_novel_or_404(db: Session, user: User, novel_id: str) -> Novel:
    novel = db.query(Novel).filter(Novel.id == novel_id, Novel.user_id == user.id).first()
    if novel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="作品不存在")
    return novel


def _chapter_out(row: NovelChapter) -> ChapterOut:
    return ChapterOut(
        id=row.id,
        novel_id=row.novel_id,
        chapter_no=row.chapter_no,
        title=row.title,
        notes=row.notes,
        annotation=row.annotation,
        content=row.content,
        outline_item_ids=row.outline_item_ids or [],
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _character_out(row: CharacterRecord) -> CharacterOut:
    return CharacterOut(
        id=row.id,
        novel_id=row.novel_id,
        name=row.name,
        created_in_chapter_id=row.created_in_chapter_id,
        first_appearance_chapter_no=row.first_appearance_chapter_no,
        age=row.age,
        gender=row.gender,
        goal=row.goal,
        secret=row.secret,
        arc=row.arc,
        notes=row.notes,
        attributes=row.attributes or [],
        aliases=row.aliases or [],
        category_ids=row.category_ids or [],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _faction_out(row: FactionRecord) -> FactionOut:
    return FactionOut(
        id=row.id,
        novel_id=row.novel_id,
        name=row.name,
        created_in_chapter_id=row.created_in_chapter_id,
        leader=row.leader,
        notes=row.notes,
        attributes=row.attributes or [],
        category_ids=row.category_ids or [],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _item_out(row: ItemRecord) -> ItemOut:
    return ItemOut(
        id=row.id,
        novel_id=row.novel_id,
        name=row.name,
        summary=row.summary,
        owner_type=row.owner_type,
        owner_id=row.owner_id,
        first_appearance_chapter_no=row.first_appearance_chapter_no,
        attributes=row.attributes or [],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _category_out(row: CategoryRecord) -> CategoryOut:
    return CategoryOut(
        id=row.id,
        novel_id=row.novel_id,
        name=row.name,
        notes=row.notes,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _relation_out(row: CharacterRelationRecord) -> CharacterRelationOut:
    return CharacterRelationOut(
        id=row.id,
        novel_id=row.novel_id,
        from_character_id=row.from_character_id,
        to_character_id=row.to_character_id,
        relation_type=row.relation_type,
        note=row.note,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _membership_out(row: CharacterFactionMembershipRecord) -> CharacterFactionMembershipOut:
    return CharacterFactionMembershipOut(
        id=row.id,
        novel_id=row.novel_id,
        character_id=row.character_id,
        faction_id=row.faction_id,
        description=row.description,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _outline_storyline_out(row: OutlineStorylineRecord) -> OutlineStorylineOut:
    return OutlineStorylineOut(
        id=row.id,
        novel_id=row.novel_id,
        name=row.name,
        type=row.type,
        color=row.color,
        description=row.description,
        order=row.display_order,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _outline_item_out(row: OutlineItemRecord) -> OutlineItemOut:
    return OutlineItemOut(
        id=row.id,
        novel_id=row.novel_id,
        order=row.display_order,
        title=row.title,
        summary=row.summary,
        status=row.status,
        level=row.level or None,
        goal=row.goal,
        conflict=row.conflict,
        twist=row.twist,
        result=row.result,
        suspense=row.suspense,
        plot_stage=row.plot_stage or None,
        storyline_ids=row.storyline_ids or [],
        parent_id=row.parent_id,
        location=row.location,
        time_label=row.time_label,
        pov_character_id=row.pov_character_id,
        tension=row.tension,
        character_ids=row.character_ids or [],
        faction_ids=row.faction_ids or [],
        foreshadow_ids=row.foreshadow_ids or [],
        issue_ids=row.issue_ids or [],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _timeline_event_out(row: TimelineEventRecord) -> TimelineEventOut:
    return TimelineEventOut(
        id=row.id,
        novel_id=row.novel_id,
        order=row.display_order,
        story_label=row.story_label,
        title=row.title,
        summary=row.summary,
        chapter_no_start=row.chapter_no_start,
        chapter_no_end=row.chapter_no_end,
        chapter_no=row.chapter_no_start if row.chapter_no_end is None else None,
        outline_item_id=row.outline_item_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _foreshadow_fulfillment_out(row: ForeshadowFulfillmentRecord) -> ForeshadowFulfillmentOut:
    return ForeshadowFulfillmentOut(
        id=row.id,
        fulfill_text=row.fulfill_text,
        fulfill_chapter_id=row.fulfill_chapter_id,
        fulfill_chapter_no=row.fulfill_chapter_no,
        fulfill_chapter_title=row.fulfill_chapter_title,
        fulfill_start=row.fulfill_start,
        fulfill_end=row.fulfill_end,
        notes=row.notes,
        created_at=row.created_at,
    )


def _foreshadow_plant_out(db: Session, row: ForeshadowPlantRecord) -> ForeshadowPlantOut:
    fulfillments = (
        db.query(ForeshadowFulfillmentRecord)
        .filter(ForeshadowFulfillmentRecord.plant_id == row.id)
        .order_by(ForeshadowFulfillmentRecord.created_at.asc())
        .all()
    )
    return ForeshadowPlantOut(
        id=row.id,
        novel_id=row.novel_id,
        title=row.title,
        plant_text=row.plant_text,
        plant_chapter_id=row.plant_chapter_id,
        plant_chapter_no=row.plant_chapter_no,
        plant_chapter_title=row.plant_chapter_title,
        plant_start=row.plant_start,
        plant_end=row.plant_end,
        description=row.description,
        expected_fulfill_chapter_no=row.expected_fulfill_chapter_no,
        expected_fulfill_notes=row.expected_fulfill_notes,
        status=row.status,
        fulfillments=[_foreshadow_fulfillment_out(item) for item in fulfillments],
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _touch_snapshot(db: Session, novel: Novel) -> None:
    sync_snapshot_from_workspace_tables(db, novel)


def _chapter_or_404(db: Session, novel_id: str, chapter_id: str) -> NovelChapter:
    row = db.query(NovelChapter).filter(NovelChapter.novel_id == novel_id, NovelChapter.id == chapter_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="章节不存在")
    return row


def _character_or_404(db: Session, novel_id: str, character_id: str) -> CharacterRecord:
    row = db.query(CharacterRecord).filter(CharacterRecord.novel_id == novel_id, CharacterRecord.id == character_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在")
    return row


def _faction_or_404(db: Session, novel_id: str, faction_id: str) -> FactionRecord:
    row = db.query(FactionRecord).filter(FactionRecord.novel_id == novel_id, FactionRecord.id == faction_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="势力不存在")
    return row


def _item_or_404(db: Session, novel_id: str, item_id: str) -> ItemRecord:
    row = db.query(ItemRecord).filter(ItemRecord.novel_id == novel_id, ItemRecord.id == item_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="物品不存在")
    return row


def _category_or_404(db: Session, novel_id: str, category_id: str) -> CategoryRecord:
    row = db.query(CategoryRecord).filter(CategoryRecord.novel_id == novel_id, CategoryRecord.id == category_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类不存在")
    return row


def _relation_or_404(db: Session, novel_id: str, relation_id: str) -> CharacterRelationRecord:
    row = db.query(CharacterRelationRecord).filter(
        CharacterRelationRecord.novel_id == novel_id,
        CharacterRelationRecord.id == relation_id,
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色关系不存在")
    return row


def _membership_or_404(db: Session, novel_id: str, membership_id: str) -> CharacterFactionMembershipRecord:
    row = db.query(CharacterFactionMembershipRecord).filter(
        CharacterFactionMembershipRecord.novel_id == novel_id,
        CharacterFactionMembershipRecord.id == membership_id,
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色势力归属不存在")
    return row


def _outline_storyline_or_404(db: Session, novel_id: str, storyline_id: str) -> OutlineStorylineRecord:
    row = db.query(OutlineStorylineRecord).filter(
        OutlineStorylineRecord.novel_id == novel_id,
        OutlineStorylineRecord.id == storyline_id,
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="剧情线不存在")
    return row


def _outline_item_or_404(db: Session, novel_id: str, outline_id: str) -> OutlineItemRecord:
    row = db.query(OutlineItemRecord).filter(
        OutlineItemRecord.novel_id == novel_id,
        OutlineItemRecord.id == outline_id,
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="大纲节点不存在")
    return row


def _timeline_event_or_404(db: Session, novel_id: str, event_id: str) -> TimelineEventRecord:
    row = db.query(TimelineEventRecord).filter(TimelineEventRecord.novel_id == novel_id, TimelineEventRecord.id == event_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="时间线节点不存在")
    return row


def _foreshadow_plant_or_404(db: Session, novel_id: str, plant_id: str) -> ForeshadowPlantRecord:
    row = db.query(ForeshadowPlantRecord).filter(ForeshadowPlantRecord.novel_id == novel_id, ForeshadowPlantRecord.id == plant_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="伏笔不存在")
    return row


def _foreshadow_fulfillment_or_404(db: Session, plant_id: str, fulfillment_id: str) -> ForeshadowFulfillmentRecord:
    row = db.query(ForeshadowFulfillmentRecord).filter(
        ForeshadowFulfillmentRecord.plant_id == plant_id,
        ForeshadowFulfillmentRecord.id == fulfillment_id,
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="填坑记录不存在")
    return row


@router.get("", response_model=list[NovelOut])
def list_novels(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[NovelOut]:
    novels = db.query(Novel).filter(Novel.user_id == user.id).order_by(Novel.updated_at.desc()).all()
    return [_novel_out(n) for n in novels]


@router.post("", response_model=NovelOut, status_code=status.HTTP_201_CREATED)
def create_novel(
    payload: NovelCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NovelOut:
    novel = Novel(
        user_id=user.id,
        title=payload.title.strip(),
        summary=payload.summary.strip(),
        genre=payload.genre.strip(),
        perspective=payload.perspective.strip(),
        tone=payload.tone.strip(),
        is_multi_line_narrative=payload.is_multi_line_narrative,
    )
    db.add(novel)
    db.flush()

    snapshot = NovelSnapshot(
        novel_id=novel.id,
        version=1,
        payload=default_snapshot_payload(),
    )
    db.add(snapshot)
    sync_novel_workspace_from_snapshot(db, novel, snapshot.payload)
    db.commit()
    db.refresh(novel)
    return _novel_out(novel)


@router.get("/{novel_id}", response_model=NovelOut)
def get_novel(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> NovelOut:
    return _novel_out(_owned_novel_or_404(db, user, novel_id))


@router.put("/{novel_id}", response_model=NovelOut)
def update_novel(
    novel_id: str,
    payload: NovelUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NovelOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    if payload.title is not None:
        novel.title = payload.title.strip()
    if payload.summary is not None:
        novel.summary = payload.summary.strip()
    if payload.genre is not None:
        novel.genre = payload.genre.strip()
    if payload.perspective is not None:
        novel.perspective = payload.perspective.strip()
    if payload.tone is not None:
        novel.tone = payload.tone.strip()
    if payload.is_multi_line_narrative is not None:
        novel.is_multi_line_narrative = payload.is_multi_line_narrative
    novel.updated_at = datetime.utcnow()
    db.add(novel)
    db.commit()
    db.refresh(novel)
    return _novel_out(novel)


@router.delete("/{novel_id}", response_model=MessageOut)
def delete_novel(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    db.delete(novel)
    db.commit()
    return MessageOut(message="作品已删除")


@router.get("/{novel_id}/snapshot", response_model=SnapshotOut)
def get_snapshot(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SnapshotOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    snapshot = db.query(NovelSnapshot).filter(NovelSnapshot.novel_id == novel.id).first()
    if snapshot is None:
        snapshot = NovelSnapshot(novel_id=novel.id, version=1, payload=default_snapshot_payload())
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
    payload = normalize_snapshot_payload(snapshot.payload)
    if payload != (snapshot.payload or {}):
        snapshot.payload = payload
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
    return SnapshotOut(
        novel_id=novel.id,
        version=snapshot.version,
        payload=snapshot.payload or {},
        updated_at=snapshot.updated_at,
    )


@router.put("/{novel_id}/snapshot", response_model=SnapshotOut)
def put_snapshot(
    novel_id: str,
    payload: SnapshotPutIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SnapshotOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    normalized_payload = normalize_snapshot_payload(payload.payload)
    snapshot = db.query(NovelSnapshot).filter(NovelSnapshot.novel_id == novel.id).first()
    if snapshot is None:
        snapshot = NovelSnapshot(novel_id=novel.id, version=1, payload=normalized_payload)
    else:
        snapshot.payload = normalized_payload
        snapshot.version += 1
        snapshot.updated_at = datetime.utcnow()
    novel.updated_at = datetime.utcnow()
    sync_novel_workspace_from_snapshot(db, novel, normalized_payload)
    db.add(snapshot)
    db.add(novel)
    db.commit()
    db.refresh(snapshot)
    return SnapshotOut(
        novel_id=novel.id,
        version=snapshot.version,
        payload=snapshot.payload or {},
        updated_at=snapshot.updated_at,
    )


@router.get("/{novel_id}/workspace", response_model=WorkspaceOut)
def get_workspace(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> WorkspaceOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    snapshot = db.query(NovelSnapshot).filter(NovelSnapshot.novel_id == novel.id).first()
    if snapshot is None:
        snapshot = NovelSnapshot(novel_id=novel.id, version=1, payload=default_snapshot_payload())
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
    payload = build_workspace_payload_from_db(db, novel.id)
    return WorkspaceOut(
        novel_id=novel.id,
        snapshot_version=snapshot.version,
        payload=payload,
        updated_at=max(novel.updated_at, snapshot.updated_at),
    )


@router.get("/{novel_id}/chapters", response_model=list[ChapterOut])
def list_chapters(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ChapterOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = db.query(NovelChapter).filter(NovelChapter.novel_id == novel.id).order_by(NovelChapter.chapter_no.asc()).all()
    return [_chapter_out(row) for row in rows]


@router.post("/{novel_id}/chapters", response_model=ChapterOut, status_code=status.HTTP_201_CREATED)
def create_chapter(
    novel_id: str,
    payload: ChapterCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChapterOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(NovelChapter).filter(NovelChapter.novel_id == novel.id, NovelChapter.id == payload.id).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="章节 id 已存在")
    row = NovelChapter(
        id=payload.id.strip(),
        novel_id=novel.id,
        chapter_no=payload.chapter_no,
        title=payload.title.strip(),
        notes=payload.notes,
        annotation=payload.annotation,
        content=payload.content,
        outline_item_ids=payload.outline_item_ids,
        status=payload.status.strip() or "draft",
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _chapter_out(row)


@router.put("/{novel_id}/chapters/{chapter_id}", response_model=ChapterOut)
def update_chapter(
    novel_id: str,
    chapter_id: str,
    payload: ChapterUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChapterOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _chapter_or_404(db, novel.id, chapter_id)
    if payload.chapter_no is not None:
        row.chapter_no = payload.chapter_no
    if payload.title is not None:
        row.title = payload.title.strip()
    if payload.notes is not None:
        row.notes = payload.notes
    if payload.annotation is not None:
        row.annotation = payload.annotation
    if payload.content is not None:
        row.content = payload.content
    if payload.outline_item_ids is not None:
        row.outline_item_ids = payload.outline_item_ids
    if payload.status is not None:
        row.status = payload.status.strip() or row.status
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _chapter_out(row)


@router.delete("/{novel_id}/chapters/{chapter_id}", response_model=MessageOut)
def delete_chapter(
    novel_id: str,
    chapter_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _chapter_or_404(db, novel.id, chapter_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="章节已删除")


@router.get("/{novel_id}/characters", response_model=list[CharacterOut])
def list_characters(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[CharacterOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = db.query(CharacterRecord).filter(CharacterRecord.novel_id == novel.id).order_by(CharacterRecord.updated_at.desc()).all()
    return [_character_out(row) for row in rows]


@router.post("/{novel_id}/characters", response_model=CharacterOut, status_code=status.HTTP_201_CREATED)
def create_character(
    novel_id: str,
    payload: CharacterCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CharacterOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(CharacterRecord).filter(CharacterRecord.novel_id == novel.id, CharacterRecord.id == payload.id).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="角色 id 已存在")
    row = CharacterRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        name=payload.name.strip(),
        created_in_chapter_id=payload.created_in_chapter_id,
        first_appearance_chapter_no=payload.first_appearance_chapter_no,
        age=payload.age,
        gender=payload.gender,
        goal=payload.goal,
        secret=payload.secret,
        arc=payload.arc,
        notes=payload.notes,
        attributes=payload.attributes,
        aliases=payload.aliases,
        category_ids=payload.category_ids,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _character_out(row)


@router.put("/{novel_id}/characters/{character_id}", response_model=CharacterOut)
def update_character(
    novel_id: str,
    character_id: str,
    payload: CharacterUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CharacterOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _character_or_404(db, novel.id, character_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "name" and value is not None:
            setattr(row, key, value.strip())
        else:
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _character_out(row)


@router.delete("/{novel_id}/characters/{character_id}", response_model=MessageOut)
def delete_character(
    novel_id: str,
    character_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _character_or_404(db, novel.id, character_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="角色已删除")


@router.get("/{novel_id}/factions", response_model=list[FactionOut])
def list_factions(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[FactionOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = db.query(FactionRecord).filter(FactionRecord.novel_id == novel.id).order_by(FactionRecord.updated_at.desc()).all()
    return [_faction_out(row) for row in rows]


@router.post("/{novel_id}/factions", response_model=FactionOut, status_code=status.HTTP_201_CREATED)
def create_faction(
    novel_id: str,
    payload: FactionCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FactionOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(FactionRecord).filter(FactionRecord.novel_id == novel.id, FactionRecord.id == payload.id).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="势力 id 已存在")
    row = FactionRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        name=payload.name.strip(),
        created_in_chapter_id=payload.created_in_chapter_id,
        leader=payload.leader,
        notes=payload.notes,
        attributes=payload.attributes,
        category_ids=payload.category_ids,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _faction_out(row)


@router.put("/{novel_id}/factions/{faction_id}", response_model=FactionOut)
def update_faction(
    novel_id: str,
    faction_id: str,
    payload: FactionUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FactionOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _faction_or_404(db, novel.id, faction_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "name" and value is not None:
            setattr(row, key, value.strip())
        else:
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _faction_out(row)


@router.delete("/{novel_id}/factions/{faction_id}", response_model=MessageOut)
def delete_faction(
    novel_id: str,
    faction_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _faction_or_404(db, novel.id, faction_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="势力已删除")


@router.get("/{novel_id}/items", response_model=list[ItemOut])
def list_items(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ItemOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = db.query(ItemRecord).filter(ItemRecord.novel_id == novel.id).order_by(ItemRecord.updated_at.desc()).all()
    return [_item_out(row) for row in rows]


@router.post("/{novel_id}/items", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    novel_id: str,
    payload: ItemCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(ItemRecord).filter(ItemRecord.novel_id == novel.id, ItemRecord.id == payload.id).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="物品 id 已存在")
    row = ItemRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        name=payload.name.strip(),
        summary=payload.summary,
        owner_type=payload.owner_type,
        owner_id=payload.owner_id,
        first_appearance_chapter_no=payload.first_appearance_chapter_no,
        attributes=payload.attributes,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _item_out(row)


@router.put("/{novel_id}/items/{item_id}", response_model=ItemOut)
def update_item(
    novel_id: str,
    item_id: str,
    payload: ItemUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _item_or_404(db, novel.id, item_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "name" and value is not None:
            setattr(row, key, value.strip())
        else:
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _item_out(row)


@router.delete("/{novel_id}/items/{item_id}", response_model=MessageOut)
def delete_item(
    novel_id: str,
    item_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _item_or_404(db, novel.id, item_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="物品已删除")


@router.get("/{novel_id}/categories", response_model=list[CategoryOut])
def list_categories(novel_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[CategoryOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = db.query(CategoryRecord).filter(CategoryRecord.novel_id == novel.id).order_by(CategoryRecord.name.asc()).all()
    return [_category_out(row) for row in rows]


@router.post("/{novel_id}/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    novel_id: str,
    payload: CategoryCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoryOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(CategoryRecord).filter(CategoryRecord.novel_id == novel.id, CategoryRecord.id == payload.id).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="分类 id 已存在")
    row = CategoryRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        name=payload.name.strip(),
        notes=payload.notes,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _category_out(row)


@router.put("/{novel_id}/categories/{category_id}", response_model=CategoryOut)
def update_category(
    novel_id: str,
    category_id: str,
    payload: CategoryUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CategoryOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _category_or_404(db, novel.id, category_id)
    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.notes is not None:
        row.notes = payload.notes
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _category_out(row)


@router.delete("/{novel_id}/categories/{category_id}", response_model=MessageOut)
def delete_category(
    novel_id: str,
    category_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _category_or_404(db, novel.id, category_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="分类已删除")


@router.get("/{novel_id}/character-relations", response_model=list[CharacterRelationOut])
def list_character_relations(
    novel_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CharacterRelationOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = (
        db.query(CharacterRelationRecord)
        .filter(CharacterRelationRecord.novel_id == novel.id)
        .order_by(CharacterRelationRecord.created_at.asc())
        .all()
    )
    return [_relation_out(row) for row in rows]


@router.post("/{novel_id}/character-relations", response_model=CharacterRelationOut, status_code=status.HTTP_201_CREATED)
def create_character_relation(
    novel_id: str,
    payload: CharacterRelationCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CharacterRelationOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(CharacterRelationRecord).filter(
        CharacterRelationRecord.novel_id == novel.id,
        CharacterRelationRecord.id == payload.id,
    ).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="角色关系 id 已存在")
    row = CharacterRelationRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        from_character_id=payload.from_character_id,
        to_character_id=payload.to_character_id,
        relation_type=payload.relation_type,
        note=payload.note,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _relation_out(row)


@router.put("/{novel_id}/character-relations/{relation_id}", response_model=CharacterRelationOut)
def update_character_relation(
    novel_id: str,
    relation_id: str,
    payload: CharacterRelationUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CharacterRelationOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _relation_or_404(db, novel.id, relation_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _relation_out(row)


@router.delete("/{novel_id}/character-relations/{relation_id}", response_model=MessageOut)
def delete_character_relation(
    novel_id: str,
    relation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _relation_or_404(db, novel.id, relation_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="角色关系已删除")


@router.get("/{novel_id}/character-faction-memberships", response_model=list[CharacterFactionMembershipOut])
def list_character_faction_memberships(
    novel_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CharacterFactionMembershipOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = (
        db.query(CharacterFactionMembershipRecord)
        .filter(CharacterFactionMembershipRecord.novel_id == novel.id)
        .order_by(CharacterFactionMembershipRecord.created_at.asc())
        .all()
    )
    return [_membership_out(row) for row in rows]


@router.post(
    "/{novel_id}/character-faction-memberships",
    response_model=CharacterFactionMembershipOut,
    status_code=status.HTTP_201_CREATED,
)
def create_character_faction_membership(
    novel_id: str,
    payload: CharacterFactionMembershipCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CharacterFactionMembershipOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(CharacterFactionMembershipRecord).filter(
        CharacterFactionMembershipRecord.novel_id == novel.id,
        CharacterFactionMembershipRecord.id == payload.id,
    ).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="角色势力归属 id 已存在")
    row = CharacterFactionMembershipRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        character_id=payload.character_id,
        faction_id=payload.faction_id,
        description=payload.description,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _membership_out(row)


@router.put(
    "/{novel_id}/character-faction-memberships/{membership_id}",
    response_model=CharacterFactionMembershipOut,
)
def update_character_faction_membership(
    novel_id: str,
    membership_id: str,
    payload: CharacterFactionMembershipUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CharacterFactionMembershipOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _membership_or_404(db, novel.id, membership_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _membership_out(row)


@router.delete("/{novel_id}/character-faction-memberships/{membership_id}", response_model=MessageOut)
def delete_character_faction_membership(
    novel_id: str,
    membership_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _membership_or_404(db, novel.id, membership_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="角色势力归属已删除")


@router.get("/{novel_id}/outline-storylines", response_model=list[OutlineStorylineOut])
def list_outline_storylines(
    novel_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OutlineStorylineOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = (
        db.query(OutlineStorylineRecord)
        .filter(OutlineStorylineRecord.novel_id == novel.id)
        .order_by(OutlineStorylineRecord.display_order.asc(), OutlineStorylineRecord.created_at.asc())
        .all()
    )
    return [_outline_storyline_out(row) for row in rows]


@router.post("/{novel_id}/outline-storylines", response_model=OutlineStorylineOut, status_code=status.HTTP_201_CREATED)
def create_outline_storyline(
    novel_id: str,
    payload: OutlineStorylineCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OutlineStorylineOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(OutlineStorylineRecord).filter(
        OutlineStorylineRecord.novel_id == novel.id,
        OutlineStorylineRecord.id == payload.id,
    ).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="剧情线 id 已存在")
    row = OutlineStorylineRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        name=payload.name.strip(),
        type=payload.type.strip() or "custom",
        color=payload.color.strip(),
        description=payload.description,
        display_order=payload.order,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _outline_storyline_out(row)


@router.put("/{novel_id}/outline-storylines/{storyline_id}", response_model=OutlineStorylineOut)
def update_outline_storyline(
    novel_id: str,
    storyline_id: str,
    payload: OutlineStorylineUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OutlineStorylineOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _outline_storyline_or_404(db, novel.id, storyline_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "name" and value is not None:
            row.name = value.strip()
        elif key == "type" and value is not None:
            row.type = value.strip() or row.type
        elif key == "color" and value is not None:
            row.color = value.strip()
        elif key == "order" and value is not None:
            row.display_order = value
        else:
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _outline_storyline_out(row)


@router.delete("/{novel_id}/outline-storylines/{storyline_id}", response_model=MessageOut)
def delete_outline_storyline(
    novel_id: str,
    storyline_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _outline_storyline_or_404(db, novel.id, storyline_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="剧情线已删除")


@router.get("/{novel_id}/outline", response_model=list[OutlineItemOut])
def list_outline_items(
    novel_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OutlineItemOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = (
        db.query(OutlineItemRecord)
        .filter(OutlineItemRecord.novel_id == novel.id)
        .order_by(OutlineItemRecord.display_order.asc(), OutlineItemRecord.created_at.asc())
        .all()
    )
    return [_outline_item_out(row) for row in rows]


@router.post("/{novel_id}/outline", response_model=OutlineItemOut, status_code=status.HTTP_201_CREATED)
def create_outline_item(
    novel_id: str,
    payload: OutlineItemCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OutlineItemOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(OutlineItemRecord).filter(
        OutlineItemRecord.novel_id == novel.id,
        OutlineItemRecord.id == payload.id,
    ).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="大纲节点 id 已存在")
    row = OutlineItemRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        display_order=payload.order,
        title=payload.title.strip(),
        summary=payload.summary,
        status=payload.status.strip() or "todo",
        level=(payload.level or "").strip(),
        goal=payload.goal,
        conflict=payload.conflict,
        twist=payload.twist,
        result=payload.result,
        suspense=payload.suspense,
        plot_stage=(payload.plot_stage or "").strip(),
        storyline_ids=payload.storyline_ids,
        parent_id=payload.parent_id,
        location=payload.location,
        time_label=payload.time_label,
        pov_character_id=payload.pov_character_id,
        tension=payload.tension,
        character_ids=payload.character_ids,
        faction_ids=payload.faction_ids,
        foreshadow_ids=payload.foreshadow_ids,
        issue_ids=payload.issue_ids,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _outline_item_out(row)


@router.put("/{novel_id}/outline/{outline_id}", response_model=OutlineItemOut)
def update_outline_item(
    novel_id: str,
    outline_id: str,
    payload: OutlineItemUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OutlineItemOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _outline_item_or_404(db, novel.id, outline_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "title" and value is not None:
            row.title = value.strip()
        elif key == "status" and value is not None:
            row.status = value.strip() or row.status
        elif key == "level":
            row.level = (value or "").strip()
        elif key == "plot_stage":
            row.plot_stage = (value or "").strip()
        elif key == "order" and value is not None:
            row.display_order = value
        else:
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _outline_item_out(row)


@router.delete("/{novel_id}/outline/{outline_id}", response_model=MessageOut)
def delete_outline_item(
    novel_id: str,
    outline_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _outline_item_or_404(db, novel.id, outline_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="大纲节点已删除")


@router.get("/{novel_id}/timeline-events", response_model=list[TimelineEventOut])
def list_timeline_events(
    novel_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TimelineEventOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = (
        db.query(TimelineEventRecord)
        .filter(TimelineEventRecord.novel_id == novel.id)
        .order_by(TimelineEventRecord.display_order.asc(), TimelineEventRecord.created_at.asc())
        .all()
    )
    return [_timeline_event_out(row) for row in rows]


@router.post("/{novel_id}/timeline-events", response_model=TimelineEventOut, status_code=status.HTTP_201_CREATED)
def create_timeline_event(
    novel_id: str,
    payload: TimelineEventCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimelineEventOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(TimelineEventRecord).filter(
        TimelineEventRecord.novel_id == novel.id,
        TimelineEventRecord.id == payload.id,
    ).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="时间线节点 id 已存在")
    chapter_no_start = payload.chapter_no_start if payload.chapter_no_start is not None else payload.chapter_no
    row = TimelineEventRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        display_order=payload.order,
        story_label=payload.story_label,
        title=payload.title.strip(),
        summary=payload.summary,
        chapter_no_start=chapter_no_start,
        chapter_no_end=payload.chapter_no_end,
        outline_item_id=payload.outline_item_id,
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _timeline_event_out(row)


@router.put("/{novel_id}/timeline-events/{event_id}", response_model=TimelineEventOut)
def update_timeline_event(
    novel_id: str,
    event_id: str,
    payload: TimelineEventUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimelineEventOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _timeline_event_or_404(db, novel.id, event_id)
    data = payload.model_dump(exclude_unset=True)
    if "chapter_no" in data and "chapter_no_start" not in data:
        data["chapter_no_start"] = data.pop("chapter_no")
    elif "chapter_no" in data:
        data.pop("chapter_no")
    for key, value in data.items():
        if key == "order":
            row.display_order = value
        elif key == "story_label":
            row.story_label = value
        elif key == "title" and value is not None:
            row.title = value.strip()
        else:
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _timeline_event_out(row)


@router.delete("/{novel_id}/timeline-events/{event_id}", response_model=MessageOut)
def delete_timeline_event(
    novel_id: str,
    event_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _timeline_event_or_404(db, novel.id, event_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="时间线节点已删除")


@router.get("/{novel_id}/foreshadows", response_model=list[ForeshadowPlantOut])
def list_foreshadows(
    novel_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ForeshadowPlantOut]:
    novel = _owned_novel_or_404(db, user, novel_id)
    rows = (
        db.query(ForeshadowPlantRecord)
        .filter(ForeshadowPlantRecord.novel_id == novel.id)
        .order_by(ForeshadowPlantRecord.created_at.desc())
        .all()
    )
    return [_foreshadow_plant_out(db, row) for row in rows]


@router.post("/{novel_id}/foreshadows", response_model=ForeshadowPlantOut, status_code=status.HTTP_201_CREATED)
def create_foreshadow(
    novel_id: str,
    payload: ForeshadowPlantCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForeshadowPlantOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    existed = db.query(ForeshadowPlantRecord).filter(
        ForeshadowPlantRecord.novel_id == novel.id,
        ForeshadowPlantRecord.id == payload.id,
    ).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="伏笔 id 已存在")
    row = ForeshadowPlantRecord(
        id=payload.id.strip(),
        novel_id=novel.id,
        title=payload.title.strip(),
        plant_text=payload.plant_text,
        plant_chapter_id=payload.plant_chapter_id,
        plant_chapter_no=payload.plant_chapter_no,
        plant_chapter_title=payload.plant_chapter_title,
        plant_start=payload.plant_start,
        plant_end=payload.plant_end,
        description=payload.description,
        expected_fulfill_chapter_no=payload.expected_fulfill_chapter_no,
        expected_fulfill_notes=payload.expected_fulfill_notes,
        status=payload.status.strip() or "open",
    )
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _foreshadow_plant_out(db, row)


@router.put("/{novel_id}/foreshadows/{plant_id}", response_model=ForeshadowPlantOut)
def update_foreshadow(
    novel_id: str,
    plant_id: str,
    payload: ForeshadowPlantUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForeshadowPlantOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _foreshadow_plant_or_404(db, novel.id, plant_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        if key == "title" and value is not None:
            row.title = value.strip()
        elif key == "status" and value is not None:
            row.status = value.strip() or row.status
        else:
            setattr(row, key, value)
    row.updated_at = datetime.utcnow()
    db.add(row)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(row)
    return _foreshadow_plant_out(db, row)


@router.delete("/{novel_id}/foreshadows/{plant_id}", response_model=MessageOut)
def delete_foreshadow(
    novel_id: str,
    plant_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    row = _foreshadow_plant_or_404(db, novel.id, plant_id)
    db.delete(row)
    _touch_snapshot(db, novel)
    db.commit()
    return MessageOut(message="伏笔已删除")


@router.post(
    "/{novel_id}/foreshadows/{plant_id}/fulfillments",
    response_model=ForeshadowPlantOut,
    status_code=status.HTTP_201_CREATED,
)
def create_foreshadow_fulfillment(
    novel_id: str,
    plant_id: str,
    payload: ForeshadowFulfillmentCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForeshadowPlantOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    plant = _foreshadow_plant_or_404(db, novel.id, plant_id)
    existed = db.query(ForeshadowFulfillmentRecord).filter(
        ForeshadowFulfillmentRecord.plant_id == plant.id,
        ForeshadowFulfillmentRecord.id == payload.id,
    ).first()
    if existed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="填坑记录 id 已存在")
    row = ForeshadowFulfillmentRecord(
        id=payload.id.strip(),
        plant_id=plant.id,
        fulfill_text=payload.fulfill_text,
        fulfill_chapter_id=payload.fulfill_chapter_id,
        fulfill_chapter_no=payload.fulfill_chapter_no,
        fulfill_chapter_title=payload.fulfill_chapter_title,
        fulfill_start=payload.fulfill_start,
        fulfill_end=payload.fulfill_end,
        notes=payload.notes,
    )
    plant.status = "fulfilled"
    plant.updated_at = datetime.utcnow()
    db.add(row)
    db.add(plant)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(plant)
    return _foreshadow_plant_out(db, plant)


@router.put(
    "/{novel_id}/foreshadows/{plant_id}/fulfillments/{fulfillment_id}",
    response_model=ForeshadowPlantOut,
)
def update_foreshadow_fulfillment(
    novel_id: str,
    plant_id: str,
    fulfillment_id: str,
    payload: ForeshadowFulfillmentUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForeshadowPlantOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    plant = _foreshadow_plant_or_404(db, novel.id, plant_id)
    row = _foreshadow_fulfillment_or_404(db, plant.id, fulfillment_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    plant.updated_at = datetime.utcnow()
    db.add(row)
    db.add(plant)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(plant)
    return _foreshadow_plant_out(db, plant)


@router.delete(
    "/{novel_id}/foreshadows/{plant_id}/fulfillments/{fulfillment_id}",
    response_model=ForeshadowPlantOut,
)
def delete_foreshadow_fulfillment(
    novel_id: str,
    plant_id: str,
    fulfillment_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ForeshadowPlantOut:
    novel = _owned_novel_or_404(db, user, novel_id)
    plant = _foreshadow_plant_or_404(db, novel.id, plant_id)
    row = _foreshadow_fulfillment_or_404(db, plant.id, fulfillment_id)
    db.delete(row)
    db.flush()
    remaining = db.query(ForeshadowFulfillmentRecord).filter(ForeshadowFulfillmentRecord.plant_id == plant.id).count()
    plant.status = "fulfilled" if remaining > 0 else "open"
    plant.updated_at = datetime.utcnow()
    db.add(plant)
    _touch_snapshot(db, novel)
    db.commit()
    db.refresh(plant)
    return _foreshadow_plant_out(db, plant)

