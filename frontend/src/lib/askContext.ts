import type { Chapter } from '../types'
import type { WorkspaceSnapshotPayload } from './storage'
import {
  buildContinueRagHits,
  collectContinueSearchTerms,
  collectForeshadowSearchTerms,
  type ContinueRagSnippet,
} from './continueRag'
import { buildOutlineBeatPathForChapter } from './outlineBeatPack'

export const ASK_INPUT_CHAR_BUDGET = 32000
export const ASK_FOLLOWUP_CHAR_BUDGET = 14000

export const ASK_CONTEXT_LAYER_LABELS: Record<string, string> = {
  instruction: '作者提问',
  selection_quote: '引用片段',
  current_chapter: '当前章正文',
  prev_summaries: '前情提要',
  rag_snippets: '旧章检索',
  bible_compact: '档案摘录',
  factions_compact: '势力',
  items_compact: '物品',
  categories_compact: '分类',
  timeline_compact: '时间线',
  worldview_compact: '世界观设定',
  outline_beat_path: '大纲节拍路径',
  continuity_brief: '全书连续性',
  novel_brief: '作品信息',
  session_note: '会话说明',
  tool_scope: '工具作用域',
}

export type AskPromptBuildResult = {
  prompt: string
  warnings: string[]
  droppedLayers: string[]
  usedLayers: string[]
  usedChars: number
  ragHits: ContinueRagSnippet[]
}

type JsonRecord = Record<string, unknown>

function s(value: unknown): string {
  return String(value ?? '').trim()
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => s(row)).filter(Boolean)
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'zh-CN')
}

function stableSortByKeys<T extends JsonRecord>(rows: T[], keys: string[]): T[] {
  return [...rows].sort((a, b) => {
    for (const key of keys) {
      const diff = compareText(s(a[key]), s(b[key]))
      if (diff !== 0) return diff
    }
    return 0
  })
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value)
}

function estimatePackChars(parts: Record<string, string>): number {
  return Object.values(parts).reduce((sum, value) => sum + value.length, 0)
}

function trimAskPack(parts: Record<string, string>, order: string[], budget: number): { pack: Record<string, string>; dropped: string[] } {
  const pack = { ...parts }
  const dropped: string[] = []
  let total = estimatePackChars(pack)
  for (const key of order) {
    if (total <= budget) break
    if (!pack[key]) continue
    delete pack[key]
    dropped.push(key)
    total = estimatePackChars(pack)
  }
  return { pack, dropped }
}

function sliceTextTail(text: string, limit: number): string {
  const normalized = String(text ?? '')
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return normalized.slice(-limit)
}

function sliceTextExcerpt(text: string, limit: number): string {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}…`
}

function mentionsNameInText(name: string, text: string): boolean {
  const token = s(name)
  if (token.length < 2) return false
  return text.includes(token)
}

function pickChapterScopedCharacters(
  characters: JsonRecord[],
  scanText: string,
  outlineCharacterIds: string[],
  limit: number,
): { rows: JsonRecord[]; chapterScoped: boolean } {
  const outlineSet = new Set(outlineCharacterIds.map((id) => s(id)).filter(Boolean))
  const mentioned = new Map<string, JsonRecord>()
  for (const row of characters) {
    const id = s(row.id)
    if (!id) continue
    const inOutline = outlineSet.has(id)
    const inText =
      mentionsNameInText(s(row.name), scanText) ||
      stringList(row.aliases).some((alias) => mentionsNameInText(alias, scanText))
    if (inOutline || inText) mentioned.set(id, row)
  }
  if (mentioned.size === 0) return { rows: characters.slice(0, limit), chapterScoped: false }
  return { rows: [...mentioned.values()].slice(0, limit), chapterScoped: true }
}

function extractQuestionCharacterTerms(question: string, characters: JsonRecord[]): string[] {
  const terms = new Set<string>()
  const q = s(question)
  if (!q) return []
  for (const row of characters) {
    const name = s(row.name)
    if (name.length >= 2 && q.includes(name)) terms.add(name)
    for (const alias of stringList(row.aliases)) {
      if (alias.length >= 2 && q.includes(alias)) terms.add(alias)
    }
  }
  return [...terms].slice(0, 12)
}

function collectAskRagTerms(input: {
  question: string
  characters: JsonRecord[]
  foreshadows: JsonRecord[]
  scanText: string
  currentChapterId: string
  outlineForeshadowIds: string[]
  outlineLocations: string[]
}): string[] {
  const fromQuestion = extractQuestionCharacterTerms(input.question, input.characters)
  const fromChapter = collectContinueSearchTerms({ characters: input.characters })
  const fromForeshadow = collectForeshadowSearchTerms({
    foreshadows: input.foreshadows,
    scanText: `${input.scanText}\n${input.question}`,
    currentChapterId: input.currentChapterId,
    outlineForeshadowIds: input.outlineForeshadowIds,
  })
  return [...new Set([...fromQuestion, ...fromChapter, ...fromForeshadow, ...input.outlineLocations])].slice(0, 20)
}

const ASK_TRIM_ORDER = [
  'novel_brief',
  'timeline_compact',
  'categories_compact',
  'items_compact',
  'factions_compact',
  'outline_beat_path',
  'continuity_brief',
  'bible_compact',
  'worldview_compact',
  'prev_summaries',
  'rag_snippets',
]

function resolvePrimaryChapter(payload: WorkspaceSnapshotPayload, chapterIds?: string[]): Chapter | null {
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  if (chapters.length === 0) return null
  const ids = new Set((chapterIds ?? []).map((id) => s(id)).filter(Boolean))
  if (ids.size > 0) {
    const hit = chapters.find((row) => ids.has(s(row.id)))
    if (hit) return hit
  }
  return chapters[chapters.length - 1]
}

/** 无章节场景（如新书只填了设定）：跳过所有正文/章节相关层，只构建作品+档案+设定层，让 AI 仍能基于世界观/角色/大纲作答与操作 */
function buildNoChapterAskParts(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: 'current' | 'recent' | 'all'
    question: string
    selectionQuote?: string
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      genre?: string
      perspective?: string
      tone?: string
    }
  },
): AskPromptBuildResult {
  const warnings: string[] = ['本作品还没有章节正文，AI 将基于作品信息、角色/势力/物品/分类档案、大纲与世界观设定作答。']
  const question = s(input.question)
  const scanText = `${question}\n${s(input.selectionQuote)}`
  const novel = input.novel ?? {}

  const characterSource = (payload.characters ?? []) as JsonRecord[]
  const characters = stableSortByKeys(
    characterSource.slice(0, 28).map((row) => ({
      id: s(row.id),
      name: s(row.name),
      aliases: stringList(row.aliases).slice(0, 5),
      gender: s(row.gender),
      goal: s(row.goal),
      notes: s(row.notes).slice(0, 140),
    })),
    ['name'],
  )
  const charById = new Map(characterSource.map((row) => [s(row.id), row]))
  const relations = stableSortByKeys(
    (payload.characterRelations ?? [])
      .map((row) => {
        const from = charById.get(s(row.fromCharacterId))
        const to = charById.get(s(row.toCharacterId))
        if (!from || !to) return null
        return { id: s(row.id), from: s(from.name), to: s(to.name), relationType: s(row.relationType), note: s(row.note).slice(0, 90) }
      })
      .filter(Boolean) as JsonRecord[],
    ['from', 'to'],
  ).slice(0, 24)

  const foreshadows = stableSortByKeys(
    (payload.foreshadows ?? [])
      .filter((row) => s(row.status) !== 'fulfilled')
      .map((row) => ({ id: s(row.id), title: s(row.title), description: s(row.description).slice(0, 120), status: s(row.status) })),
    ['title'],
  ).slice(0, 12)

  const factions = stableSortByKeys(
    (payload.factions ?? []).slice(0, 16).map((row) => ({ id: s(row.id), name: s(row.name), leader: s(row.leader), notes: s(row.notes).slice(0, 100) })),
    ['name'],
  )
  const items = stableSortByKeys(
    (payload.items ?? []).slice(0, 16).map((row) => ({ id: s(row.id), name: s(row.name), summary: s(row.summary).slice(0, 100) })),
    ['name'],
  )
  const categories = stableSortByKeys(
    (payload.categories ?? []).slice(0, 20).map((row) => ({ id: s(row.id), name: s(row.name), notes: s(row.notes).slice(0, 80) })),
    ['name'],
  )
  const outline = stableSortByKeys(
    (payload.outline ?? []).slice(0, 40).map((row) => ({ id: s(row.id), title: s(row.title), summary: s(row.summary).slice(0, 120), level: s(row.level) })),
    ['title'],
  )
  const worldSettings = stableSortByKeys(
    (payload.worldSettings ?? []).slice(0, 12).map((row) => {
      const cards = Array.isArray(row.attributes) ? row.attributes.filter((a) => a && (a.key || a.value)) : []
      const cardText = cards.map((a) => `【${s(a.key)}】${s(a.value)}`).join('\n')
      return { id: s(row.id), name: s(row.name), content: (cardText || s(row.content)).slice(0, 400) }
    }),
    ['name'],
  ).filter((row) => row.name || row.content)

  const parts: Record<string, string> = {
    instruction: ['【作者提问】', `提问范围：${input.mode}`, question].filter(Boolean).join('\n'),
    selection_quote: s(input.selectionQuote) ? ['【引用片段】', s(input.selectionQuote)].join('\n') : '',
    bible_compact: [
      '【档案摘录】（每条带 id；若需修改或删除已有角色/关系/伏笔，请用对应工具并传该 id，不要重复新建）',
      characters.length > 0 ? `角色：${stableStringify(characters)}` : '',
      relations.length > 0 ? `关系：${stableStringify(relations)}` : '',
      foreshadows.length > 0 ? `伏笔：${stableStringify(foreshadows)}` : '',
    ].filter(Boolean).join('\n'),
    factions_compact: factions.length > 0 ? ['【势力】', stableStringify(factions)].join('\n') : '',
    items_compact: items.length > 0 ? ['【物品】', stableStringify(items)].join('\n') : '',
    categories_compact: categories.length > 0 ? ['【分类】', stableStringify(categories)].join('\n') : '',
    outline_beat_path: outline.length > 0 ? ['【大纲节点】', stableStringify(outline)].join('\n') : '',
    worldview_compact:
      worldSettings.length > 0
        ? ['【世界观设定（每条带 id；回答与改写须与此一致，不得臆造）】', stableStringify(worldSettings)].join('\n')
        : '',
    continuity_brief: s(novel.continuityBrief).trim() ? ['【全书连续性摘要】', s(novel.continuityBrief).trim()].join('\n') : '',
    novel_brief: [
      '【作品信息】',
      s(novel.title) ? `书名：${s(novel.title)}` : '',
      s(novel.genre) ? `类型：${s(novel.genre)}` : '',
      s(novel.perspective) ? `视角：${s(novel.perspective)}` : '',
      s(novel.tone) ? `基调：${s(novel.tone)}` : '',
      s(novel.summary) ? `简介：${s(novel.summary)}` : '',
    ].filter(Boolean).join('\n'),
  }
  void scanText

  const { pack, dropped } = trimAskPack(parts, ASK_TRIM_ORDER, ASK_INPUT_CHAR_BUDGET)
  const prompt = Object.entries(pack).map(([, value]) => value).filter(Boolean).join('\n\n')
  const usedLayers = Object.keys(pack).filter((key) => Boolean(pack[key]?.trim()))
  return { prompt, warnings, droppedLayers: dropped, usedLayers, usedChars: estimatePackChars(pack), ragHits: [] }
}

function buildAskContextParts(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: 'current' | 'recent' | 'all'
    chapterIds?: string[]
    question: string
    selectionQuote?: string
    prevSummaryCount?: number
    enableRag?: boolean
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      genre?: string
      perspective?: string
      tone?: string
    }
    /** 追问轮次用更短的当前章摘录 */
    compactChapter?: boolean
  },
): AskPromptBuildResult {
  const warnings: string[] = []
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const current = resolvePrimaryChapter(payload, input.chapterIds)
  if (!current) {
    return buildNoChapterAskParts(payload, input)
  }

  const currentIndex = chapters.findIndex((row) => s(row.id) === s(current.id))
  const content = String(current.content ?? '')
  const question = s(input.question)
  const scanText = `${content}\n${question}\n${s(input.selectionQuote)}`

  const outlineIds = (current.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)
  const outlineIdSet = new Set(outlineIds)
  const beatPack = buildOutlineBeatPathForChapter(
    payload.outline ?? [],
    outlineIds,
    (payload.characters ?? []).map((row) => ({
      id: s(row.id),
      name: s(row.name),
      goal: s(row.goal),
      arc: s(row.arc),
    })),
  )
  warnings.push(...beatPack.warnings)

  const outlineCharacterIds = [
    ...new Set([
      ...beatPack.outlineCharacterIds,
      ...(payload.outline ?? [])
        .filter((row) => outlineIdSet.has(s(row.id)))
        .flatMap((row) => (Array.isArray(row.characterIds) ? row.characterIds : []).map((id) => s(id))),
    ]),
  ].filter(Boolean)
  const outlineForeshadowIds = (payload.outline ?? [])
    .filter((row) => outlineIdSet.has(s(row.id)))
    .flatMap((row) => (Array.isArray(row.foreshadowIds) ? row.foreshadowIds : []).map((id) => s(id)))
    .filter(Boolean)
  const outlineLocations = (payload.outline ?? [])
    .filter((row) => outlineIdSet.has(s(row.id)))
    .map((row) => s(row.location))
    .filter((loc) => loc.length >= 2)

  const characterSource = (payload.characters ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    gender: row.gender,
    age: row.age,
    goal: row.goal,
    secret: row.secret,
    arc: row.arc,
    notes: row.notes,
    attributes: row.attributes,
    firstAppearanceChapterNo: row.firstAppearanceChapterNo,
    categoryIds: row.categoryIds,
  }))

  const { rows: scopedCharacters, chapterScoped } = pickChapterScopedCharacters(
    characterSource,
    scanText,
    outlineCharacterIds,
    28,
  )
  if (!chapterScoped && characterSource.length > scopedCharacters.length) {
    warnings.push('档案按全书前若干角色截取；建议在问题里写出人物名以便检索旧章。')
  } else if (chapterScoped) {
    warnings.push(`档案已按当前章与问题相关人物筛选（${scopedCharacters.length} 人）。`)
  }

  const scopedIds = new Set(scopedCharacters.map((row) => s(row.id)))
  const characters = stableSortByKeys(
    scopedCharacters.map((row) => ({
      id: s(row.id),
      name: s(row.name),
      aliases: stringList(row.aliases).slice(0, 5),
      gender: s(row.gender),
      goal: s(row.goal),
      notes: s(row.notes).slice(0, 140),
    })),
    ['name'],
  )

  const relations = stableSortByKeys(
    (payload.characterRelations ?? [])
      .map((row) => {
        const from = characterSource.find((item) => s(item.id) === s(row.fromCharacterId))
        const to = characterSource.find((item) => s(item.id) === s(row.toCharacterId))
        if (!from || !to) return null
        if (!scopedIds.has(s(from.id)) || !scopedIds.has(s(to.id))) return null
        return {
          id: s(row.id),
          from: s(from.name),
          to: s(to.name),
          relationType: s(row.relationType),
          note: s(row.note).slice(0, 90),
        }
      })
      .filter(Boolean) as JsonRecord[],
    ['from', 'to'],
  ).slice(0, 24)

  const foreshadowSource = payload.foreshadows ?? []
  const relevantForeshadows = stableSortByKeys(
    foreshadowSource
      .filter((row) => {
        if (s(row.status) === 'fulfilled') return false
        const title = s(row.title)
        const id = s(row.id)
        return (
          outlineForeshadowIds.includes(id) ||
          mentionsNameInText(title, scanText) ||
          s(row.plantChapterId) === s(current.id)
        )
      })
      .map((row) => ({
        id: s(row.id),
        title: s(row.title),
        description: s(row.description).slice(0, 120),
        status: s(row.status),
      })),
    ['title'],
  ).slice(0, 12)

  const summaryCount = Math.max(2, Math.min(8, Math.trunc(Number(input.prevSummaryCount ?? 5))))
  const prevSummaries = chapters
    .slice(Math.max(0, currentIndex - summaryCount), currentIndex)
    .map((row) => ({
      chapterNo: row.chapterNo,
      title: s(row.title),
      summary: s(row.annotation).trim() || sliceTextExcerpt(row.content, 400),
    }))

  const outlineBeatPath = beatPack.text

  const factions = stableSortByKeys(
    (payload.factions ?? []).slice(0, 16).map((row) => ({
      id: s(row.id),
      name: s(row.name),
      leader: s(row.leader),
      notes: s(row.notes).slice(0, 100),
    })),
    ['name'],
  )

  const items = stableSortByKeys(
    (payload.items ?? []).slice(0, 16).map((row) => ({
      id: s(row.id),
      name: s(row.name),
      summary: s(row.summary).slice(0, 100),
    })),
    ['name'],
  )

  const categories = stableSortByKeys(
    (payload.categories ?? []).slice(0, 20).map((row) => ({
      id: s(row.id),
      name: s(row.name),
      notes: s(row.notes).slice(0, 80),
    })),
    ['name'],
  )

  const timeline = stableSortByKeys(
    (payload.timelineEvents ?? []).slice(0, 12).map((row) => ({
      id: s(row.id),
      title: s(row.title),
      summary: s(row.summary).slice(0, 100),
      chapterNoStart: row.chapterNoStart ?? null,
    })),
    ['title'],
  )

  const worldSettingSource = payload.worldSettings ?? []
  const relevantWorldSettings = (() => {
    const matched = worldSettingSource.filter((row) => mentionsNameInText(s(row.name), scanText))
    const base = matched.length > 0 ? matched : worldSettingSource
    return stableSortByKeys(
      base.slice(0, 12).map((row) => {
        const cards = Array.isArray(row.attributes) ? row.attributes.filter((a) => a && (a.key || a.value)) : []
        const cardText = cards.map((a) => `【${s(a.key)}】${s(a.value)}`).join('\n')
        return {
          id: s(row.id),
          name: s(row.name),
          content: (cardText || s(row.content)).slice(0, 400),
        }
      }),
      ['name'],
    ).filter((row) => row.name || row.content)
  })()

  const novel = input.novel ?? {}
  const enableRag = input.enableRag !== false && !input.compactChapter
  const ragTerms = collectAskRagTerms({
    question,
    characters: characterSource,
    foreshadows: foreshadowSource,
    scanText,
    currentChapterId: s(current.id),
    outlineForeshadowIds,
    outlineLocations,
  })

  const ragHits =
    enableRag && currentIndex > 0
      ? buildContinueRagHits({
          chapters,
          currentChapterId: s(current.id),
          characters: characterSource,
          direction: question,
          foreshadows: foreshadowSource,
          scanText,
          outlineForeshadowIds,
          outlineLocations,
        })
      : []

  if (enableRag && ragHits.length > 0) {
    const bits = [
      ragHits.filter((r) => r.source === 'character').length > 0
        ? `人物 ${ragHits.filter((r) => r.source === 'character').length}`
        : '',
      ragHits.filter((r) => r.source === 'foreshadow').length > 0
        ? `伏笔 ${ragHits.filter((r) => r.source === 'foreshadow').length}`
        : '',
      ragHits.filter((r) => r.source === 'location').length > 0
        ? `地点 ${ragHits.filter((r) => r.source === 'location').length}`
        : '',
    ].filter(Boolean)
    warnings.push(`旧章检索 ${ragHits.length} 段（${bits.join('、')}）。`)
  }

  const chapterCap = input.compactChapter ? 2200 : 10000
  let chapterBody = content
  if (content.length > chapterCap) {
    chapterBody = sliceTextTail(content, chapterCap)
    warnings.push(`当前章正文较长，已截取末尾约 ${chapterCap} 字供阅读。`)
  }

  const parts: Record<string, string> = {
    instruction: ['【作者提问】', `提问范围：${input.mode}`, question].filter(Boolean).join('\n'),
    selection_quote: s(input.selectionQuote) ? ['【引用片段】', s(input.selectionQuote)].join('\n') : '',
    tool_scope: [
      '【工具作用域】',
      `当前章 ID：${current.id}（第 ${current.chapterNo} 章《${s(current.title)}》）`,
      '未传 chapterId 时，正文与章总结类工具默认作用于当前章。',
    ].join('\n'),
    current_chapter: [
      '【当前章正文】',
      `第 ${current.chapterNo} 章 ${s(current.title)}`,
      s(current.notes) ? `作者备注：${s(current.notes)}` : '',
      s(current.annotation) ? `章总结：${s(current.annotation)}` : '',
      chapterBody,
    ]
      .filter(Boolean)
      .join('\n'),
    prev_summaries:
      prevSummaries.length > 0
        ? ['【前情提要】', ...prevSummaries.map((row) => `第 ${row.chapterNo} 章《${row.title}》：${row.summary}`)].join('\n')
        : '',
    rag_snippets:
      ragHits.length > 0
        ? [
            '【旧章检索片段】',
            ...ragHits.map(
              (row, index) =>
                `${index + 1}. 第 ${row.chapterNo} 章（${row.matchedTerms.join('、')}）\n${row.excerpt}`,
            ),
          ].join('\n\n')
        : '',
    bible_compact: [
      '【档案摘录】（每条带 id；若需修改或删除已有角色/关系/伏笔，请用对应工具并传该 id，不要重复新建。重写正文导致旧伏笔原文消失时，应更新或删除旧伏笔，而非新增）',
      characters.length > 0 ? `角色：${stableStringify(characters)}` : '',
      relations.length > 0 ? `关系：${stableStringify(relations)}` : '',
      relevantForeshadows.length > 0 ? `伏笔：${stableStringify(relevantForeshadows)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    factions_compact: factions.length > 0 ? ['【势力】', stableStringify(factions)].join('\n') : '',
    items_compact: items.length > 0 ? ['【物品】', stableStringify(items)].join('\n') : '',
    categories_compact: categories.length > 0 ? ['【分类】', stableStringify(categories)].join('\n') : '',
    timeline_compact: timeline.length > 0 ? ['【时间线】', stableStringify(timeline)].join('\n') : '',
    worldview_compact:
      relevantWorldSettings.length > 0
        ? ['【世界观设定（角色、地点、势力、规则的设定依据，回答与改写须与此一致，不得臆造）】', stableStringify(relevantWorldSettings)].join('\n')
        : '',
    outline_beat_path: outlineBeatPath ? outlineBeatPath : '',
    continuity_brief: s(novel.continuityBrief).trim()
      ? ['【全书连续性摘要】', s(novel.continuityBrief).trim()].join('\n')
      : '',
    novel_brief: [
      '【作品信息】',
      s(novel.title) ? `书名：${s(novel.title)}` : '',
      s(novel.genre) ? `类型：${s(novel.genre)}` : '',
      s(novel.perspective) ? `视角：${s(novel.perspective)}` : '',
      s(novel.tone) ? `基调：${s(novel.tone)}` : '',
      s(novel.summary) ? `简介：${s(novel.summary)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  }

  const budget = input.compactChapter ? ASK_FOLLOWUP_CHAR_BUDGET : ASK_INPUT_CHAR_BUDGET
  const { pack, dropped } = trimAskPack(parts, ASK_TRIM_ORDER, budget)
  if (dropped.length > 0) {
    warnings.push(`上下文过长，已省略：${dropped.map((key) => ASK_CONTEXT_LAYER_LABELS[key] ?? key).join('、')}`)
  }

  const prompt = Object.entries(pack)
    .map(([, value]) => value)
    .filter(Boolean)
    .join('\n\n')

  const usedLayers = Object.keys(pack).filter((key) => Boolean(pack[key]?.trim()))
  return {
    prompt,
    warnings,
    droppedLayers: dropped,
    usedLayers,
    usedChars: estimatePackChars(pack),
    ragHits,
  }
}

export function buildAskUserPrompt(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: 'current' | 'recent' | 'all'
    chapterIds?: string[]
    question: string
    selectionQuote?: string
    prevSummaryCount?: number
    enableRag?: boolean
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      genre?: string
      perspective?: string
      tone?: string
    }
  },
): AskPromptBuildResult {
  return buildAskContextParts(payload, { ...input, compactChapter: false })
}

export function buildAskFollowUpPrompt(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: 'current' | 'recent' | 'all'
    chapterIds?: string[]
    question: string
    selectionQuote?: string
    enableRag?: boolean
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
    }
  },
): AskPromptBuildResult {
  const built = buildAskContextParts(payload, {
    ...input,
    compactChapter: true,
    prevSummaryCount: 2,
  })
  const sessionNote = [
    '【会话说明】',
    '本条为同一会话内的追问。完整档案与当前章正文已在会话开头提供，请结合上文回答，勿重复索要已给出的设定。',
  ].join('\n')
  return {
    ...built,
    prompt: [sessionNote, built.prompt].filter(Boolean).join('\n\n'),
    usedLayers: ['session_note', ...built.usedLayers],
    usedChars: built.usedChars + sessionNote.length,
  }
}

export function trimAskConversationHistory<T extends { role: string; content?: string | null }>(
  history: T[],
  maxMessages = 14,
): T[] {
  if (history.length <= maxMessages) return history
  const system = history.filter((row) => row.role === 'system')
  const rest = history.filter((row) => row.role !== 'system')
  const kept = rest.slice(-maxMessages)
  return [...system, ...kept]
}

/**
 * 修复对话历史里 tool_calls 与 tool 响应不配对的情况：
 * - assistant 的每个 tool_call 必须有对应 role:'tool' 的响应消息；缺失则给该 assistant 去掉 tool_calls
 * - 去掉找不到对应 tool_call 的孤立 tool 消息
 * 否则上游 API 会报 400（tool_calls 后缺少 tool 响应）。
 */
export function sanitizeToolCallHistory<
  T extends { role: string; content?: string | null; tool_calls?: Array<{ id: string }>; tool_call_id?: string },
>(history: T[]): T[] {
  if (!Array.isArray(history) || history.length === 0) return history
  // 收集所有已存在的 tool 响应 id
  const respondedIds = new Set<string>()
  for (const msg of history) {
    if (msg.role === 'tool' && msg.tool_call_id) respondedIds.add(String(msg.tool_call_id))
  }
  // 收集所有「被完整响应」的 tool_call id（用于过滤孤立 tool 消息）
  const validCallIds = new Set<string>()
  const out: T[] = []
  for (const msg of history) {
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      const allResponded = msg.tool_calls.every((tc) => respondedIds.has(String(tc.id)))
      if (allResponded) {
        for (const tc of msg.tool_calls) validCallIds.add(String(tc.id))
        out.push(msg)
      } else {
        // 去掉未配对的 tool_calls，保留文字内容（content 为空则补占位，避免空 assistant）
        const { tool_calls, ...rest } = msg as T & { tool_calls?: unknown }
        void tool_calls
        out.push({ ...(rest as T), content: msg.content ?? '' })
      }
      continue
    }
    if (msg.role === 'tool') {
      if (msg.tool_call_id && validCallIds.has(String(msg.tool_call_id))) out.push(msg)
      // 否则丢弃孤立 tool 消息
      continue
    }
    out.push(msg)
  }
  return out
}
