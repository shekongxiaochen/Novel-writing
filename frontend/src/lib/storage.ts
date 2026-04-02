import type {
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
  Faction,
  Novel,
  OutlineItem,
  StoryIssue,
} from '../types'

const NOVELS_KEY = 'novel-writing.novels'
const CHAPTERS_KEY = 'novel-writing.chapters'
const OUTLINE_KEY = 'novel-writing.outline'
const CHARACTERS_KEY = 'novel-writing.characters'
const CHARACTER_RELATIONS_KEY = 'novel-writing.character-relations'
const FACTIONS_KEY = 'novel-writing.factions'
const ISSUES_KEY = 'novel-writing.issues'

function nowIso(): string {
  return new Date().toISOString()
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
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

function getAllCharacters(): Character[] {
  const raw = localStorage.getItem(CHARACTERS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Character[]
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
  const factionId = input.factionId?.trim() ? input.factionId.trim() : null
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
    factionId,
    age: input.age.trim(),
    gender: input.gender.trim(),
    goal: input.goal.trim(),
    secret: input.secret.trim(),
    arc: input.arc.trim(),
    notes: input.notes.trim(),
    attributes: attrsIn,
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

  return true
}

function getAllFactions(): Faction[] {
  const raw = localStorage.getItem(FACTIONS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Faction[]
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
  const item: Faction = {
    id: uid(),
    novelId: input.novelId,
    name: input.name.trim() || '未命名势力',
    leader: input.leader.trim(),
    goal: input.goal.trim(),
    resource: input.resource.trim(),
    relationToProtagonist: input.relationToProtagonist.trim(),
    notes: input.notes.trim(),
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

