import type { ConflictItem } from './conflictDetect'

const CONFLICT_KEY = 'novel-writing.conflicts'

function readAll(): ConflictItem[] {
  try {
    const raw = localStorage.getItem(CONFLICT_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ConflictItem[]
  } catch {
    return []
  }
}

function writeAll(items: ConflictItem[]): void {
  localStorage.setItem(CONFLICT_KEY, JSON.stringify(items))
}

export function getConflictsByNovelId(novelId: string): ConflictItem[] {
  return readAll().filter((item) => item.novelId === novelId)
}

export function getUnresolvedConflicts(novelId: string): ConflictItem[] {
  return readAll().filter((item) => item.novelId === novelId && !item.resolved)
}

export function getUnresolvedConflictCount(novelId: string): number {
  return getUnresolvedConflicts(novelId).length
}

export function appendConflict(item: ConflictItem): void {
  const all = readAll()
  all.push(item)
  writeAll(all)
}

export function appendConflicts(items: ConflictItem[]): void {
  if (items.length === 0) return
  const all = readAll()
  all.push(...items)
  writeAll(all)
}

export function resolveConflict(
  id: string,
  resolution: 'keep_existing' | 'accept_incoming' | 'ignored',
): ConflictItem | null {
  const all = readAll()
  const idx = all.findIndex((item) => item.id === id)
  if (idx < 0) return null
  all[idx] = {
    ...all[idx],
    resolved: true,
    resolution,
    resolvedAt: new Date().toISOString(),
  }
  writeAll(all)
  return all[idx]
}

export function removeResolvedConflicts(novelId: string): number {
  const all = readAll()
  const before = all.length
  const kept = all.filter((item) => item.novelId !== novelId || !item.resolved)
  writeAll(kept)
  return before - kept.length
}

export function clearConflictsForChapter(novelId: string, chapterId: string): void {
  const all = readAll()
  const kept = all.filter((item) => !(item.novelId === novelId && item.chapterId === chapterId))
  writeAll(kept)
}
