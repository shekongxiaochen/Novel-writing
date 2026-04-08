import type {
  Category,
  Character,
  Chapter,
  NewCharacterInput,
  NewChapterInput,
  CharacterRelation,
  NewCharacterRelationInput,
  NewFactionInput,
  NewNovelInput,
  NewOutlineInput,
  NewStoryIssueInput,
  NewTimelineEventInput,
  CharacterFactionMembership,
  Faction,
  Novel,
  OutlineItem,
  StoryIssue,
  TimelineEvent,
} from '../types'

const NOVELS_KEY = 'novel-writing.novels'
const CHAPTERS_KEY = 'novel-writing.chapters'
const OUTLINE_KEY = 'novel-writing.outline'
const CHARACTERS_KEY = 'novel-writing.characters'
const CHARACTER_RELATIONS_KEY = 'novel-writing.character-relations'
const FACTIONS_KEY = 'novel-writing.factions'
const CHARACTER_FACTION_MEMBERSHIPS_KEY = 'novel-writing.character-faction-memberships'
const CATEGORIES_KEY = 'novel-writing.categories'
const ISSUES_KEY = 'novel-writing.issues'
const TIMELINE_KEY = 'novel-writing.timeline-events'

function nowIso(): string {
  return new Date().toISOString()
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function normalizeCategoryIds(ids?: string[] | null): string[] {
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

function getAllCategories(): Category[] {
  const raw = localStorage.getItem(CATEGORIES_KEY)
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
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(items))
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

export function getNovels(): Novel[] {
  const raw = localStorage.getItem(NOVELS_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Novel[]
    return parsed.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  } catch {
    return []
  }
}

export function getNovelById(id: string): Novel | null {
  return getNovels().find((n) => n.id === id) ?? null
}

export function createNovel(input: NewNovelInput): Novel {
  const novels = getNovels()
  const now = nowIso()
  const novel: Novel = {
    id: uid(),
    title: input.title.trim(),
    summary: input.summary.trim(),
    genre: input.genre.trim(),
    perspective: input.perspective.trim(),
    tone: input.tone.trim(),
    isMultiLineNarrative: input.isMultiLineNarrative,
    createdAt: now,
    updatedAt: now,
  }

  novels.unshift(novel)
  localStorage.setItem(NOVELS_KEY, JSON.stringify(novels))
  return novel
}

export function getChaptersByNovelId(novelId: string): Chapter[] {
  const raw = localStorage.getItem(CHAPTERS_KEY)
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
  localStorage.setItem(CHAPTERS_KEY, JSON.stringify(chapters))
}

function getAllChapters(): Chapter[] {
  const raw = localStorage.getItem(CHAPTERS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Chapter[]
  } catch {
    return []
  }
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
    content: '',
    outlineItemIds: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  all.push(chapter)
  saveAllChapters(all)
  return chapter
}

export function updateChapter(partial: Pick<Chapter, 'id'> & Partial<Chapter>): Chapter | null {
  const all = getAllChapters()
  const idx = all.findIndex((c) => c.id === partial.id)
  if (idx < 0) return null

  const updated: Chapter = {
    ...all[idx],
    ...partial,
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllChapters(all)
  return updated
}

/** 删除章节并按顺序重编号（同作品内 1..n） */
export function deleteChapter(chapterId: string): boolean {
  const all = getAllChapters()
  const target = all.find((c) => c.id === chapterId)
  if (!target) return false
  const novelId = target.novelId
  const filtered = all.filter((c) => c.id !== chapterId)
  const novelChapters = filtered
    .filter((c) => c.novelId === novelId)
    .sort((a, b) => a.chapterNo - b.chapterNo)
  novelChapters.forEach((c, i) => {
    const j = filtered.findIndex((x) => x.id === c.id)
    if (j >= 0) {
      filtered[j] = { ...filtered[j], chapterNo: i + 1, updatedAt: nowIso() }
    }
  })
  saveAllChapters(filtered)
  return true
}

function getAllOutlineItems(): OutlineItem[] {
  const raw = localStorage.getItem(OUTLINE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as OutlineItem[]
  } catch {
    return []
  }
}

function saveAllOutlineItems(items: OutlineItem[]): void {
  localStorage.setItem(OUTLINE_KEY, JSON.stringify(items))
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
  const raw = localStorage.getItem(CHARACTER_FACTION_MEMBERSHIPS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as CharacterFactionMembership[]
  } catch {
    return []
  }
}

function saveAllCharacterFactionMemberships(items: CharacterFactionMembership[]): void {
  localStorage.setItem(CHARACTER_FACTION_MEMBERSHIPS_KEY, JSON.stringify(items))
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
  const raw = localStorage.getItem(CHARACTERS_KEY)
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
    if (charChanged) saveAllCharacters(nextChars)
    return charChanged ? nextChars : (parsed as Character[])
  } catch {
    return []
  }
}

function saveAllCharacters(items: Character[]): void {
  localStorage.setItem(CHARACTERS_KEY, JSON.stringify(items))
}

export function getCharactersByNovelId(novelId: string): Character[] {
  return getAllCharacters()
    .filter((c) => c.novelId === novelId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

function getAllCharacterRelations(): CharacterRelation[] {
  const raw = localStorage.getItem(CHARACTER_RELATIONS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as CharacterRelation[]
  } catch {
    return []
  }
}

function saveAllCharacterRelations(items: CharacterRelation[]): void {
  localStorage.setItem(CHARACTER_RELATIONS_KEY, JSON.stringify(items))
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
    firstAppearanceChapterNo,
    age: input.age.trim(),
    gender: input.gender.trim(),
    goal: input.goal.trim(),
    secret: input.secret.trim(),
    arc: input.arc.trim(),
    notes: input.notes.trim(),
    attributes: attrsIn,
    categoryIds: normalizeCategoryIds(input.categoryIds),
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllCharacters(all)
  return item
}

export function updateCharacter(
  partial: Pick<Character, 'id'> & Partial<Character>
): Character | null {
  const all = getAllCharacters()
  const idx = all.findIndex((c) => c.id === partial.id)
  if (idx < 0) return null
  const updated: Character = {
    ...all[idx],
    ...partial,
    categoryIds:
      partial.categoryIds !== undefined
        ? normalizeCategoryIds(partial.categoryIds)
        : normalizeCategoryIds(all[idx].categoryIds),
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllCharacters(all)
  return updated
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
    leader: String(raw.leader ?? ''),
    notes: String(raw.notes ?? ''),
    attributes: attributes.length > 0 ? attributes : undefined,
    categoryIds: normalizeCategoryIds(raw.categoryIds as string[] | undefined),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

function getAllFactions(): Faction[] {
  const raw = localStorage.getItem(FACTIONS_KEY)
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
  localStorage.setItem(FACTIONS_KEY, JSON.stringify(items))
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
  const mems = getAllCharacterFactionMemberships()
  const nextMems = mems.filter((m) => m.factionId !== factionId)
  if (nextMems.length !== mems.length) saveAllCharacterFactionMemberships(nextMems)
  return true
}

function getAllIssues(): StoryIssue[] {
  const raw = localStorage.getItem(ISSUES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as StoryIssue[]
  } catch {
    return []
  }
}

function saveAllIssues(items: StoryIssue[]): void {
  localStorage.setItem(ISSUES_KEY, JSON.stringify(items))
}

export function getIssuesByNovelId(novelId: string): StoryIssue[] {
  return getAllIssues()
    .filter((i) => i.novelId === novelId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function createIssue(input: NewStoryIssueInput): StoryIssue {
  const all = getAllIssues()
  const now = nowIso()
  const item: StoryIssue = {
    id: uid(),
    novelId: input.novelId,
    title: input.title.trim() || '未命名问题',
    type: input.type,
    status: 'open',
    plan: input.plan.trim(),
    notes: input.notes.trim(),
    createdAt: now,
    updatedAt: now,
  }
  all.push(item)
  saveAllIssues(all)
  return item
}

export function updateIssue(
  partial: Pick<StoryIssue, 'id'> & Partial<StoryIssue>
): StoryIssue | null {
  const all = getAllIssues()
  const idx = all.findIndex((i) => i.id === partial.id)
  if (idx < 0) return null
  const updated: StoryIssue = {
    ...all[idx],
    ...partial,
    updatedAt: nowIso(),
  }
  all[idx] = updated
  saveAllIssues(all)
  return updated
}

function getAllTimelineEvents(): TimelineEvent[] {
  const raw = localStorage.getItem(TIMELINE_KEY)
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
  localStorage.setItem(TIMELINE_KEY, JSON.stringify(items))
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

