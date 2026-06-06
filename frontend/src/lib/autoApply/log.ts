import type { AutoApplyLogEntry } from '../../types'
import { emitStorageChange, readScopedJson, uid, writeScopedJson } from '../storage'

/** 操作日志存储 key(经 storage 的 scope 隔离,与实体数据同一用户口径) */
const AUTO_APPLY_LOG_KEY = 'novel-writing.auto-apply-log'

function readAll(): AutoApplyLogEntry[] {
  const rows = readScopedJson<AutoApplyLogEntry[]>(AUTO_APPLY_LOG_KEY, [])
  return Array.isArray(rows) ? rows : []
}

function writeAll(rows: AutoApplyLogEntry[]): void {
  writeScopedJson(AUTO_APPLY_LOG_KEY, rows)
  emitStorageChange()
}

/** 追加一条自动入库日志,返回完整 entry(含生成的 id/createdAt) */
export function appendAutoApplyLog(
  entry: Omit<AutoApplyLogEntry, 'id' | 'createdAt' | 'undone' | 'undoneAt'>,
): AutoApplyLogEntry {
  const full: AutoApplyLogEntry = {
    ...entry,
    id: `aal-${uid()}`,
    createdAt: new Date().toISOString(),
    undone: false,
    undoneAt: null,
  }
  const rows = readAll()
  rows.push(full)
  writeAll(rows)
  return full
}

/** 取某章的自动入库日志(默认只取未撤销的,倒序——最近的在前) */
export function getAutoApplyLogByChapter(
  chapterId: string,
  opts?: { includeUndone?: boolean },
): AutoApplyLogEntry[] {
  const cid = String(chapterId ?? '')
  return readAll()
    .filter((r) => r.chapterId === cid && (opts?.includeUndone ? true : !r.undone))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/** 取某本小说的全部自动入库日志(倒序) */
export function getAutoApplyLogByNovel(
  novelId: string,
  opts?: { includeUndone?: boolean },
): AutoApplyLogEntry[] {
  const nid = String(novelId ?? '')
  return readAll()
    .filter((r) => r.novelId === nid && (opts?.includeUndone ? true : !r.undone))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/** 按 id 取单条 */
export function getAutoApplyLogEntry(id: string): AutoApplyLogEntry | null {
  return readAll().find((r) => r.id === id) ?? null
}

/** 标记某条日志已撤销(不物理删除,保留审计) */
export function markAutoApplyUndone(id: string): void {
  const rows = readAll()
  let changed = false
  for (const r of rows) {
    if (r.id === id && !r.undone) {
      r.undone = true
      r.undoneAt = new Date().toISOString()
      changed = true
    }
  }
  if (changed) writeAll(rows)
}

/** 整本小说的日志(冷启动从后端灌回时用):整体替换某 novelId 的记录 */
export function replaceAutoApplyLogForNovel(novelId: string, entries: AutoApplyLogEntry[]): void {
  const nid = String(novelId ?? '')
  const others = readAll().filter((r) => r.novelId !== nid)
  writeAll([...others, ...entries])
}
