from __future__ import annotations

import json
from difflib import SequenceMatcher
from typing import Any

import httpx

from app.core.config import settings
from app.schemas import (
    EntityEvidence,
    EntityMatch,
    ExtractedCharacter,
    ExtractedFaction,
    ExtractedItem,
    ExtractedMembership,
    ExtractedRelation,
    NovelEntityExtractIn,
    NovelEntityExtractOut,
)
from app.services.novel_sync import normalize_snapshot_payload


def _s(value: Any) -> str:
    return str(value if value is not None else "").strip()


def _i(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _f(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for item in value:
        text = _s(item)
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def _norm_name(value: str) -> str:
    return _s(value).casefold().replace(" ", "")


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, _norm_name(a), _norm_name(b)).ratio()


def _normalize_evidences(value: Any) -> list[EntityEvidence]:
    if not isinstance(value, list):
        return []
    out: list[EntityEvidence] = []
    for row in value:
        if not isinstance(row, dict):
            continue
        chapter_id = _s(row.get("chapterId") or row.get("chapter_id"))
        quote = _s(row.get("quote"))
        if not chapter_id and not quote:
            continue
        out.append(
            EntityEvidence(
                chapter_id=chapter_id,
                chapter_no=_i(row.get("chapterNo") or row.get("chapter_no")),
                quote=quote[:280],
            )
        )
    return out[:5]


def _selected_chapters(payload: dict[str, Any], req: NovelEntityExtractIn) -> list[dict[str, Any]]:
    chapters = [row for row in payload.get("chapters", []) if isinstance(row, dict)]
    chapters.sort(key=lambda row: (_i(row.get("chapterNo")) or 0, _s(row.get("createdAt"))))
    explicit_ids = {_s(item) for item in req.chapter_ids if _s(item)}
    if explicit_ids:
        return [row for row in chapters if _s(row.get("id")) in explicit_ids]
    if req.mode == "all":
        return chapters
    if req.mode == "recent":
        return chapters[-3:]
    if not chapters:
        return []
    return [chapters[-1]]


def build_extract_context(snapshot_payload: dict[str, Any], req: NovelEntityExtractIn) -> dict[str, Any]:
    payload = normalize_snapshot_payload(snapshot_payload)
    chapters = _selected_chapters(payload, req)
    return {
        "chapters": [
            {
                "id": _s(row.get("id")),
                "chapterNo": _i(row.get("chapterNo")),
                "title": _s(row.get("title")),
                "content": _s(row.get("content")),
                "notes": _s(row.get("notes")),
                "annotation": _s(row.get("annotation")),
            }
            for row in chapters
            if _s(row.get("content")) or _s(row.get("title"))
        ],
        "characters": payload.get("characters", []) if req.include_existing_entities else [],
        "factions": payload.get("factions", []) if req.include_existing_entities else [],
        "items": payload.get("items", []) if req.include_existing_entities else [],
        "characterRelations": payload.get("characterRelations", []) if req.include_existing_entities else [],
        "characterFactionMemberships": payload.get("characterFactionMemberships", []) if req.include_existing_entities else [],
    }


def _build_prompt(context: dict[str, Any], req: NovelEntityExtractIn) -> str:
    mode_map = {
        "current": "当前章节",
        "recent": "最近 3 章",
        "all": "全书范围",
    }
    schema_hint = {
        "characters": [
            {
                "name": "角色名",
                "aliases": ["别名"],
                "gender": "",
                "age": "",
                "goal": "",
                "secret": "",
                "notes": "",
                "firstAppearanceChapterNo": 1,
                "confidence": 0.9,
                "evidences": [{"chapterId": "ch-1", "chapterNo": 1, "quote": "证据原句"}],
                "warnings": [],
            }
        ],
        "factions": [],
        "items": [],
        "memberships": [
            {
                "characterName": "角色名",
                "factionName": "势力名",
                "description": "所属/立场",
                "confidence": 0.8,
                "evidences": [{"chapterId": "ch-1", "chapterNo": 1, "quote": "证据原句"}],
                "warnings": [],
            }
        ],
        "relations": [
            {
                "fromCharacterName": "甲",
                "toCharacterName": "乙",
                "relationType": "师徒",
                "note": "",
                "confidence": 0.8,
                "evidences": [{"chapterId": "ch-1", "chapterNo": 1, "quote": "证据原句"}],
                "warnings": [],
            }
        ],
        "warnings": [],
    }
    return (
        "你是小说实体抽取助手，不是续写助手。\n"
        "你的任务只是在给定正文里抽取角色、势力、物品，以及角色关系和角色所属势力建议。\n"
        "只能依据输入文本，不能编造，不能补完未明确写出的设定，不要输出正文续写内容。\n"
        "如果不确定，就留空或不输出该字段；如果不能确认同一实体，不要强行合并。\n"
        "输出必须是合法 JSON，对象顶层必须包含 characters, factions, items, memberships, relations, warnings。\n"
        "尽量为每条结论附带 evidences。quote 必须直接来自原文或非常短的原文片段。\n\n"
        f"分析范围：{mode_map.get(req.mode, '当前章节')}\n"
        f"输出 JSON 示例结构：{json.dumps(schema_hint, ensure_ascii=False)}\n\n"
        f"上下文 JSON：{json.dumps(context, ensure_ascii=False)}"
    )


async def _call_model(prompt: str) -> dict[str, Any]:
    req_body = {
        "model": settings.dashscope_model,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": "你只输出合法 JSON，不输出解释，不输出 Markdown。"},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            settings.dashscope_base_url,
            headers={
                "Authorization": f"Bearer {settings.dashscope_api_key}",
                "Content-Type": "application/json",
            },
            json=req_body,
        )
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content) if isinstance(content, str) else content


def _character_match(entity: ExtractedCharacter, payload: dict[str, Any]) -> EntityMatch:
    existing = [row for row in payload.get("characters", []) if isinstance(row, dict)]
    name = entity.name
    for row in existing:
        if _norm_name(_s(row.get("name"))) == _norm_name(name):
            if entity.gender and _s(row.get("gender")) and _s(row.get("gender")) != entity.gender:
                return EntityMatch(type="conflict", target_id=_s(row.get("id")) or None, target_name=_s(row.get("name")) or None)
            return EntityMatch(type="update", target_id=_s(row.get("id")) or None, target_name=_s(row.get("name")) or None)
    for row in existing:
        aliases = _string_list(row.get("aliases"))
        if any(_norm_name(alias) == _norm_name(name) for alias in aliases):
            return EntityMatch(type="possible_duplicate", target_id=_s(row.get("id")) or None, target_name=_s(row.get("name")) or None)
    best = None
    best_score = 0.0
    for row in existing:
        score = _similarity(name, _s(row.get("name")))
        if score > best_score:
            best = row
            best_score = score
    if best is not None and best_score >= 0.78:
        return EntityMatch(type="possible_duplicate", target_id=_s(best.get("id")) or None, target_name=_s(best.get("name")) or None)
    return EntityMatch(type="new")


def _faction_match(entity: ExtractedFaction, payload: dict[str, Any]) -> EntityMatch:
    existing = [row for row in payload.get("factions", []) if isinstance(row, dict)]
    name = entity.name
    for row in existing:
        if _norm_name(_s(row.get("name"))) == _norm_name(name):
            if entity.leader and _s(row.get("leader")) and _s(row.get("leader")) != entity.leader:
                return EntityMatch(type="conflict", target_id=_s(row.get("id")) or None, target_name=_s(row.get("name")) or None)
            return EntityMatch(type="update", target_id=_s(row.get("id")) or None, target_name=_s(row.get("name")) or None)
    best = None
    best_score = 0.0
    for row in existing:
        score = _similarity(name, _s(row.get("name")))
        if score > best_score:
            best = row
            best_score = score
    if best is not None and best_score >= 0.8:
        return EntityMatch(type="possible_duplicate", target_id=_s(best.get("id")) or None, target_name=_s(best.get("name")) or None)
    return EntityMatch(type="new")


def _item_match(entity: ExtractedItem, payload: dict[str, Any]) -> EntityMatch:
    existing = [row for row in payload.get("items", []) if isinstance(row, dict)]
    name = entity.name
    for row in existing:
        if _norm_name(_s(row.get("name"))) == _norm_name(name):
            existing_owner = _s(row.get("ownerId"))
            if entity.owner_id and existing_owner and existing_owner != entity.owner_id:
                return EntityMatch(type="conflict", target_id=_s(row.get("id")) or None, target_name=_s(row.get("name")) or None)
            return EntityMatch(type="update", target_id=_s(row.get("id")) or None, target_name=_s(row.get("name")) or None)
    best = None
    best_score = 0.0
    for row in existing:
        score = _similarity(name, _s(row.get("name")))
        if score > best_score:
            best = row
            best_score = score
    if best is not None and best_score >= 0.8:
        return EntityMatch(type="possible_duplicate", target_id=_s(best.get("id")) or None, target_name=_s(best.get("name")) or None)
    return EntityMatch(type="new")


def _membership_match(entity: ExtractedMembership, payload: dict[str, Any]) -> EntityMatch:
    relations = [row for row in payload.get("characterFactionMemberships", []) if isinstance(row, dict)]
    character_by_id = { _s(row.get("id")): row for row in payload.get("characters", []) if isinstance(row, dict) }
    faction_by_id = { _s(row.get("id")): row for row in payload.get("factions", []) if isinstance(row, dict) }
    for row in relations:
        c = character_by_id.get(_s(row.get("characterId")))
        f = faction_by_id.get(_s(row.get("factionId")))
        if not c or not f:
            continue
        if _norm_name(_s(c.get("name"))) == _norm_name(entity.character_name) and _norm_name(_s(f.get("name"))) == _norm_name(entity.faction_name):
            return EntityMatch(type="update", target_id=_s(row.get("id")) or None, target_name=f"{_s(c.get('name'))} -> {_s(f.get('name'))}")
    return EntityMatch(type="new")


def _relation_match(entity: ExtractedRelation, payload: dict[str, Any]) -> EntityMatch:
    relations = [row for row in payload.get("characterRelations", []) if isinstance(row, dict)]
    character_by_id = { _s(row.get("id")): row for row in payload.get("characters", []) if isinstance(row, dict) }
    for row in relations:
        left = character_by_id.get(_s(row.get("fromCharacterId")))
        right = character_by_id.get(_s(row.get("toCharacterId")))
        if not left or not right:
            continue
        same_pair = _norm_name(_s(left.get("name"))) == _norm_name(entity.from_character_name) and _norm_name(_s(right.get("name"))) == _norm_name(entity.to_character_name)
        reverse_pair = _norm_name(_s(left.get("name"))) == _norm_name(entity.to_character_name) and _norm_name(_s(right.get("name"))) == _norm_name(entity.from_character_name)
        if same_pair or reverse_pair:
            if entity.relation_type and _s(row.get("relationType")) and _s(row.get("relationType")) != entity.relation_type:
                return EntityMatch(type="conflict", target_id=_s(row.get("id")) or None, target_name=f"{_s(left.get('name'))} / {_s(right.get('name'))}")
            return EntityMatch(type="update", target_id=_s(row.get("id")) or None, target_name=f"{_s(left.get('name'))} / {_s(right.get('name'))}")
    return EntityMatch(type="new")


def normalize_extract_result(raw: dict[str, Any], payload: dict[str, Any]) -> NovelEntityExtractOut:
    out = NovelEntityExtractOut(warnings=_string_list(raw.get("warnings")))
    for row in raw.get("characters", []) if isinstance(raw.get("characters"), list) else []:
        if not isinstance(row, dict):
            continue
        entity = ExtractedCharacter(
            name=_s(row.get("name")),
            aliases=_string_list(row.get("aliases")),
            gender=_s(row.get("gender")),
            age=_s(row.get("age")),
            goal=_s(row.get("goal")),
            secret=_s(row.get("secret")),
            notes=_s(row.get("notes")),
            first_appearance_chapter_no=_i(row.get("firstAppearanceChapterNo") or row.get("first_appearance_chapter_no")),
            confidence=_f(row.get("confidence")),
            evidences=_normalize_evidences(row.get("evidences")),
            warnings=_string_list(row.get("warnings")),
        )
        if not entity.name:
            continue
        entity.match = _character_match(entity, payload)
        out.characters.append(entity)
    for row in raw.get("factions", []) if isinstance(raw.get("factions"), list) else []:
        if not isinstance(row, dict):
            continue
        entity = ExtractedFaction(
            name=_s(row.get("name")),
            leader=_s(row.get("leader")),
            notes=_s(row.get("notes")),
            confidence=_f(row.get("confidence")),
            evidences=_normalize_evidences(row.get("evidences")),
            warnings=_string_list(row.get("warnings")),
        )
        if not entity.name:
            continue
        entity.match = _faction_match(entity, payload)
        out.factions.append(entity)
    for row in raw.get("items", []) if isinstance(raw.get("items"), list) else []:
        if not isinstance(row, dict):
            continue
        entity = ExtractedItem(
            name=_s(row.get("name")),
            summary=_s(row.get("summary")),
            owner_type=_s(row.get("ownerType") or row.get("owner_type")) or None,
            owner_id=_s(row.get("ownerId") or row.get("owner_id")) or None,
            owner_name=_s(row.get("ownerName") or row.get("owner_name")),
            first_appearance_chapter_no=_i(row.get("firstAppearanceChapterNo") or row.get("first_appearance_chapter_no")),
            confidence=_f(row.get("confidence")),
            evidences=_normalize_evidences(row.get("evidences")),
            warnings=_string_list(row.get("warnings")),
        )
        if not entity.name:
            continue
        entity.match = _item_match(entity, payload)
        out.items.append(entity)
    for row in raw.get("memberships", []) if isinstance(raw.get("memberships"), list) else []:
        if not isinstance(row, dict):
            continue
        entity = ExtractedMembership(
            character_name=_s(row.get("characterName") or row.get("character_name")),
            faction_name=_s(row.get("factionName") or row.get("faction_name")),
            description=_s(row.get("description")),
            confidence=_f(row.get("confidence")),
            evidences=_normalize_evidences(row.get("evidences")),
            warnings=_string_list(row.get("warnings")),
        )
        if not entity.character_name or not entity.faction_name:
            continue
        entity.match = _membership_match(entity, payload)
        out.memberships.append(entity)
    for row in raw.get("relations", []) if isinstance(raw.get("relations"), list) else []:
        if not isinstance(row, dict):
            continue
        entity = ExtractedRelation(
            from_character_name=_s(row.get("fromCharacterName") or row.get("from_character_name")),
            to_character_name=_s(row.get("toCharacterName") or row.get("to_character_name")),
            relation_type=_s(row.get("relationType") or row.get("relation_type")),
            note=_s(row.get("note")),
            confidence=_f(row.get("confidence")),
            evidences=_normalize_evidences(row.get("evidences")),
            warnings=_string_list(row.get("warnings")),
        )
        if not entity.from_character_name or not entity.to_character_name:
            continue
        entity.match = _relation_match(entity, payload)
        out.relations.append(entity)
    return out


async def extract_entities(snapshot_payload: dict[str, Any], req: NovelEntityExtractIn) -> NovelEntityExtractOut:
    payload = normalize_snapshot_payload(snapshot_payload)
    context = build_extract_context(payload, req)
    if not context["chapters"]:
        return NovelEntityExtractOut(warnings=["没有可分析的章节正文"])
    prompt = _build_prompt(context, req)
    raw = await _call_model(prompt)
    if not isinstance(raw, dict):
        return NovelEntityExtractOut(warnings=["AI 返回格式无效"])
    return normalize_extract_result(raw, payload)
