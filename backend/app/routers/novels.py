from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Novel, NovelSnapshot, User
from app.schemas import MessageOut, NovelCreateIn, NovelOut, NovelUpdateIn, SnapshotOut, SnapshotPutIn

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
        payload={
            "chapters": [],
            "outline": [],
            "characters": [],
            "characterRelations": [],
            "factions": [],
            "characterFactionMemberships": [],
            "categories": [],
            "timelineEvents": [],
            "foreshadows": [],
        },
    )
    db.add(snapshot)
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
        snapshot = NovelSnapshot(novel_id=novel.id, version=1, payload={})
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
    snapshot = db.query(NovelSnapshot).filter(NovelSnapshot.novel_id == novel.id).first()
    if snapshot is None:
        snapshot = NovelSnapshot(novel_id=novel.id, version=1, payload=payload.payload)
    else:
        snapshot.payload = payload.payload
        snapshot.version += 1
        snapshot.updated_at = datetime.utcnow()
    novel.updated_at = datetime.utcnow()
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

