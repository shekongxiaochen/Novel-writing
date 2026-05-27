import type { Chapter, Character, CharacterRelation, Novel, OutlineItem, OutlineStoryline } from '../types'
import type { WorkspaceSnapshotPayload } from './storage'
import { buildOutlineBeatPathForChapter } from './outlineBeatPack'

function s(value: unknown): string {
  return String(value ?? '').trim()
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value)
}

function buildOutlineById(items: OutlineItem[]): Map<string, OutlineItem> {
  return new Map(items.map((row) => [s(row.id), row]))
}

function collectAncestorChain(id: string, byId: Map<string, OutlineItem>): OutlineItem[] {
  const chain: OutlineItem[] = []
  let current = byId.get(id)
  while (current) {
    chain.unshift(current)
    const parentId = s(current.parentId)
    current = parentId ? byId.get(parentId) : undefined
  }
  return chain
}

function collectSubtree(id: string, items: OutlineItem[]): OutlineItem[] {
  const childrenByParent = new Map<string, OutlineItem[]>()
  for (const row of items) {
    const pid = s(row.parentId)
    if (!pid) continue
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
    childrenByParent.get(pid)!.push(row)
  }
  const result: OutlineItem[] = []
  const walk = (nodeId: string) => {
    for (const child of childrenByParent.get(nodeId) ?? []) {
      result.push(child)
      walk(s(child.id))
    }
  }
  walk(id)
  return result
}

function compactOutlineRow(row: OutlineItem) {
  return {
    id: row.id,
    parentId: row.parentId ?? null,
    order: row.order,
    title: row.title,
    level: row.level ?? 'scene',
    status: row.status,
    summary: s(row.summary).slice(0, 160),
    goal: s(row.goal).slice(0, 100),
    conflict: s(row.conflict).slice(0, 80),
    result: s(row.result).slice(0, 80),
    suspense: s(row.suspense).slice(0, 80),
    plotStage: row.plotStage ?? 'idea',
    storylineIds: row.storylineIds ?? [],
    tension: row.tension,
  }
}

export type OutlineAiContextPack = {
  text: string
  anchorPathText: string
  writtenChapterCount: number
}

export function buildOutlineAiContextPack(
  payload: WorkspaceSnapshotPayload,
  novel: Pick<Novel, 'title' | 'summary' | 'continuityBrief' | 'genre' | 'perspective' | 'tone'>,
  options?: {
    anchorOutlineId?: string
    maxOutlineNodes?: number
  },
): OutlineAiContextPack {
  const outline = [...(payload.outline ?? [])].sort((a, b) => a.order - b.order)
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => a.chapterNo - b.chapterNo)
  const characters = payload.characters ?? []
  const storylines = payload.outlineStorylines ?? []
  const foreshadows = payload.foreshadows ?? []
  const anchorId = s(options?.anchorOutlineId)
  const maxNodes = Math.max(20, Math.min(120, options?.maxOutlineNodes ?? 80))

  const byId = buildOutlineById(outline)
  const anchorChain = anchorId ? collectAncestorChain(anchorId, byId) : []
  const anchorSubtree = anchorId ? collectSubtree(anchorId, outline) : []

  const writtenChapters = chapters.filter((c) => s(c.content).length > 80 || c.status === 'done')
  const latestWritten = writtenChapters[writtenChapters.length - 1]

  let beatTail = ''
  if (latestWritten && outline.length > 0) {
    const beat = buildOutlineBeatPathForChapter(
      outline,
      latestWritten.outlineItemIds ?? [],
      characters.map((row) => ({ id: row.id, name: row.name, goal: row.goal, arc: row.arc })),
    )
    beatTail = beat.text ? beat.text.slice(0, 1200) : ''
  }

  const outlineCompact = outline.slice(0, maxNodes).map(compactOutlineRow)
  const characterCompact = buildCharacterBibleCompact(characters, 24)
  const relationsCompact = buildCharacterRelationsCompact(characters, payload.characterRelations ?? [], 28)
  const factionMembershipCompact = buildFactionMembershipCompact(
    characters,
    payload.factions ?? [],
    payload.characterFactionMemberships ?? [],
    16,
  )

  const storylineCompact = storylines.map((row: OutlineStoryline) => ({
    name: row.name,
    type: row.type,
    description: s(row.description).slice(0, 120),
  }))

  const openForeshadows = foreshadows
    .filter((row) => row.status !== 'fulfilled')
    .slice(0, 12)
    .map((row) => ({
      title: row.title,
      plantChapterNo: row.plantChapterNo,
      description: s(row.description).slice(0, 100),
    }))

  const anchorPathText =
    anchorChain.length > 0
      ? anchorChain.map((row) => `【${row.level ?? 'scene'}】${row.title}：${s(row.summary) || s(row.goal)}`).join('\n')
      : ''

  const sections = [
    '【作品】',
    stableStringify({
      title: s(novel.title),
      genre: s(novel.genre),
      perspective: s(novel.perspective),
      tone: s(novel.tone),
      summary: s(novel.summary).slice(0, 400),
      continuityBrief: s(novel.continuityBrief).slice(0, 600),
    }),
    '【写作进度】',
    stableStringify({
      chapterCount: chapters.length,
      writtenChapterCount: writtenChapters.length,
      latestWrittenChapterNo: latestWritten?.chapterNo ?? null,
      latestWrittenTitle: latestWritten?.title ?? '',
    }),
    '【已有大纲】',
    stableStringify(outlineCompact),
    storylineCompact.length > 0 ? '【故事线】' : '',
    storylineCompact.length > 0 ? stableStringify(storylineCompact) : '',
    characterCompact.length > 0 ? '【已有角色档案（大纲与续写必须对齐，禁止写崩人设）】' : '',
    characterCompact.length > 0 ? stableStringify(characterCompact) : '',
    relationsCompact.length > 0 ? '【人物关系（情节转折需体现关系张力）】' : '',
    relationsCompact.length > 0 ? stableStringify(relationsCompact) : '',
    factionMembershipCompact.length > 0 ? '【势力归属】' : '',
    factionMembershipCompact.length > 0 ? stableStringify(factionMembershipCompact) : '',
    openForeshadows.length > 0 ? '【未回收伏笔】' : '',
    openForeshadows.length > 0 ? stableStringify(openForeshadows) : '',
    anchorId ? '【扩展锚点路径】' : '',
    anchorId ? anchorPathText : '',
    anchorSubtree.length > 0 ? '【锚点已有子节点】' : '',
    anchorSubtree.length > 0 ? stableStringify(anchorSubtree.slice(0, 24).map(compactOutlineRow)) : '',
    beatTail ? '【最近一章关联节拍（供衔接）】' : '',
    beatTail ? beatTail : '',
  ].filter(Boolean)

  return {
    text: sections.join('\n'),
    anchorPathText,
    writtenChapterCount: writtenChapters.length,
  }
}

function buildCharacterBibleCompact(characters: Character[], max: number) {
  return characters.slice(0, max).map((row) => {
    const attrs = (row.attributes ?? [])
      .filter((attr) => s(attr.key) && s(attr.value))
      .slice(0, 6)
      .map((attr) => `${s(attr.key)}:${s(attr.value).slice(0, 40)}`)
    return {
      name: s(row.name),
      aliases: (row.aliases ?? []).map((alias) => s(alias)).filter(Boolean).slice(0, 4),
      gender: s(row.gender).slice(0, 12),
      age: s(row.age).slice(0, 12),
      goal: s(row.goal).slice(0, 100),
      secret: s(row.secret).slice(0, 80),
      arc: s(row.arc).slice(0, 100),
      notes: s(row.notes).slice(0, 160),
      traits: attrs.join('；'),
    }
  })
}

function buildCharacterRelationsCompact(
  characters: Character[],
  relations: CharacterRelation[],
  max: number,
) {
  const byId = new Map(characters.map((row) => [s(row.id), row]))
  const rows: Array<{ from: string; to: string; relationType: string; note: string }> = []
  for (const rel of relations) {
    const from = byId.get(s(rel.fromCharacterId))
    const to = byId.get(s(rel.toCharacterId))
    if (!from || !to) continue
    rows.push({
      from: s(from.name),
      to: s(to.name),
      relationType: s(rel.relationType).slice(0, 40),
      note: s(rel.note).slice(0, 100),
    })
    if (rows.length >= max) break
  }
  return rows
}

function buildFactionMembershipCompact(
  characters: Character[],
  factions: Array<{ id: string; name: string }>,
  memberships: Array<{ characterId: string; factionId: string; description: string }>,
  max: number,
) {
  const charById = new Map(characters.map((row) => [s(row.id), row]))
  const factionById = new Map(factions.map((row) => [s(row.id), s(row.name)]))
  return memberships
    .slice(0, max)
    .map((row) => ({
      character: s(charById.get(s(row.characterId))?.name),
      faction: factionById.get(s(row.factionId)) ?? '',
      note: s(row.description).slice(0, 80),
    }))
    .filter((row) => row.character && row.faction)
}
