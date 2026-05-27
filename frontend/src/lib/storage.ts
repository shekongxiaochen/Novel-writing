import type {
  Category,
  Character,
  CharacterAttribute,
  Chapter,
  NewCharacterInput,
  NewChapterInput,
  CharacterRelation,
  NewCharacterRelationInput,
  NewFactionInput,
  NewItemInput,
  NewNovelInput,
  NewOutlineInput,
  NewOutlineStorylineInput,
  NewTimelineEventInput,
  OutlineStorylineType,
  CharacterFactionMembership,
  Faction,
  ForeshadowPlant,
  ForeshadowFulfillment,
  Item,
  ItemOwnerType,
  NewForeshadowPlantInput,
  NewForeshadowFulfillmentInput,
  Novel,
  OutlineItem,
  OutlineStoryline,
  OutlineTension,
  TimelineEvent,
} from '../types'
import { getCurrentUser } from './auth'
import { normalizeCharacterAliases } from './characterLabels'

const NOVELS_KEY = 'novel-writing.novels'
const CHAPTERS_KEY = 'novel-writing.chapters'
const OUTLINE_KEY = 'novel-writing.outline'
const OUTLINE_STORYLINE_KEY = 'novel-writing.outline-storylines'
const CHARACTERS_KEY = 'novel-writing.characters'
const CHARACTER_RELATIONS_KEY = 'novel-writing.character-relations'
const FACTIONS_KEY = 'novel-writing.factions'
const ITEMS_KEY = 'novel-writing.items'
const CHARACTER_FACTION_MEMBERSHIPS_KEY = 'novel-writing.character-faction-memberships'
const CHARACTER_LAST_CHANGED_FIELDS_KEY = 'novel-writing.character-last-changed-fields'
const FACTION_LAST_CHANGED_FIELDS_KEY = 'novel-writing.faction-last-changed-fields'
const CATEGORIES_KEY = 'novel-writing.categories'
const TIMELINE_KEY = 'novel-writing.timeline-events'
const FORESHADOWS_KEY = 'novel-writing.foreshadows'
const DELETED_NOVEL_IDS_KEY = 'novel-writing.deleted-novel-ids'

function currentStorageScope(): string {
  const userId = String(getCurrentUser()?.id ?? '').trim()
  return userId ? `user:${userId}` : 'guest'
}

function scopedStorageKey(key: string): string {
  return `${key}.${currentStorageScope()}`
}

function readScopedStorageItem(key: string): string | null {
  return localStorage.getItem(scopedStorageKey(key))
}

function writeScopedStorageItem(key: string, value: string): void {
  localStorage.setItem(scopedStorageKey(key), value)
}

export type WorkspaceSnapshotPayload = {
  chapters?: Chapter[]
  outline?: OutlineItem[]
  outlineStorylines?: OutlineStoryline[]
  characters?: Character[]
  characterRelations?: CharacterRelation[]
  factions?: Faction[]
  items?: Item[]
  characterFactionMemberships?: CharacterFactionMembership[]
  categories?: Category[]
  timelineEvents?: TimelineEvent[]
  foreshadows?: ForeshadowPlant[]
}

function nowIso(): string {
  return new Date().toISOString()
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function emitStorageChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('novel-writing:changed'))
}

function readArrayFromStorage<T>(key: string): T[] {
  try {
    const raw = readScopedStorageItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeArrayToStorage<T>(key: string, items: T[]): void {
  writeScopedStorageItem(key, JSON.stringify(items))
}

function replaceNovelScopedRows<T extends { novelId: string }>(key: string, novelId: string, rows: T[]): void {
  const current = readArrayFromStorage<T>(key)
  const next = current.filter((row) => String(row.novelId ?? '') !== novelId).concat(rows)
  writeArrayToStorage(key, next)
}

function removeNovelScopedRows<T extends { novelId: string }>(key: string, novelId: string): void {
  const current = readArrayFromStorage<T>(key)
  const next = current.filter((row) => String(row.novelId ?? '') !== novelId)
  writeArrayToStorage(key, next)
}

function readDeletedNovelIds(): string[] {
  return normalizeIdList(readArrayFromStorage<string>(DELETED_NOVEL_IDS_KEY))
}

function writeDeletedNovelIds(ids: string[]): void {
  writeArrayToStorage(DELETED_NOVEL_IDS_KEY, normalizeIdList(ids))
}

function markDeletedNovelId(novelId: string): void {
  const id = String(novelId ?? '').trim()
  if (!id) return
  const next = new Set(readDeletedNovelIds())
  next.add(id)
  writeDeletedNovelIds(Array.from(next))
}

function unmarkDeletedNovelId(novelId: string): void {
  const id = String(novelId ?? '').trim()
  if (!id) return
  const next = readDeletedNovelIds().filter((item) => item !== id)
  writeDeletedNovelIds(next)
}

function normalizeIdList(ids?: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = String(raw ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function normalizeCategoryIds(ids?: string[] | null): string[] {
  return normalizeIdList(ids)
}

function getAllCategories(): Category[] {
  const raw = readScopedStorageItem(CATEGORIES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => row as Record<string, unknown>)
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({
        id: String(row.id ?? ''),
        novelId: String(row.novelId ?? ''),
        name: String(row.name ?? '').trim(),
        notes: String(row.notes ?? '').trim(),
        createdAt: String(row.createdAt ?? ''),
        updatedAt: String(row.updatedAt ?? ''),
      }))
      .filter((c) => c.id && c.novelId && c.name)
  } catch {
    return []
  }
}

function saveAllCategories(items: Category[]): void {
  writeScopedStorageItem(CATEGORIES_KEY, JSON.stringify(items))
  emitStorageChange()
}

export function getCategoriesByNovelId(novelId: string): Category[] {
  return getAllCategories()
    .filter((c) => c.novelId === novelId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'))
}

export function createCategory(input: { novelId: string; name: string }): Category {
  const novelId = input.novelId.trim()
  const name = input.name.trim()
  if (!novelId || !name) throw new Error('createCategory: novelId 与 name 不能为空')
  const all = getAllCategories()
  const existed = all.find((c) => c.novelId === novelId && c.name.toLowerCase() === name.toLowerCase())
  if (existed) return existed
  const now = nowIso()
  const item: Category = {
    id: uid(),
    novelId,
    name,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllCategories(all)
  return item
}

export function updateCategory(partial: Pick<Category, 'id'> & Partial<Pick<Category, 'name' | 'notes'>>): Category | null {
  const all = getAllCategories()
  const idx = all.findIndex((c) => c.id === partial.id)
  if (idx < 0) return null
  const merged = { ...all[idx], ...partial }
  const updated: Category = {
    ...merged,
    name: String(merged.name ?? '').trim() || all[idx].name,
    notes: String(merged.notes ?? '').trim(),
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllCategories(all)
  return updated
}

export function deleteCategory(categoryId: string): boolean {
  const id = String(categoryId ?? '').trim()
  if (!id) return false

  const allCategories = getAllCategories()
  const nextCategories = allCategories.filter((c) => c.id !== id)
  if (nextCategories.length === allCategories.length) return false
  saveAllCategories(nextCategories)

  const allCharacters = getAllCharacters()
  let characterChanged = false
  const nextCharacters = allCharacters.map((character) => {
    const nextCategoryIds = normalizeCategoryIds(character.categoryIds).filter((categoryItemId) => categoryItemId !== id)
    const prevCategoryIds = normalizeCategoryIds(character.categoryIds)
    if (nextCategoryIds.length === prevCategoryIds.length) return character
    characterChanged = true
    return {
      ...character,
      categoryIds: nextCategoryIds,
      updatedAt: nowIso(),
    }
  })
  if (characterChanged) saveAllCharacters(nextCharacters)

  const allFactions = getAllFactions()
  let factionChanged = false
  const nextFactions = allFactions.map((faction) => {
    const nextCategoryIds = normalizeCategoryIds(faction.categoryIds).filter((categoryItemId) => categoryItemId !== id)
    const prevCategoryIds = normalizeCategoryIds(faction.categoryIds)
    if (nextCategoryIds.length === prevCategoryIds.length) return faction
    factionChanged = true
    return {
      ...faction,
      categoryIds: nextCategoryIds,
      updatedAt: nowIso(),
    }
  })
  if (factionChanged) saveAllFactions(nextFactions)

  return true
}

export function getNovels(): Novel[] {
  const raw = readScopedStorageItem(NOVELS_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Novel[]
    return parsed
      .map((row) => ({
        ...row,
        continuityBrief: String((row as Novel).continuityBrief ?? '').trim(),
      }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  } catch {
    return []
  }
}

export function getNovelById(id: string): Novel | null {
  return getNovels().find((n) => n.id === id) ?? null
}

export function getDeletedNovelIds(): string[] {
  return readDeletedNovelIds()
}

export function createNovel(input: NewNovelInput): Novel {
  const novels = getNovels()
  const now = nowIso()
  const novel: Novel = {
    id: uid(),
    title: input.title.trim(),
    summary: input.summary.trim(),
    continuityBrief: '',
    genre: input.genre.trim(),
    perspective: input.perspective.trim(),
    tone: input.tone.trim(),
    isMultiLineNarrative: input.isMultiLineNarrative,
    createdAt: now,
    updatedAt: now,
  }

  novels.unshift(novel)
  writeScopedStorageItem(NOVELS_KEY, JSON.stringify(novels))
  unmarkDeletedNovelId(novel.id)
  emitStorageChange()
  return novel
}

export function upsertNovelRecord(novel: Novel): Novel {
  const all = getNovels()
  const idx = all.findIndex((item) => item.id === novel.id)
  if (idx >= 0) all[idx] = novel
  else all.unshift(novel)
  writeScopedStorageItem(NOVELS_KEY, JSON.stringify(all))
  unmarkDeletedNovelId(novel.id)
  emitStorageChange()
  return novel
}

export function hydrateNovelWorkspaceFromPayload(novelId: string, payload: WorkspaceSnapshotPayload): void {
  const id = String(novelId ?? '').trim()
  if (!id) return
  unmarkDeletedNovelId(id)
  replaceNovelScopedRows(CHAPTERS_KEY, id, Array.isArray(payload.chapters) ? payload.chapters : [])
  replaceNovelScopedRows(OUTLINE_KEY, id, Array.isArray(payload.outline) ? payload.outline : [])
  replaceNovelScopedRows(
    OUTLINE_STORYLINE_KEY,
    id,
    Array.isArray(payload.outlineStorylines) ? payload.outlineStorylines : [],
  )
  replaceNovelScopedRows(CHARACTERS_KEY, id, Array.isArray(payload.characters) ? payload.characters : [])
  replaceNovelScopedRows(
    CHARACTER_RELATIONS_KEY,
    id,
    Array.isArray(payload.characterRelations) ? payload.characterRelations : [],
  )
  replaceNovelScopedRows(FACTIONS_KEY, id, Array.isArray(payload.factions) ? payload.factions : [])
  replaceNovelScopedRows(ITEMS_KEY, id, Array.isArray(payload.items) ? payload.items : [])
  replaceNovelScopedRows(
    CHARACTER_FACTION_MEMBERSHIPS_KEY,
    id,
    Array.isArray(payload.characterFactionMemberships) ? payload.characterFactionMemberships : [],
  )
  replaceNovelScopedRows(CATEGORIES_KEY, id, Array.isArray(payload.categories) ? payload.categories : [])
  replaceNovelScopedRows(TIMELINE_KEY, id, Array.isArray(payload.timelineEvents) ? payload.timelineEvents : [])
  replaceNovelScopedRows(FORESHADOWS_KEY, id, Array.isArray(payload.foreshadows) ? payload.foreshadows : [])
  emitStorageChange()
}

export function clearDeletedNovelTracking(novelIds: string[]): void {
  const pending = new Set(readDeletedNovelIds())
  let changed = false
  for (const rawId of novelIds) {
    const id = String(rawId ?? '').trim()
    if (!id || !pending.has(id)) continue
    pending.delete(id)
    changed = true
  }
  if (changed) writeDeletedNovelIds(Array.from(pending))
}

export function deleteNovel(novelId: string, options?: { trackDeletion?: boolean }): boolean {
  const id = String(novelId ?? '').trim()
  if (!id) return false

  const novels = getNovels()
  const nextNovels = novels.filter((novel) => novel.id !== id)
  if (nextNovels.length === novels.length) return false

  const chapterIds = getChaptersByNovelId(id).map((chapter) => chapter.id)
  const characterIds = getCharactersByNovelId(id).map((character) => character.id)
  const factionIds = getFactionsByNovelId(id).map((faction) => faction.id)

  writeScopedStorageItem(NOVELS_KEY, JSON.stringify(nextNovels))
  removeNovelScopedRows<Chapter>(CHAPTERS_KEY, id)
  removeNovelScopedRows<OutlineItem>(OUTLINE_KEY, id)
  removeNovelScopedRows<OutlineStoryline>(OUTLINE_STORYLINE_KEY, id)
  removeNovelScopedRows<Character>(CHARACTERS_KEY, id)
  removeNovelScopedRows<CharacterRelation>(CHARACTER_RELATIONS_KEY, id)
  removeNovelScopedRows<Faction>(FACTIONS_KEY, id)
  removeNovelScopedRows<Item>(ITEMS_KEY, id)
  removeNovelScopedRows<CharacterFactionMembership>(CHARACTER_FACTION_MEMBERSHIPS_KEY, id)
  removeNovelScopedRows<Category>(CATEGORIES_KEY, id)
  removeNovelScopedRows<TimelineEvent>(TIMELINE_KEY, id)
  removeNovelScopedRows<ForeshadowPlant>(FORESHADOWS_KEY, id)

  for (const chapterId of chapterIds) {
    removeEntityChangeAnchorsForChapter(chapterId)
  }
  for (const characterId of characterIds) {
    removeCharacterLastChangedFields(characterId)
  }
  for (const factionId of factionIds) {
    removeFactionLastChangedFields(factionId)
  }

  if (options?.trackDeletion !== false) markDeletedNovelId(id)
  else unmarkDeletedNovelId(id)
  emitStorageChange()
  return true
}

export function buildNovelWorkspacePayload(novelId: string): WorkspaceSnapshotPayload {
  return {
    chapters: getChaptersByNovelId(novelId),
    outline: getOutlineByNovelId(novelId),
    outlineStorylines: getOutlineStorylinesByNovelId(novelId),
    characters: getCharactersByNovelId(novelId),
    characterRelations: getCharacterRelationsByNovelId(novelId),
    factions: getFactionsByNovelId(novelId),
    items: getItemsByNovelId(novelId),
    characterFactionMemberships: getCharacterFactionMembershipsByNovelId(novelId),
    categories: getCategoriesByNovelId(novelId),
    timelineEvents: getTimelineByNovelId(novelId),
    foreshadows: getForeshadowsByNovelId(novelId),
  }
}

export function getChaptersByNovelId(novelId: string): Chapter[] {
  const raw = readScopedStorageItem(CHAPTERS_KEY)
  if (!raw) return []

  try {
    const all = JSON.parse(raw) as Chapter[]
    return all
      .filter((c) => c.novelId === novelId)
      .sort((a, b) => a.chapterNo - b.chapterNo)
  } catch {
    return []
  }
}

function saveAllChapters(chapters: Chapter[]): void {
  writeScopedStorageItem(CHAPTERS_KEY, JSON.stringify(chapters))
}

function getAllChapters(): Chapter[] {
  const raw = readScopedStorageItem(CHAPTERS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Chapter[]
    return parsed.map((c) => ({
      ...c,
      notes: (c as any).notes ?? '',
      annotation: (c as any).annotation ?? '',
      content: (c as any).content ?? '',
      outlineItemIds: Array.isArray((c as any).outlineItemIds) ? (c as any).outlineItemIds : [],
      status: ((c as any).status as any) ?? 'draft',
      createdAt: (c as any).createdAt ?? nowIso(),
      updatedAt: (c as any).updatedAt ?? nowIso(),
    }))
  } catch {
    return []
  }
}

function detectTextChangeWindow(oldText: string, newText: string): {
  oldStart: number
  oldEnd: number
  newStart: number
  newEnd: number
  delta: number
} {
  const oldLen = oldText.length
  const newLen = newText.length
  let prefix = 0
  const minLen = Math.min(oldLen, newLen)
  while (prefix < minLen && oldText[prefix] === newText[prefix]) prefix += 1

  let suffix = 0
  while (
    suffix < oldLen - prefix &&
    suffix < newLen - prefix &&
    oldText[oldLen - 1 - suffix] === newText[newLen - 1 - suffix]
  ) {
    suffix += 1
  }

  const oldStart = prefix
  const oldEnd = oldLen - suffix
  const newStart = prefix
  const newEnd = newLen - suffix
  return {
    oldStart,
    oldEnd,
    newStart,
    newEnd,
    delta: (newEnd - newStart) - (oldEnd - oldStart),
  }
}

function remapRangeAfterEdit(
  start: number,
  end: number,
  win: { oldStart: number; oldEnd: number; newStart: number; newEnd: number; delta: number },
): { start: number; end: number } {
  const s = Math.max(0, Math.floor(start))
  const e = Math.max(s, Math.floor(end))

  // 纯插入：在范围内插入应扩展该范围；在前方插入整体右移
  if (win.oldStart === win.oldEnd && win.newEnd > win.newStart) {
    const addLen = win.newEnd - win.newStart
    const p = win.oldStart
    // 仅当插入点严格落在区间内部时才扩展；边界（p===s 或 p===e）不计入区间
    if (p <= s) return { start: s + addLen, end: e + addLen }
    if (p < e) return { start: s, end: e + addLen }
    return { start: s, end: e }
  }

  const mapPos = (pos: number, edge: 'start' | 'end'): number => {
    if (pos <= win.oldStart) return pos
    if (pos >= win.oldEnd) return pos + win.delta
    return edge === 'start' ? win.newStart : win.newEnd
  }

  const mappedStart = mapPos(s, 'start')
  const mappedEnd = mapPos(e, 'end')
  return {
    start: Math.max(0, Math.min(mappedStart, mappedEnd)),
    end: Math.max(0, Math.max(mappedStart, mappedEnd)),
  }
}

function syncForeshadowsAfterChapterContentEdit(
  chapterId: string,
  oldContent: string,
  newContent: string,
): void {
  if (oldContent === newContent) return
  const foreshadows = getAllForeshadows()
  if (foreshadows.length === 0) return
  const win = detectTextChangeWindow(oldContent, newContent)
  let changed = false

  const next = foreshadows.map((plant) => {
    let plantChanged = false
    let nextPlant = plant

    if (
      plant.plantChapterId === chapterId &&
      typeof plant.plantStart === 'number' &&
      typeof plant.plantEnd === 'number' &&
      plant.plantEnd > plant.plantStart
    ) {
      const mapped = remapRangeAfterEdit(plant.plantStart, plant.plantEnd, win)
      const nextPlantText = newContent.slice(mapped.start, mapped.end)
      nextPlant = {
        ...nextPlant,
        plantStart: mapped.start,
        plantEnd: mapped.end,
        plantText: nextPlantText,
      }
      plantChanged = true
    }

    const nextFulfillments = (nextPlant.fulfillments ?? []).map((ff) => {
      if (
        ff.fulfillChapterId !== chapterId ||
        typeof ff.fulfillStart !== 'number' ||
        typeof ff.fulfillEnd !== 'number' ||
        ff.fulfillEnd <= ff.fulfillStart
      ) {
        return ff
      }
      const mapped = remapRangeAfterEdit(ff.fulfillStart, ff.fulfillEnd, win)
      const nextText = newContent.slice(mapped.start, mapped.end)
      plantChanged = true
      return {
        ...ff,
        fulfillStart: mapped.start,
        fulfillEnd: mapped.end,
        fulfillText: nextText,
      }
    })

    if (!plantChanged) return plant
    changed = true
    return {
      ...nextPlant,
      fulfillments: nextFulfillments,
      updatedAt: nowIso(),
    }
  })

  if (changed) saveAllForeshadows(next)
}

function normalizeAnchoredEventAfterRemap<T extends { anchorStart?: number; anchorEnd?: number }>(
  ev: T,
  win: { oldStart: number; oldEnd: number; newStart: number; newEnd: number; delta: number },
): T {
  if (typeof ev.anchorStart !== 'number') return ev
  const start = Math.max(0, Math.floor(ev.anchorStart))
  const endRaw = typeof ev.anchorEnd === 'number' ? Math.max(0, Math.floor(ev.anchorEnd)) : start + 1
  const end = Math.max(start + 1, endRaw)
  const mapped = remapRangeAfterEdit(start, end, win)
  const nextStart = Math.max(0, Math.floor(mapped.start))
  const nextEnd = Math.max(nextStart + 1, Math.floor(mapped.end))
  if (nextStart === start && nextEnd === end) return ev
  return {
    ...(ev as any),
    anchorStart: nextStart,
    anchorEnd: nextEnd,
  } as T
}

/** 章节正文变更后：重映射本章内角色/势力档案修改锚点，避免插入/删除导致锚点失效 */
function syncEntityChangeAnchorsAfterChapterContentEdit(
  chapterId: string,
  oldContent: string,
  newContent: string,
): void {
  if (oldContent === newContent) return
  const chId = String(chapterId ?? '').trim()
  if (!chId) return
  const win = detectTextChangeWindow(oldContent, newContent)

  // 角色
  const charMap = readCharacterLastChangedMap()
  let charChanged = false
  for (const [id, row] of Object.entries(charMap)) {
    const events = row?.events
    if (!Array.isArray(events) || events.length === 0) continue
    let touched = false
    const nextEvents = events.map((ev) => {
      if (String(ev.chapterId ?? '').trim() !== chId) return ev
      if (typeof ev.anchorStart !== 'number') return ev
      touched = true
      return normalizeAnchoredEventAfterRemap(ev, win)
    })
    if (touched) {
      charMap[id] = { events: nextEvents }
      charChanged = true
    }
  }
  if (charChanged) saveCharacterLastChangedMap(charMap)

  // 势力
  const facMap = readFactionLastChangedMap()
  let facChanged = false
  for (const [id, row] of Object.entries(facMap)) {
    const events = row?.events
    if (!Array.isArray(events) || events.length === 0) continue
    let touched = false
    const nextEvents = events.map((ev) => {
      if (String(ev.chapterId ?? '').trim() !== chId) return ev
      if (typeof ev.anchorStart !== 'number') return ev
      touched = true
      return normalizeAnchoredEventAfterRemap(ev, win)
    })
    if (touched) {
      facMap[id] = { events: nextEvents }
      facChanged = true
    }
  }
  if (facChanged) saveFactionLastChangedMap(facMap)
}

function removeEntityChangeAnchorsForChapter(chapterId: string): void {
  const chId = String(chapterId ?? '').trim()
  if (!chId) return

  const charMap = readCharacterLastChangedMap()
  let charChanged = false
  for (const [id, row] of Object.entries(charMap)) {
    const events = row.events.filter((ev) => String(ev.chapterId ?? '').trim() !== chId)
    if (events.length !== row.events.length) {
      if (events.length > 0) charMap[id] = { events }
      else delete charMap[id]
      charChanged = true
    }
  }
  if (charChanged) saveCharacterLastChangedMap(charMap)

  const facMap = readFactionLastChangedMap()
  let facChanged = false
  for (const [id, row] of Object.entries(facMap)) {
    const events = row.events.filter((ev) => String(ev.chapterId ?? '').trim() !== chId)
    if (events.length !== row.events.length) {
      if (events.length > 0) facMap[id] = { events }
      else delete facMap[id]
      facChanged = true
    }
  }
  if (facChanged) saveFactionLastChangedMap(facMap)
}


/** 章节正文变更后：自动绑定角色首次出场章节（基于角色名在正文中首次出现） */
function syncCharacterFirstAppearanceByNovel(novelId: string): void {
  const id = String(novelId ?? '').trim()
  if (!id) return
  const chapters = getAllChapters()
    .filter((c) => c.novelId === id)
    .sort((a, b) => a.chapterNo - b.chapterNo)

  const allCharacters = getAllCharacters()
  let changed = false
  for (let i = 0; i < allCharacters.length; i++) {
    const c = allCharacters[i]
    if (c.novelId !== id) continue
    const name = (c.name ?? '').trim()
    if (!name) continue
    let firstNo: number | null = null
    for (const ch of chapters) {
      if ((ch.content ?? '').includes(name)) {
        firstNo = ch.chapterNo
        break
      }
    }
    const prevNo =
      typeof c.firstAppearanceChapterNo === 'number' && c.firstAppearanceChapterNo > 0
        ? Math.floor(c.firstAppearanceChapterNo)
        : null
    if (prevNo === firstNo) continue
    allCharacters[i] = {
      ...c,
      firstAppearanceChapterNo: firstNo,
      updatedAt: nowIso(),
    }
    changed = true
  }
  if (changed) saveAllCharacters(allCharacters)
}

export function createChapter(input: NewChapterInput): Chapter {
  const all = getAllChapters()
  const novelChapters = all.filter((c) => c.novelId === input.novelId)
  const maxNo = novelChapters.reduce((max, c) => Math.max(max, c.chapterNo), 0)
  const now = nowIso()
  const chapter: Chapter = {
    id: uid(),
    novelId: input.novelId,
    chapterNo: maxNo + 1,
    title: input.title.trim() || `第${maxNo + 1}章`,
    notes: input.notes.trim(),
    annotation: input.annotation.trim(),
    content: '',
    outlineItemIds: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  all.push(chapter)
  saveAllChapters(all)
  emitStorageChange()
  return chapter
}

export function updateChapter(partial: Pick<Chapter, 'id'> & Partial<Chapter>): Chapter | null {
  const all = getAllChapters()
  const idx = all.findIndex((c) => c.id === partial.id)
  if (idx < 0) return null

  const prev = all[idx]
  const updated: Chapter = {
    ...prev,
    ...partial,
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllChapters(all)
  if (typeof partial.content === 'string') {
    syncForeshadowsAfterChapterContentEdit(updated.id, prev.content ?? '', updated.content ?? '')
    syncEntityChangeAnchorsAfterChapterContentEdit(updated.id, prev.content ?? '', updated.content ?? '')
    syncCharacterFirstAppearanceByNovel(updated.novelId)
    syncItemFirstAppearanceByNovel(updated.novelId)
  }
  return updated
}

export type ChapterDeletePreview = {
  chapterId: string
  chapterNo: number
  chapterTitle: string
  charactersToDelete: Character[]
  factionsToDelete: Faction[]
  foreshadowPlantsToDelete: ForeshadowPlant[]
  fulfillmentsToDeleteCount: number
  chaptersToRenumberCount: number
}

function remapChapterNoAfterDelete(chapterNo: number | null | undefined, deletedNo: number): number | null {
  if (typeof chapterNo !== 'number' || !Number.isFinite(chapterNo) || chapterNo <= 0) return null
  if (chapterNo === deletedNo) return null
  return chapterNo > deletedNo ? chapterNo - 1 : Math.floor(chapterNo)
}

export function getChapterDeletePreview(chapterId: string): ChapterDeletePreview | null {
  const allChapters = getAllChapters()
  const target = allChapters.find((c) => c.id === chapterId)
  if (!target) return null
  const novelId = target.novelId
  const deletedNo = target.chapterNo

  const allCharacters = getAllCharacters().filter((c) => c.novelId === novelId)
  const charactersToDelete = allCharacters.filter((c) => {
    if ((c.createdInChapterId ?? '') === chapterId) return true
    const no = c.firstAppearanceChapterNo
    return (c.createdInChapterId == null || c.createdInChapterId === '') && no === deletedNo
  })

  const allFactions = getAllFactions().filter((f) => f.novelId === novelId)
  const factionsToDelete = allFactions.filter((f) => (f.createdInChapterId ?? '') === chapterId)

  const novelForeshadows = getAllForeshadows().filter((p) => p.novelId === novelId)
  const foreshadowPlantsToDelete = novelForeshadows.filter((p) => p.plantChapterId === chapterId)
  const deletedPlantIds = new Set(foreshadowPlantsToDelete.map((p) => p.id))
  const fulfillmentsToDeleteCount = novelForeshadows.reduce((sum, p) => {
    if (deletedPlantIds.has(p.id)) return sum + (p.fulfillments?.length ?? 0)
    return sum + (p.fulfillments ?? []).filter((ff) => ff.fulfillChapterId === chapterId).length
  }, 0)

  const chaptersToRenumberCount = allChapters.filter(
    (c) => c.novelId === novelId && c.id !== chapterId && c.chapterNo > deletedNo,
  ).length

  return {
    chapterId,
    chapterNo: target.chapterNo,
    chapterTitle: target.title,
    charactersToDelete,
    factionsToDelete,
    foreshadowPlantsToDelete,
    fulfillmentsToDeleteCount,
    chaptersToRenumberCount,
  }
}

/** 删除章节并级联清理关联数据，然后重排后续章节号 */
export function deleteChapter(chapterId: string): boolean {
  const preview = getChapterDeletePreview(chapterId)
  if (!preview) return false

  const now = nowIso()
  const target = getAllChapters().find((c) => c.id === chapterId)
  if (!target) return false
  removeEntityChangeAnchorsForChapter(chapterId)
  const novelId = target.novelId
  const deletedNo = target.chapterNo
  const remainingChapters = getAllChapters().filter((c) => c.id !== chapterId)

  const chapterById = new Map<string, Chapter>()
  for (const ch of remainingChapters) chapterById.set(ch.id, ch)

  const reindexedChapters = remainingChapters.map((c) => {
    if (c.novelId !== novelId) return c
    const nextNo = remapChapterNoAfterDelete(c.chapterNo, deletedNo)
    if (nextNo == null) return c
    if (nextNo === c.chapterNo) return c
    return { ...c, chapterNo: nextNo, updatedAt: now }
  })
  saveAllChapters(reindexedChapters)

  const deletedCharacterIds = new Set(preview.charactersToDelete.map((c) => c.id))
  const deletedFactionIds = new Set(preview.factionsToDelete.map((f) => f.id))

  const allCharacters = getAllCharacters()
  const nextCharacters = allCharacters
    .filter((c) => !deletedCharacterIds.has(c.id))
    .map((c) => {
      if (c.novelId !== novelId) return c
      const mappedNo = remapChapterNoAfterDelete(c.firstAppearanceChapterNo, deletedNo)
      if (mappedNo === c.firstAppearanceChapterNo) return c
      return { ...c, firstAppearanceChapterNo: mappedNo, updatedAt: now }
    })
  saveAllCharacters(nextCharacters)

  const allFactions = getAllFactions()
  const nextFactions = allFactions.filter((f) => !deletedFactionIds.has(f.id))
  saveAllFactions(nextFactions)

  const allMems = getAllCharacterFactionMemberships()
  const nextMems = allMems.filter(
    (m) => !deletedCharacterIds.has(m.characterId) && !deletedFactionIds.has(m.factionId),
  )
  if (nextMems.length !== allMems.length) saveAllCharacterFactionMemberships(nextMems)

  const allRelations = getAllCharacterRelations()
  const nextRelations = allRelations.filter(
    (r) => !deletedCharacterIds.has(r.fromCharacterId) && !deletedCharacterIds.has(r.toCharacterId),
  )
  if (nextRelations.length !== allRelations.length) saveAllCharacterRelations(nextRelations)

  const allForeshadows = getAllForeshadows()
  const nextForeshadows: ForeshadowPlant[] = []
  for (const plant of allForeshadows) {
    if (plant.novelId !== novelId) {
      nextForeshadows.push(plant)
      continue
    }
    if (plant.plantChapterId === chapterId) continue

    const keptFulfillments = (plant.fulfillments ?? []).filter((ff) => ff.fulfillChapterId !== chapterId)
    const mappedPlantNo = remapChapterNoAfterDelete(plant.plantChapterNo, deletedNo)
    const plantChapter = chapterById.get(plant.plantChapterId)
    const nextPlantNo = mappedPlantNo ?? plant.plantChapterNo
    const nextPlantTitle = plantChapter?.title ?? plant.plantChapterTitle
    const nextFulfillments = keptFulfillments.map((ff) => {
      const mappedNo = remapChapterNoAfterDelete(ff.fulfillChapterNo, deletedNo)
      const ffChapter = chapterById.get(ff.fulfillChapterId)
      return {
        ...ff,
        fulfillChapterNo: mappedNo ?? ff.fulfillChapterNo,
        fulfillChapterTitle: ffChapter?.title ?? ff.fulfillChapterTitle,
      }
    })

    nextForeshadows.push({
      ...plant,
      plantChapterNo: nextPlantNo,
      plantChapterTitle: nextPlantTitle,
      fulfillments: nextFulfillments,
      status: nextFulfillments.length > 0 ? 'fulfilled' : 'open',
      updatedAt: now,
    })
  }
  saveAllForeshadows(nextForeshadows)

  const allTimeline = getAllTimelineEvents()
  const nextTimeline = allTimeline.map((item) => {
    if (item.novelId !== novelId) return item
    const nextStart = remapChapterNoAfterDelete(item.chapterNoStart, deletedNo)
    const nextEnd = remapChapterNoAfterDelete(item.chapterNoEnd, deletedNo)
    if (nextStart === item.chapterNoStart && nextEnd === item.chapterNoEnd) return item
    return { ...item, chapterNoStart: nextStart, chapterNoEnd: nextEnd, updatedAt: now }
  })
  saveAllTimelineEvents(nextTimeline)
  syncCharacterFirstAppearanceByNovel(novelId)
  syncItemFirstAppearanceByNovel(novelId)

  return true
}

function normalizeOutlineTension(value: unknown): OutlineTension {
  const n = Math.round(Number(value))
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n
  return 3
}

function normalizeOutlineItem(row: OutlineItem | (Partial<OutlineItem> & Record<string, unknown>)): OutlineItem {
  const now = nowIso()
  return {
    id: String(row.id ?? '').trim(),
    novelId: String(row.novelId ?? '').trim(),
    order: Number.isFinite(Number(row.order)) ? Number(row.order) : 0,
    title: String(row.title ?? '').trim() || '未命名情节点',
    summary: String(row.summary ?? '').trim(),
    status: row.status === 'doing' || row.status === 'done' ? row.status : 'todo',
    level: row.level === 'volume' || row.level === 'act' || row.level === 'chapter' || row.level === 'scene' ? row.level : 'scene',
    goal: String(row.goal ?? '').trim(),
    conflict: String(row.conflict ?? '').trim(),
    twist: String(row.twist ?? '').trim(),
    result: String(row.result ?? '').trim(),
    suspense: String(row.suspense ?? '').trim(),
    plotStage: row.plotStage === 'drafted' || row.plotStage === 'written' || row.plotStage === 'resolved' ? row.plotStage : 'idea',
    parentId: String(row.parentId ?? '').trim() || null,
    location: String(row.location ?? '').trim(),
    timeLabel: String(row.timeLabel ?? '').trim(),
    povCharacterId: String(row.povCharacterId ?? '').trim() || null,
    tension: normalizeOutlineTension(row.tension),
    characterIds: normalizeIdList(row.characterIds),
    factionIds: normalizeIdList(row.factionIds),
    foreshadowIds: normalizeIdList(row.foreshadowIds),
    issueIds: normalizeIdList(row.issueIds),
    storylineIds: normalizeIdList(row.storylineIds),
    emotionalTurn: String(row.emotionalTurn ?? '').trim(),
    proseHint: String(row.proseHint ?? '').trim(),
    createdAt: String(row.createdAt ?? '') || now,
    updatedAt: String(row.updatedAt ?? '') || now,
  }
}

const DEFAULT_STORYLINE_COLORS: Record<OutlineStorylineType, string> = {
  main: '#b45309',
  subplot: '#2563eb',
  character: '#7c3aed',
  romance: '#db2777',
  antagonist: '#dc2626',
  world: '#059669',
  custom: '#64748b',
}

function normalizeOutlineStorylineType(value: unknown): OutlineStorylineType {
  const raw = String(value ?? '').trim() as OutlineStorylineType
  if (
    raw === 'main' ||
    raw === 'subplot' ||
    raw === 'character' ||
    raw === 'romance' ||
    raw === 'antagonist' ||
    raw === 'world' ||
    raw === 'custom'
  ) {
    return raw
  }
  return 'custom'
}

function normalizeOutlineStoryline(
  row: OutlineStoryline | (Partial<OutlineStoryline> & Record<string, unknown>),
): OutlineStoryline {
  const now = nowIso()
  const type = normalizeOutlineStorylineType(row.type)
  const colorRaw = String(row.color ?? '').trim()
  return {
    id: String(row.id ?? '').trim(),
    novelId: String(row.novelId ?? '').trim(),
    name: String(row.name ?? '').trim() || '未命名故事线',
    type,
    color: colorRaw || DEFAULT_STORYLINE_COLORS[type],
    description: String(row.description ?? '').trim(),
    order: Number.isFinite(Number(row.order)) ? Number(row.order) : 0,
    createdAt: String(row.createdAt ?? '') || now,
    updatedAt: String(row.updatedAt ?? '') || now,
  }
}

function getAllOutlineStorylines(): OutlineStoryline[] {
  return readArrayFromStorage<OutlineStoryline>(OUTLINE_STORYLINE_KEY)
    .map((row) => normalizeOutlineStoryline(row as Partial<OutlineStoryline> & Record<string, unknown>))
    .filter((item) => item.id && item.novelId)
}

function saveAllOutlineStorylines(items: OutlineStoryline[]): void {
  writeArrayToStorage(OUTLINE_STORYLINE_KEY, items)
}

export function getOutlineStorylinesByNovelId(novelId: string): OutlineStoryline[] {
  return getAllOutlineStorylines()
    .filter((item) => item.novelId === novelId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

export function resolveOutlineStorylineColor(type: OutlineStorylineType, colorHint?: string): string {
  const hint = String(colorHint ?? '').trim()
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hint)) return hint
  return DEFAULT_STORYLINE_COLORS[type] ?? DEFAULT_STORYLINE_COLORS.custom
}

export function createOutlineStoryline(input: NewOutlineStorylineInput): OutlineStoryline {
  const all = getAllOutlineStorylines()
  const novelItems = all.filter((item) => item.novelId === input.novelId)
  const maxOrder = novelItems.reduce((max, item) => Math.max(max, item.order), 0)
  const type = normalizeOutlineStorylineType(input.type)
  const now = nowIso()
  const item: OutlineStoryline = {
    id: uid(),
    novelId: input.novelId,
    name: input.name.trim() || `故事线 ${maxOrder + 1}`,
    type,
    color: String(input.color ?? '').trim() || DEFAULT_STORYLINE_COLORS[type],
    description: String(input.description ?? '').trim(),
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllOutlineStorylines(all)
  emitStorageChange()
  return item
}
function getAllOutlineItems(): OutlineItem[] {
  const raw = readScopedStorageItem(OUTLINE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => normalizeOutlineItem(row as Partial<OutlineItem> & Record<string, unknown>))
      .filter((item) => item.id && item.novelId)
  } catch {
    return []
  }
}

function saveAllOutlineItems(items: OutlineItem[]): void {
  writeScopedStorageItem(OUTLINE_KEY, JSON.stringify(items))
}

export function getOutlineByNovelId(novelId: string): OutlineItem[] {
  return getAllOutlineItems()
    .filter((i) => i.novelId === novelId)
    .sort((a, b) => a.order - b.order)
}

export function createOutlineItem(input: NewOutlineInput): OutlineItem {
  const all = getAllOutlineItems()
  const novelItems = all.filter((i) => i.novelId === input.novelId)
  const maxOrder = novelItems.reduce((max, i) => Math.max(max, i.order), 0)
  const now = nowIso()
  const item: OutlineItem = {
    id: uid(),
    novelId: input.novelId,
    order: maxOrder + 1,
    title: input.title.trim() || `情节点 ${maxOrder + 1}`,
    summary: input.summary.trim(),
    status: 'todo',
    level: input.level ?? 'scene',
    goal: String(input.goal ?? '').trim(),
    conflict: String(input.conflict ?? '').trim(),
    twist: String(input.twist ?? '').trim(),
    result: String(input.result ?? '').trim(),
    suspense: String(input.suspense ?? '').trim(),
    plotStage: input.plotStage ?? 'idea',
    parentId: String(input.parentId ?? '').trim() || null,
    location: String(input.location ?? '').trim(),
    timeLabel: String(input.timeLabel ?? '').trim(),
    povCharacterId: String(input.povCharacterId ?? '').trim() || null,
    tension: normalizeOutlineTension(input.tension),
    characterIds: normalizeIdList(input.characterIds),
    factionIds: normalizeIdList(input.factionIds),
    foreshadowIds: normalizeIdList(input.foreshadowIds),
    issueIds: normalizeIdList(input.issueIds),
    storylineIds: normalizeIdList(input.storylineIds),
    emotionalTurn: String(input.emotionalTurn ?? '').trim(),
    proseHint: String(input.proseHint ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllOutlineItems(all)
  return item
}

export function updateOutlineItem(
  partial: Pick<OutlineItem, 'id'> & Partial<OutlineItem>
): OutlineItem | null {
  const all = getAllOutlineItems()
  const idx = all.findIndex((i) => i.id === partial.id)
  if (idx < 0) return null

  const updated: OutlineItem = {
    ...all[idx],
    ...partial,
    characterIds: partial.characterIds !== undefined ? normalizeIdList(partial.characterIds) : all[idx].characterIds ?? [],
    factionIds: partial.factionIds !== undefined ? normalizeIdList(partial.factionIds) : all[idx].factionIds ?? [],
    foreshadowIds: partial.foreshadowIds !== undefined ? normalizeIdList(partial.foreshadowIds) : all[idx].foreshadowIds ?? [],
    issueIds: partial.issueIds !== undefined ? normalizeIdList(partial.issueIds) : all[idx].issueIds ?? [],
    storylineIds:
      partial.storylineIds !== undefined ? normalizeIdList(partial.storylineIds) : all[idx].storylineIds ?? [],
    parentId: partial.parentId !== undefined ? String(partial.parentId ?? '').trim() || null : all[idx].parentId ?? null,
    location: partial.location != null ? String(partial.location).trim() : String(all[idx].location ?? '').trim(),
    timeLabel: partial.timeLabel != null ? String(partial.timeLabel).trim() : String(all[idx].timeLabel ?? '').trim(),
    povCharacterId: partial.povCharacterId !== undefined ? String(partial.povCharacterId ?? '').trim() || null : all[idx].povCharacterId ?? null,
    tension: partial.tension !== undefined ? normalizeOutlineTension(partial.tension) : normalizeOutlineTension(all[idx].tension),
    goal: partial.goal != null ? String(partial.goal).trim() : String(all[idx].goal ?? '').trim(),
    conflict: partial.conflict != null ? String(partial.conflict).trim() : String(all[idx].conflict ?? '').trim(),
    twist: partial.twist != null ? String(partial.twist).trim() : String(all[idx].twist ?? '').trim(),
    result: partial.result != null ? String(partial.result).trim() : String(all[idx].result ?? '').trim(),
    suspense: partial.suspense != null ? String(partial.suspense).trim() : String(all[idx].suspense ?? '').trim(),
    emotionalTurn:
      partial.emotionalTurn != null ? String(partial.emotionalTurn).trim() : String(all[idx].emotionalTurn ?? '').trim(),
    proseHint: partial.proseHint != null ? String(partial.proseHint).trim() : String(all[idx].proseHint ?? '').trim(),
    level: partial.level ?? all[idx].level ?? 'scene',
    plotStage: partial.plotStage ?? all[idx].plotStage ?? 'idea',
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllOutlineItems(all)
  return updated
}

/** 删除情节点并重排 order；同时从各章节的 outlineItemIds 中移除 */
export function deleteOutlineItem(outlineId: string): boolean {
  const all = getAllOutlineItems()
  const target = all.find((i) => i.id === outlineId)
  if (!target) return false
  const novelId = target.novelId
  const filtered = all.filter((i) => i.id !== outlineId)
  const novelItems = filtered
    .filter((i) => i.novelId === novelId)
    .sort((a, b) => a.order - b.order)
  novelItems.forEach((item, i) => {
    const j = filtered.findIndex((x) => x.id === item.id)
    if (j >= 0) {
      filtered[j] = { ...filtered[j], order: i + 1, updatedAt: nowIso() }
    }
  })
  saveAllOutlineItems(filtered)

  const chapters = getAllChapters()
  const nextChapters = chapters.map((c) => {
    const ids = c.outlineItemIds ?? []
    if (!ids.includes(outlineId)) return c
    return {
      ...c,
      outlineItemIds: ids.filter((id) => id !== outlineId),
      updatedAt: nowIso(),
    }
  })
  saveAllChapters(nextChapters)
  return true
}

/** 与同作品内相邻情节点交换 order */
export function moveOutlineItem(outlineId: string, direction: 'up' | 'down'): boolean {
  const all = getAllOutlineItems()
  const target = all.find((i) => i.id === outlineId)
  if (!target) return false
  const novelItems = all
    .filter((i) => i.novelId === target.novelId)
    .sort((a, b) => a.order - b.order)
  const pos = novelItems.findIndex((i) => i.id === outlineId)
  if (pos < 0) return false
  const newPos = direction === 'up' ? pos - 1 : pos + 1
  if (newPos < 0 || newPos >= novelItems.length) return false
  const a = novelItems[pos]
  const b = novelItems[newPos]
  const ia = all.findIndex((x) => x.id === a.id)
  const ib = all.findIndex((x) => x.id === b.id)
  if (ia < 0 || ib < 0) return false
  const orderA = a.order
  const orderB = b.order
  all[ia] = { ...a, order: orderB, updatedAt: nowIso() }
  all[ib] = { ...b, order: orderA, updatedAt: nowIso() }
  saveAllOutlineItems(all)
  return true
}

function getAllCharacterFactionMemberships(): CharacterFactionMembership[] {
  const raw = readScopedStorageItem(CHARACTER_FACTION_MEMBERSHIPS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as CharacterFactionMembership[]
  } catch {
    return []
  }
}

function saveAllCharacterFactionMemberships(items: CharacterFactionMembership[]): void {
  writeScopedStorageItem(CHARACTER_FACTION_MEMBERSHIPS_KEY, JSON.stringify(items))
  emitStorageChange()
}

export function getCharacterFactionMembershipsByNovelId(novelId: string): CharacterFactionMembership[] {
  return getAllCharacterFactionMemberships()
    .filter((m) => m.novelId === novelId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function deleteCharacterFactionMembership(membershipId: string): boolean {
  const all = getAllCharacterFactionMemberships()
  const next = all.filter((m) => m.id !== membershipId)
  if (next.length === all.length) return false
  saveAllCharacterFactionMemberships(next)
  return true
}

export function createCharacterFactionMembership(input: {
  novelId: string
  characterId: string
  factionId: string
  description?: string
}): CharacterFactionMembership {
  const all = getAllCharacterFactionMemberships()
  const fid = input.factionId.trim()
  const cid = input.characterId.trim()
  if (!fid || !cid) {
    throw new Error('characterFactionMembership: 需要有效的 characterId 与 factionId')
  }
  if (all.some((m) => m.characterId === cid && m.factionId === fid)) {
    throw new Error('characterFactionMembership: 该角色已加入此势力')
  }
  const now = nowIso()
  const item: CharacterFactionMembership = {
    id: uid(),
    novelId: input.novelId,
    characterId: cid,
    factionId: fid,
    description: (input.description ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllCharacterFactionMemberships(all)
  return item
}

export function updateCharacterFactionMembership(
  partial: Pick<CharacterFactionMembership, 'id'> & Partial<Pick<CharacterFactionMembership, 'description'>>,
): CharacterFactionMembership | null {
  const all = getAllCharacterFactionMemberships()
  const idx = all.findIndex((m) => m.id === partial.id)
  if (idx < 0) return null
  const updated: CharacterFactionMembership = {
    ...all[idx],
    ...partial,
    description:
      partial.description !== undefined ? partial.description.trim() : all[idx].description,
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllCharacterFactionMemberships(all)
  return updated
}

/** 替换某角色在本书内与所有势力的关联（用于工作台档案编辑） */
export function replaceMembershipsForCharacter(
  novelId: string,
  characterId: string,
  rows: Array<{ factionId: string; description: string }>,
): void {
  const all = getAllCharacterFactionMemberships()
  const rest = all.filter((m) => !(m.novelId === novelId && m.characterId === characterId))
  const now = nowIso()
  const seen = new Set<string>()
  for (const row of rows) {
    const fid = row.factionId?.trim()
    if (!fid || seen.has(fid)) continue
    seen.add(fid)
    rest.push({
      id: uid(),
      novelId,
      characterId,
      factionId: fid,
      description: (row.description ?? '').trim(),
      createdAt: now,
      updatedAt: now,
    })
  }
  saveAllCharacterFactionMemberships(rest)
}

/** 替换某势力在本书内与所有角色的关联（用于势力侧编辑成员） */
export function replaceMembershipsForFaction(
  novelId: string,
  factionId: string,
  rows: Array<{ characterId: string; description: string }>,
): void {
  const all = getAllCharacterFactionMemberships()
  const rest = all.filter((m) => !(m.novelId === novelId && m.factionId === factionId))
  const now = nowIso()
  const seen = new Set<string>()
  for (const row of rows) {
    const cid = row.characterId?.trim()
    if (!cid || seen.has(cid)) continue
    seen.add(cid)
    rest.push({
      id: uid(),
      novelId,
      characterId: cid,
      factionId,
      description: (row.description ?? '').trim(),
      createdAt: now,
      updatedAt: now,
    })
  }
  saveAllCharacterFactionMemberships(rest)
}

function getAllCharacters(): Character[] {
  const raw = readScopedStorageItem(CHARACTERS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    let mems = getAllCharacterFactionMemberships()
    let memChanged = false
    let charChanged = false
    const nextChars: Character[] = []
    for (const item of parsed) {
      const c = item as Character & { factionId?: string | null }
      const fid = typeof c.factionId === 'string' ? c.factionId.trim() : ''
      if (fid && c.id && c.novelId) {
        const exists = mems.some((m) => m.characterId === c.id && m.factionId === fid)
        if (!exists) {
          const now = nowIso()
          mems.push({
            id: uid(),
            novelId: c.novelId,
            characterId: c.id,
            factionId: fid,
            description: '',
            createdAt: now,
            updatedAt: now,
          })
          memChanged = true
        }
        const { factionId: _drop, ...rest } = c as Character & { factionId?: string | null }
        nextChars.push(rest as Character)
        charChanged = true
      } else {
        if ('factionId' in c) {
          const { factionId: _drop, ...rest } = c as Character & { factionId?: string | null }
          nextChars.push(rest as Character)
          charChanged = true
        } else {
          nextChars.push(c as Character)
        }
      }
    }
    if (memChanged) saveAllCharacterFactionMemberships(mems)
    const base = charChanged ? nextChars : (parsed as Character[])
    const finalized = base.map((c) => ({ ...c, aliases: normalizeCharacterAliases(c.aliases) }))
    const needAliasPersist = base.some((c) => !Array.isArray((c as Character).aliases))
    if (charChanged || needAliasPersist) saveAllCharacters(finalized)
    return finalized
  } catch {
    return []
  }
}

function saveAllCharacters(items: Character[]): void {
  writeScopedStorageItem(CHARACTERS_KEY, JSON.stringify(items))
  emitStorageChange()
}

export type EntityMembershipSnapshot = {
  id?: string
  novelId: string
  characterId: string
  factionId: string
  description: string
}

export type CharacterStateSnapshot = {
  name: string
  firstAppearanceChapterNo?: number | null
  age: string
  gender: string
  goal: string
  secret: string
  arc: string
  notes: string
  attributes: CharacterAttribute[]
  aliases: string[]
  categoryIds: string[]
  memberships: EntityMembershipSnapshot[]
}

export type FactionStateSnapshot = {
  name: string
  leader: string
  notes: string
  attributes: CharacterAttribute[]
  categoryIds: string[]
  memberships: EntityMembershipSnapshot[]
}

function normalizeMembershipSnapshot(raw: unknown): EntityMembershipSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const novelId = String(row.novelId ?? '').trim()
  const characterId = String(row.characterId ?? '').trim()
  const factionId = String(row.factionId ?? '').trim()
  if (!novelId || !characterId || !factionId) return null
  return {
    id: String(row.id ?? '').trim() || undefined,
    novelId,
    characterId,
    factionId,
    description: String(row.description ?? '').trim(),
  }
}

function normalizeAttributeSnapshot(raw: unknown): CharacterAttribute[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((a) => a as Record<string, unknown>)
    .map((a) => ({
      id: String(a.id ?? '').trim() || uid(),
      key: String(a.key ?? '').trim(),
      value: String(a.value ?? '').trim(),
    }))
    .filter((a) => a.key && a.value)
}

function normalizeCharacterStateSnapshot(raw: unknown): CharacterStateSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  return {
    name: String(row.name ?? '').trim(),
    firstAppearanceChapterNo:
      typeof row.firstAppearanceChapterNo === 'number' && row.firstAppearanceChapterNo > 0
        ? Math.floor(row.firstAppearanceChapterNo)
        : null,
    age: String(row.age ?? ''),
    gender: String(row.gender ?? ''),
    goal: String(row.goal ?? ''),
    secret: String(row.secret ?? ''),
    arc: String(row.arc ?? ''),
    notes: String(row.notes ?? ''),
    attributes: normalizeAttributeSnapshot(row.attributes),
    aliases: normalizeCharacterAliases(Array.isArray(row.aliases) ? row.aliases.map((x) => String(x ?? '')) : []),
    categoryIds: normalizeCategoryIds(Array.isArray(row.categoryIds) ? row.categoryIds.map((x) => String(x ?? '')) : []),
    memberships: Array.isArray(row.memberships)
      ? row.memberships.map(normalizeMembershipSnapshot).filter((m): m is EntityMembershipSnapshot => !!m)
      : [],
  }
}

function normalizeFactionStateSnapshot(raw: unknown): FactionStateSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  return {
    name: String(row.name ?? '').trim(),
    leader: String(row.leader ?? ''),
    notes: String(row.notes ?? ''),
    attributes: normalizeAttributeSnapshot(row.attributes),
    categoryIds: normalizeCategoryIds(Array.isArray(row.categoryIds) ? row.categoryIds.map((x) => String(x ?? '')) : []),
    memberships: Array.isArray(row.memberships)
      ? row.memberships.map(normalizeMembershipSnapshot).filter((m): m is EntityMembershipSnapshot => !!m)
      : [],
  }
}

export function buildCharacterStateSnapshot(
  character: Character,
  memberships: Array<Pick<CharacterFactionMembership, 'id' | 'novelId' | 'characterId' | 'factionId' | 'description'>> = getAllCharacterFactionMemberships().filter((m) => m.characterId === character.id),
): CharacterStateSnapshot {
  return {
    name: String(character.name ?? '').trim(),
    firstAppearanceChapterNo:
      typeof character.firstAppearanceChapterNo === 'number' && character.firstAppearanceChapterNo > 0
        ? Math.floor(character.firstAppearanceChapterNo)
        : null,
    age: String(character.age ?? ''),
    gender: String(character.gender ?? ''),
    goal: String(character.goal ?? ''),
    secret: String(character.secret ?? ''),
    arc: String(character.arc ?? ''),
    notes: String(character.notes ?? ''),
    attributes: normalizeAttributeSnapshot(character.attributes),
    aliases: normalizeCharacterAliases(character.aliases),
    categoryIds: normalizeCategoryIds(character.categoryIds),
    memberships: memberships
      .filter((m) => m.characterId === character.id)
      .map((m) => ({
        id: String(m.id ?? '').trim() || undefined,
        novelId: String(m.novelId ?? character.novelId).trim(),
        characterId: String(m.characterId ?? character.id).trim(),
        factionId: String(m.factionId ?? '').trim(),
        description: String(m.description ?? '').trim(),
      }))
      .filter((m) => m.novelId && m.characterId && m.factionId),
  }
}

export function buildFactionStateSnapshot(
  faction: Faction,
  memberships: Array<Pick<CharacterFactionMembership, 'id' | 'novelId' | 'characterId' | 'factionId' | 'description'>> = getAllCharacterFactionMemberships().filter((m) => m.factionId === faction.id),
): FactionStateSnapshot {
  return {
    name: String(faction.name ?? '').trim(),
    leader: String(faction.leader ?? ''),
    notes: String(faction.notes ?? ''),
    attributes: normalizeAttributeSnapshot(faction.attributes),
    categoryIds: normalizeCategoryIds(faction.categoryIds),
    memberships: memberships
      .filter((m) => m.factionId === faction.id)
      .map((m) => ({
        id: String(m.id ?? '').trim() || undefined,
        novelId: String(m.novelId ?? faction.novelId).trim(),
        characterId: String(m.characterId ?? '').trim(),
        factionId: String(m.factionId ?? faction.id).trim(),
        description: String(m.description ?? '').trim(),
      }))
      .filter((m) => m.novelId && m.characterId && m.factionId),
  }
}

function applyCharacterSnapshot(character: Character, snapshot: CharacterStateSnapshot): Character {
  return {
    ...character,
    name: snapshot.name || character.name,
    firstAppearanceChapterNo: snapshot.firstAppearanceChapterNo ?? null,
    age: snapshot.age,
    gender: snapshot.gender,
    goal: snapshot.goal,
    secret: snapshot.secret,
    arc: snapshot.arc,
    notes: snapshot.notes,
    attributes: snapshot.attributes.map((a) => ({ ...a })),
    aliases: normalizeCharacterAliases(snapshot.aliases),
    categoryIds: normalizeCategoryIds(snapshot.categoryIds),
  }
}

function applyFactionSnapshot(faction: Faction, snapshot: FactionStateSnapshot): Faction {
  return {
    ...faction,
    name: snapshot.name || faction.name,
    leader: snapshot.leader,
    notes: snapshot.notes,
    attributes: snapshot.attributes.map((a) => ({ ...a })),
    categoryIds: normalizeCategoryIds(snapshot.categoryIds),
  }
}

function normalizeCharacterChangeEvent(raw: unknown): CharacterChangeEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  const fields = Array.isArray(e.fields) ? e.fields.map((f) => String(f ?? '').trim()).filter(Boolean) : []
  if (fields.length === 0) return null
  return {
    fields,
    updatedAt: String(e.updatedAt ?? ''),
    chapterId: String(e.chapterId ?? '').trim(),
    anchorStart:
      typeof e.anchorStart === 'number' ? Math.max(0, Math.floor(e.anchorStart)) : undefined,
    anchorEnd: typeof e.anchorEnd === 'number' ? Math.max(0, Math.floor(e.anchorEnd)) : undefined,
    fieldValues:
      e.fieldValues && typeof e.fieldValues === 'object'
        ? Object.fromEntries(
            Object.entries(e.fieldValues as Record<string, unknown>).map(([k, v]) => [
              String(k ?? '').trim(),
              String(v ?? ''),
            ]),
          )
        : {},
    details: Array.isArray(e.details)
      ? e.details
          .map((d) => d as Record<string, unknown>)
          .map((d) => ({
            field: String(d.field ?? '').trim(),
            location: String(d.location ?? '').trim(),
            before: String(d.before ?? ''),
            after: String(d.after ?? ''),
          }))
          .filter((d) => d.field && d.location)
      : [],
    beforeSnapshot: normalizeCharacterStateSnapshot(e.beforeSnapshot),
    afterSnapshot: normalizeCharacterStateSnapshot(e.afterSnapshot),
  }
}

function normalizeFactionChangeEvent(raw: unknown): FactionChangeEvent | null {
  const ev = normalizeCharacterChangeEvent(raw)
  if (!ev || !raw || typeof raw !== 'object') return ev as FactionChangeEvent | null
  const e = raw as Record<string, unknown>
  return {
    ...ev,
    beforeSnapshot: normalizeFactionStateSnapshot(e.beforeSnapshot),
    afterSnapshot: normalizeFactionStateSnapshot(e.afterSnapshot),
  }
}
export type CharacterChangeDetail = {
  field: string
  location: string
  before: string
  after: string
}

export type EntityStateSnapshot = CharacterStateSnapshot | FactionStateSnapshot

export type CharacterChangeEvent = {
  fields: string[]
  updatedAt: string
  chapterId?: string
  anchorStart?: number
  anchorEnd?: number
  details?: CharacterChangeDetail[]
  fieldValues?: Record<string, string>
  beforeSnapshot?: EntityStateSnapshot | null
  afterSnapshot?: EntityStateSnapshot | null
}

type CharacterChangeHistoryRow = {
  events: CharacterChangeEvent[]
}

function readCharacterLastChangedMap(): Record<string, CharacterChangeHistoryRow> {
  const raw = readScopedStorageItem(CHARACTER_LAST_CHANGED_FIELDS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, CharacterChangeHistoryRow> = {}
    for (const [id, row] of Object.entries(parsed)) {
      if (!id || !row || typeof row !== 'object') continue
      const anyRow = row as { events?: unknown }
      if (Array.isArray(anyRow.events)) {
        const events = anyRow.events
          .map(normalizeCharacterChangeEvent)
          .filter((e): e is CharacterChangeEvent => !!e)
        if (events.length > 0) out[id] = { events }
        continue
      }
      const event = normalizeCharacterChangeEvent(row)
      if (event) out[id] = { events: [event] }
    }
    return out
  } catch {
    return {}
  }
}

function saveCharacterLastChangedMap(map: Record<string, CharacterChangeHistoryRow>): void {
  writeScopedStorageItem(CHARACTER_LAST_CHANGED_FIELDS_KEY, JSON.stringify(map))
  emitStorageChange()
}

function appendCharacterLastChangedFields(
  characterId: string,
  payload: {
    fields: string[]
    chapterId?: string
    anchorStart?: number
    anchorEnd?: number
    details?: CharacterChangeDetail[]
    fieldValues?: Record<string, string>
    beforeSnapshot?: CharacterStateSnapshot | null
    afterSnapshot?: CharacterStateSnapshot | null
  },
): void {
  const id = String(characterId ?? '').trim()
  if (!id || payload.fields.length === 0) return
  const uniq = Array.from(new Set(payload.fields.map((f) => String(f ?? '').trim()).filter(Boolean)))
  if (uniq.length === 0) return
  const details = (payload.details ?? [])
    .map((d) => ({
      field: String(d.field ?? '').trim(),
      location: String(d.location ?? '').trim(),
      before: String(d.before ?? ''),
      after: String(d.after ?? ''),
    }))
    .filter((d) => d.field && d.location)
  const map = readCharacterLastChangedMap()
  const current = map[id]?.events ?? []
  const nextEvents = [
    ...current,
    {
      fields: uniq,
      updatedAt: nowIso(),
      chapterId: String(payload.chapterId ?? '').trim(),
      anchorStart:
        typeof payload.anchorStart === 'number' ? Math.max(0, Math.floor(payload.anchorStart)) : undefined,
      anchorEnd: typeof payload.anchorEnd === 'number' ? Math.max(0, Math.floor(payload.anchorEnd)) : undefined,
      details,
      fieldValues: payload.fieldValues ?? {},
      beforeSnapshot: payload.beforeSnapshot ?? null,
      afterSnapshot: payload.afterSnapshot ?? null,
    },
  ]
  // 控制历史长度，避免无限增长
  map[id] = { events: nextEvents.slice(-50) }
  saveCharacterLastChangedMap(map)
}

function removeCharacterLastChangedFields(characterId: string): void {
  const id = String(characterId ?? '').trim()
  if (!id) return
  const map = readCharacterLastChangedMap()
  if (!(id in map)) return
  delete map[id]
  saveCharacterLastChangedMap(map)
}

export function getCharacterLastChangedFields(characterId: string): string[] {
  const id = String(characterId ?? '').trim()
  if (!id) return []
  const row = readCharacterLastChangedMap()[id]
  if (!row || !Array.isArray(row.events) || row.events.length === 0) return []
  const latest = row.events[row.events.length - 1]
  return Array.from(new Set((latest.fields ?? []).map((f) => String(f ?? '').trim()).filter(Boolean)))
}

/** 每次保存一条修改记录；tooltip 读取该角色最近一条记录 */
export function recordCharacterChangeFields(
  characterId: string,
  fields: string[],
  options?: {
    chapterId?: string
    anchorStart?: number
    anchorEnd?: number
    details?: CharacterChangeDetail[]
    fieldValues?: Record<string, string>
    beforeSnapshot?: CharacterStateSnapshot | null
    afterSnapshot?: CharacterStateSnapshot | null
  },
): void {
  const id = String(characterId ?? '').trim()
  if (!id) return
  const uniq = Array.from(new Set(fields.map((f) => String(f ?? '').trim()).filter(Boolean)))
  if (uniq.length === 0) return
  appendCharacterLastChangedFields(id, {
    fields: uniq,
    chapterId: options?.chapterId,
    anchorStart: options?.anchorStart,
    anchorEnd: options?.anchorEnd,
    details: options?.details,
    fieldValues: options?.fieldValues,
    beforeSnapshot: options?.beforeSnapshot,
    afterSnapshot: options?.afterSnapshot,
  })
}

/** 兼容旧调用：记录带上下文的角色修改 */
export function recordCharacterChangeWithContext(
  characterId: string,
  fields: string[],
  chapterId: string | null,
  fieldValues?: Record<string, string>,
): void {
  recordCharacterChangeFields(characterId, fields, {
    chapterId: chapterId ?? '',
    fieldValues: fieldValues ?? {},
  })
}

export function getCharacterChangeHistory(characterId: string): CharacterChangeEvent[] {
  const id = String(characterId ?? '').trim()
  if (!id) return []
  const row = readCharacterLastChangedMap()[id]
  return Array.isArray(row?.events) ? row.events : []
}

/** 是否存在「在本章节记录过」的档案修改（用于写作区关系图等强调当前章有改动的角色） */
export function hasCharacterChangeInChapter(characterId: string, chapterId: string): boolean {
  const cid = String(characterId ?? '').trim()
  const chId = String(chapterId ?? '').trim()
  if (!cid || !chId) return false
  return getCharacterChangeHistory(cid).some((e) => String(e.chapterId ?? '').trim() === chId)
}

function resolveHistoryEventForChapter(
  history: CharacterChangeEvent[],
  chapterId: string,
  chapters: Chapter[],
): CharacterChangeEvent | null {
  if (!chapterId || history.length === 0 || chapters.length === 0) return null
  const chapterNoMap = new Map<string, number>()
  for (const ch of chapters) chapterNoMap.set(ch.id, ch.chapterNo)
  const currentNo = chapterNoMap.get(chapterId)
  if (currentNo == null) return null
  const events = history
    .filter((e) => String(e.chapterId ?? '').trim())
    .map((e) => ({ ...e, chapterId: String(e.chapterId ?? '').trim() }))
    .filter((e) => !!e.chapterId)
    .sort((a, b) => {
      const noA = chapterNoMap.get(a.chapterId!) ?? Number.MAX_SAFE_INTEGER
      const noB = chapterNoMap.get(b.chapterId!) ?? Number.MAX_SAFE_INTEGER
      if (noA !== noB) return noA - noB
      return a.updatedAt.localeCompare(b.updatedAt)
    })
  if (events.length === 0) return history[history.length - 1] ?? null
  let picked: CharacterChangeEvent | null = null
  for (const ev of events) {
    const evNo = chapterNoMap.get(ev.chapterId!) ?? Number.MAX_SAFE_INTEGER
    if (evNo <= currentNo) picked = ev
    else break
  }
  return picked
}

export function getCharacterChangeEventForChapter(
  characterId: string,
  chapterId: string,
  chapters: Chapter[],
): CharacterChangeEvent | null {
  const history = getCharacterChangeHistory(characterId)
  if (history.length === 0) return null
  return resolveHistoryEventForChapter(history, String(chapterId ?? '').trim(), chapters)
}

export function getCharacterChangedFieldsForChapter(
  characterId: string,
  chapterId: string,
  chapters: Chapter[],
): string[] {
  const event = getCharacterChangeEventForChapter(characterId, chapterId, chapters)
  if (!event) return []
  return Array.from(new Set((event.fields ?? []).map((f) => String(f ?? '').trim()).filter(Boolean)))
}

function chapterOrderMap(chapters: Chapter[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const ch of chapters) {
    const id = String(ch.id ?? '').trim()
    if (!id) continue
    map.set(id, typeof ch.chapterNo === 'number' ? ch.chapterNo : Number.MAX_SAFE_INTEGER)
  }
  return map
}

function compareEventAnchorPosition(
  a: { chapterId?: string; anchorStart?: number; updatedAt?: string },
  b: { chapterId?: string; anchorStart?: number; updatedAt?: string },
  order: Map<string, number>,
): number {
  const aId = String(a.chapterId ?? '').trim()
  const bId = String(b.chapterId ?? '').trim()
  const noA = order.get(aId) ?? Number.MAX_SAFE_INTEGER
  const noB = order.get(bId) ?? Number.MAX_SAFE_INTEGER
  if (noA !== noB) return noA - noB
  const startA = typeof a.anchorStart === 'number' ? Math.max(0, Math.floor(a.anchorStart)) : Number.MAX_SAFE_INTEGER
  const startB = typeof b.anchorStart === 'number' ? Math.max(0, Math.floor(b.anchorStart)) : Number.MAX_SAFE_INTEGER
  if (startA !== startB) return startA - startB
  return String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? ''))
}

function compareTargetToEvent(
  targetChapterId: string,
  targetPosition: number,
  ev: { chapterId?: string; anchorStart?: number },
  order: Map<string, number>,
): number {
  const evChapterId = String(ev.chapterId ?? '').trim()
  const targetNo = order.get(targetChapterId) ?? Number.MAX_SAFE_INTEGER
  const evNo = order.get(evChapterId) ?? Number.MAX_SAFE_INTEGER
  if (targetNo !== evNo) return targetNo - evNo
  const evStart = typeof ev.anchorStart === 'number' ? Math.max(0, Math.floor(ev.anchorStart)) : Number.MAX_SAFE_INTEGER
  return Math.max(0, Math.floor(targetPosition)) - evStart
}

function anchoredEventsForTimeline<T extends CharacterChangeEvent>(
  events: T[],
  chapters: Chapter[],
): T[] {
  const order = chapterOrderMap(chapters)
  return events
    .filter((e) => String(e.chapterId ?? '').trim())
    .filter((e) => typeof e.anchorStart === 'number')
    .filter((e) => order.has(String(e.chapterId ?? '').trim()))
    .sort((a, b) => compareEventAnchorPosition(a, b, order))
}

export type ResolvedCharacterState = {
  character: Character
  snapshot: CharacterStateSnapshot
  memberships: EntityMembershipSnapshot[]
  event: CharacterChangeEvent | null
}

export type ResolvedFactionState = {
  faction: Faction
  snapshot: FactionStateSnapshot
  memberships: EntityMembershipSnapshot[]
  event: FactionChangeEvent | null
}

export function getCharacterStateAtPosition(
  characterId: string,
  chapterId: string,
  position: number,
  chapters: Chapter[],
): ResolvedCharacterState | null {
  const id = String(characterId ?? '').trim()
  const chId = String(chapterId ?? '').trim()
  if (!id || !chId) return null
  const base = getAllCharacters().find((c) => c.id === id) ?? null
  if (!base) return null
  const currentSnapshot = buildCharacterStateSnapshot(base)
  const events = anchoredEventsForTimeline(getCharacterChangeHistory(id), chapters)
  const order = chapterOrderMap(chapters)
  const eligible = events.filter((e) => compareTargetToEvent(chId, position, e, order) >= 0)
  const picked = eligible[eligible.length - 1] ?? null
  const first = events[0] ?? null
  const rawSnapshot = picked?.afterSnapshot ?? (first && compareTargetToEvent(chId, position, first, order) < 0 ? first.beforeSnapshot : null)
  const snapshot = normalizeCharacterStateSnapshot(rawSnapshot) ?? currentSnapshot
  return {
    character: applyCharacterSnapshot(base, snapshot),
    snapshot,
    memberships: snapshot.memberships.map((m) => ({ ...m })),
    event: picked,
  }
}

export function getFactionStateAtPosition(
  factionId: string,
  chapterId: string,
  position: number,
  chapters: Chapter[],
): ResolvedFactionState | null {
  const id = String(factionId ?? '').trim()
  const chId = String(chapterId ?? '').trim()
  if (!id || !chId) return null
  const base = getAllFactions().find((f) => f.id === id) ?? null
  if (!base) return null
  const currentSnapshot = buildFactionStateSnapshot(base)
  const events = anchoredEventsForTimeline(getFactionChangeHistory(id), chapters)
  const order = chapterOrderMap(chapters)
  const eligible = events.filter((e) => compareTargetToEvent(chId, position, e, order) >= 0)
  const picked = eligible[eligible.length - 1] ?? null
  const first = events[0] ?? null
  const rawSnapshot = picked?.afterSnapshot ?? (first && compareTargetToEvent(chId, position, first, order) < 0 ? first.beforeSnapshot : null)
  const snapshot = normalizeFactionStateSnapshot(rawSnapshot) ?? currentSnapshot
  return {
    faction: applyFactionSnapshot(base, snapshot),
    snapshot,
    memberships: snapshot.memberships.map((m) => ({ ...m })),
    event: picked,
  }
}

function addKnownLabel(out: Map<string, Set<string>>, id: string, label: unknown): void {
  const entityId = String(id ?? '').trim()
  const text = String(label ?? '').trim()
  if (!entityId || !text) return
  if (!out.has(entityId)) out.set(entityId, new Set<string>())
  out.get(entityId)!.add(text)
}

export function getCharacterKnownLabelsByNovelId(novelId: string): Map<string, string[]> {
  const id = String(novelId ?? '').trim()
  const out = new Map<string, Set<string>>()
  if (!id) return new Map()
  for (const c of getAllCharacters().filter((x) => x.novelId === id)) {
    addKnownLabel(out, c.id, c.name)
    for (const alias of normalizeCharacterAliases(c.aliases)) addKnownLabel(out, c.id, alias)
    for (const ev of getCharacterChangeHistory(c.id)) {
      for (const snapshot of [ev.beforeSnapshot, ev.afterSnapshot]) {
        const s = normalizeCharacterStateSnapshot(snapshot)
        if (!s) continue
        addKnownLabel(out, c.id, s.name)
        for (const alias of normalizeCharacterAliases(s.aliases)) addKnownLabel(out, c.id, alias)
      }
    }
  }
  return new Map(Array.from(out.entries()).map(([entityId, labels]) => [entityId, Array.from(labels)]))
}

export function getFactionKnownLabelsByNovelId(novelId: string): Map<string, string[]> {
  const id = String(novelId ?? '').trim()
  const out = new Map<string, Set<string>>()
  if (!id) return new Map()
  for (const f of getAllFactions().filter((x) => x.novelId === id)) {
    addKnownLabel(out, f.id, f.name)
    for (const ev of getFactionChangeHistory(f.id)) {
      for (const snapshot of [ev.beforeSnapshot, ev.afterSnapshot]) {
        const s = normalizeFactionStateSnapshot(snapshot)
        if (s) addKnownLabel(out, f.id, s.name)
      }
    }
  }
  return new Map(Array.from(out.entries()).map(([entityId, labels]) => [entityId, Array.from(labels)]))
}

export function getCharacterChangeEventForPosition(
  characterId: string,
  chapterId: string,
  position: number,
): CharacterChangeEvent | null {
  const id = String(characterId ?? '').trim()
  const chId = String(chapterId ?? '').trim()
  if (!id || !chId) return null
  const pos = Math.max(0, Math.floor(position))
  const history = getCharacterChangeHistory(id)
  if (history.length === 0) return null
  const sameChapter = history
    .filter((e) => String(e.chapterId ?? '').trim() === chId)
    .filter((e) => typeof e.anchorStart === 'number')
    .sort((a, b) => {
      const sa = Math.max(0, Math.floor(a.anchorStart ?? 0))
      const sb = Math.max(0, Math.floor(b.anchorStart ?? 0))
      if (sa !== sb) return sa - sb
      return a.updatedAt.localeCompare(b.updatedAt)
    })
  if (sameChapter.length === 0) return null

  // 仅在“改动锚点覆盖到当前位置”时才算命中
  const hits = sameChapter.filter((e) => {
    const s = Math.max(0, Math.floor(e.anchorStart ?? 0))
    const endRaw = typeof e.anchorEnd === 'number' ? Math.max(0, Math.floor(e.anchorEnd)) : s + 1
    const ed = Math.max(s + 1, endRaw)
    return pos >= s && pos < ed
  })
  if (hits.length === 0) return null
  // 同一位置多次保存时，返回“最新一次”更新（即第 n 次更新）
  return hits[hits.length - 1] ?? null
}

export function getCharacterChangedFieldsForPosition(
  characterId: string,
  chapterId: string,
  position: number,
): string[] {
  const ev = getCharacterChangeEventForPosition(characterId, chapterId, position)
  if (!ev) return []
  return Array.from(new Set((ev.fields ?? []).map((f) => String(f ?? '').trim()).filter(Boolean)))
}

/** 与角色侧结构一致，便于复用解析与 UI */
export type FactionChangeEvent = Omit<CharacterChangeEvent, 'beforeSnapshot' | 'afterSnapshot'> & {
  beforeSnapshot?: FactionStateSnapshot | null
  afterSnapshot?: FactionStateSnapshot | null
}

type FactionChangeHistoryRow = {
  events: FactionChangeEvent[]
}

function readFactionLastChangedMap(): Record<string, FactionChangeHistoryRow> {
  const raw = readScopedStorageItem(FACTION_LAST_CHANGED_FIELDS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, FactionChangeHistoryRow> = {}
    for (const [id, row] of Object.entries(parsed)) {
      if (!id || !row || typeof row !== 'object') continue
      const anyRow = row as { events?: unknown }
      if (Array.isArray(anyRow.events)) {
        const events = anyRow.events
          .map(normalizeFactionChangeEvent)
          .filter((e): e is FactionChangeEvent => !!e)
        if (events.length > 0) out[id] = { events }
        continue
      }
      const event = normalizeFactionChangeEvent(row)
      if (event) out[id] = { events: [event] }
    }
    return out
  } catch {
    return {}
  }
}

function saveFactionLastChangedMap(map: Record<string, FactionChangeHistoryRow>): void {
  writeScopedStorageItem(FACTION_LAST_CHANGED_FIELDS_KEY, JSON.stringify(map))
  emitStorageChange()
}

function appendFactionLastChangedFields(
  factionId: string,
  payload: {
    fields: string[]
    chapterId?: string
    anchorStart?: number
    anchorEnd?: number
    details?: CharacterChangeDetail[]
    fieldValues?: Record<string, string>
    beforeSnapshot?: FactionStateSnapshot | null
    afterSnapshot?: FactionStateSnapshot | null
  },
): void {
  const id = String(factionId ?? '').trim()
  if (!id || payload.fields.length === 0) return
  const uniq = Array.from(new Set(payload.fields.map((f) => String(f ?? '').trim()).filter(Boolean)))
  if (uniq.length === 0) return
  const details = (payload.details ?? [])
    .map((d) => ({
      field: String(d.field ?? '').trim(),
      location: String(d.location ?? '').trim(),
      before: String(d.before ?? ''),
      after: String(d.after ?? ''),
    }))
    .filter((d) => d.field && d.location)
  const map = readFactionLastChangedMap()
  const current = map[id]?.events ?? []
  const nextEvents = [
    ...current,
    {
      fields: uniq,
      updatedAt: nowIso(),
      chapterId: String(payload.chapterId ?? '').trim(),
      anchorStart:
        typeof payload.anchorStart === 'number' ? Math.max(0, Math.floor(payload.anchorStart)) : undefined,
      anchorEnd: typeof payload.anchorEnd === 'number' ? Math.max(0, Math.floor(payload.anchorEnd)) : undefined,
      details,
      fieldValues: payload.fieldValues ?? {},
      beforeSnapshot: payload.beforeSnapshot ?? null,
      afterSnapshot: payload.afterSnapshot ?? null,
    },
  ]
  map[id] = { events: nextEvents.slice(-50) }
  saveFactionLastChangedMap(map)
}

export function recordFactionChangeFields(
  factionId: string,
  fields: string[],
  options?: {
    chapterId?: string
    anchorStart?: number
    anchorEnd?: number
    details?: CharacterChangeDetail[]
    fieldValues?: Record<string, string>
    beforeSnapshot?: FactionStateSnapshot | null
    afterSnapshot?: FactionStateSnapshot | null
  },
): void {
  const id = String(factionId ?? '').trim()
  if (!id) return
  const uniq = Array.from(new Set(fields.map((f) => String(f ?? '').trim()).filter(Boolean)))
  if (uniq.length === 0) return
  appendFactionLastChangedFields(id, {
    fields: uniq,
    chapterId: options?.chapterId,
    anchorStart: options?.anchorStart,
    anchorEnd: options?.anchorEnd,
    details: options?.details,
    fieldValues: options?.fieldValues,
    beforeSnapshot: options?.beforeSnapshot,
    afterSnapshot: options?.afterSnapshot,
  })
}

export function getFactionChangeHistory(factionId: string): FactionChangeEvent[] {
  const id = String(factionId ?? '').trim()
  if (!id) return []
  const row = readFactionLastChangedMap()[id]
  return Array.isArray(row?.events) ? row.events : []
}

export function hasFactionChangeInChapter(factionId: string, chapterId: string): boolean {
  const fid = String(factionId ?? '').trim()
  const chId = String(chapterId ?? '').trim()
  if (!fid || !chId) return false
  return getFactionChangeHistory(fid).some((e) => String(e.chapterId ?? '').trim() === chId)
}

export function getFactionChangeEventForPosition(
  factionId: string,
  chapterId: string,
  position: number,
): FactionChangeEvent | null {
  const id = String(factionId ?? '').trim()
  const chId = String(chapterId ?? '').trim()
  if (!id || !chId) return null
  const pos = Math.max(0, Math.floor(position))
  const history = getFactionChangeHistory(id)
  if (history.length === 0) return null
  const sameChapter = history
    .filter((e) => String(e.chapterId ?? '').trim() === chId)
    .filter((e) => typeof e.anchorStart === 'number')
    .sort((a, b) => {
      const sa = Math.max(0, Math.floor(a.anchorStart ?? 0))
      const sb = Math.max(0, Math.floor(b.anchorStart ?? 0))
      if (sa !== sb) return sa - sb
      return a.updatedAt.localeCompare(b.updatedAt)
    })
  if (sameChapter.length === 0) return null

  const hits = sameChapter.filter((e) => {
    const s = Math.max(0, Math.floor(e.anchorStart ?? 0))
    const endRaw = typeof e.anchorEnd === 'number' ? Math.max(0, Math.floor(e.anchorEnd)) : s + 1
    const ed = Math.max(s + 1, endRaw)
    return pos >= s && pos < ed
  })
  if (hits.length === 0) return null
  return hits[hits.length - 1] ?? null
}

export function getFactionChangedFieldsForPosition(
  factionId: string,
  chapterId: string,
  position: number,
): string[] {
  const ev = getFactionChangeEventForPosition(factionId, chapterId, position)
  if (!ev) return []
  return Array.from(new Set((ev.fields ?? []).map((f) => String(f ?? '').trim()).filter(Boolean)))
}

/** 本章正文内「带锚点」的角色/势力档案修改位置，供滚动条旁指示（与 Cursor 类似） */
export type ChapterEditRailMarker = {
  start: number
  kinds: Array<'character' | 'faction'>
}

export function getEditAnchorMarkersForChapter(
  chapterId: string,
  characters: Character[],
  factions: Faction[],
): ChapterEditRailMarker[] {
  const chId = String(chapterId ?? '').trim()
  if (!chId) return []
  const byStart = new Map<number, Set<'character' | 'faction'>>()

  for (const c of characters) {
    const id = String(c.id ?? '').trim()
    if (!id) continue
    for (const ev of getCharacterChangeHistory(id)) {
      if (String(ev.chapterId ?? '').trim() !== chId) continue
      if (typeof ev.anchorStart !== 'number') continue
      const start = Math.max(0, Math.floor(ev.anchorStart))
      if (!byStart.has(start)) byStart.set(start, new Set())
      byStart.get(start)!.add('character')
    }
  }
  for (const f of factions) {
    const id = String(f.id ?? '').trim()
    if (!id) continue
    for (const ev of getFactionChangeHistory(id)) {
      if (String(ev.chapterId ?? '').trim() !== chId) continue
      if (typeof ev.anchorStart !== 'number') continue
      const start = Math.max(0, Math.floor(ev.anchorStart))
      if (!byStart.has(start)) byStart.set(start, new Set())
      byStart.get(start)!.add('faction')
    }
  }

  return Array.from(byStart.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([start, kinds]) => ({
      start,
      kinds: Array.from(kinds).sort(),
    }))
}

function removeFactionLastChangedFields(factionId: string): void {
  const id = String(factionId ?? '').trim()
  if (!id) return
  const map = readFactionLastChangedMap()
  if (!(id in map)) return
  delete map[id]
  saveFactionLastChangedMap(map)
}

export function getCharactersByNovelId(novelId: string): Character[] {
  return getAllCharacters()
    .filter((c) => c.novelId === novelId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

function getAllCharacterRelations(): CharacterRelation[] {
  const raw = readScopedStorageItem(CHARACTER_RELATIONS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as CharacterRelation[]
  } catch {
    return []
  }
}

function saveAllCharacterRelations(items: CharacterRelation[]): void {
  writeScopedStorageItem(CHARACTER_RELATIONS_KEY, JSON.stringify(items))
}

export function getCharacterRelationsByNovelId(novelId: string): CharacterRelation[] {
  return getAllCharacterRelations()
    .filter((r) => r.novelId === novelId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function createCharacterRelation(input: NewCharacterRelationInput): CharacterRelation {
  const all = getAllCharacterRelations()
  const now = nowIso()
  const item: CharacterRelation = {
    id: uid(),
    novelId: input.novelId,
    fromCharacterId: input.fromCharacterId,
    toCharacterId: input.toCharacterId,
    relationType: input.relationType.trim() || '关系',
    note: input.note?.trim() || '',
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllCharacterRelations(all)
  return item
}

export function deleteCharacterRelation(relationId: string): boolean {
  const all = getAllCharacterRelations()
  const beforeLen = all.length
  const next = all.filter((r) => r.id !== relationId)
  if (next.length === beforeLen) return false
  saveAllCharacterRelations(next)
  return true
}

export function updateCharacterRelation(
  partial: Pick<CharacterRelation, 'id'> & Partial<CharacterRelation>,
): CharacterRelation | null {
  const all = getAllCharacterRelations()
  const idx = all.findIndex((r) => r.id === partial.id)
  if (idx < 0) return null

  const updated: CharacterRelation = {
    ...all[idx],
    ...partial,
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllCharacterRelations(all)
  return updated
}

export function createCharacter(input: NewCharacterInput): Character {
  const all = getAllCharacters()
  const now = nowIso()
  const firstAppearanceChapterNo =
    typeof input.firstAppearanceChapterNo === 'number' && input.firstAppearanceChapterNo > 0
      ? Math.floor(input.firstAppearanceChapterNo)
      : null
  const attrsIn =
    input.attributes?.filter((a) => a.key.trim() && a.value.trim()).map((a) => ({
      id: a.id?.trim() || uid(),
      key: a.key.trim(),
      value: a.value.trim(),
    })) ?? []

  const item: Character = {
    id: uid(),
    novelId: input.novelId,
    name: input.name.trim() || '未命名角色',
    createdInChapterId: input.createdInChapterId?.trim() || null,
    firstAppearanceChapterNo,
    age: String(input.age ?? '').trim(),
    gender: String(input.gender ?? '').trim(),
    goal: String(input.goal ?? '').trim(),
    secret: String(input.secret ?? '').trim(),
    arc: String(input.arc ?? '').trim(),
    notes: String(input.notes ?? '').trim(),
    attributes: attrsIn,
    aliases: normalizeCharacterAliases(input.aliases),
    categoryIds: normalizeCategoryIds(input.categoryIds),
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllCharacters(all)
  syncCharacterFirstAppearanceByNovel(item.novelId)
  return getAllCharacters().find((x) => x.id === item.id) ?? item
}

export function updateCharacter(
  partial: Pick<Character, 'id'> & Partial<Character>
): Character | null {
  const all = getAllCharacters()
  const idx = all.findIndex((c) => c.id === partial.id)
  if (idx < 0) return null
  const merged = { ...all[idx], ...partial }
  const updated: Character = {
    ...merged,
    aliases: normalizeCharacterAliases(merged.aliases),
    categoryIds:
      partial.categoryIds !== undefined
        ? normalizeCategoryIds(partial.categoryIds)
        : normalizeCategoryIds(all[idx].categoryIds),
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllCharacters(all)
  syncCharacterFirstAppearanceByNovel(updated.novelId)
  return getAllCharacters().find((x) => x.id === updated.id) ?? updated
}

/** 删除角色；同时删除与该角色相关的所有关系（CharacterRelation） */
export function deleteCharacter(characterId: string): boolean {
  const allCharacters = getAllCharacters()
  const target = allCharacters.find((c) => c.id === characterId)
  if (!target) return false

  const nextCharacters = allCharacters.filter((c) => c.id !== characterId)
  saveAllCharacters(nextCharacters)

  // 级联删除与该角色相关的关系
  const allRelations = getAllCharacterRelations()
  const nextRelations = allRelations.filter(
    (r) => r.fromCharacterId !== characterId && r.toCharacterId !== characterId
  )
  saveAllCharacterRelations(nextRelations)

  const mems = getAllCharacterFactionMemberships()
  const nextMems = mems.filter((m) => m.characterId !== characterId)
  if (nextMems.length !== mems.length) saveAllCharacterFactionMemberships(nextMems)
  clearItemOwnerReferences('character', characterId)
  removeCharacterLastChangedFields(characterId)

  return true
}

function normalizeFactionRow(raw: Record<string, unknown>): Faction {
  const attrsRaw = raw.attributes
  const attributes = Array.isArray(attrsRaw)
    ? (attrsRaw as { id?: string; key?: string; value?: string }[])
        .filter((a) => a && typeof a.key === 'string' && typeof a.value === 'string')
        .map((a) => ({
          id: typeof a.id === 'string' && a.id ? a.id : uid(),
          key: String(a.key).trim(),
          value: String(a.value).trim(),
        }))
        .filter((a) => a.key && a.value)
    : []
  return {
    id: String(raw.id ?? ''),
    novelId: String(raw.novelId ?? ''),
    name: String(raw.name ?? ''),
    createdInChapterId: String(raw.createdInChapterId ?? '').trim() || null,
    leader: String(raw.leader ?? ''),
    notes: String(raw.notes ?? ''),
    attributes: attributes.length > 0 ? attributes : undefined,
    categoryIds: normalizeCategoryIds(raw.categoryIds as string[] | undefined),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

function getAllFactions(): Faction[] {
  const raw = readScopedStorageItem(FACTIONS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>[]
    if (!Array.isArray(parsed)) return []
    let changed = false
    const next = parsed.map((row) => {
      if (row && typeof row === 'object' && ('goal' in row || 'resource' in row || 'relationToProtagonist' in row)) {
        changed = true
      }
      return normalizeFactionRow(row as Record<string, unknown>)
    })
    if (changed) saveAllFactions(next)
    return next
  } catch {
    return []
  }
}

function saveAllFactions(items: Faction[]): void {
  writeScopedStorageItem(FACTIONS_KEY, JSON.stringify(items))
  emitStorageChange()
}

export function getFactionsByNovelId(novelId: string): Faction[] {
  return getAllFactions()
    .filter((f) => f.novelId === novelId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function createFaction(input: NewFactionInput): Faction {
  const all = getAllFactions()
  const now = nowIso()
  const attrsIn =
    input.attributes?.filter((a) => a.key.trim() && a.value.trim()).map((a) => ({
      id: a.id?.trim() || uid(),
      key: a.key.trim(),
      value: a.value.trim(),
    })) ?? []
  const item: Faction = {
    id: uid(),
    novelId: input.novelId,
    name: input.name.trim() || '未命名势力',
    createdInChapterId: input.createdInChapterId?.trim() || null,
    leader: input.leader.trim(),
    notes: input.notes.trim(),
    attributes: attrsIn.length > 0 ? attrsIn : undefined,
    categoryIds: normalizeCategoryIds(input.categoryIds),
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllFactions(all)
  return item
}

export function updateFaction(partial: Pick<Faction, 'id'> & Partial<Faction>): Faction | null {
  const all = getAllFactions()
  const idx = all.findIndex((f) => f.id === partial.id)
  if (idx < 0) return null
  const updated: Faction = {
    ...all[idx],
    ...partial,
    categoryIds:
      partial.categoryIds !== undefined
        ? normalizeCategoryIds(partial.categoryIds)
        : normalizeCategoryIds(all[idx].categoryIds),
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllFactions(all)
  return updated
}

export function deleteFaction(factionId: string): boolean {
  const all = getAllFactions()
  const beforeLen = all.length
  const next = all.filter((f) => f.id !== factionId)
  if (next.length === beforeLen) return false
  saveAllFactions(next)
  removeFactionLastChangedFields(factionId)
  const mems = getAllCharacterFactionMemberships()
  const nextMems = mems.filter((m) => m.factionId !== factionId)
  if (nextMems.length !== mems.length) saveAllCharacterFactionMemberships(nextMems)
  clearItemOwnerReferences('faction', factionId)
  return true
}

function normalizeItemAttributes(raw: unknown): CharacterAttribute[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((a) => a as { id?: string; key?: string; value?: string })
    .map((a) => ({
      id: String(a.id ?? '').trim() || uid(),
      key: String(a.key ?? '').trim(),
      value: String(a.value ?? '').trim(),
    }))
    .filter((a) => a.key && a.value)
}

function normalizeItemFirstAppearance(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

function normalizeItemOwnerType(value: unknown): ItemOwnerType | null {
  const type = String(value ?? '').trim()
  return type === 'character' || type === 'faction' ? type : null
}

function findLegacyItemOwner(novelId: string, owner: string): { ownerType: ItemOwnerType | null; ownerId: string | null } {
  const name = owner.trim()
  if (!name) return { ownerType: null, ownerId: null }
  const character = getAllCharacters().find((c) => c.novelId === novelId && c.name.trim() === name)
  if (character) return { ownerType: 'character', ownerId: character.id }
  const faction = getAllFactions().find((f) => f.novelId === novelId && f.name.trim() === name)
  if (faction) return { ownerType: 'faction', ownerId: faction.id }
  return { ownerType: null, ownerId: null }
}

function normalizeItemOwner(
  raw: Record<string, unknown>,
  novelId: string,
): { ownerType: ItemOwnerType | null; ownerId: string | null } {
  const ownerType = normalizeItemOwnerType(raw.ownerType)
  const ownerId = String(raw.ownerId ?? '').trim()
  if (ownerType === 'character' && ownerId) {
    const exists = getAllCharacters().some((c) => c.novelId === novelId && c.id === ownerId)
    if (exists) return { ownerType, ownerId }
  }
  if (ownerType === 'faction' && ownerId) {
    const exists = getAllFactions().some((f) => f.novelId === novelId && f.id === ownerId)
    if (exists) return { ownerType, ownerId }
  }
  return findLegacyItemOwner(novelId, String(raw.owner ?? '').trim())
}

function normalizeItemRow(raw: Record<string, unknown>): Item {
  const attributes = normalizeItemAttributes(raw.attributes)
  const novelId = String(raw.novelId ?? '').trim()
  const owner = normalizeItemOwner(raw, novelId)
  return {
    id: String(raw.id ?? '').trim(),
    novelId,
    name: String(raw.name ?? '').trim() || '未命名物品',
    summary: String(raw.summary ?? '').trim(),
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    firstAppearanceChapterNo: normalizeItemFirstAppearance(raw.firstAppearanceChapterNo),
    attributes: attributes.length > 0 ? attributes : undefined,
    createdAt: String(raw.createdAt ?? '') || nowIso(),
    updatedAt: String(raw.updatedAt ?? '') || nowIso(),
  }
}

function getAllItems(): Item[] {
  const raw = readScopedStorageItem(ITEMS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    const rows = parsed.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    const next = rows.map((row) => normalizeItemRow(row))
      .filter((item) => item.id && item.novelId)
    const changed = rows.length !== next.length || rows.some((row, i) => {
      const item = next[i]
      if (!item) return true
      return (
        'owner' in row ||
        normalizeItemOwnerType(row.ownerType) !== item.ownerType ||
        String(row.ownerId ?? '').trim() !== (item.ownerId ?? '') ||
        normalizeItemFirstAppearance(row.firstAppearanceChapterNo) !== item.firstAppearanceChapterNo
      )
    })
    if (changed) saveAllItems(next)
    return next
  } catch {
    return []
  }
}

function saveAllItems(items: Item[]): void {
  writeScopedStorageItem(ITEMS_KEY, JSON.stringify(items))
  emitStorageChange()
}

function syncItemFirstAppearanceByNovel(novelId: string): void {
  const id = String(novelId ?? '').trim()
  if (!id) return
  const chapters = getAllChapters()
    .filter((c) => c.novelId === id)
    .sort((a, b) => a.chapterNo - b.chapterNo)
  const allItems = getAllItems()
  let changed = false
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i]
    if (item.novelId !== id) continue
    const name = (item.name ?? '').trim()
    let firstNo: number | null = null
    if (name) {
      for (const ch of chapters) {
        if ((ch.content ?? '').includes(name)) {
          firstNo = ch.chapterNo
          break
        }
      }
    }
    const prevNo = normalizeItemFirstAppearance(item.firstAppearanceChapterNo)
    if (prevNo === firstNo) continue
    allItems[i] = {
      ...item,
      firstAppearanceChapterNo: firstNo,
      updatedAt: nowIso(),
    }
    changed = true
  }
  if (changed) saveAllItems(allItems)
}

function clearItemOwnerReferences(ownerType: ItemOwnerType, ownerId: string): void {
  const id = String(ownerId ?? '').trim()
  if (!id) return
  const all = getAllItems()
  let changed = false
  const next = all.map((item) => {
    if (item.ownerType !== ownerType || item.ownerId !== id) return item
    changed = true
    return { ...item, ownerType: null, ownerId: null, updatedAt: nowIso() }
  })
  if (changed) saveAllItems(next)
}

export function getItemsByNovelId(novelId: string): Item[] {
  return getAllItems()
    .filter((item) => item.novelId === novelId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function getItemsByOwner(novelId: string, ownerType: ItemOwnerType, ownerId: string): Item[] {
  const id = String(ownerId ?? '').trim()
  if (!id) return []
  return getItemsByNovelId(novelId).filter((item) => item.ownerType === ownerType && item.ownerId === id)
}

export function replaceItemOwnersForEntity(
  novelId: string,
  ownerType: ItemOwnerType,
  ownerId: string,
  itemIds: string[],
): void {
  const nId = String(novelId ?? '').trim()
  const oId = String(ownerId ?? '').trim()
  if (!nId || !oId) return
  const selected = new Set(normalizeIdList(itemIds))
  const all = getAllItems()
  let changed = false
  const now = nowIso()
  const next = all.map((item) => {
    if (item.novelId !== nId) return item
    if (selected.has(item.id)) {
      if (item.ownerType === ownerType && item.ownerId === oId) return item
      changed = true
      return { ...item, ownerType, ownerId: oId, updatedAt: now }
    }
    if (item.ownerType === ownerType && item.ownerId === oId) {
      changed = true
      return { ...item, ownerType: null, ownerId: null, updatedAt: now }
    }
    return item
  })
  if (changed) saveAllItems(next)
}

export function createItem(input: NewItemInput): Item {
  const all = getAllItems()
  const now = nowIso()
  const attributes = normalizeItemAttributes(input.attributes)
  const owner = normalizeItemOwner(
    { ownerType: input.ownerType ?? null, ownerId: input.ownerId ?? null },
    input.novelId,
  )
  const item: Item = {
    id: uid(),
    novelId: input.novelId,
    name: input.name.trim() || '未命名物品',
    summary: input.summary.trim(),
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    firstAppearanceChapterNo: null,
    attributes: attributes.length > 0 ? attributes : undefined,
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllItems(all)
  syncItemFirstAppearanceByNovel(item.novelId)
  return getAllItems().find((x) => x.id === item.id) ?? item
}

export function updateItem(partial: Pick<Item, 'id'> & Partial<Item>): Item | null {
  const all = getAllItems()
  const idx = all.findIndex((item) => item.id === partial.id)
  if (idx < 0) return null
  const merged = { ...all[idx], ...partial }
  const attributes = partial.attributes !== undefined ? normalizeItemAttributes(partial.attributes) : normalizeItemAttributes(all[idx].attributes)
  const owner = normalizeItemOwner(
    { ownerType: merged.ownerType ?? null, ownerId: merged.ownerId ?? null },
    merged.novelId,
  )
  const updated: Item = {
    ...merged,
    name: String(merged.name ?? '').trim() || all[idx].name || '未命名物品',
    summary: String(merged.summary ?? '').trim(),
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    firstAppearanceChapterNo: normalizeItemFirstAppearance(all[idx].firstAppearanceChapterNo),
    attributes: attributes.length > 0 ? attributes : undefined,
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllItems(all)
  syncItemFirstAppearanceByNovel(updated.novelId)
  return getAllItems().find((x) => x.id === updated.id) ?? updated
}

export function deleteItem(itemId: string): boolean {
  const all = getAllItems()
  const next = all.filter((item) => item.id !== itemId)
  if (next.length === all.length) return false
  saveAllItems(next)
  return true
}

function getAllTimelineEvents(): TimelineEvent[] {
  const raw = readScopedStorageItem(TIMELINE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Array<TimelineEvent & { chapterNo?: number | null }>
    if (!Array.isArray(parsed)) return []
    let changed = false
    const next = parsed.map((e) => {
      const oldNo =
        typeof e.chapterNo === 'number' && e.chapterNo > 0 ? Math.floor(e.chapterNo) : null
      const start =
        typeof e.chapterNoStart === 'number' && e.chapterNoStart > 0
          ? Math.floor(e.chapterNoStart)
          : oldNo
      const end =
        typeof e.chapterNoEnd === 'number' && e.chapterNoEnd > 0
          ? Math.floor(e.chapterNoEnd)
          : null
      if (e.chapterNo !== undefined || e.chapterNoStart !== start || e.chapterNoEnd !== end) {
        changed = true
      }
      return {
        ...e,
        chapterNoStart: start,
        chapterNoEnd: end,
        chapterNo: undefined,
      } as TimelineEvent
    })
    if (changed) saveAllTimelineEvents(next)
    return next
  } catch {
    return []
  }
}

function saveAllTimelineEvents(items: TimelineEvent[]): void {
  writeScopedStorageItem(TIMELINE_KEY, JSON.stringify(items))
}

export function getTimelineByNovelId(novelId: string): TimelineEvent[] {
  return getAllTimelineEvents()
    .filter((e) => e.novelId === novelId)
    .sort((a, b) => a.order - b.order)
}

export function createTimelineEvent(input: NewTimelineEventInput): TimelineEvent {
  const all = getAllTimelineEvents()
  const novelEv = all.filter((e) => e.novelId === input.novelId)
  const maxOrder = novelEv.reduce((max, e) => Math.max(max, e.order), 0)
  const now = nowIso()
  const rawStart =
    typeof input.chapterNoStart === 'number' && input.chapterNoStart > 0
      ? Math.floor(input.chapterNoStart)
      : typeof input.chapterNo === 'number' && input.chapterNo > 0
        ? Math.floor(input.chapterNo)
        : null
  const rawEnd =
    typeof input.chapterNoEnd === 'number' && input.chapterNoEnd > 0
      ? Math.floor(input.chapterNoEnd)
      : null
  const chapterNoStart = rawStart != null && rawEnd != null ? Math.min(rawStart, rawEnd) : rawStart
  const chapterNoEnd = rawStart != null && rawEnd != null ? Math.max(rawStart, rawEnd) : rawEnd
  const outlineItemId = input.outlineItemId?.trim() ? input.outlineItemId.trim() : null
  const item: TimelineEvent = {
    id: uid(),
    novelId: input.novelId,
    order: maxOrder + 1,
    storyLabel: input.storyLabel.trim(),
    title: input.title.trim() || `事件 ${maxOrder + 1}`,
    summary: input.summary.trim(),
    chapterNoStart,
    chapterNoEnd,
    outlineItemId,
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllTimelineEvents(all)
  return item
}

export function updateTimelineEvent(
  partial: Pick<TimelineEvent, 'id'> & Partial<TimelineEvent>
): TimelineEvent | null {
  const all = getAllTimelineEvents()
  const idx = all.findIndex((e) => e.id === partial.id)
  if (idx < 0) return null
  const merged = { ...all[idx], ...partial }
  if (merged.chapterNoStart != null && merged.chapterNoEnd != null && merged.chapterNoStart > merged.chapterNoEnd) {
    const s = merged.chapterNoStart
    merged.chapterNoStart = merged.chapterNoEnd
    merged.chapterNoEnd = s
  }
  const updated: TimelineEvent = {
    ...merged,
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllTimelineEvents(all)
  return updated
}

export function deleteTimelineEvent(eventId: string): boolean {
  const all = getAllTimelineEvents()
  const target = all.find((e) => e.id === eventId)
  if (!target) return false
  const novelId = target.novelId
  const filtered = all.filter((e) => e.id !== eventId)
  const novelItems = filtered
    .filter((e) => e.novelId === novelId)
    .sort((a, b) => a.order - b.order)
  novelItems.forEach((ev, i) => {
    const j = filtered.findIndex((x) => x.id === ev.id)
    if (j >= 0) {
      filtered[j] = { ...filtered[j], order: i + 1, updatedAt: nowIso() }
    }
  })
  saveAllTimelineEvents(filtered)
  return true
}

export function moveTimelineEvent(eventId: string, direction: 'up' | 'down'): boolean {
  const all = getAllTimelineEvents()
  const target = all.find((e) => e.id === eventId)
  if (!target) return false
  const novelItems = all
    .filter((e) => e.novelId === target.novelId)
    .sort((a, b) => a.order - b.order)
  const pos = novelItems.findIndex((e) => e.id === eventId)
  if (pos < 0) return false
  const newPos = direction === 'up' ? pos - 1 : pos + 1
  if (newPos < 0 || newPos >= novelItems.length) return false
  const a = novelItems[pos]
  const b = novelItems[newPos]
  const ia = all.findIndex((x) => x.id === a.id)
  const ib = all.findIndex((x) => x.id === b.id)
  if (ia < 0 || ib < 0) return false
  const orderA = a.order
  const orderB = b.order
  all[ia] = { ...a, order: orderB, updatedAt: nowIso() }
  all[ib] = { ...b, order: orderA, updatedAt: nowIso() }
  saveAllTimelineEvents(all)
  return true
}


// ─── Foreshadow Plants ──────────────────────────────────────────────────────

function getAllForeshadows(): ForeshadowPlant[] {
  const raw = readScopedStorageItem(FORESHADOWS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed as ForeshadowPlant[]
  } catch {
    return []
  }
}

function saveAllForeshadows(items: ForeshadowPlant[]): void {
  writeScopedStorageItem(FORESHADOWS_KEY, JSON.stringify(items))
}

export function getForeshadowsByNovelId(novelId: string): ForeshadowPlant[] {
  return getAllForeshadows()
    .filter((f) => f.novelId === novelId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function createForeshadowPlant(input: NewForeshadowPlantInput): ForeshadowPlant {
  const all = getAllForeshadows()
  const now = nowIso()
  const plant: ForeshadowPlant = {
    id: uid(),
    novelId: input.novelId,
    title: input.title.trim() || input.plantText.slice(0, 20) || '未命名伏笔',
    plantText: input.plantText,
    plantChapterId: input.plantChapterId,
    plantChapterNo: input.plantChapterNo,
    plantChapterTitle: input.plantChapterTitle,
    plantStart: typeof input.plantStart === 'number' ? Math.max(0, Math.floor(input.plantStart)) : undefined,
    plantEnd: typeof input.plantEnd === 'number' ? Math.max(0, Math.floor(input.plantEnd)) : undefined,
    description: input.description.trim(),
    expectedFulfillChapterNo:
      typeof input.expectedFulfillChapterNo === 'number' && input.expectedFulfillChapterNo > 0
        ? Math.floor(input.expectedFulfillChapterNo)
        : null,
    expectedFulfillNotes: input.expectedFulfillNotes?.trim() ?? '',
    status: 'open',
    fulfillments: [],
    createdAt: now,
    updatedAt: now,
  }
  all.push(plant)
  saveAllForeshadows(all)
  return plant
}

export function addForeshadowFulfillment(
  plantId: string,
  input: NewForeshadowFulfillmentInput,
): ForeshadowPlant | null {
  const all = getAllForeshadows()
  const idx = all.findIndex((f) => f.id === plantId)
  if (idx < 0) return null
  const fulfillment: ForeshadowFulfillment = {
    id: uid(),
    fulfillText: input.fulfillText,
    fulfillChapterId: input.fulfillChapterId,
    fulfillChapterNo: input.fulfillChapterNo,
    fulfillChapterTitle: input.fulfillChapterTitle,
    fulfillStart:
      typeof input.fulfillStart === 'number' ? Math.max(0, Math.floor(input.fulfillStart)) : undefined,
    fulfillEnd: typeof input.fulfillEnd === 'number' ? Math.max(0, Math.floor(input.fulfillEnd)) : undefined,
    notes: input.notes.trim(),
    createdAt: nowIso(),
  }
  const updated: ForeshadowPlant = {
    ...all[idx],
    fulfillments: [...(all[idx].fulfillments ?? []), fulfillment],
    status: 'fulfilled',
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllForeshadows(all)
  return updated
}

export function removeForeshadowFulfillment(
  plantId: string,
  fulfillmentId: string,
): ForeshadowPlant | null {
  const all = getAllForeshadows()
  const idx = all.findIndex((f) => f.id === plantId)
  if (idx < 0) return null
  const fulfillments = (all[idx].fulfillments ?? []).filter((f) => f.id !== fulfillmentId)
  const updated: ForeshadowPlant = {
    ...all[idx],
    fulfillments,
    status: fulfillments.length === 0 ? 'open' : 'fulfilled',
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllForeshadows(all)
  return updated
}

export function updateForeshadowFulfillment(
  plantId: string,
  fulfillmentId: string,
  partial: Partial<Pick<ForeshadowFulfillment, 'fulfillText' | 'notes'>>,
): ForeshadowPlant | null {
  const all = getAllForeshadows()
  const idx = all.findIndex((f) => f.id === plantId)
  if (idx < 0) return null
  const list = [...(all[idx].fulfillments ?? [])]
  const ffIdx = list.findIndex((f) => f.id === fulfillmentId)
  if (ffIdx < 0) return null
  list[ffIdx] = {
    ...list[ffIdx],
    fulfillText:
      partial.fulfillText !== undefined ? String(partial.fulfillText ?? '').trim() : list[ffIdx].fulfillText,
    notes: partial.notes !== undefined ? String(partial.notes ?? '').trim() : list[ffIdx].notes,
  }
  const updated: ForeshadowPlant = {
    ...all[idx],
    fulfillments: list,
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllForeshadows(all)
  return updated
}

export function updateForeshadowPlant(
  partial: Pick<ForeshadowPlant, 'id'> & Partial<ForeshadowPlant>,
): ForeshadowPlant | null {
  const all = getAllForeshadows()
  const idx = all.findIndex((f) => f.id === partial.id)
  if (idx < 0) return null
  const updated: ForeshadowPlant = { ...all[idx], ...partial, updatedAt: nowIso() }
  all[idx] = updated
  saveAllForeshadows(all)
  return updated
}

export function deleteForeshadowPlant(plantId: string): boolean {
  const all = getAllForeshadows()
  const next = all.filter((f) => f.id !== plantId)
  if (next.length === all.length) return false
  saveAllForeshadows(next)
  return true
}
