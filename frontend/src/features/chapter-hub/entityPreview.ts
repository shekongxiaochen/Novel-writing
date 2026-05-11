import type { Chapter, Character, Faction, ForeshadowFulfillment, ForeshadowPlant, Item } from '../../types'
import { characterMatchLabels } from '../../lib/characterLabels'
import {
  getCharacterChangeHistory,
  getCharacterKnownLabelsByNovelId,
  getCharacterStateAtPosition,
  getFactionChangeHistory,
  getFactionKnownLabelsByNovelId,
  getFactionStateAtPosition,
  type CharacterChangeEvent,
} from '../../lib/storage'
import type { EntityToken } from './types'

function inferFulfillRangeInContent(
  content: string,
  f: ForeshadowFulfillment,
): { start: number; end: number } | null {
  const t = f.fulfillText ?? ''
  if (!t) return null
  const idx = content.indexOf(t)
  if (idx < 0) return null
  return { start: idx, end: idx + t.length }
}

/** 字段名 → 中文 label 前缀的映射 */
const FIELD_LABEL_MAP: Record<string, string> = {
  name: '姓名',
  age: '年龄',
  gender: '性别',
  notes: '备注',
  aliases: '别名',
  attributes: '属性',
  memberships: '所属势力',
  items: '绑定物品',
  categoryIds: '分类',
}

const FACTION_FIELD_LABEL_MAP: Record<string, string> = {
  name: '名称',
  leader: '领袖',
  notes: '备注',
  attributes: '扩展条目',
  categoryIds: '分类',
  memberships: '绑定角色',
  items: '绑定物品',
}

/**
 * 根据当前章节 id 和角色修改历史，计算该角色在当前章节所属的修改时间区间。
 *
 * 规则：
 * - 过滤出有 chapterId 的修改事件（按发生章节定位）
 * - 将各事件按其 chapterId 对应章节的 chapterNo 升序排列
 * - 找到当前章节属于第几个区间（第i次修改后、第i+1次修改前）
 * - 区间从第1次修改开始编号，创建到第1次修改之间返回 null（无底色）
 */
function resolveCharacterStateZone(
  characterId: string,
  currentChapterId: string | null | undefined,
  histories: Map<string, CharacterChangeEvent[]>,
  chapters: Chapter[],
): EntityToken['characterStateZone'] {
  if (!currentChapterId) return null
  const events = histories.get(characterId)
  if (!events || events.length === 0) return null

  // 只使用有 chapterId 的修改事件
  const chapterEvents = events.filter((e) => e.chapterId)
  if (chapterEvents.length === 0) return null

  // 建立 chapterId -> chapterNo 的映射
  const chapterNoMap = new Map<string, number>()
  for (const ch of chapters) {
    chapterNoMap.set(ch.id, ch.chapterNo)
  }

  const currentChapterNo = chapterNoMap.get(currentChapterId)
  if (currentChapterNo == null) return null

  // 将事件按 chapterNo 升序排列（同章节按 updatedAt 取最新）
  // 先按 chapterId 去重（同一章节多次修改，取最后一次）
  const latestByChapter = new Map<string, CharacterChangeEvent>()
  for (const ev of chapterEvents) {
    if (!ev.chapterId) continue
    const existing = latestByChapter.get(ev.chapterId)
    if (!existing || ev.updatedAt > existing.updatedAt) {
      latestByChapter.set(ev.chapterId, ev)
    }
  }

  // 按 chapterNo 排序
  const sortedEvents = Array.from(latestByChapter.values()).sort((a, b) => {
    const noA = chapterNoMap.get(a.chapterId!) ?? 0
    const noB = chapterNoMap.get(b.chapterId!) ?? 0
    return noA - noB
  })

  if (sortedEvents.length === 0) return null

  // 找出当前章节所属区间：
  // - 当前章节 < 第1次修改章节：无底色（创建到第1次修改之前）
  // - 当前章节 >= 第i次修改章节 且 < 第i+1次修改章节：属于区间i
  // - 当前章节 >= 最后一次修改章节：属于最后区间
  const firstEventChapterNo = chapterNoMap.get(sortedEvents[0].chapterId!) ?? 0
  if (currentChapterNo < firstEventChapterNo) return null // 创建后尚未修改，无底色

  // 找到当前章节处于哪个区间
  let zoneIndex = 0
  let zoneEvent: CharacterChangeEvent | null = null
  for (let i = sortedEvents.length - 1; i >= 0; i--) {
    const evChapterNo = chapterNoMap.get(sortedEvents[i].chapterId!) ?? 0
    if (currentChapterNo >= evChapterNo) {
      zoneIndex = i + 1 // 1-indexed
      zoneEvent = sortedEvents[i]
      break
    }
  }

  if (!zoneEvent || zoneIndex === 0) return null

  // 从 fieldValues 中提取 label
  const fieldValues = zoneEvent.fieldValues ?? {}
  const fields = zoneEvent.fields ?? []

  // 优先取第一个有值且有中文名的字段
  let label = ''
  let fieldKey = ''
  for (const f of fields) {
    const val = fieldValues[f]
    const labelPrefix = FIELD_LABEL_MAP[f]
    if (val && labelPrefix) {
      label = `${labelPrefix}：${val}`
      fieldKey = f
      break
    }
  }

  // 若 fieldValues 没有存值，只显示字段名
  if (!label && fields.length > 0) {
    const f = fields[0]
    const labelPrefix = FIELD_LABEL_MAP[f] ?? f
    label = `${labelPrefix}已修改`
    fieldKey = f
  }

  if (!label) return null

  return { label, fieldKey, zoneIndex }
}

function resolveFactionStateZone(
  factionId: string,
  currentChapterId: string | null | undefined,
  histories: Map<string, CharacterChangeEvent[]>,
  chapters: Chapter[],
): EntityToken['factionStateZone'] {
  if (!currentChapterId) return null
  const events = histories.get(factionId) ?? getFactionChangeHistory(factionId)
  if (!events || events.length === 0) return null

  const chapterEvents = events.filter((e) => e.chapterId)
  if (chapterEvents.length === 0) return null

  const chapterNoMap = new Map<string, number>()
  for (const ch of chapters) {
    chapterNoMap.set(ch.id, ch.chapterNo)
  }

  const currentChapterNo = chapterNoMap.get(currentChapterId)
  if (currentChapterNo == null) return null

  const latestByChapter = new Map<string, CharacterChangeEvent>()
  for (const ev of chapterEvents) {
    if (!ev.chapterId) continue
    const existing = latestByChapter.get(ev.chapterId)
    if (!existing || ev.updatedAt > existing.updatedAt) {
      latestByChapter.set(ev.chapterId, ev)
    }
  }

  const sortedEvents = Array.from(latestByChapter.values()).sort((a, b) => {
    const noA = chapterNoMap.get(a.chapterId!) ?? 0
    const noB = chapterNoMap.get(b.chapterId!) ?? 0
    return noA - noB
  })

  if (sortedEvents.length === 0) return null

  const firstEventChapterNo = chapterNoMap.get(sortedEvents[0].chapterId!) ?? 0
  if (currentChapterNo < firstEventChapterNo) return null

  let zoneIndex = 0
  let zoneEvent: CharacterChangeEvent | null = null
  for (let i = sortedEvents.length - 1; i >= 0; i--) {
    const evChapterNo = chapterNoMap.get(sortedEvents[i].chapterId!) ?? 0
    if (currentChapterNo >= evChapterNo) {
      zoneIndex = i + 1
      zoneEvent = sortedEvents[i]
      break
    }
  }

  if (!zoneEvent || zoneIndex === 0) return null

  const fieldValues = zoneEvent.fieldValues ?? {}
  const fields = zoneEvent.fields ?? []

  let label = ''
  let fieldKey = ''
  for (const f of fields) {
    const val = fieldValues[f]
    const labelPrefix = FACTION_FIELD_LABEL_MAP[f]
    if (val && labelPrefix) {
      label = `${labelPrefix}：${val}`
      fieldKey = f
      break
    }
  }

  if (!label && fields.length > 0) {
    const f = fields[0]
    const labelPrefix = FACTION_FIELD_LABEL_MAP[f] ?? f
    label = `${labelPrefix}已修改`
    fieldKey = f
  }

  if (!label) return null

  return { label, fieldKey, zoneIndex }
}

function eventAnchorSpan(e: CharacterChangeEvent): { start: number; end: number } | null {
  if (typeof e.anchorStart !== 'number') return null
  const start = Math.max(0, Math.floor(e.anchorStart))
  let end =
    typeof e.anchorEnd === 'number' ? Math.max(start, Math.floor(e.anchorEnd)) : start + 1
  if (end <= start) end = start + 1
  return { start, end }
}

/** 半开区间 [a,b) 与 [c,d) 是否相交 */
function rangesOverlapHalfOpen(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && a1 > b0
}

/**
 * 各角色在本章「带锚点」的档案修改区间，用于给叠加层上落在该处的名字单独上色。
 */
function buildCharacterAnchorSpanIndex(
  characters: Character[],
  chapterId: string,
  histories: Map<string, CharacterChangeEvent[]>,
): Map<string, Array<{ start: number; end: number }>> {
  const cid = String(chapterId).trim()
  const index = new Map<string, Array<{ start: number; end: number }>>()
  if (!cid) return index
  for (const c of characters) {
    const events = histories.get(c.id) ?? getCharacterChangeHistory(c.id)
    const spans: Array<{ start: number; end: number }> = []
    for (const ev of events) {
      if (String(ev.chapterId ?? '').trim() !== cid) continue
      const span = eventAnchorSpan(ev)
      if (span) spans.push(span)
    }
    if (spans.length > 0) index.set(c.id, spans)
  }
  return index
}

function buildFactionAnchorSpanIndex(
  factions: Faction[],
  chapterId: string,
  histories: Map<string, CharacterChangeEvent[]>,
): Map<string, Array<{ start: number; end: number }>> {
  const cid = String(chapterId).trim()
  const index = new Map<string, Array<{ start: number; end: number }>>()
  if (!cid) return index
  for (const f of factions) {
    const events = histories.get(f.id) ?? getFactionChangeHistory(f.id)
    const spans: Array<{ start: number; end: number }> = []
    for (const ev of events) {
      if (String(ev.chapterId ?? '').trim() !== cid) continue
      const span = eventAnchorSpan(ev)
      if (span) spans.push(span)
    }
    if (spans.length > 0) index.set(f.id, spans)
  }
  return index
}

export function buildEntityPreviewLines(
  content: string,
  characters: Character[],
  factions: Faction[],
  items: Item[],
  foreshadows?: ForeshadowPlant[] | null,
  chapterId?: string | null,
  characterHistories?: Map<string, CharacterChangeEvent[]>,
  chapters?: Chapter[],
  factionHistories?: Map<string, CharacterChangeEvent[]>,
): EntityToken[][] {
  const lines = content.split('\n')

  const plantRangesRaw =
    chapterId && foreshadows
      ? foreshadows.flatMap((p) => {
          const start = p.plantStart
          const end = p.plantEnd
          if (p.plantChapterId !== chapterId || typeof start !== 'number' || typeof end !== 'number' || end <= start) {
            return []
          }
          return [
            {
              id: p.id,
              title: p.title,
              status: p.status,
              description: p.description,
              text: p.plantText ?? '',
              start: Math.max(0, Math.floor(start)),
              end: Math.max(0, Math.floor(end)),
              chapterId: p.plantChapterId,
              segment: 'plant' as const,
            },
          ]
        })
      : []

  const fulfillRangesRaw =
    chapterId && foreshadows
      ? foreshadows.flatMap((p) =>
          (p.fulfillments ?? []).flatMap((f) => {
            if (f.fulfillChapterId !== chapterId) return []
            const stored =
              typeof f.fulfillStart === 'number' && typeof f.fulfillEnd === 'number' && f.fulfillEnd > f.fulfillStart
                ? {
                    start: Math.max(0, Math.floor(f.fulfillStart)),
                    end: Math.max(0, Math.floor(f.fulfillEnd)),
                  }
                : inferFulfillRangeInContent(content, f)
            if (!stored || stored.end <= stored.start) return []
            const desc = f.notes?.trim() ? f.notes : p.description
            return [
              {
                id: p.id,
                title: p.title,
                status: p.status,
                description: desc,
                text: f.fulfillText ?? '',
                fulfillmentId: f.id,
                start: stored.start,
                end: stored.end,
                chapterId: f.fulfillChapterId,
                segment: 'fulfill' as const,
              },
            ]
          })
        )
      : []

  const mergedRanges = [...plantRangesRaw, ...fulfillRangesRaw]
    .map((r) => ({
      ...r,
      start: Math.max(0, Math.floor(r.start)),
      end: Math.max(0, Math.floor(r.end)),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const characterKnownLabels = new Map<string, string[]>()
  const factionKnownLabels = new Map<string, string[]>()
  const novelId = characters.find((c) => c.novelId)?.novelId ?? factions.find((f) => f.novelId)?.novelId ?? ''
  if (novelId) {
    for (const [id, labels] of getCharacterKnownLabelsByNovelId(novelId)) characterKnownLabels.set(id, labels)
    for (const [id, labels] of getFactionKnownLabelsByNovelId(novelId)) factionKnownLabels.set(id, labels)
  }

  const charEntities = characters
    .flatMap((c) => {
      const labels = characterKnownLabels.get(c.id) ?? characterMatchLabels(c)
      return labels.map((name) => ({ kind: 'character' as const, name, obj: c }))
    })
    .sort((a, b) => b.name.length - a.name.length)
  const facEntities = [...factions]
    .flatMap((f) => {
      const labels = factionKnownLabels.get(f.id) ?? [f.name]
      return labels.filter(Boolean).map((name) => ({ kind: 'faction' as const, name, obj: f }))
    })
    .sort((a, b) => b.name.length - a.name.length)

  const itemEntities = [...items]
    .map((item) => ({ kind: 'item' as const, name: (item.name ?? '').trim(), obj: item }))
    .filter((item) => item.name)
    .sort((a, b) => b.name.length - a.name.length)

  const entities = [...charEntities, ...facEntities, ...itemEntities].sort((a, b) => b.name.length - a.name.length)

  // 预计算每个角色在当前章节的 characterStateZone（避免 tokenize 时重复计算）
  const characterZoneCache = new Map<string, EntityToken['characterStateZone']>()
  if (characterHistories && chapters && chapterId) {
    for (const c of characters) {
      characterZoneCache.set(
        c.id,
        resolveCharacterStateZone(c.id, chapterId, characterHistories, chapters)
      )
    }
  }

  const anchorSpanIndex =
    characterHistories && chapterId
      ? buildCharacterAnchorSpanIndex(characters, chapterId, characterHistories)
      : new Map<string, Array<{ start: number; end: number }>>()

  const factionZoneCache = new Map<string, EntityToken['factionStateZone']>()
  if (factionHistories && chapters && chapterId) {
    for (const f of factions) {
      factionZoneCache.set(
        f.id,
        resolveFactionStateZone(f.id, chapterId, factionHistories, chapters),
      )
    }
  }

  const factionAnchorSpanIndex =
    factionHistories && chapterId
      ? buildFactionAnchorSpanIndex(factions, chapterId, factionHistories)
      : new Map<string, Array<{ start: number; end: number }>>()

  type FsSpan = {
    start: number
    end: number
    id: string
    title: string
    status: 'open' | 'fulfilled'
    description: string
    text?: string
    segment: 'plant' | 'fulfill'
    fulfillmentId?: string
  }

  function getForeshadowSpanContaining(pos: number): FsSpan | null {
    let fulfillHit: FsSpan | null = null
    let plantHit: FsSpan | null = null
    let plantLen = Infinity
    for (const r of mergedRanges) {
      if (pos < r.start || pos >= r.end) continue
      if (r.segment === 'fulfill') {
        fulfillHit = r as FsSpan
        break
      }
      const len = r.end - r.start
      if (len < plantLen) {
        plantLen = len
        plantHit = r as FsSpan
      }
    }
    return fulfillHit ?? plantHit
  }

  function findEntityAt(line: string, i: number): {
    len: number
    character: Character | null
    faction: Faction | null
    item: Item | null
  } {
    for (const e of entities) {
      if (line.startsWith(e.name, i)) {
        const len = e.name.length
        return {
          len,
          character: e.kind === 'character' ? (e.obj as Character) : null,
          faction: e.kind === 'faction' ? (e.obj as Faction) : null,
          item: e.kind === 'item' ? (e.obj as Item) : null,
        }
      }
    }
    return { len: 0, character: null, faction: null, item: null }
  }

  function resolveCharacterForToken(c: Character | null, pos: number): Character | null {
    if (!c) return null
    if (!chapterId || !chapters) return c
    return getCharacterStateAtPosition(c.id, chapterId, pos, chapters)?.character ?? c
  }

  function resolveFactionForToken(f: Faction | null, pos: number): Faction | null {
    if (!f) return null
    if (!chapterId || !chapters) return f
    return getFactionStateAtPosition(f.id, chapterId, pos, chapters)?.faction ?? f
  }

  function spanToMeta(span: FsSpan): NonNullable<EntityToken['foreshadow']> {
    return {
      id: span.id,
      title: span.title,
      status: span.status,
      description: span.description,
      text: span.text,
      segment: span.segment,
      fulfillmentId: span.fulfillmentId,
    }
  }

  const tokenize = (line: string, lineStartPos: number): EntityToken[] => {
    if (!line) return [{ text: '', character: null, faction: null, item: null, foreshadow: null }]
    const tokens: EntityToken[] = []
    let i = 0
    while (i < line.length) {
      const globalPos = lineStartPos + i
      const ent = findEntityAt(line, i)

      if (ent.len > 0) {
        const endPos = globalPos + ent.len
        const span = getForeshadowSpanContaining(globalPos)
        const foreshadowAttached =
          span && globalPos >= span.start && endPos <= span.end ? spanToMeta(span) : null
        const resolvedCharacter = resolveCharacterForToken(ent.character, globalPos)
        const resolvedFaction = resolveFactionForToken(ent.faction, globalPos)
        const token: EntityToken = {
          text: line.slice(i, i + ent.len),
          range: { start: globalPos, end: endPos },
          character: resolvedCharacter,
          faction: resolvedFaction,
          item: ent.item,
          foreshadow: foreshadowAttached,
        }
        // 为角色 token 附加 characterStateZone
        if (ent.character) {
          token.characterStateZone = characterZoneCache.get(ent.character.id) ?? null
          const spans = anchorSpanIndex.get(ent.character.id)
          if (spans?.length) {
            token.characterAnchorEditSite = spans.some((s) =>
              rangesOverlapHalfOpen(globalPos, endPos, s.start, s.end),
            )
          }
        } else if (ent.faction) {
          token.factionStateZone = factionZoneCache.get(ent.faction.id) ?? null
          const fSpans = factionAnchorSpanIndex.get(ent.faction.id)
          if (fSpans?.length) {
            token.factionAnchorEditSite = fSpans.some((s) =>
              rangesOverlapHalfOpen(globalPos, endPos, s.start, s.end),
            )
          }
        }
        tokens.push(token)
        i += ent.len
        continue
      }

      const span = getForeshadowSpanContaining(globalPos)
      const fsMeta = span ? spanToMeta(span) : null
      tokens.push({
        text: line[i],
        range: { start: globalPos, end: globalPos + 1 },
        character: null,
        faction: null,
        item: null,
        foreshadow: fsMeta,
      })
      i += 1
    }
    return tokens
  }

  let pos = 0
  return lines.map((l) => {
    const out = tokenize(l, pos)
    pos += l.length + 1
    return out
  })
}
