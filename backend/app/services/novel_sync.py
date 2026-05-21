from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import delete
from sqlalchemy.orm import Session

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
    NovelSnapshot,
    NovelChapter,
    OutlineItemRecord,
    TimelineEventRecord,
)


def now_utc() -> datetime:
    return datetime.utcnow()


def default_snapshot_payload() -> dict[str, Any]:
    return {
        "chapters": [],
        "outline": [],
        "characters": [],
        "characterRelations": [],
        "factions": [],
        "items": [],
        "characterFactionMemberships": [],
        "categories": [],
        "timelineEvents": [],
        "foreshadows": [],
    }


def normalize_snapshot_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    base = default_snapshot_payload()
    if not isinstance(payload, dict):
        return base
    for key, default_value in base.items():
        value = payload.get(key, default_value)
        base[key] = value if isinstance(value, list) else default_value
    return base


def _s(value: Any, default: str = "") -> str:
    return str(value if value is not None else default).strip()


def _i(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _json_list(value: Any) -> list[Any]:
    if not isinstance(value, list):
        return []
    return value


def _dt(value: Any) -> datetime:
    raw = _s(value)
    if not raw:
        return now_utc()
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return now_utc()


def _row_list(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, Any]] = []
    for row in value:
        if isinstance(row, dict):
            out.append(row)
    return out


def sync_novel_workspace_from_snapshot(db: Session, novel: Novel, payload: dict[str, Any] | None) -> dict[str, Any]:
    normalized = normalize_snapshot_payload(payload)
    novel_id = novel.id

    db.execute(delete(ForeshadowFulfillmentRecord).where(ForeshadowFulfillmentRecord.plant_id.in_(
        db.query(ForeshadowPlantRecord.id).filter(ForeshadowPlantRecord.novel_id == novel_id)
    )))
    db.execute(delete(ForeshadowPlantRecord).where(ForeshadowPlantRecord.novel_id == novel_id))
    db.execute(delete(TimelineEventRecord).where(TimelineEventRecord.novel_id == novel_id))
    db.execute(delete(CharacterFactionMembershipRecord).where(CharacterFactionMembershipRecord.novel_id == novel_id))
    db.execute(delete(CharacterRelationRecord).where(CharacterRelationRecord.novel_id == novel_id))
    db.execute(delete(ItemRecord).where(ItemRecord.novel_id == novel_id))
    db.execute(delete(FactionRecord).where(FactionRecord.novel_id == novel_id))
    db.execute(delete(CharacterRecord).where(CharacterRecord.novel_id == novel_id))
    db.execute(delete(CategoryRecord).where(CategoryRecord.novel_id == novel_id))
    db.execute(delete(OutlineItemRecord).where(OutlineItemRecord.novel_id == novel_id))
    db.execute(delete(NovelChapter).where(NovelChapter.novel_id == novel_id))

    for row in _row_list(normalized["chapters"]):
        chapter_id = _s(row.get("id"))
        if not chapter_id:
            continue
        db.add(
            NovelChapter(
                id=chapter_id,
                novel_id=novel_id,
                chapter_no=_i(row.get("chapterNo")) or 0,
                title=_s(row.get("title")),
                notes=_s(row.get("notes")),
                annotation=_s(row.get("annotation")),
                content=_s(row.get("content")),
                outline_item_ids=_json_list(row.get("outlineItemIds")),
                status=_s(row.get("status"), "draft") or "draft",
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["outline"]):
        outline_id = _s(row.get("id"))
        if not outline_id:
            continue
        db.add(
            OutlineItemRecord(
                id=outline_id,
                novel_id=novel_id,
                display_order=_i(row.get("order")) or 0,
                title=_s(row.get("title")),
                summary=_s(row.get("summary")),
                status=_s(row.get("status"), "todo") or "todo",
                level=_s(row.get("level")),
                goal=_s(row.get("goal")),
                conflict=_s(row.get("conflict")),
                twist=_s(row.get("twist")),
                result=_s(row.get("result")),
                suspense=_s(row.get("suspense")),
                plot_stage=_s(row.get("plotStage")),
                parent_id=_s(row.get("parentId")) or None,
                location=_s(row.get("location")),
                time_label=_s(row.get("timeLabel")),
                pov_character_id=_s(row.get("povCharacterId")) or None,
                tension=_i(row.get("tension")),
                character_ids=_json_list(row.get("characterIds")),
                faction_ids=_json_list(row.get("factionIds")),
                foreshadow_ids=_json_list(row.get("foreshadowIds")),
                issue_ids=_json_list(row.get("issueIds")),
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["categories"]):
        category_id = _s(row.get("id"))
        if not category_id:
            continue
        db.add(
            CategoryRecord(
                id=category_id,
                novel_id=novel_id,
                name=_s(row.get("name")),
                notes=_s(row.get("notes")),
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["characters"]):
        character_id = _s(row.get("id"))
        if not character_id:
            continue
        db.add(
            CharacterRecord(
                id=character_id,
                novel_id=novel_id,
                name=_s(row.get("name")),
                created_in_chapter_id=_s(row.get("createdInChapterId")) or None,
                first_appearance_chapter_no=_i(row.get("firstAppearanceChapterNo")),
                age=_s(row.get("age")),
                gender=_s(row.get("gender")),
                goal=_s(row.get("goal")),
                secret=_s(row.get("secret")),
                arc=_s(row.get("arc")),
                notes=_s(row.get("notes")),
                attributes=_json_list(row.get("attributes")),
                aliases=_json_list(row.get("aliases")),
                category_ids=_json_list(row.get("categoryIds")),
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["factions"]):
        faction_id = _s(row.get("id"))
        if not faction_id:
            continue
        db.add(
            FactionRecord(
                id=faction_id,
                novel_id=novel_id,
                name=_s(row.get("name")),
                created_in_chapter_id=_s(row.get("createdInChapterId")) or None,
                leader=_s(row.get("leader")),
                notes=_s(row.get("notes")),
                attributes=_json_list(row.get("attributes")),
                category_ids=_json_list(row.get("categoryIds")),
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["items"]):
        item_id = _s(row.get("id"))
        if not item_id:
            continue
        db.add(
            ItemRecord(
                id=item_id,
                novel_id=novel_id,
                name=_s(row.get("name")),
                summary=_s(row.get("summary")),
                owner_type=_s(row.get("ownerType")) or None,
                owner_id=_s(row.get("ownerId")) or None,
                first_appearance_chapter_no=_i(row.get("firstAppearanceChapterNo")),
                attributes=_json_list(row.get("attributes")),
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["characterRelations"]):
        relation_id = _s(row.get("id"))
        if not relation_id:
            continue
        db.add(
            CharacterRelationRecord(
                id=relation_id,
                novel_id=novel_id,
                from_character_id=_s(row.get("fromCharacterId")),
                to_character_id=_s(row.get("toCharacterId")),
                relation_type=_s(row.get("relationType")),
                note=_s(row.get("note")),
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["characterFactionMemberships"]):
        membership_id = _s(row.get("id"))
        if not membership_id:
            continue
        db.add(
            CharacterFactionMembershipRecord(
                id=membership_id,
                novel_id=novel_id,
                character_id=_s(row.get("characterId")),
                faction_id=_s(row.get("factionId")),
                description=_s(row.get("description")),
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["timelineEvents"]):
        event_id = _s(row.get("id"))
        if not event_id:
            continue
        db.add(
            TimelineEventRecord(
                id=event_id,
                novel_id=novel_id,
                display_order=_i(row.get("order")) or 0,
                story_label=_s(row.get("storyLabel")),
                title=_s(row.get("title")),
                summary=_s(row.get("summary")),
                chapter_no_start=_i(row.get("chapterNoStart") if row.get("chapterNoStart") is not None else row.get("chapterNo")),
                chapter_no_end=_i(row.get("chapterNoEnd")),
                outline_item_id=_s(row.get("outlineItemId")) or None,
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )

    for row in _row_list(normalized["foreshadows"]):
        plant_id = _s(row.get("id"))
        if not plant_id:
            continue
        db.add(
            ForeshadowPlantRecord(
                id=plant_id,
                novel_id=novel_id,
                title=_s(row.get("title")),
                plant_text=_s(row.get("plantText")),
                plant_chapter_id=_s(row.get("plantChapterId")),
                plant_chapter_no=_i(row.get("plantChapterNo")) or 0,
                plant_chapter_title=_s(row.get("plantChapterTitle")),
                plant_start=_i(row.get("plantStart")),
                plant_end=_i(row.get("plantEnd")),
                description=_s(row.get("description")),
                expected_fulfill_chapter_no=_i(row.get("expectedFulfillChapterNo")),
                expected_fulfill_notes=_s(row.get("expectedFulfillNotes")),
                status=_s(row.get("status"), "open") or "open",
                created_at=_dt(row.get("createdAt")),
                updated_at=_dt(row.get("updatedAt")),
            )
        )
        for fulfillment in _row_list(row.get("fulfillments")):
            fulfillment_id = _s(fulfillment.get("id"))
            if not fulfillment_id:
                continue
            db.add(
                ForeshadowFulfillmentRecord(
                    id=fulfillment_id,
                    plant_id=plant_id,
                    fulfill_text=_s(fulfillment.get("fulfillText")),
                    fulfill_chapter_id=_s(fulfillment.get("fulfillChapterId")),
                    fulfill_chapter_no=_i(fulfillment.get("fulfillChapterNo")) or 0,
                    fulfill_chapter_title=_s(fulfillment.get("fulfillChapterTitle")),
                    fulfill_start=_i(fulfillment.get("fulfillStart")),
                    fulfill_end=_i(fulfillment.get("fulfillEnd")),
                    notes=_s(fulfillment.get("notes")),
                    created_at=_dt(fulfillment.get("createdAt")),
                )
            )

    return normalized


def backfill_all_novels_from_snapshots(db: Session) -> None:
    novels = db.query(Novel).all()
    for novel in novels:
        payload = novel.snapshot.payload if novel.snapshot else None
        sync_novel_workspace_from_snapshot(db, novel, payload)


def build_workspace_payload_from_db(db: Session, novel_id: str) -> dict[str, Any]:
    payload = default_snapshot_payload()

    payload["chapters"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "chapterNo": row.chapter_no,
            "title": row.title,
            "notes": row.notes,
            "annotation": row.annotation,
            "content": row.content,
            "outlineItemIds": row.outline_item_ids or [],
            "status": row.status,
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(NovelChapter)
        .filter(NovelChapter.novel_id == novel_id)
        .order_by(NovelChapter.chapter_no.asc(), NovelChapter.created_at.asc())
        .all()
    ]

    payload["outline"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "order": row.display_order,
            "title": row.title,
            "summary": row.summary,
            "status": row.status,
            "level": row.level or None,
            "goal": row.goal or "",
            "conflict": row.conflict or "",
            "twist": row.twist or "",
            "result": row.result or "",
            "suspense": row.suspense or "",
            "plotStage": row.plot_stage or None,
            "parentId": row.parent_id,
            "location": row.location or "",
            "timeLabel": row.time_label or "",
            "povCharacterId": row.pov_character_id,
            "tension": row.tension,
            "characterIds": row.character_ids or [],
            "factionIds": row.faction_ids or [],
            "foreshadowIds": row.foreshadow_ids or [],
            "issueIds": row.issue_ids or [],
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(OutlineItemRecord)
        .filter(OutlineItemRecord.novel_id == novel_id)
        .order_by(OutlineItemRecord.display_order.asc(), OutlineItemRecord.created_at.asc())
        .all()
    ]

    payload["categories"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "name": row.name,
            "notes": row.notes,
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(CategoryRecord)
        .filter(CategoryRecord.novel_id == novel_id)
        .order_by(CategoryRecord.name.asc(), CategoryRecord.created_at.asc())
        .all()
    ]

    payload["characters"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "name": row.name,
            "createdInChapterId": row.created_in_chapter_id,
            "firstAppearanceChapterNo": row.first_appearance_chapter_no,
            "age": row.age,
            "gender": row.gender,
            "goal": row.goal,
            "secret": row.secret,
            "arc": row.arc,
            "notes": row.notes,
            "attributes": row.attributes or [],
            "aliases": row.aliases or [],
            "categoryIds": row.category_ids or [],
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(CharacterRecord)
        .filter(CharacterRecord.novel_id == novel_id)
        .order_by(CharacterRecord.updated_at.desc(), CharacterRecord.created_at.asc())
        .all()
    ]

    payload["factions"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "name": row.name,
            "createdInChapterId": row.created_in_chapter_id,
            "leader": row.leader,
            "notes": row.notes,
            "attributes": row.attributes or [],
            "categoryIds": row.category_ids or [],
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(FactionRecord)
        .filter(FactionRecord.novel_id == novel_id)
        .order_by(FactionRecord.updated_at.desc(), FactionRecord.created_at.asc())
        .all()
    ]

    payload["items"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "name": row.name,
            "summary": row.summary,
            "ownerType": row.owner_type,
            "ownerId": row.owner_id,
            "firstAppearanceChapterNo": row.first_appearance_chapter_no,
            "attributes": row.attributes or [],
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(ItemRecord)
        .filter(ItemRecord.novel_id == novel_id)
        .order_by(ItemRecord.updated_at.desc(), ItemRecord.created_at.asc())
        .all()
    ]

    payload["characterRelations"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "fromCharacterId": row.from_character_id,
            "toCharacterId": row.to_character_id,
            "relationType": row.relation_type,
            "note": row.note,
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(CharacterRelationRecord)
        .filter(CharacterRelationRecord.novel_id == novel_id)
        .order_by(CharacterRelationRecord.created_at.asc())
        .all()
    ]

    payload["characterFactionMemberships"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "characterId": row.character_id,
            "factionId": row.faction_id,
            "description": row.description,
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(CharacterFactionMembershipRecord)
        .filter(CharacterFactionMembershipRecord.novel_id == novel_id)
        .order_by(CharacterFactionMembershipRecord.created_at.asc())
        .all()
    ]

    payload["timelineEvents"] = [
        {
            "id": row.id,
            "novelId": row.novel_id,
            "order": row.display_order,
            "storyLabel": row.story_label,
            "title": row.title,
            "summary": row.summary,
            "chapterNoStart": row.chapter_no_start,
            "chapterNoEnd": row.chapter_no_end,
            "outlineItemId": row.outline_item_id,
            "createdAt": row.created_at.isoformat(),
            "updatedAt": row.updated_at.isoformat(),
        }
        for row in db.query(TimelineEventRecord)
        .filter(TimelineEventRecord.novel_id == novel_id)
        .order_by(TimelineEventRecord.display_order.asc(), TimelineEventRecord.created_at.asc())
        .all()
    ]

    plants = (
        db.query(ForeshadowPlantRecord)
        .filter(ForeshadowPlantRecord.novel_id == novel_id)
        .order_by(ForeshadowPlantRecord.created_at.desc())
        .all()
    )
    payload["foreshadows"] = []
    for plant in plants:
        fulfillments = (
            db.query(ForeshadowFulfillmentRecord)
            .filter(ForeshadowFulfillmentRecord.plant_id == plant.id)
            .order_by(ForeshadowFulfillmentRecord.created_at.asc())
            .all()
        )
        payload["foreshadows"].append(
            {
                "id": plant.id,
                "novelId": plant.novel_id,
                "title": plant.title,
                "plantText": plant.plant_text,
                "plantChapterId": plant.plant_chapter_id,
                "plantChapterNo": plant.plant_chapter_no,
                "plantChapterTitle": plant.plant_chapter_title,
                "plantStart": plant.plant_start,
                "plantEnd": plant.plant_end,
                "description": plant.description,
                "expectedFulfillChapterNo": plant.expected_fulfill_chapter_no,
                "expectedFulfillNotes": plant.expected_fulfill_notes,
                "status": plant.status,
                "fulfillments": [
                    {
                        "id": ff.id,
                        "fulfillText": ff.fulfill_text,
                        "fulfillChapterId": ff.fulfill_chapter_id,
                        "fulfillChapterNo": ff.fulfill_chapter_no,
                        "fulfillChapterTitle": ff.fulfill_chapter_title,
                        "fulfillStart": ff.fulfill_start,
                        "fulfillEnd": ff.fulfill_end,
                        "notes": ff.notes,
                        "createdAt": ff.created_at.isoformat(),
                    }
                    for ff in fulfillments
                ],
                "createdAt": plant.created_at.isoformat(),
                "updatedAt": plant.updated_at.isoformat(),
            }
        )

    return payload


def sync_snapshot_from_workspace_tables(db: Session, novel: Novel) -> NovelSnapshot:
    payload = build_workspace_payload_from_db(db, novel.id)
    snapshot = db.query(NovelSnapshot).filter(NovelSnapshot.novel_id == novel.id).first()
    if snapshot is None:
        snapshot = NovelSnapshot(novel_id=novel.id, version=1, payload=payload)
    else:
        snapshot.payload = payload
        snapshot.version += 1
        snapshot.updated_at = now_utc()
    novel.updated_at = now_utc()
    db.add(snapshot)
    db.add(novel)
    return snapshot
