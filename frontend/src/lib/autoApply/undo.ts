import type {
  AutoApplyLogEntry,
  Character,
  Faction,
  Item,
  OutlineItem,
} from '../../types'
import {
  deleteCharacter,
  deleteCharacterFactionMembership,
  deleteCharacterRelation,
  deleteFaction,
  deleteForeshadowPlant,
  deleteItem,
  deleteOutlineItem,
  getChaptersByNovelId,
  updateCharacter,
  updateChapter,
  updateFaction,
  updateItem,
  updateOutlineItem,
} from '../storage'
import { markAutoApplyUndone } from './log'

export type UndoResult = { ok: boolean; reason?: string }

/**
 * 撤销一条自动入库操作。
 * create → 删除新建的实体(大纲还需从来源章移除绑定);
 * merge  → 用 beforeSnapshot 整体还原已有实体;
 * classification → 用 beforeSnapshot 还原章节 annotation。
 * 撤销成功后标记日志 undone。纯 storage 操作,reload/toast 由调用方(View)负责。
 */
export function undoAutoApplyEntry(entry: AutoApplyLogEntry): UndoResult {
  if (entry.undone) return { ok: true, reason: '已撤销' }
  const res = entry.action === 'create' ? undoCreate(entry) : undoMerge(entry)
  if (res.ok) markAutoApplyUndone(entry.id)
  return res
}

function undoCreate(entry: AutoApplyLogEntry): UndoResult {
  switch (entry.module) {
    case 'characters':
      deleteCharacter(entry.entityId)
      return { ok: true }
    case 'factions':
      deleteFaction(entry.entityId)
      return { ok: true }
    case 'items':
      deleteItem(entry.entityId)
      return { ok: true }
    case 'relations':
      deleteCharacterRelation(entry.entityId)
      return { ok: true }
    case 'memberships':
      deleteCharacterFactionMembership(entry.entityId)
      return { ok: true }
    case 'foreshadows':
      deleteForeshadowPlant(entry.entityId)
      return { ok: true }
    case 'outlineItems':
      detachOutlineFromChapter(entry.novelId, entry.chapterId, entry.entityId)
      deleteOutlineItem(entry.entityId)
      return { ok: true }
    default:
      return { ok: false, reason: `不支持撤销新建:${entry.module}` }
  }
}

function undoMerge(entry: AutoApplyLogEntry): UndoResult {
  const snap = entry.beforeSnapshot
  if (snap == null) return { ok: false, reason: '缺少还原快照,无法撤销更新' }
  switch (entry.module) {
    case 'characters':
      updateCharacter(snap as Character)
      return { ok: true }
    case 'factions':
      updateFaction(snap as Faction)
      return { ok: true }
    case 'items':
      updateItem(snap as Item)
      return { ok: true }
    case 'outlineItems':
      updateOutlineItem(snap as OutlineItem)
      return { ok: true }
    case 'classification':
      // 快照是 { id, annotation } 形态
      updateChapter(snap as { id: string; annotation?: string })
      return { ok: true }
    default:
      return { ok: false, reason: `不支持撤销更新:${entry.module}` }
  }
}

/** 从来源章节的 outlineItemIds 移除某大纲节点绑定 */
function detachOutlineFromChapter(novelId: string, chapterId: string, outlineId: string): void {
  const chapter = getChaptersByNovelId(novelId).find((c) => c.id === chapterId)
  if (!chapter) return
  const ids = Array.isArray(chapter.outlineItemIds) ? chapter.outlineItemIds : []
  if (!ids.includes(outlineId)) return
  updateChapter({ id: chapterId, outlineItemIds: ids.filter((x) => x !== outlineId) })
}
