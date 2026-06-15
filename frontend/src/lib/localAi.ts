import type {
  AiExtractMode,
  AiMessage,
  AiPendingToolAction,
  AiToolCall,
  AiToolDefinition,
  AiToolExecutionContext,
  ArcSummary,
  Chapter,
  EntityMatch,
  EntityMatchType,
  ContinueChapterResult,
  ExtractedCharacter,
  NovelChapterClassificationResult,
  NovelEntityExtractResult,
  NovelForeshadowAnalysisResult,
  Novel,
  OutlineItem,
  OutlineNodeLevel,
  OutlineRewriteResult,
  OutlineStorylineType,
  Storyboard,
  Shot,
} from '../types'
import type { AiToolResult } from '../types'
import { matchGenreProfiles, buildGenrePromptInjection } from './genreProfiles'
import { assertAiReady, postAiCompletion, postAiCompletionStream, postAiPrompt, postAiPromptStream } from './backendAi'
import { buildPendingToolActions } from '../features/chapter-hub/lib/aiPendingToolActions'
import { AI_WRITE_TOOLS, executeToolCall } from './aiTools'
import type { WorkspaceSnapshotPayload } from './storage'
import { getCharacterStateAtPosition, recordCharacterChangeFields, uid } from './storage'
import type { CharacterNarrativeState, CharacterChangeDetail } from './storage'
import {
  buildAskFollowUpPrompt,
  buildAskUserPrompt,
  sanitizeToolCallHistory,
  trimAskConversationHistory,
  type AskPromptBuildResult,
} from './askContext'
import { buildContinueRagHits, formatContinueRagSnippetsForPrompt, type ContinueRagSnippet } from './continueRag'
import { buildOutlineBeatPathForChapter } from './outlineBeatPack'
import { isValidParentLevel } from './outlineHierarchy'
import { buildDisplayNameMap } from './characterLabels'
import { buildOutlineAiContextPack } from './outlineContextPack'

export type { AskPromptBuildResult } from './askContext'
export { ASK_CONTEXT_LAYER_LABELS } from './askContext'

type JsonRecord = Record<string, any>






const CONTINUE_INPUT_CHAR_BUDGET = 32000

export const CONTINUE_CONTEXT_LAYER_LABELS: Record<string, string> = {
  instruction: '续写要求',
  anchor: '锚点正文',
  chapter_meta: '当前章',
  prev_tail: '上章衔接',
  prev_summaries: '前情提要',
  bible_compact: '档案摘录',
  outline_beat_path: '大纲节拍路径',
  novel_brief: '作品信息',
  continuity_brief: '全书连续性',
  arc_context: '篇章弧线',
  rag_snippets: '旧章检索',
}








const OUTLINE_DESIGN_JSON_TEMPERATURE = 0.72




export type OutlineDesignOption = {
  id: string
  title: string
  premise: string
  structure: string
  narrativeShape: string
  coreQuestion: string
  forbiddenCliche: string
  highlights: string[]
  endingTone: string
  beats: string[]
  characterRoster: Array<{ name: string; role: string; hook: string }>
}

function parseOutlineDesignOptionsPayload(parsed: JsonRecord): { brief: string; options: OutlineDesignOption[] } {
  return {
    brief: s(parsed.brief),
    options: Array.isArray(parsed.options)
      ? parsed.options.slice(0, 3).map((item: JsonRecord, index: number) => ({
          id: s(item.id) || `option-${index + 1}`,
          title: s(item.title) || `方案 ${index + 1}`,
          premise: s(item.premise),
          structure: s(item.structure),
          narrativeShape: s(item.narrativeShape),
          coreQuestion: s(item.coreQuestion),
          forbiddenCliche: s(item.forbiddenCliche),
          highlights: stringList(item.highlights).slice(0, 4),
          endingTone: s(item.endingTone),
          beats: stringList(item.beats).slice(0, 6),
          characterRoster: Array.isArray(item.characterRoster)
            ? item.characterRoster
                .slice(0, 6)
                .map((row: JsonRecord) => ({
                  name: s(row.name),
                  role: s(row.role),
                  hook: s(row.hook),
                }))
                .filter((row) => row.name)
            : [],
        }))
      : [],
  }
}

function s(value: unknown): string {
  return String(value ?? '').trim()
}

/** 清除 DeepSeek DSML 格式的 tool call 标记（代理未解析时的降级处理） */
function stripDsmlToolCalls(text: string): string {
  return String(text ?? '').replace(/<｜｜DSML｜｜[^>]*>[\s\S]*?<｜｜DSML｜｜[^>]*>/g, '').trim()
}

function i(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function f(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of value) {
    const text = s(row)
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function extractBalancedJsonObject(text: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (start === -1) {
      if (char === '{') {
        start = index
        depth = 1
      }
      continue
    }

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }

  return null
}

function salvageTruncatedJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let inString = false
  let escaped = false
  const stack: string[] = [] // 记录待闭合的 { / [
  let lastComplete = -1 // 最近一个「完整键值对/元素」结束的位置（顶层对象内）
  let result = ''
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]
    result += ch
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') stack.pop()
    // 在顶层对象（stack 深度为1）记录逗号位置，作为安全截断点
    if (ch === ',' && stack.length >= 1) lastComplete = result.length
  }
  if (stack.length === 0) return result // 本就完整
  // 截断发生：回退到最近一个完整元素，去掉尾随逗号，再补齐闭合符
  let body = lastComplete > 0 ? result.slice(0, lastComplete - 1) : result
  // 若仍在字符串中，补一个引号
  // 重新扫描 body 计算需要补的闭合括号
  const need: string[] = []
  let s2 = false, e2 = false
  for (const ch of body) {
    if (s2) { if (e2) e2 = false; else if (ch === '\\') e2 = true; else if (ch === '"') s2 = false; continue }
    if (ch === '"') s2 = true
    else if (ch === '{') need.push('}')
    else if (ch === '[') need.push(']')
    else if (ch === '}' || ch === ']') need.pop()
  }
  if (s2) body += '"'
  for (let i = need.length - 1; i >= 0; i -= 1) body += need[i]
  return body
}

function parseAiJsonContent(content: string): JsonRecord {
  const raw = s(content)
  if (!raw) throw new Error('AI 返回内容为空，无法整理')

  const candidates = [
    raw,
    raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim(),
  ]

  const balanced = extractBalancedJsonObject(raw)
  if (balanced) candidates.push(balanced)

  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate) as JsonRecord
    } catch {
      // continue
    }
  }

  // 兜底：尝试修复被截断的 JSON（长输出超 token 被切断时）
  const salvaged = salvageTruncatedJson(raw)
  if (salvaged) {
    try {
      return JSON.parse(salvaged) as JsonRecord
    } catch {
      // continue
    }
  }

  throw new Error('AI 返回的整理结果不是有效 JSON，请更换模型或稍后重试')
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const text = s(raw)
    const key = normName(text)
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function normName(value: string): string {
  return s(value).toLowerCase().replace(/\s+/g, '')
}

function similarity(a: string, b: string): number {
  const left = normName(a)
  const right = normName(b)
  if (!left || !right) return 0
  if (left === right) return 1
  let hits = 0
  for (const char of left) {
    if (right.includes(char)) hits += 1
  }
  return hits / Math.max(left.length, right.length)
}

function namesOverlap(a: ExtractedCharacter | { name: string; aliases: string[] }, b: ExtractedCharacter | { name: string; aliases: string[] }): boolean {
  const left = uniqueStrings([a.name, ...a.aliases])
  const right = uniqueStrings([b.name, ...b.aliases])
  return left.some((name) => right.some((other) => normName(name) === normName(other)))
}

function parseIdentityStatus(value: unknown): 'certain' | 'uncertain' | 'possible_same_person' {
  const raw = s(value)
  if (raw === 'uncertain' || raw === 'possible_same_person') return raw
  return 'certain'
}

function enrichIdentityWarnings(
  identityStatus: 'certain' | 'uncertain' | 'possible_same_person',
  warnings: string[],
  extra?: string,
): string[] {
  const out = [...warnings]
  const hasPending = out.some((row) => row.includes('待确认'))
  if (identityStatus === 'uncertain' && !hasPending) {
    out.unshift(`【待确认】${extra || '该人物身份或是否为独立角色尚不明确，请勿自动合并。'}`)
  }
  if (identityStatus === 'possible_same_person' && !hasPending) {
    out.unshift(`【待确认】${extra || '怀疑与档案中已有角色为同一人，但正文证据不足；请核对后再决定是否合并。'}`)
  }
  return uniqueStrings(out)
}

function isLikelyDistinctPersonLabel(alias: string, characterName: string): boolean {
  const aliasNorm = normName(alias)
  const nameNorm = normName(characterName)
  if (!aliasNorm || aliasNorm === nameNorm) return false

  const rolePattern =
    /(老头|老者|老头儿|少年|少女|青年|汉子|女子|男孩|女孩|小子|丫头|书生|和尚|道士|掌柜|车夫|仆人|侍女|锦衣|白衣|黑衣|灰袍|壮汉|美人)/
  if (rolePattern.test(alias) && !rolePattern.test(characterName)) return true

  if (characterName.length >= 2 && alias.length >= 2) {
    const surnameA = characterName[0]
    const surnameB = alias[0]
    if (surnameA !== surnameB && !aliasNorm.includes(nameNorm) && !nameNorm.includes(aliasNorm)) {
      return true
    }
  }

  return false
}

function emptyExtractedCharacter(name: string, warnings: string[], evidences: ExtractedCharacter['evidences']): ExtractedCharacter {
  return {
    name,
    aliases: [],
    gender: '',
    age: '',
    goal: '',
    secret: '',
    arc: '',
    notes: '',
    attributes: [],
    identityStatus: 'uncertain',
    firstAppearanceChapterNo: null,
    confidence: 0.35,
    match: createMatch('new'),
    evidences,
    warnings: enrichIdentityWarnings('uncertain', warnings, `「${name}」原被误列为他人别名，已拆分为独立建议，请核对。`),
  }
}

function findArchiveCharacterIdByLabel(label: string, archiveCharacters: JsonRecord[]): string | null {
  const needle = normName(label)
  if (!needle) return null
  for (const row of archiveCharacters) {
    const labels = [s(row.name), ...stringList(row.aliases)].map((name) => normName(name))
    if (labels.includes(needle)) return s(row.id)
  }
  return null
}

function sanitizeExtractedCharacters(
  rows: ExtractedCharacter[],
  archiveCharacters: JsonRecord[],
): ExtractedCharacter[] {
  const primaryNames = new Set(rows.map((row) => normName(row.name)))
  const promoted: ExtractedCharacter[] = []

  const cleaned = rows.map((row) => {
    const kept: string[] = []
    const removed: string[] = []
    const selfArchiveId = s(row.match.targetId)

    for (const alias of row.aliases) {
      const aliasNorm = normName(alias)
      if (!aliasNorm || aliasNorm === normName(row.name)) continue

      const otherPrimary = rows.some((other) => normName(other.name) === aliasNorm && normName(other.name) !== normName(row.name))
      const archiveOwnerId = findArchiveCharacterIdByLabel(alias, archiveCharacters)
      const archiveOther = !!archiveOwnerId && archiveOwnerId !== selfArchiveId
      if (otherPrimary || archiveOther || isLikelyDistinctPersonLabel(alias, row.name)) {
        removed.push(alias)
        if (!primaryNames.has(aliasNorm) && alias.length >= 2) {
          promoted.push(
            emptyExtractedCharacter(alias, [], row.evidences.slice(0, 2)),
          )
          primaryNames.add(aliasNorm)
        }
        continue
      }
      kept.push(alias)
    }

    let identityStatus = row.identityStatus
    let warnings = [...row.warnings]
    if (removed.length > 0) {
      identityStatus = identityStatus === 'certain' ? 'uncertain' : identityStatus
      warnings = enrichIdentityWarnings(
        identityStatus === 'certain' ? 'uncertain' : identityStatus,
        warnings,
        `以下称呼更像其他独立人物，已从别名移除：${removed.join('、')}。请分别为其建档案，或用 relations 记录关系。`,
      )
    }

    return { ...row, aliases: kept, identityStatus, warnings }
  })

  return [...cleaned, ...promoted]
}

function shouldMergeExtractedCharacters(current: ExtractedCharacter, other: ExtractedCharacter): boolean {
  if (namesOverlap(current, other)) return true

  const genericPair =
    (isLikelyUnnamedDescriptor(current.name) && !isLikelyUnnamedDescriptor(other.name)) ||
    (!isLikelyUnnamedDescriptor(current.name) && isLikelyUnnamedDescriptor(other.name))

  if (!genericPair) {
    if (current.identityStatus === 'uncertain' || other.identityStatus === 'uncertain') return false
    if (current.identityStatus === 'possible_same_person' || other.identityStatus === 'possible_same_person') return false
    const score = similarity(current.name, other.name)
    if (score >= 0.92) {
      const genderClash =
        s(current.gender) && s(other.gender) && normName(current.gender) !== normName(other.gender)
      if (genderClash) return false
    }
    return false
  }

  const score = Math.max(similarity(current.name, other.name), similarity(other.name, current.name))
  return score >= 0.95
}

function normalizeEvidences(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => ({
      chapterId: s((row as JsonRecord)?.chapterId ?? (row as JsonRecord)?.chapter_id),
      chapterNo: i((row as JsonRecord)?.chapterNo ?? (row as JsonRecord)?.chapter_no),
      quote: s((row as JsonRecord)?.quote).slice(0, 280),
    }))
    .filter((row) => row.chapterId || row.quote)
    .slice(0, 5)
}

function clampTensionLevel(value: unknown): number {
  const level = Number(value)
  if (!Number.isFinite(level)) return 0
  return Math.max(1, Math.min(5, Math.trunc(level)))
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

function estimatePackChars(parts: Record<string, string>): number {
  return Object.values(parts).reduce((sum, value) => sum + value.length, 0)
}

function mentionsNameInText(name: string, text: string): boolean {
  const token = s(name).trim()
  if (token.length < 2) return false
  return text.includes(token)
}

function pickCharactersForContinueContext(
  characters: JsonRecord[],
  scanText: string,
  outlineCharacterIds: string[],
  limit: number,
): { rows: JsonRecord[]; chapterScoped: boolean } {
  const text = String(scanText ?? '')
  const outlineSet = new Set(outlineCharacterIds.map((id) => s(id)).filter(Boolean))
  const mentioned = new Map<string, JsonRecord>()
  for (const row of characters) {
    const id = s(row.id)
    if (!id) continue
    const inOutline = outlineSet.has(id)
    const inText =
      mentionsNameInText(s(row.name), text) ||
      stringList(row.aliases).some((alias) => mentionsNameInText(alias, text))
    if (inOutline || inText) mentioned.set(id, row)
  }
  if (mentioned.size === 0) {
    return { rows: characters.slice(0, limit), chapterScoped: false }
  }
  return { rows: [...mentioned.values()].slice(0, limit), chapterScoped: true }
}

function trimContinuePack(parts: Record<string, string>, order: string[], budget: number): { pack: Record<string, string>; dropped: string[] } {
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

function buildContinueUserPrompt(
  payload: WorkspaceSnapshotPayload,
  input: {
    chapterId: string
    position: 'cursor' | 'end' | 'replace'
    cursorOffset?: number
    targetChars?: number
    direction?: string
    selectionQuote?: string
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      arcSummaries?: ArcSummary[]
      genre?: string
      perspective?: string
      tone?: string
    }
    prevSummaryCount?: number
    enableRag?: boolean
  },
): {
  prompt: string
  contextPrompt: string
  warnings: string[]
  droppedLayers: string[]
  usedLayers: string[]
  usedChars: number
  ragHits: ContinueRagSnippet[]
} {
  const warnings: string[] = []
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const currentIndex = chapters.findIndex((row) => s(row.id) === s(input.chapterId))
  const current = currentIndex >= 0 ? chapters[currentIndex] : chapters[chapters.length - 1]
  if (!current) {
    return {
      prompt: '没有可续写的章节正文。',
      contextPrompt: '',
      warnings: ['没有可续写的章节正文'],
      droppedLayers: [],
      usedLayers: [],
      usedChars: 0,
      ragHits: [],
    }
  }

  const content = String(current.content ?? '')
  const offset =
    input.position === 'cursor'
      ? Math.max(0, Math.min(content.length, Math.trunc(Number(input.cursorOffset ?? content.length))))
      : content.length
  const isRewrite = input.position === 'replace'
  // 重写：锚点为本章完整旧正文（从头取），供 AI 整章重写参考；续写：取末尾/光标前片段
  const anchor = isRewrite
    ? content.slice(0, 4000)
    : input.position === 'end'
      ? sliceTextTail(content, 2800)
      : sliceTextTail(content.slice(0, offset), 2800)
  if (!anchor.trim()) {
    warnings.push(isRewrite ? '本章原文几乎为空，重写将基本等同于新写本章。' : '当前锚点附近几乎没有正文，续写可能偏离既有语气。')
  }

  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const summaryCount = Math.max(1, Math.min(5, Math.trunc(Number(input.prevSummaryCount ?? 3))))
  const prevSummaries = selectRelevantPrevSummaries(
    chapters,
    currentIndex,
    summaryCount,
    payload.outline ?? [],
    input.novel?.arcSummaries ?? [],
  )

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
        .filter((row) => outlineIds.includes(s(row.id)))
        .flatMap((row) => (Array.isArray(row.characterIds) ? row.characterIds : []).map((id) => s(id))),
    ]),
  ].filter(Boolean)

  const scanText = `${anchor}\n${content}`
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
  }))
  const { rows: scopedCharacters, chapterScoped } = pickCharactersForContinueContext(
    characterSource,
    scanText,
    outlineCharacterIds,
    24,
  )
  if (!chapterScoped && characterSource.length > scopedCharacters.length) {
    warnings.push('未在锚点/本章正文匹配到出场角色，已改用全书档案前若干条。')
  } else if (chapterScoped) {
    warnings.push(`档案已按本章出场人物筛选（${scopedCharacters.length} 人）。`)
  }

  const scopedIds = new Set(scopedCharacters.map((row) => s(row.id)))
  // 同名实体显示名映射(在全书集合上计算,使张三1/张三2 互相知晓),喂给 AI 以便区分同名角色/势力
  const charDisplayNameMap = buildDisplayNameMap(
    (payload.characters ?? []).map((row) => ({ id: s(row.id), name: s(row.name), createdAt: s(row.createdAt) })),
  )
  const factionDisplayNameMap = buildDisplayNameMap(
    (payload.factions ?? []).map((row) => ({ id: s(row.id), name: s(row.name), createdAt: s(row.createdAt) })),
  )
  const charDisplay = (id: string, fallback: string): string => charDisplayNameMap.get(s(id)) || fallback
  // 逐章叙事状态:取该角色「截至当前章锚点位置」的最新状态(角色状态机),作为静态档案之上的覆盖层
  const narrativeStateText = (charId: string): string => {
    try {
      const resolved = getCharacterStateAtPosition(s(charId), s(current.id), offset, chapters)
      const st = resolved?.event?.narrativeState
      if (!st) return ''
      const parts = [
        s(st.location) ? `位置:${s(st.location)}` : '',
        s(st.condition) ? `状态:${s(st.condition)}` : '',
        Array.isArray(st.knownInfo) && st.knownInfo.length > 0 ? `已知:${st.knownInfo.map((x) => s(x)).filter(Boolean).join('、')}` : '',
        Array.isArray(st.possessions) && st.possessions.length > 0 ? `持有:${st.possessions.map((x) => s(x)).filter(Boolean).join('、')}` : '',
        Array.isArray(st.relationDelta) && st.relationDelta.length > 0 ? `关系变动:${st.relationDelta.map((x) => s(x)).filter(Boolean).join('、')}` : '',
      ].filter(Boolean)
      return parts.length > 0 ? `${parts.join('；')}（截至第${st.chapterNo}章）` : ''
    } catch {
      return ''
    }
  }
  const characters = stableSortByKeys(
    scopedCharacters.map((row) => {
      const attrs = Array.isArray(row.attributes)
        ? (row.attributes as Array<{ key?: string; value?: string }>)
            .filter((a) => a.key && a.value)
            .map((a) => `${a.key}:${a.value}`)
            .join('；')
        : ''
      return {
        name: charDisplay(s(row.id), s(row.name)),
        aliases: stringList(row.aliases).slice(0, 4),
        gender: s(row.gender),
        age: s(row.age),
        goal: s(row.goal),
        secret: s(row.secret),
        arc: s(row.arc),
        notes: s(row.notes).slice(0, 200),
        attrs: attrs.slice(0, 200),
        现状: narrativeStateText(s(row.id)).slice(0, 300),
        firstCh: typeof row.firstAppearanceChapterNo === 'number' ? row.firstAppearanceChapterNo : undefined,
      }
    }),
    ['name'],
  )

  const relations = stableSortByKeys(
    (payload.characterRelations ?? []).map((row) => {
      const from = (payload.characters ?? []).find((item) => s(item.id) === s(row.fromCharacterId))
      const to = (payload.characters ?? []).find((item) => s(item.id) === s(row.toCharacterId))
      if (!from || !to) return null
      if (!scopedIds.has(s(from.id)) || !scopedIds.has(s(to.id))) return null
      return {
        from: charDisplay(s(from.id), s(from.name)),
        to: charDisplay(s(to.id), s(to.name)),
        relationType: s(row.relationType),
        note: s(row.note).slice(0, 80),
      }
    }).filter(Boolean) as JsonRecord[],
    ['from', 'to'],
  ).slice(0, 20)

  // 角色势力归属
  const membershipLines: string[] = []
  if (payload.characterFactionMemberships?.length && payload.factions?.length) {
    for (const m of payload.characterFactionMemberships) {
      const charRow = scopedCharacters.find((c) => s(c.id) === s(m.characterId))
      const charName = charRow ? charDisplay(s(charRow.id), s(charRow.name)) : ''
      const facName = factionDisplayNameMap.get(s(m.factionId)) || ''
      if (charName && facName) membershipLines.push(`${charName} → ${facName}`)
    }
  }

  const outlineForeshadowIds = (payload.outline ?? [])
    .filter((row) => outlineIdSet.has(s(row.id)))
    .flatMap((row) => (Array.isArray(row.foreshadowIds) ? row.foreshadowIds : []).map((id) => s(id)))
    .filter(Boolean)

  const outlineLocations = (payload.outline ?? [])
    .filter((row) => outlineIdSet.has(s(row.id)))
    .map((row) => s(row.location))
    .filter((loc) => loc.length >= 2)

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
        title: s(row.title),
        description: s(row.description).slice(0, 100),
        status: s(row.status),
        plantText: s(row.plantText).slice(0, 60),
        expectedCh: typeof row.expectedFulfillChapterNo === 'number' ? row.expectedFulfillChapterNo : undefined,
        expectedNotes: s(row.expectedFulfillNotes).slice(0, 60),
      })),
    ['title'],
  ).slice(0, 10)

  const novel = input.novel ?? {}
  const targetChars = Math.max(400, Math.min(6000, Math.trunc(Number(input.targetChars ?? 1500))))

  // 重写专用：汇总本章「必须保留的出口事实」——章总结、本章绑定大纲节点的结果性字段、本章埋下的伏笔。
  // 这些是后续章节可能依赖的既定结果，重写时只能改写法、不能改这些结论，否则后文会崩。
  const mustKeepLines = isRewrite
    ? (() => {
        const lines: string[] = []
        if (s(current.annotation)) lines.push(`本章原有章总结（核心事件，须保留其结果）：${s(current.annotation)}`)
        const boundOutline = (payload.outline ?? []).filter((row) => outlineIdSet.has(s(row.id)))
        for (const node of boundOutline) {
          const parts2 = [
            s(node.goal) ? `目标：${s(node.goal)}` : '',
            s(node.conflict) ? `冲突：${s(node.conflict)}` : '',
            s(node.twist) ? `转折：${s(node.twist)}` : '',
            s(node.result) ? `结果：${s(node.result)}` : '',
          ].filter(Boolean)
          if (parts2.length > 0) lines.push(`大纲节拍《${s(node.title)}》——${parts2.join('；')}`)
        }
        const plantedHere = foreshadowSource
          .filter((row) => s(row.plantChapterId) === s(current.id))
          .map((row) => s(row.title))
          .filter(Boolean)
        if (plantedHere.length > 0) lines.push(`本章埋下的伏笔（重写后仍须在本章埋下，不得丢失）：${plantedHere.join('、')}`)
        return lines
      })()
    : []

  const enableRag = input.enableRag !== false
  const ragHits =
    enableRag && currentIndex > 0
      ? buildContinueRagHits({
          chapters,
          currentChapterId: s(input.chapterId),
          characters: scopedCharacters,
          direction: s(input.direction),
          foreshadows: foreshadowSource,
          scanText,
          outlineForeshadowIds,
          outlineLocations,
        })
      : []
  if (enableRag && currentIndex > 0 && ragHits.length > 0) {
    const bySource = {
      character: ragHits.filter((row) => row.source === 'character').length,
      foreshadow: ragHits.filter((row) => row.source === 'foreshadow').length,
      location: ragHits.filter((row) => row.source === 'location').length,
    }
    const bits = [
      bySource.character > 0 ? `人物 ${bySource.character}` : '',
      bySource.foreshadow > 0 ? `伏笔 ${bySource.foreshadow}` : '',
      bySource.location > 0 ? `地点 ${bySource.location}` : '',
    ].filter(Boolean)
    warnings.push(
      `已从旧章检索 ${ragHits.length} 段（${bits.join('、')}；第 ${[...new Set(ragHits.map((row) => row.chapterNo))].join('、')} 章）。`,
    )
  } else if (enableRag && currentIndex >= 3) {
    warnings.push('旧章中未找到与当前人物/伏笔/地点匹配的正文片段。')
  }

  const beatTaskLine =
    beatPack.text && outlineIds.length > 0
      ? '必须落实【写作任务】与【大纲节拍路径】中的目标与悬念，禁止跳节或提前写完【后续节拍预告】。'
      : ''

  const parts: Record<string, string> = {
    instruction: isRewrite
      ? [
          '【重写要求】',
          '把下方【本章原文】整章重写一遍，输出一份从头到尾完整的本章新正文（不是续写片段、不是局部修改）。',
          `参考篇幅约 ${targetChars} 字（仅供参考，与原文大致相当即可，不要为凑字数注水）。`,
          '只改写法、过程、文笔、对话、细节、节奏；不得改变下方【必须保留的关键事实】里的任何结果。',
          beatTaskLine,
          s(input.direction) ? `作者的重写方向：${s(input.direction)}` : '作者未额外指定方向，请在保留关键事实的前提下提升文笔与可读性。',
          s(input.selectionQuote) ? `作者特别关注的片段：${s(input.selectionQuote)}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          '【续写要求】',
          `参考篇幅约 ${targetChars} 字（仅供参考，宁缺毋滥，不要为凑字数注水）。`,
          input.position === 'end' ? '续写位置：本章末尾之后。' : `续写位置：本章第 ${offset} 字处（光标处）之后。`,
          beatTaskLine,
          s(input.direction) ? `作者方向：${s(input.direction)}` : outlineIds.length > 0 ? '作者未额外指定方向，请严格按大纲节拍自然推进。' : '作者未额外指定方向，请自然推进当前场景。',
          s(input.selectionQuote) ? `引用片段：${s(input.selectionQuote)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
    must_keep:
      isRewrite && mustKeepLines.length > 0
        ? ['【必须保留的关键事实 —— 重写后这些结果不得改变，否则后续章节会对不上】', ...mustKeepLines].join('\n')
        : '',
    anchor: isRewrite
      ? ['【本章原文（供重写参考，你要整章重写它，不要保留原句）】', anchor].join('\n')
      : ['【锚点正文 —— 必须紧接其后续写，禁止重复】', anchor].join('\n'),
    golden_three:
      typeof current.chapterNo === 'number' && current.chapterNo <= 3
        ? [
            '【黄金三章铁律 —— 仅限前三章，必须严格执行】',
            '本章处于全书前三章，开局决定读者留存，按以下硬规则写：',
            '1. 主角必须在前 300 字内登场亮相。',
            '2. 第一个爽点或钩子必须在 1000 字内落地，不得延后。',
            '3. 禁止背景设定堆砌、禁止天气/景物式开场、禁止序章楔子、禁止旁白铺陈世界观。',
            '4. 出场主要角色不超过 3 个，信息密度服从"先抓人再交代"。',
            current.chapterNo === 1
              ? '5. 本章（第1章）必须明确点出主角的核心目标，并亮出全书最大卖点/钩子。'
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        : '',
    chapter_meta: [
      '【当前章】',
      `第 ${current.chapterNo} 章 ${s(current.title)}`,
      s(current.notes) ? `作者备注：${s(current.notes)}` : '',
      s(current.annotation) ? `章总结：${s(current.annotation)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    prev_tail: prev ? ['【上一章衔接（末尾）】', `第 ${prev.chapterNo} 章`, sliceTextTail(prev.content, 1100)].join('\n') : '',
    prev_summaries:
      prevSummaries.length > 0
        ? ['【前情提要】', ...prevSummaries.map((row) => `第 ${row.chapterNo} 章《${row.title}》：${row.summary}`)].join('\n')
        : '',
    bible_compact: [
      `【角色当前状态（截至第 ${current.chapterNo} 章，视为事实基准，续写须与此一致，不得回退或矛盾）】`,
      characters.length > 0 ? `角色：${stableStringify(characters)}` : '',
      membershipLines.length > 0 ? `势力归属：${membershipLines.join('；')}` : '',
      relations.length > 0 ? `关系：${stableStringify(relations)}` : '',
      relevantForeshadows.length > 0 ? `伏笔：${stableStringify(relevantForeshadows)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    outline_beat_path: beatPack.text ? beatPack.text : '',
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
    continuity_brief: s(novel.continuityBrief).trim()
      ? ['【全书连续性摘要】', s(novel.continuityBrief).trim()].join('\n')
      : '',
    arc_context: buildArcContext(novel.arcSummaries ?? [], payload.outline ?? [], outlineIds),
    rag_snippets: formatContinueRagSnippetsForPrompt(ragHits),
  }

  const trimOrder =
    beatPack.text && outlineIds.length > 0
      ? ['novel_brief', 'arc_context', 'continuity_brief', 'prev_tail', 'prev_summaries', 'rag_snippets', 'bible_compact', 'outline_beat_path']
      : ['novel_brief', 'outline_beat_path', 'arc_context', 'continuity_brief', 'prev_tail', 'prev_summaries', 'rag_snippets', 'bible_compact']

  const { pack, dropped } = trimContinuePack(parts, trimOrder, CONTINUE_INPUT_CHAR_BUDGET)
  if (dropped.length > 0) {
    warnings.push(`上下文过长，已省略：${dropped.join('、')}`)
  }

  // 拆分为「稳定上下文」与「动态正文任务」两条消息：
  // 稳定块仅含全书级别基本不变的信息（作品信息/连续性/弧线），
  // 单独成一条消息置于动态块之前，使其落入可命中 DeepSeek 前缀缓存的稳定前缀；
  // 动态块含本次续写的所有章相关内容（大纲节拍/前情/档案/锚点/指令/检索片段）。
  const contextOrder = ['novel_brief', 'continuity_brief', 'arc_context']
  const dynamicOrder = ['outline_beat_path', 'bible_compact', 'prev_summaries', 'prev_tail', 'instruction', 'must_keep', 'golden_three', 'chapter_meta', 'anchor', 'rag_snippets']

  const contextPrompt = contextOrder
    .map((key) => pack[key])
    .filter(Boolean)
    .join('\n\n')

  const prompt = dynamicOrder
    .map((key) => pack[key])
    .filter(Boolean)
    .join('\n\n')

  const usedLayers = Object.keys(pack).filter((key) => Boolean(pack[key]?.trim()))
  const usedChars = estimatePackChars(pack)

  return { prompt, contextPrompt, warnings, droppedLayers: dropped, usedLayers, usedChars, ragHits }
}

export async function continueChapterFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    chapterId: string
    position: 'cursor' | 'end' | 'replace'
    cursorOffset?: number
    targetChars?: number
    direction?: string
    selectionQuote?: string
    novel?: {
      title?: string
      summary?: string
      continuityBrief?: string
      arcSummaries?: ArcSummary[]
      genre?: string
      perspective?: string
      tone?: string
    }
    aiStylePrompt?: string
    prevSummaryCount?: number
    enableRag?: boolean
  },
  callbacks: {
    onChunk: (text: string) => void
    onError: (err: Error) => void
    onReasoningChunk?: (text: string) => void
  },
  signal?: AbortSignal,
): Promise<ContinueChapterResult> {
  const { prompt, contextPrompt, warnings, droppedLayers, usedLayers, usedChars, ragHits } = buildContinueUserPrompt(payload, input)
  if (!prompt || prompt === '没有可续写的章节正文。') {
    return { text: '', warnings, droppedLayers, usedLayers, usedChars, ragHits }
  }

  // 中文约 1.5-2 token/字，预留 2.5x 空间；DeepSeek 默认 4096 太小会导致输出被截断
  const targetChars = Math.max(400, Math.min(6000, Math.trunc(Number(input.targetChars ?? 1500))))
  const maxTokens = Math.max(4096, Math.min(16384, Math.ceil(targetChars * 2.5)))

  // 取当前章所属的 novelId，供后端做语义向量检索（补充相关前文）
  const currentChapter = (payload.chapters ?? []).find((c) => c.id === input.chapterId)
  const novelId = currentChapter?.novelId || undefined

  const { text } = await postAiPromptStream({
    prompt_type: input.position === 'replace' ? 'rewrite' : 'continue',
    novel_id: novelId,
    user_prompt: prompt,
    context_prompt: contextPrompt || undefined,
    ai_style_prompt: input.aiStylePrompt,
    temperature: 0.8,
    presence_penalty: 0.3,
    frequency_penalty: 0.3,
    max_tokens: maxTokens,
  }, callbacks, signal)
  return {
    text: text.trim(),
    warnings,
    droppedLayers,
    usedLayers,
    usedChars,
    ragHits,
  }
}

export async function summarizeNovelContinuityBriefFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    novel?: { title?: string; summary?: string; continuityBrief?: string }
    maxChapterSummaries?: number
  },
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<string> {
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const maxRows = Math.max(5, Math.min(40, Math.trunc(Number(input.maxChapterSummaries ?? 24))))
  const summaries = chapters
    .map((row) => ({
      chapterNo: row.chapterNo,
      title: s(row.title),
      summary: s(row.annotation).trim() || sliceTextExcerpt(row.content, 280),
    }))
    .filter((row) => row.summary)
    .slice(-maxRows)

  if (summaries.length === 0) {
    callbacks.onError(new Error('尚无章节总结或正文，无法生成全书连续性摘要。请先为若干章撰写或生成章总结。'))
    return ''
  }

  const novel = input.novel ?? {}
  const prompt = [
    s(novel.title) ? `书名：${s(novel.title)}` : '',
    s(novel.summary) ? `作品简介：${s(novel.summary)}` : '',
    s(novel.continuityBrief) ? `现有连续性摘要（可在此基础上更新）：${s(novel.continuityBrief)}` : '',
    `各章总结（共 ${summaries.length} 章）：${stableStringify(summaries)}`,
    `角色与伏笔概况：${stableStringify({
      characters: stableSortByKeys(
        (payload.characters ?? []).slice(0, 18).map((row) => ({ name: s(row.name), goal: s(row.goal), notes: s(row.notes).slice(0, 80) })),
        ['name'],
      ),
      foreshadows: stableSortByKeys(
        (payload.foreshadows ?? []).slice(0, 10).map((row) => ({ title: s(row.title), description: s(row.description).slice(0, 100) })),
        ['title'],
      ),
    })}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const { text } = await postAiPromptStream({
    prompt_type: 'continuity_brief',
    user_prompt: prompt,
    temperature: 0.3,
  }, callbacks, signal)
  return text.trim()
}

function selectedChapters(payload: WorkspaceSnapshotPayload, mode: AiExtractMode, chapterIds?: string[]) {
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const ids = new Set((chapterIds ?? []).map((row) => s(row)).filter(Boolean))
  if (ids.size > 0) return chapters.filter((row) => ids.has(s(row.id)))
  if (mode === 'all') return chapters
  if (mode === 'recent') return chapters.slice(-3)
  return chapters.length > 0 ? [chapters[chapters.length - 1]] : []
}

function compactAttributes(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => ({
      key: s((row as JsonRecord)?.key),
      value: s((row as JsonRecord)?.value),
    }))
    .filter((row) => row.key && row.value)
}

function compareText(a: unknown, b: unknown): number {
  return s(a).localeCompare(s(b), 'zh-Hans')
}

function compareNumbers(a: unknown, b: unknown): number {
  const left = Number(a)
  const right = Number(b)
  const safeLeft = Number.isFinite(left) ? left : Number.MAX_SAFE_INTEGER
  const safeRight = Number.isFinite(right) ? right : Number.MAX_SAFE_INTEGER
  return safeLeft - safeRight
}

function stableSortByKeys<T extends JsonRecord>(rows: T[], keys: string[]): T[] {
  return [...rows].sort((left, right) => {
    for (const key of keys) {
      const a = left?.[key]
      const b = right?.[key]
      const numDiff = compareNumbers(a, b)
      if (Number.isFinite(Number(a)) || Number.isFinite(Number(b))) {
        if (numDiff !== 0) return numDiff
      }
      const textDiff = compareText(a, b)
      if (textDiff !== 0) return textDiff
    }
    return 0
  })
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current
    const out: JsonRecord = {}
    for (const key of Object.keys(current).sort((a, b) => a.localeCompare(b))) {
      out[key] = (current as JsonRecord)[key]
    }
    return out
  })
}

function buildExtractContext(payload: WorkspaceSnapshotPayload, mode: AiExtractMode, chapterIds?: string[]) {
  const chapters = stableSortByKeys(
    selectedChapters(payload, mode, chapterIds).map((row) => ({
      id: row.id,
      chapterNo: row.chapterNo,
      title: row.title,
      content: row.content,
      notes: row.notes,
      annotation: row.annotation,
    })),
    ['chapterNo', 'id', 'title'],
  )
  const characters = stableSortByKeys(
    (payload.characters ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      aliases: [...(row.aliases ?? [])].sort((a, b) => compareText(a, b)),
      gender: row.gender,
      age: row.age,
      goal: row.goal,
      secret: row.secret,
      arc: row.arc,
      notes: row.notes,
      attributes: stableSortByKeys(compactAttributes(row.attributes), ['key', 'value']),
      firstAppearanceChapterNo: row.firstAppearanceChapterNo ?? null,
      categoryIds: [...(row.categoryIds ?? [])].sort((a, b) => compareText(a, b)),
    })),
    ['name', 'id'],
  )
  const factions = stableSortByKeys(
    (payload.factions ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      leader: row.leader,
      notes: row.notes,
      attributes: stableSortByKeys(compactAttributes(row.attributes), ['key', 'value']),
      categoryIds: [...(row.categoryIds ?? [])].sort((a, b) => compareText(a, b)),
    })),
    ['name', 'id'],
  )
  const items = stableSortByKeys(
    (payload.items ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      summary: row.summary,
      ownerType: row.ownerType ?? null,
      ownerId: row.ownerId ?? null,
      firstAppearanceChapterNo: row.firstAppearanceChapterNo ?? null,
      attributes: stableSortByKeys(compactAttributes(row.attributes), ['key', 'value']),
    })),
    ['name', 'id'],
  )
  const categories = stableSortByKeys(
    (payload.categories ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      notes: row.notes,
    })),
    ['name', 'id'],
  )
  const foreshadows = stableSortByKeys(
    (payload.foreshadows ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      plantText: row.plantText,
      fulfillments: stableSortByKeys(
        Array.isArray(row.fulfillments)
          ? row.fulfillments.map((item) => ({
              chapterId: item.fulfillChapterId,
              chapterNo: item.fulfillChapterNo,
              text: item.fulfillText,
            }))
          : [],
        ['chapterNo', 'chapterId', 'text'],
      ),
    })),
    ['title', 'id'],
  )
  const characterRelations = stableSortByKeys(
    (payload.characterRelations ?? []).map((row) => ({
      id: row.id,
      fromCharacterId: row.fromCharacterId,
      toCharacterId: row.toCharacterId,
      relationType: row.relationType,
      note: row.note ?? '',
    })),
    ['fromCharacterId', 'toCharacterId', 'relationType', 'id'],
  )
  const characterFactionMemberships = stableSortByKeys(
    (payload.characterFactionMemberships ?? []).map((row) => ({
      id: row.id,
      characterId: row.characterId,
      factionId: row.factionId,
      description: row.description,
    })),
    ['characterId', 'factionId', 'id'],
  )

  return {
    chapters,
    characters,
    factions,
    items,
    categories,
    foreshadows,
    characterRelations,
    characterFactionMemberships,
  }
}

function compactChapterExcerpt(text: string, limit = 360): string {
  const normalized = s(text).replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, Math.max(0, limit - 1)).trim()}...`
}

function selectRelevantPrevSummaries(
  chapters: Chapter[],
  currentIndex: number,
  maxCount: number,
  outline: OutlineItem[],
  arcSummaries: ArcSummary[],
): Array<{ chapterNo: number; title: string; summary: string }> {
  if (currentIndex <= 0 || maxCount <= 0) return []

  const current = chapters[currentIndex]
  const currentOutlineIds = new Set((current.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean))

  // 找到当前章节所属的弧线
  const currentArcId = findArcForChapter(currentOutlineIds, outline, arcSummaries)

  const result: Array<{ chapterNo: number; title: string; summary: string }> = []
  const addedChapterNos = new Set<number>()

  // 1. 始终包含前一章摘要
  if (currentIndex > 0) {
    const prevChapter = chapters[currentIndex - 1]
    const summary = s(prevChapter.annotation).trim()
    result.push({
      chapterNo: prevChapter.chapterNo,
      title: s(prevChapter.title),
      summary: summary || sliceTextExcerpt(prevChapter.content, 360),
    })
    addedChapterNos.add(prevChapter.chapterNo)
  }

  // 2. 如果当前章是新弧线开头，包含上一弧线最后一章
  if (currentArcId && currentIndex > 1) {
    const prevChapter = chapters[currentIndex - 1]
    const prevArcId = findArcForChapter(
      new Set((prevChapter.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)),
      outline,
      arcSummaries,
    )
    if (prevArcId && prevArcId !== currentArcId) {
      // 找上一弧线的最后一章
      for (let i = currentIndex - 2; i >= 0; i--) {
        const ch = chapters[i]
        const chArcId = findArcForChapter(
          new Set((ch.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)),
          outline,
          arcSummaries,
        )
        if (chArcId === prevArcId && !addedChapterNos.has(ch.chapterNo)) {
          const summary = s(ch.annotation).trim()
          result.push({
            chapterNo: ch.chapterNo,
            title: s(ch.title),
            summary: summary || sliceTextExcerpt(ch.content, 360),
          })
          addedChapterNos.add(ch.chapterNo)
          break
        }
      }
    }
  }

  // 3. 从当前弧线中选择相关章节摘要
  if (currentArcId && result.length < maxCount) {
    for (let i = currentIndex - 2; i >= 0 && result.length < maxCount; i--) {
      const ch = chapters[i]
      if (addedChapterNos.has(ch.chapterNo)) continue
      const chArcId = findArcForChapter(
        new Set((ch.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)),
        outline,
        arcSummaries,
      )
      if (chArcId === currentArcId) {
        const summary = s(ch.annotation).trim()
        result.push({
          chapterNo: ch.chapterNo,
          title: s(ch.title),
          summary: summary || sliceTextExcerpt(ch.content, 360),
        })
        addedChapterNos.add(ch.chapterNo)
      }
    }
  }

  // 4. 如果还不够，从更早的章节补充
  for (let i = currentIndex - 2; i >= 0 && result.length < maxCount; i--) {
    const ch = chapters[i]
    if (addedChapterNos.has(ch.chapterNo)) continue
    const summary = s(ch.annotation).trim()
    result.push({
      chapterNo: ch.chapterNo,
      title: s(ch.title),
      summary: summary || sliceTextExcerpt(ch.content, 360),
    })
    addedChapterNos.add(ch.chapterNo)
  }

  // 按章节号排序
  return result.sort((a, b) => a.chapterNo - b.chapterNo)
}

function findArcForChapter(
  chapterOutlineIds: Set<string>,
  outline: OutlineItem[],
  arcSummaries: ArcSummary[],
): string | null {
  for (const outlineId of chapterOutlineIds) {
    let current = outline.find((o) => o.id === outlineId)
    while (current) {
      const arc = arcSummaries.find((a) => a.arcId === current!.id)
      if (arc) return arc.arcId
      current = current.parentId ? outline.find((o) => o.id === current!.parentId) : undefined
    }
  }
  return null
}

function buildArcContext(
  arcSummaries: ArcSummary[],
  outline: OutlineItem[],
  currentOutlineIds: string[],
): string {
  if (arcSummaries.length === 0) return ''

  const outlineIdSet = new Set(currentOutlineIds)

  // 找到当前章节所属的弧线
  const currentArc = arcSummaries.find((arc) => {
    // 检查当前大纲节点是否在这个弧线的子节点中
    return currentOutlineIds.some((id) => {
      let current = outline.find((o) => o.id === id)
      while (current) {
        if (current.id === arc.arcId) return true
        current = current.parentId ? outline.find((o) => o.id === current!.parentId) : undefined
      }
      return false
    })
  })

  const lines: string[] = []

  if (currentArc) {
    lines.push(`【当前篇章：${currentArc.title}】`)
    lines.push(currentArc.summary)
  }

  // 其他弧线的一行概要
  const otherArcs = arcSummaries.filter((arc) => arc.arcId !== currentArc?.arcId)
  if (otherArcs.length > 0) {
    lines.push('')
    lines.push('【其他篇章概览】')
    for (const arc of otherArcs) {
      const preview = arc.summary.length > 60 ? `${arc.summary.slice(0, 60)}...` : arc.summary
      lines.push(`${arc.title}：${preview}`)
    }
  }

  return lines.join('\n')
}

function buildNearbyChapterContext(payload: WorkspaceSnapshotPayload, chapterIds?: string[]) {
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const ids = (chapterIds ?? []).map((row) => s(row)).filter(Boolean)
  if (chapters.length === 0 || ids.length === 0) return []

  const idSet = new Set(ids)
  const picked = new Set<number>()
  for (const id of ids) {
    const index = chapters.findIndex((chapter) => s(chapter.id) === id)
    if (index < 0) continue
    if (index > 0) picked.add(index - 1)
    picked.add(index)
    if (index < chapters.length - 1) picked.add(index + 1)
  }

  return [...picked].sort((a, b) => a - b).map((index) => {
    const chapter = chapters[index]
    return {
      id: chapter.id,
      chapterNo: chapter.chapterNo,
      title: chapter.title,
      annotation: chapter.annotation,
      notes: chapter.notes,
      role: idSet.has(s(chapter.id)) ? 'current' : index < chapters.findIndex((row) => idSet.has(s(row.id))) ? 'previous' : 'next',
      excerpt: compactChapterExcerpt(chapter.content, idSet.has(s(chapter.id)) ? 520 : 260),
    }
  })
}

/** 通过 /ai/prompt 接口调用 AI，系统提示词由后端组装 */
async function callAiPromptJson(
  promptType: string,
  userPrompt: string,
  options?: { temperature?: number; aiStylePrompt?: string; maxTokens?: number },
): Promise<JsonRecord> {
  assertAiReady()
  const result = await postAiPrompt({
    prompt_type: promptType,
    user_prompt: userPrompt,
    ai_style_prompt: options?.aiStylePrompt,
    temperature: options?.temperature,
    max_tokens: options?.maxTokens ?? 8192,
    response_format: 'json',
  })
  const content = result.content
  if (typeof content === 'string' && content) return parseAiJsonContent(content)
  throw new Error('AI 返回格式无效')
}

export type CharacterStateExtractResult = {
  updated: Array<{ characterId: string; name: string; state: CharacterNarrativeState }>
  warnings: string[]
}

/**
 * 角色状态机抽取：写完一章后，让 AI 抽取本章中状态发生变化的角色，
 * 写入逐章叙事状态历史(narrativeState)，供续写时注入"截至当前章的真实现状"。
 * 仅记录本章真有变化的角色(增量)，无变化不写。
 */

export async function generateStoryboardFromPayload(
  payload: WorkspaceSnapshotPayload,
  chapterId: string,
): Promise<Storyboard> {
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const chapter = chapters.find((c) => c.id === chapterId)
  if (!chapter) throw new Error('找不到目标章节')
  if (!chapter.content?.trim()) throw new Error('本章没有正文')

  // 场景素材（含多视图）
  const scenes = (payload.scenes ?? []).map((s) => ({
    id: s.id, name: s.name, description: (s.description ?? '').slice(0, 200),
    views: (s.views ?? []).map((v) => ({ id: v.id, kind: v.kind, description: v.description })),
  }))

  // 角色素材（含多视图）
  const characters = (payload.characters ?? []).slice(0, 20).map((c) => ({
    id: c.id, name: c.name, aliases: c.aliases ?? [], gender: c.gender, age: c.age,
    views: (c.views ?? []).map((v) => ({ id: v.id, kind: v.kind, description: v.description })),
  }))

  // 物品素材
  const items = (payload.items ?? []).slice(0, 10).map((i) => ({
    id: i.id, name: i.name, summary: (i.summary ?? '').slice(0, 150),
    views: (i.views ?? []).map((v) => ({ id: v.id, kind: v.kind, description: v.description })),
  }))

  const prompt = [
    '你是分镜师。请把以下小说章节拆成分镜表。',
    '',
    `--- 本章正文（第${chapter.chapterNo ?? 1}章）---`,
    chapter.content.slice(0, 4000),
    '',
    '--- 可用场景 ---',
    stableStringify(scenes),
    '',
    '--- 可用角色 ---',
    stableStringify(characters),
    '',
    '--- 可用物品 ---',
    stableStringify(items),
    '',
    '角色必须从上述列表选取（不要编造不存在的角色）；物品同理。场景优先使用列表中的，但如果剧情需要的场景列表中没有，可直接用 sceneDescription 字段自由描述场景（不要 sceneId）。如果某个角色有 views，请为每个镜头指定该角色应使用的视图的 id（不同机位用不同视图）。没有适合的视图则不指定 assetViewIds。',
    '',
    '输出 JSON 格式:',
    '{"shots": [{"order":1,"sceneId":"...（可选）","sceneViewId":"...（可选）","sceneDescription":"...（无sceneId时描述场景）","characterIds":["..."],"assetViewIds":["..."],"itemIds":["..."],"shotType":"wide|medium|closeup|establishing","action":"动作描述","dialogue":"台词或旁白","emotion":"情绪"}]}',
    'shotType: establishing=建立镜头空镜 wide=远景 medium=中景 closeup=特写',
    'action 写角色做了什么，dialogue 写台词或旁白，emotion 写情绪基调，没有的留空。',
    '每个镜头只保留真正出场的角色，不要塞无关 id。',
  ].join('\n')

  const raw = await callAiPromptJson('qa', prompt, { temperature: 0.5, maxTokens: 8192 })
  const shots: Shot[] = (Array.isArray(raw.shots) ? raw.shots : [])
    .filter((s: any) => s && typeof s.order === 'number')
    .sort((a: any, b: any) => a.order - b.order)
    .map((s: any, i: number) => ({
      id: uid(),
      order: s.order ?? i + 1,
      sceneId: String(s.sceneId ?? '').trim() || undefined,
      sceneViewId: String(s.sceneViewId ?? '').trim() || undefined,
      sceneDescription: String(s.sceneDescription ?? '').trim() || undefined,
      characterIds: Array.isArray(s.characterIds) ? s.characterIds.map(String) : [],
      assetViewIds: Array.isArray(s.assetViewIds) ? s.assetViewIds.map(String) : [],
      itemIds: Array.isArray(s.itemIds) ? s.itemIds.map(String) : [],
      shotType: (['closeup', 'medium', 'wide', 'establishing'].includes(s.shotType) ? s.shotType : undefined) as Shot['shotType'],
      action: String(s.action ?? '').trim() || undefined,
      dialogue: String(s.dialogue ?? '').trim() || undefined,
      emotion: String(s.emotion ?? '').trim() || undefined,
    }))

  const now = new Date().toISOString()
  return {
    id: uid(),
    novelId: chapter.novelId || '',
    chapterId: chapter.id,
    chapterTitle: chapter.title || undefined,
    chapterNo: chapter.chapterNo,
    shots,
    createdAt: now,
    updatedAt: now,
  }
}

export async function runCharacterStateExtract(
  payload: WorkspaceSnapshotPayload,
  chapterId: string,
): Promise<CharacterStateExtractResult> {
  const warnings: string[] = []
  const updated: CharacterStateExtractResult['updated'] = []
  const chapters = [...(payload.chapters ?? [])].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const idx = chapters.findIndex((row) => s(row.id) === s(chapterId))
  const current = idx >= 0 ? chapters[idx] : null
  if (!current) return { updated, warnings: ['未找到目标章节，跳过角色状态抽取。'] }
  const content = String(current.content ?? '').trim()
  if (!content) return { updated, warnings: ['本章正文为空，跳过角色状态抽取。'] }
  const chapterNo = typeof current.chapterNo === 'number' ? current.chapterNo : idx + 1

  // 筛出场角色(限24人,复用续写同款逻辑)
  const characterSource = (payload.characters ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    aliases: row.aliases,
  }))
  const { rows: scoped } = pickCharactersForContinueContext(characterSource, content, [], 24)
  if (scoped.length === 0) return { updated, warnings: ['本章未匹配到出场角色，跳过。'] }

  // 每个出场角色附上"截至上一章"的已知状态，让 AI 做差分而非全量重述
  const prevById = new Map<string, { location: string; condition: string; knownInfo: string[]; possessions: string[] }>()
  const roster = scoped.map((row) => {
    const prev = getCharacterStateAtPosition(s(row.id), s(current.id), 0, chapters)
    const st = prev?.event?.narrativeState
    const prevState = st
      ? { location: s(st.location), condition: s(st.condition), knownInfo: st.knownInfo ?? [], possessions: st.possessions ?? [] }
      : { location: '', condition: '', knownInfo: [] as string[], possessions: [] as string[] }
    prevById.set(s(row.id), prevState)
    return {
      name: s(row.name),
      上一章状态: st ? prevState : null,
    }
  })

  const prompt = [
    `当前章节：第 ${chapterNo} 章 ${s(current.title)}`,
    `本章正文：\n${content.slice(0, 8000)}`,
    `本章出场角色及其截至上一章的已知状态 JSON：${stableStringify(roster)}`,
    '请只输出本章中状态发生变化的角色，格式遵循系统提示。',
    '额外要求：在每个角色对象里再加一个字段 "evidence"（字符串）——从【本章正文】里原样摘录一句最能体现该角色这次状态变化的话，且这句话里必须出现该角色的姓名或称呼（10～60 字，必须是正文中逐字存在的原文，不要改写、不要加引号）。若实在找不到含其姓名的原句，则摘录最贴近变化发生处的原文片段。',
  ].join('\n\n')

  let parsed: JsonRecord
  try {
    parsed = await callAiPromptJson('character_state_extract', prompt, { temperature: 0.2 })
  } catch (err) {
    return { updated, warnings: [`角色状态抽取失败：${err instanceof Error ? err.message : String(err)}`] }
  }

  const states = Array.isArray(parsed.states) ? parsed.states : []
  const nameToId = new Map<string, string>()
  for (const row of scoped) nameToId.set(s(row.name), s(row.id))

  // 角色 id -> 所有可匹配的名字/别名（长名优先，避免子串误命中）
  const labelsById = new Map<string, string[]>()
  for (const row of payload.characters ?? []) {
    const id = s(row.id)
    if (!id) continue
    const labels = Array.from(new Set([s(row.name), ...stringList(row.aliases)].filter(Boolean)))
      .sort((a, b) => b.length - a.length)
    if (labels.length > 0) labelsById.set(id, labels)
  }

  for (const raw of states as JsonRecord[]) {
    const name = s(raw.name)
    const charId = nameToId.get(name)
    if (!charId) {
      warnings.push(`抽取到未匹配的角色名「${name}」，已忽略。`)
      continue
    }
    const state: CharacterNarrativeState = {
      location: s(raw.location),
      condition: s(raw.condition),
      knownInfo: stringList(raw.knownInfo),
      possessions: stringList(raw.possessions),
      relationDelta: stringList(raw.relationDelta),
      chapterNo,
    }
    // 全空视为无变化，不写入
    if (!state.location && !state.condition && state.knownInfo.length === 0 && state.possessions.length === 0 && state.relationDelta.length === 0) {
      continue
    }

    // 用 evidence 原文 + 角色名定位真实锚点，使该位置的角色名变色
    const labels = labelsById.get(charId) ?? [name].filter(Boolean)
    const anchor = locateCharacterAnchor(content, labels, s(raw.evidence))

    // 与上一章状态差分，构造悬停可见的「改了什么」明细
    const prev = prevById.get(charId)
    const details = buildNarrativeChangeDetails(prev, state)

    recordCharacterChangeFields(charId, ['narrativeState'], {
      chapterId: s(current.id),
      anchorStart: anchor ? anchor.start : 0,
      anchorEnd: anchor ? anchor.end : undefined,
      details: details.length > 0 ? details : undefined,
      narrativeState: state,
    })
    updated.push({ characterId: charId, name, state })
  }
  return { updated, warnings }
}

/**
 * 用 AI 给出的 evidence 原文片段，在正文里定位该角色名出现的精确位置，
 * 作为本次状态变化的锚点（使该处角色名在叠加层中单独上色）。
 * 优先在 evidence 命中的区间内/附近找角色名；找不到则回退到全文首次出现。
 */
function locateCharacterAnchor(
  content: string,
  labels: string[],
  evidence: string,
): { start: number; end: number } | null {
  const text = content ?? ''
  if (!text) return null
  const cleanLabels = labels.map((l) => String(l ?? '').trim()).filter(Boolean)
  if (cleanLabels.length === 0) return null

  // evidence 命中区间（用于把锚点限定在变化发生处附近）
  let regionStart = -1
  let regionEnd = -1
  const ev = String(evidence ?? '').trim()
  if (ev) {
    const i = text.indexOf(ev)
    if (i >= 0) {
      regionStart = i
      regionEnd = i + ev.length
    }
  }

  const findLabelIn = (from: number, to: number): { start: number; end: number } | null => {
    let best: { start: number; end: number } | null = null
    for (const label of cleanLabels) {
      let idx = text.indexOf(label, Math.max(0, from))
      while (idx >= 0 && idx < to) {
        const cand = { start: idx, end: idx + label.length }
        if (!best || cand.start < best.start) best = cand
        idx = text.indexOf(label, idx + 1)
      }
    }
    return best
  }

  // 1) evidence 区间内找角色名
  if (regionStart >= 0) {
    const inRegion = findLabelIn(regionStart, regionEnd)
    if (inRegion) return inRegion
  }
  // 2) evidence 之后最近一次出现
  if (regionEnd >= 0) {
    const after = findLabelIn(regionEnd, text.length)
    if (after) return after
  }
  // 3) 全文首次出现
  const anywhere = findLabelIn(0, text.length)
  return anywhere
}

/** 上一章状态 vs 本章状态差分，生成悬停可见的变更明细。 */
function buildNarrativeChangeDetails(
  prev: { location: string; condition: string; knownInfo: string[]; possessions: string[] } | undefined,
  next: CharacterNarrativeState,
): CharacterChangeDetail[] {
  const details: CharacterChangeDetail[] = []
  const joinList = (arr: string[]): string => (arr ?? []).filter(Boolean).join('、')
  const pushStr = (field: string, location: string, before: string, after: string): void => {
    const a = String(after ?? '').trim()
    const b = String(before ?? '').trim()
    if (a && a !== b) details.push({ field, location, before: b, after: a })
  }
  const pushList = (field: string, location: string, beforeArr: string[], afterArr: string[]): void => {
    const after = joinList(afterArr)
    const before = joinList(beforeArr)
    if (after && after !== before) details.push({ field, location, before, after })
  }
  pushStr('location', '角色状态/所在位置', prev?.location ?? '', next.location)
  pushStr('condition', '角色状态/身心状态', prev?.condition ?? '', next.condition)
  pushList('possessions', '角色状态/持有物品', prev?.possessions ?? [], next.possessions)
  pushList('knownInfo', '角色状态/掌握信息', prev?.knownInfo ?? [], next.knownInfo)
  // relationDelta 是本章增量，无上一章基线
  if (next.relationDelta.length > 0) {
    details.push({ field: 'relationDelta', location: '角色状态/关系变化', before: '', after: joinList(next.relationDelta) })
  }
  return details
}

function isLikelyUnnamedDescriptor(name: string): boolean {
  const text = s(name)
  if (!text) return false
  if (/某人|路人|陌生人|神秘人|那人|此人|对方/.test(text)) return true
  return /(青年|少年|少女|男人|女人|老人|老者|汉子|女子|男孩|女孩|小子|丫头|书生|和尚|道士|掌柜|车夫|仆人|侍女|白衣|黑衣|灰袍|老头|壮汉)$/.test(text)
}

function matchByName(name: string, rows: JsonRecord[]): { row: JsonRecord | null; score: number } {
  let best: JsonRecord | null = null
  let bestScore = 0
  for (const row of rows) {
    const score = similarity(name, s(row.name))
    if (score > bestScore) {
      best = row
      bestScore = score
    }
  }
  return { row: best, score: bestScore }
}

function createMatch(type: EntityMatchType, target?: JsonRecord | null, fallbackName?: string): EntityMatch {
  return {
    type,
    targetId: target ? s(target.id) || null : null,
    targetName: target ? s(target.name) || fallbackName || null : fallbackName || null,
  }
}

function characterMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const rows = (payload.characters ?? []) as JsonRecord[]
  for (const row of rows) {
    if (normName(s(row.name)) === normName(s(entity.name))) {
      if (s(entity.gender) && s(row.gender) && s(entity.gender) !== s(row.gender)) return createMatch('conflict', row)
      return createMatch('update', row)
    }
  }
  for (const row of rows) {
    const aliases = stringList((row as JsonRecord).aliases)
    if (aliases.some((alias) => normName(alias) === normName(s(entity.name)))) return createMatch('possible_duplicate', row)
    if (isLikelyUnnamedDescriptor(s(entity.name)) && aliases.some((alias) => similarity(alias, s(entity.name)) >= 0.88)) {
      return createMatch('possible_duplicate', row)
    }
  }
  const best = matchByName(s(entity.name), rows)
  if (isLikelyUnnamedDescriptor(s(entity.name)) && best.row && best.score >= 0.88) {
    return createMatch('possible_duplicate', best.row)
  }
  if (best.row && best.score >= 0.92) {
    const left = normName(s(entity.name))
    const right = normName(s(best.row.name))
    if (left.includes(right) || right.includes(left)) {
      return createMatch('possible_duplicate', best.row)
    }
  }
  return createMatch('new')
}

function factionMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const rows = (payload.factions ?? []) as JsonRecord[]
  for (const row of rows) {
    if (normName(s(row.name)) === normName(s(entity.name))) {
      if (s(entity.leader) && s(row.leader) && s(entity.leader) !== s(row.leader)) return createMatch('conflict', row)
      return createMatch('update', row)
    }
  }
  const best = matchByName(s(entity.name), rows)
  return best.row && best.score >= 0.8 ? createMatch('possible_duplicate', best.row) : createMatch('new')
}

function itemMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const rows = (payload.items ?? []) as JsonRecord[]
  for (const row of rows) {
    if (normName(s(row.name)) === normName(s(entity.name))) return createMatch('update', row)
  }
  const best = matchByName(s(entity.name), rows)
  return best.row && best.score >= 0.8 ? createMatch('possible_duplicate', best.row) : createMatch('new')
}

function outlineItemMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const rows = (payload.outline ?? []) as JsonRecord[]
  const needle = normName(s(entity.title))
  if (!needle) return createMatch('new')
  for (const row of rows) {
    if (normName(s(row.title)) === needle) return createMatch('possible_duplicate', { ...row, name: s(row.title) })
  }
  const best = matchByName(s(entity.title), rows.map((row) => ({ ...row, name: s(row.title) })))
  return best.row && best.score >= 0.82 ? createMatch('possible_duplicate', best.row) : createMatch('new')
}

function membershipMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const memberships = (payload.characterFactionMemberships ?? []) as JsonRecord[]
  const characters = new Map(((payload.characters ?? []) as JsonRecord[]).map((row) => [s(row.id), row]))
  const factions = new Map(((payload.factions ?? []) as JsonRecord[]).map((row) => [s(row.id), row]))
  for (const row of memberships) {
    const character = characters.get(s(row.characterId))
    const faction = factions.get(s(row.factionId))
    if (!character || !faction) continue
    if (normName(s(character.name)) === normName(s(entity.characterName)) && normName(s(faction.name)) === normName(s(entity.factionName))) {
      return { type: 'update', targetId: s(row.id), targetName: `${s(character.name)} -> ${s(faction.name)}` }
    }
  }
  return createMatch('new')
}

function relationMatch(entity: JsonRecord, payload: WorkspaceSnapshotPayload): EntityMatch {
  const relations = (payload.characterRelations ?? []) as JsonRecord[]
  const characters = new Map(((payload.characters ?? []) as JsonRecord[]).map((row) => [s(row.id), row]))
  for (const row of relations) {
    const left = characters.get(s(row.fromCharacterId))
    const right = characters.get(s(row.toCharacterId))
    if (!left || !right) continue
    const same = normName(s(left.name)) === normName(s(entity.fromCharacterName)) && normName(s(right.name)) === normName(s(entity.toCharacterName))
    const reverse = normName(s(left.name)) === normName(s(entity.toCharacterName)) && normName(s(right.name)) === normName(s(entity.fromCharacterName))
    if (same) {
      if (s(entity.relationType) && s(row.relationType) && s(entity.relationType) !== s(row.relationType)) {
        return { type: 'conflict', targetId: s(row.id), targetName: `${s(left.name)} / ${s(right.name)}` }
      }
      return { type: 'update', targetId: s(row.id), targetName: `${s(left.name)} / ${s(right.name)}` }
    }
    if (reverse) {
      return { type: 'possible_duplicate', targetId: s(row.id), targetName: `${s(left.name)} / ${s(right.name)}（反向已存在）` }
    }
  }
  return createMatch('new')
}

function mergeCharacterRows(rows: NovelEntityExtractResult['characters']): NovelEntityExtractResult['characters'] {
  const merged: NovelEntityExtractResult['characters'] = []
  const consumed = new Set<number>()

  for (let index = 0; index < rows.length; index += 1) {
    if (consumed.has(index)) continue
    const current = rows[index]
    let next: ExtractedCharacter = {
      ...current,
      aliases: [...current.aliases],
      attributes: [...current.attributes],
      evidences: [...current.evidences],
      warnings: [...current.warnings],
    }

    for (let otherIndex = index + 1; otherIndex < rows.length; otherIndex += 1) {
      if (consumed.has(otherIndex)) continue
      const other = rows[otherIndex]
      if (!shouldMergeExtractedCharacters(next, other)) continue

      const primary =
        isLikelyUnnamedDescriptor(next.name) && !isLikelyUnnamedDescriptor(other.name) ? other : next
      const secondary = primary === next ? other : next

      next = {
        ...next,
        name: primary.name,
        aliases: uniqueStrings([next.name, other.name, ...next.aliases, ...other.aliases]).filter(
          (alias) => normName(alias) !== normName(primary.name),
        ),
        gender: primary.gender || secondary.gender,
        age: primary.age || secondary.age,
        goal: primary.goal || secondary.goal,
        secret: primary.secret || secondary.secret,
        arc: primary.arc || secondary.arc,
        notes: uniqueStrings([primary.notes, secondary.notes]).join('；'),
        attributes: uniqueStrings(
          [...primary.attributes, ...secondary.attributes].map((attr) => `${s(attr.key)}::${s(attr.value)}`),
        )
          .map((pair) => {
            const [key, ...rest] = pair.split('::')
            return { id: '', key: s(key), value: s(rest.join('::')) }
          })
          .filter((attr) => attr.key && attr.value),
        firstAppearanceChapterNo:
          primary.firstAppearanceChapterNo == null
            ? secondary.firstAppearanceChapterNo
            : secondary.firstAppearanceChapterNo == null
              ? primary.firstAppearanceChapterNo
              : Math.min(primary.firstAppearanceChapterNo, secondary.firstAppearanceChapterNo),
        confidence: Math.max(primary.confidence, secondary.confidence),
        identityStatus:
          primary.identityStatus === 'certain' && secondary.identityStatus === 'certain'
            ? 'certain'
            : primary.identityStatus === 'possible_same_person' || secondary.identityStatus === 'possible_same_person'
              ? 'possible_same_person'
              : 'uncertain',
        match: next.match.type === 'new' && other.match.type !== 'new' ? other.match : next.match,
        evidences: [...primary.evidences, ...secondary.evidences].slice(0, 8),
        warnings: enrichIdentityWarnings(
          primary.identityStatus === 'certain' && secondary.identityStatus === 'certain' ? 'certain' : 'uncertain',
          uniqueStrings([
            ...primary.warnings,
            ...secondary.warnings,
            `【待确认】已将「${secondary.name}」与「${primary.name}」合并为同一人物，请核对正文是否确为同一人。`,
          ]),
        ),
      }
      consumed.add(otherIndex)
    }

    merged.push(next)
  }

  return merged
}

export async function extractNovelEntitiesFromWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[] },
): Promise<NovelEntityExtractResult> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return { characters: [], factions: [], items: [], memberships: [], relations: [], outlineItems: [], warnings: ['没有可分析的章节正文'] }
  }

  const prompt = [
    `提取范围：${input.mode}`,
    '请严格按既定 JSON 结构输出结果。',
    '建议步骤：①通读章节正文列出所有出场人物（含绰号、职业称呼）；②每人一条 characters，禁止把他人写入 aliases；③再填关系/势力/物品。',
    '下面内容分为两部分：先给相对稳定的档案底座，再给本次最易变化的章节正文。请以章节正文为主，结合档案底座做增量提取。',
    `档案底座 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      categories: context.categories,
      foreshadows: context.foreshadows,
      characterRelations: context.characterRelations,
      characterFactionMemberships: context.characterFactionMemberships,
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
  ].join('\n')

  const raw = await callAiPromptJson('extract', prompt)
  const characters: NovelEntityExtractResult['characters'] = Array.isArray(raw.characters)
    ? raw.characters
        .filter((row: any) => s(row?.name))
        .map((row: any) => {
          const identityStatus = parseIdentityStatus(row.identityStatus ?? row.identity_status)
          const warnings = enrichIdentityWarnings(identityStatus, stringList(row.warnings))
          return {
            name: s(row.name),
            aliases: stringList(row.aliases),
            gender: s(row.gender),
            age: s(row.age),
            goal: s(row.goal),
            secret: s(row.secret),
            arc: s(row.arc),
            notes: s(row.notes),
            attributes: Array.isArray(row.attributes)
              ? row.attributes
                  .map((attr: any) => ({
                    id: '',
                    key: s(attr?.key),
                    value: s(attr?.value),
                  }))
                  .filter((attr: { id: string; key: string; value: string }) => attr.key && attr.value)
              : [],
            identityStatus,
            firstAppearanceChapterNo: i(row.firstAppearanceChapterNo ?? row.first_appearance_chapter_no),
            confidence: f(row.confidence),
            match: characterMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings,
          }
        })
    : []

  const archiveCharacters = (payload.characters ?? []) as JsonRecord[]

  return {
    characters: sanitizeExtractedCharacters(mergeCharacterRows(characters), archiveCharacters),
    factions: Array.isArray(raw.factions)
      ? raw.factions
          .filter((row: any) => s(row?.name))
          .map((row: any) => ({
            name: s(row.name),
            leader: s(row.leader),
            notes: s(row.notes),
            attributes: Array.isArray(row.attributes)
              ? row.attributes
                  .map((attr: any) => ({
                    id: '',
                    key: s(attr?.key),
                    value: s(attr?.value),
                  }))
                  .filter((attr: { id: string; key: string; value: string }) => attr.key && attr.value)
              : [],
            categoryNames: stringList(row.categoryNames ?? row.category_names),
            confidence: f(row.confidence),
            match: factionMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    items: Array.isArray(raw.items)
      ? raw.items
          .filter((row: any) => s(row?.name))
          .map((row: any) => ({
            name: s(row.name),
            summary: s(row.summary),
            ownerType: s(row.ownerType ?? row.owner_type) || null,
            ownerId: s(row.ownerId ?? row.owner_id) || null,
            ownerName: s(row.ownerName ?? row.owner_name),
            firstAppearanceChapterNo: i(row.firstAppearanceChapterNo ?? row.first_appearance_chapter_no),
            confidence: f(row.confidence),
            match: itemMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    memberships: Array.isArray(raw.memberships)
      ? raw.memberships
          .filter((row: any) => s(row?.characterName ?? row?.character_name) && s(row?.factionName ?? row?.faction_name))
          .map((row: any) => ({
            characterName: s(row.characterName ?? row.character_name),
            factionName: s(row.factionName ?? row.faction_name),
            description: s(row.description),
            confidence: f(row.confidence),
            match: membershipMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    relations: Array.isArray(raw.relations)
      ? raw.relations
          .filter((row: any) => s(row?.fromCharacterName ?? row?.from_character_name) && s(row?.toCharacterName ?? row?.to_character_name))
          .map((row: any) => ({
            fromCharacterName: s(row.fromCharacterName ?? row.from_character_name),
            toCharacterName: s(row.toCharacterName ?? row.to_character_name),
            relationType: s(row.relationType ?? row.relation_type),
            note: s(row.note),
            confidence: f(row.confidence),
            match: relationMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    outlineItems: Array.isArray(raw.outlineItems)
      ? raw.outlineItems
          .filter((row: any) => s(row?.title))
          .map((row: any) => ({
            title: s(row.title),
            summary: s(row.summary),
            level: s(row.level) || 'scene',
            estimatedChapters: i(row.estimatedChapters ?? row.estimated_chapters),
            confidence: f(row.confidence),
            match: outlineItemMatch(row, payload),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    warnings: stringList(raw.warnings),
  }
}

async function callAiMessagesStream(
  messages: AiMessage[],
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<string> {
  assertAiReady()
  const { text } = await postAiCompletionStream(
    { temperature: 0.25, messages },
    callbacks,
    signal,
  )
  return text
}

export async function analyzeNovelForeshadowsFromWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[]; focusQuote?: string },
): Promise<NovelForeshadowAnalysisResult> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return { newPlants: [], fulfillments: [], danglingThreads: [], warnings: ['没有可分析的章节正文'] }
  }

  const prompt = [
    `分析范围：${input.mode}`,
    '请严格按既定 JSON 结构输出结果。',
    '下面内容分为三部分：已有伏笔与档案底座、相关剧情大纲、当前最需要判断的章节正文。',
    ...(s(input.focusQuote) ? [`重点关注片段：${s(input.focusQuote)}`] : []),
    `伏笔与档案 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      categories: context.categories,
      foreshadows: context.foreshadows,
    })}`,
    `大纲与时间线 JSON：${stableStringify({
      outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        goal: row.goal,
        conflict: row.conflict,
        twist: row.twist,
        result: row.result,
        suspense: row.suspense,
        plotStage: row.plotStage,
        foreshadowIds: row.foreshadowIds ?? [],
      })), ['id', 'title']),
      timelineEvents: stableSortByKeys((payload.timelineEvents ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        storyLabel: row.storyLabel,
        chapterNoStart: row.chapterNoStart,
        chapterNoEnd: row.chapterNoEnd,
      })), ['storyLabel', 'chapterNoStart', 'title', 'id']),
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
    `补充上下文 JSON：${stableStringify({
      nearbyChapters: buildNearbyChapterContext(payload, input.chapterIds),
    })}`,
  ].join('\n')

  const raw = await callAiPromptJson('foreshadow', prompt)
  return {
    newPlants: Array.isArray(raw.newPlants)
      ? raw.newPlants
          .filter((row: any) => s(row?.title))
          .map((row: any) => ({
            title: s(row.title),
            summary: s(row.summary),
            payoffHint: s(row.payoffHint ?? row.payoff_hint),
            confidence: f(row.confidence),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    fulfillments: Array.isArray(raw.fulfillments)
      ? raw.fulfillments
          .filter((row: any) => s(row?.title))
          .map((row: any) => ({
            title: s(row.title),
            summary: s(row.summary),
            relatedPlantTitle: s(row.relatedPlantTitle ?? row.related_plant_title),
            status: s(row.status) === 'implicit' ? 'implicit' : 'existing',
            confidence: f(row.confidence),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    danglingThreads: Array.isArray(raw.danglingThreads)
      ? raw.danglingThreads
          .filter((row: any) => s(row?.title))
          .map((row: any) => ({
            title: s(row.title),
            summary: s(row.summary),
            lastMentionChapterNo: i(row.lastMentionChapterNo ?? row.last_mention_chapter_no),
            suggestedPayoff: s(row.suggestedPayoff ?? row.suggested_payoff),
            confidence: f(row.confidence),
            evidences: normalizeEvidences(row.evidences),
            warnings: stringList(row.warnings),
          }))
      : [],
    warnings: stringList(raw.warnings),
  }
}

/**
 * 计算"已写"大纲节点 id 集合：被任意章节通过 outlineItemIds 绑定的节点，
 * 或 status==='done' 的节点，视为已写，动态回写禁止修改它们。
 */
function collectWrittenOutlineIds(payload: WorkspaceSnapshotPayload): Set<string> {
  const written = new Set<string>()
  for (const ch of payload.chapters ?? []) {
    for (const oid of ch.outlineItemIds ?? []) {
      const id = s(oid)
      if (id) written.add(id)
    }
  }
  for (const item of payload.outline ?? []) {
    if (s(item.status) === 'done') {
      const id = s(item.id)
      if (id) written.add(id)
    }
  }
  return written
}

/**
 * 动态大纲回写：对照已写正文与现有大纲，让未写节点贴合已发生剧情，
 * 并在剧情超出原大纲覆盖时补充后续节拍。绝不改动已写节点（prompt 铁律 + TS 侧二次过滤）。
 */
export async function rewriteOutlineFromProgressByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: AiExtractMode
    chapterIds?: string[]
    novel?: { title?: string; summary?: string; continuityBrief?: string; genre?: string }
  },
): Promise<OutlineRewriteResult> {
  const outlineAll = payload.outline ?? []
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0 || outlineAll.length === 0) {
    return { revisions: [], additions: [], warnings: outlineAll.length === 0 ? ['本作品还没有大纲，无法动态回写'] : ['没有可分析的章节正文'] }
  }

  const writtenIds = collectWrittenOutlineIds(payload)

  const outlineForAi = stableSortByKeys(
    outlineAll.map((row) => ({
      id: s(row.id),
      parentId: s(row.parentId) || null,
      order: typeof row.order === 'number' ? row.order : null,
      level: s(row.level) || 'scene',
      status: s(row.status),
      title: s(row.title),
      summary: s(row.summary),
      goal: s(row.goal),
      conflict: s(row.conflict),
      twist: s(row.twist),
      result: s(row.result),
      suspense: s(row.suspense),
      tension: typeof row.tension === 'number' ? row.tension : null,
      written: writtenIds.has(s(row.id)),
    })),
    ['order', 'id'],
  )

  const prompt = [
    `分析范围：${input.mode}`,
    '请严格按既定 JSON 结构输出结果。',
    '下面内容分为三部分：现有大纲（每个节点带 id 与 written 标记）、已写正文（章总结/正文）、作品信息。',
    `现有大纲 JSON：${stableStringify({ outline: outlineForAi })}`,
    `已写正文 JSON：${stableStringify({
      chapters: context.chapters.map((row) => ({
        chapterNo: row.chapterNo,
        title: row.title,
        summary: s(row.annotation).trim() || compactChapterExcerpt(row.content, 600),
      })),
    })}`,
    `作品信息 JSON：${stableStringify({
      title: s(input.novel?.title),
      summary: s(input.novel?.summary),
      continuityBrief: s(input.novel?.continuityBrief),
      genre: s(input.novel?.genre),
    })}`,
    '只对 written=false 的节点提出 revisions；additions 仅在已写剧情已超出原大纲覆盖、后续无节点承接时补充。',
  ].join('\n')

  const raw = await callAiPromptJson('outline_rewrite', prompt, { temperature: OUTLINE_DESIGN_JSON_TEMPERATURE })

  const writableLevels = new Set<OutlineNodeLevel>(['volume', 'act', 'chapter', 'scene'])
  const levelById = new Map<string, OutlineNodeLevel>()
  for (const row of outlineAll) {
    const lvl = s(row.level) as OutlineNodeLevel
    levelById.set(s(row.id), writableLevels.has(lvl) ? lvl : 'scene')
  }
  const revisions = (Array.isArray(raw.revisions) ? raw.revisions : [])
    .map((row: any) => {
      const id = s(row?.id)
      if (!id) return null
      // 双保险：丢弃任何指向已写节点的修订，以及大纲里不存在的 id
      if (writtenIds.has(id)) return null
      if (!outlineAll.some((item) => s(item.id) === id)) return null
      const out: any = { id, reason: s(row.reason) }
      for (const field of ['title', 'summary', 'goal', 'conflict', 'twist', 'result', 'suspense'] as const) {
        if (row[field] !== undefined && s(row[field])) out[field] = s(row[field])
      }
      if (typeof row.tension === 'number') out.tension = row.tension
      return out
    })
    .filter(Boolean)
    // 仅保留确实带改动字段的修订（除 id/reason 外至少一个字段）
    .filter((row: any) => Object.keys(row).some((k) => k !== 'id' && k !== 'reason'))

  const additionWarnings: string[] = []
  const additions = (Array.isArray(raw.additions) ? raw.additions : [])
    .map((row: any, index: number) => {
      const title = s(row?.title)
      if (!title) return null
      const rawLevel = s(row.level) as OutlineNodeLevel
      const level: OutlineNodeLevel = writableLevels.has(rawLevel) ? rawLevel : 'chapter'

      const parentId = s(row.parentOutlineId)
      const hasParent = !!parentId && outlineAll.some((item) => s(item.id) === parentId)
      const parentLevel = hasParent ? levelById.get(parentId) ?? null : null

      // 父级合法性校验：场景/章必须挂在合法父级下；卷可无父。非法的丢弃并记 warning，防孤儿。
      if (level !== 'volume') {
        if (!hasParent || !isValidParentLevel(level, parentLevel)) {
          additionWarnings.push(
            `已忽略新增「${title}」：${level} 缺少合法父级（应挂在 ${parentLevelHint(level)} 下）`,
          )
          return null
        }
      }

      const out: any = {
        tempId: s(row.tempId) || `add-${index + 1}`,
        title,
        summary: s(row.summary),
        level,
      }
      const afterId = s(row.afterOutlineId)
      if (afterId && outlineAll.some((item) => s(item.id) === afterId)) out.afterOutlineId = afterId
      if (hasParent) out.parentOutlineId = parentId
      for (const field of ['goal', 'conflict', 'twist', 'result', 'suspense'] as const) {
        if (row[field] !== undefined && s(row[field])) out[field] = s(row[field])
      }
      if (typeof row.tension === 'number') out.tension = row.tension
      return out
    })
    .filter(Boolean)

  return {
    revisions: revisions as OutlineRewriteResult['revisions'],
    additions: additions as OutlineRewriteResult['additions'],
    warnings: [...stringList(raw.warnings), ...additionWarnings],
  }
}

function parentLevelHint(level: OutlineNodeLevel): string {
  if (level === 'scene') return '章'
  if (level === 'chapter') return '幕'
  if (level === 'act') return '卷'
  return '顶层'
}

export async function classifyNovelChapterFromWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[]; focusQuote?: string },
): Promise<NovelChapterClassificationResult> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return {
      chapterType: '',
      pacing: '',
      tensionLevel: 0,
      storyFunctions: [],
      informationGain: [],
      activeForeshadows: [],
      tags: [],
      mainConflict: '',
      summary: '',
      rationale: '',
      warnings: ['没有可分析的章节正文'],
    }
  }

  const prompt = [
    `分析范围：${input.mode}`,
    '请严格按既定 JSON 结构输出结果。',
    '下面内容分为三部分：正文档案底座、大纲与伏笔、当前章节正文。',
    ...(s(input.focusQuote) ? [`重点关注片段：${s(input.focusQuote)}`] : []),
    `档案底座 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      categories: context.categories,
      characterRelations: context.characterRelations,
      characterFactionMemberships: context.characterFactionMemberships,
    })}`,
    `大纲与伏笔 JSON：${stableStringify({
      foreshadows: context.foreshadows,
      outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        goal: row.goal,
        conflict: row.conflict,
        twist: row.twist,
        result: row.result,
        suspense: row.suspense,
        plotStage: row.plotStage,
        characterIds: row.characterIds ?? [],
        factionIds: row.factionIds ?? [],
        foreshadowIds: row.foreshadowIds ?? [],
      })), ['id', 'title']),
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
    `补充上下文 JSON：${stableStringify({
      nearbyChapters: buildNearbyChapterContext(payload, input.chapterIds),
    })}`,
  ].join('\n')

  const raw = await callAiPromptJson('classification', prompt)
  return {
    chapterType: s(raw.chapterType ?? raw.chapter_type),
    pacing: s(raw.pacing),
    tensionLevel: clampTensionLevel(raw.tensionLevel ?? raw.tension_level),
    storyFunctions: stringList(raw.storyFunctions ?? raw.story_functions),
    informationGain: stringList(raw.informationGain ?? raw.information_gain),
    activeForeshadows: stringList(raw.activeForeshadows ?? raw.active_foreshadows),
    tags: stringList(raw.tags),
    mainConflict: s(raw.mainConflict ?? raw.main_conflict),
    summary: s(raw.summary),
    rationale: s(raw.rationale),
    warnings: stringList(raw.warnings),
  }
}

export async function summarizeNovelChapterFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[]; focusQuote?: string },
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<string> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) return ''

  const prompt = [
    `总结范围：${input.mode}`,
    '请为作者生成一份章节总结草稿。',
    ...(s(input.focusQuote) ? [`重点关注片段：${s(input.focusQuote)}`] : []),
    `档案底座 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      categories: context.categories,
      characterRelations: context.characterRelations,
      characterFactionMemberships: context.characterFactionMemberships,
    })}`,
    `大纲与伏笔 JSON：${stableStringify({
      foreshadows: context.foreshadows,
      outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        goal: row.goal,
        conflict: row.conflict,
        twist: row.twist,
        result: row.result,
        suspense: row.suspense,
        plotStage: row.plotStage,
        characterIds: row.characterIds ?? [],
        factionIds: row.factionIds ?? [],
        foreshadowIds: row.foreshadowIds ?? [],
      })), ['id', 'title']),
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
    `补充上下文 JSON：${stableStringify({
      nearbyChapters: buildNearbyChapterContext(payload, input.chapterIds),
    })}`,
  ].join('\n')

  const { text } = await postAiPromptStream({
    prompt_type: 'chapter_summary',
    user_prompt: prompt,
    temperature: 0.3,
  }, callbacks, signal)
  return text
}

/**
 * 章节命名：根据本章正文（不足时退回章总结）让 AI 起一个贴合剧情的标题。
 * 用于续写「写下一章」后，给占位标题（空 / 第N章）自动回填一个有内容的章名。
 * 返回清洗后的纯文本标题；无正文或失败时返回空串。
 */
export async function generateChapterTitleFromWorkspace(
  payload: WorkspaceSnapshotPayload,
  chapterId: string,
  signal?: AbortSignal,
): Promise<string> {
  assertAiReady()
  const chapters = [...(payload.chapters ?? [])]
  const target = chapters.find((row) => s(row.id) === s(chapterId))
  if (!target) return ''
  const body = String(target.content ?? '').trim()
  const annotation = String(target.annotation ?? '').trim()
  const basis = body || annotation
  if (!basis) return ''
  // 正文过长时只取开头与结尾，控制 token 又能体现首尾关键剧情
  const head = basis.slice(0, 1800)
  const tail = basis.length > 2600 ? basis.slice(-800) : ''
  const prompt = [
    '请为下面这一章起一个贴合本章剧情的标题。',
    `本章正文${tail ? '（节选开头与结尾）' : ''}：\n${head}${tail ? `\n……\n${tail}` : ''}`,
    annotation && body ? `本章总结参考：${annotation}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const result = await postAiPrompt({
    prompt_type: 'chapter_title',
    user_prompt: prompt,
    temperature: 0.7,
    max_tokens: 64,
  })
  const raw = typeof result.content === 'string' ? result.content : ''
  // 清洗：去掉书名号/引号/前后空白/可能的「第N章」前缀/结尾标点，只留标题本身
  return raw
    .replace(/<｜｜DSML｜｜[^>]*>[\s\S]*?<｜｜DSML｜｜[^>]*>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?.replace(/^[「『《【\["']+|[」』》】\]"']+$/g, '')
    .replace(/^第?\s*[0-9一二三四五六七八九十百千]+\s*章[：:、.\s]*/, '')
    .replace(/[。.！!？?，,；;：:]+$/, '')
    .trim()
    .slice(0, 30) ?? ''
}

// ── 场景级摘要 ──


export type SceneSummaryResult = {
  sceneIndex: number
  title: string
  summary: string
}

export async function summarizeChapterScenesFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  chapterId: string,
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<SceneSummaryResult[]> {
  const chapters = payload.chapters ?? []
  const chapter = chapters.find((c) => c.id === chapterId)
  if (!chapter || !chapter.content?.trim()) return []

  const prompt = [
    `章节标题：${chapter.title || '无标题'}`,
    `章节正文：${chapter.content}`,
  ].join('\n\n')

  const { text: raw } = await postAiPromptStream({
    prompt_type: 'scene_summary',
    user_prompt: prompt,
    temperature: 0.2,
  }, callbacks, signal)
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s: any) => s && typeof s.sceneIndex === 'number' && typeof s.summary === 'string')
        .map((s: any, i: number) => ({
          sceneIndex: s.sceneIndex ?? i,
          title: String(s.title ?? `场景${i + 1}`),
          summary: String(s.summary ?? ''),
        }))
    }
  } catch {}
  return []
}

// ── 篇章弧线级摘要 ──


export type ArcSummaryResult = {
  arcId: string
  level: 'volume' | 'act'
  title: string
  summary: string
  chapterRange: [number, number]
}

export async function summarizeArcFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  arcId: string,
  level: 'volume' | 'act',
  title: string,
  chapterRange: [number, number],
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<ArcSummaryResult | null> {
  const chapters = (payload.chapters ?? [])
    .filter((c) => c.chapterNo >= chapterRange[0] && c.chapterNo <= chapterRange[1])
    .sort((a, b) => a.chapterNo - b.chapterNo)

  if (chapters.length === 0) return null

  const summaries = chapters.map((c) => ({
    chapterNo: c.chapterNo,
    title: c.title,
    annotation: c.annotation || '(无总结)',
  }))

  const prompt = [
    `篇章名称：${title}`,
    `章节范围：第${chapterRange[0]}章 - 第${chapterRange[1]}章`,
    `各章总结：${stableStringify(summaries)}`,
  ].join('\n\n')

  const { text: summary } = await postAiPromptStream({
    prompt_type: 'arc_summary',
    user_prompt: prompt,
    temperature: 0.3,
  }, callbacks, signal)
  return {
    arcId,
    level,
    title,
    summary: summary.trim(),
    chapterRange,
  }
}

export async function rebuildArcSummariesFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  novelId: string,
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<ArcSummaryResult[]> {
  const outline = payload.outline ?? []
  const chapters = payload.chapters ?? []
  if (outline.length === 0 || chapters.length === 0) return []

  const arcNodes = outline.filter((item) => item.level === 'volume' || item.level === 'act')
  if (arcNodes.length === 0) return []

  const results: ArcSummaryResult[] = []

  for (const arc of arcNodes) {
    if (signal?.aborted) break

    const childChapters = chapters.filter((c) =>
      c.outlineItemIds?.some((id) => {
        let current = outline.find((o) => o.id === id)
        while (current) {
          if (current.id === arc.id) return true
          current = current.parentId ? outline.find((o) => o.id === current!.parentId) : undefined
        }
        return false
      })
    )

    if (childChapters.length === 0) continue

    const minNo = Math.min(...childChapters.map((c) => c.chapterNo))
    const maxNo = Math.max(...childChapters.map((c) => c.chapterNo))

    const result = await summarizeArcFromWorkspaceStream(
      payload,
      arc.id,
      arc.level as 'volume' | 'act',
      arc.title || `篇章${arc.id}`,
      [minNo, maxNo],
      callbacks,
      signal,
    )

    if (result) results.push(result)
  }

  return results
}

// ── 一致性检查 ──


export type ConsistencyIssue = {
  characterName?: string
  foreshadowTitle?: string
  issue: string
  severity: 'error' | 'warning' | 'info'
  evidence?: string
  chapters?: number[]
  suggestion?: string
}

export type ConsistencyCheckResult = {
  characterIssues: ConsistencyIssue[]
  timelineIssues: ConsistencyIssue[]
  foreshadowIssues: ConsistencyIssue[]
  settingIssues: ConsistencyIssue[]
  warnings: string[]
}

export async function checkChapterConsistencyFromWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  chapterId: string,
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<ConsistencyCheckResult> {
  const emptyResult: ConsistencyCheckResult = {
    characterIssues: [],
    timelineIssues: [],
    foreshadowIssues: [],
    settingIssues: [],
    warnings: [],
  }

  const chapters = payload.chapters ?? []
  const chapter = chapters.find((c) => c.id === chapterId)
  if (!chapter || !chapter.content?.trim()) return emptyResult

  const characters = (payload.characters ?? []).map((row) => {
    const attrs = Array.isArray(row.attributes)
      ? (row.attributes as Array<{ key?: string; value?: string }>)
          .filter((a) => a.key && a.value)
          .slice(0, 5)
          .map((a) => `${a.key}:${a.value}`)
      : []
    return {
      name: s(row.name),
      gender: s(row.gender),
      age: s(row.age),
      goal: s(row.goal),
      secret: s(row.secret),
      notes: s(row.notes).slice(0, 200),
      arc: s(row.arc),
      aliases: Array.isArray(row.aliases) ? row.aliases.slice(0, 5) : [],
      attrs,
      firstCh: typeof row.firstAppearanceChapterNo === 'number' ? row.firstAppearanceChapterNo : undefined,
    }
  })

  const foreshadows = (payload.foreshadows ?? []).map((row) => ({
    title: s(row.title),
    description: s(row.description).slice(0, 150),
    status: s(row.status),
    plantText: s(row.plantText).slice(0, 80),
    expectedCh: typeof row.expectedFulfillChapterNo === 'number' ? row.expectedFulfillChapterNo : undefined,
    expectedNotes: s(row.expectedFulfillNotes).slice(0, 60),
  }))

  const factions = (payload.factions ?? []).slice(0, 10).map((row) => ({
    name: s(row.name),
    leader: s(row.leader),
    notes: s(row.notes).slice(0, 100),
  }))

  const items = (payload.items ?? []).slice(0, 10).map((row) => ({
    name: s(row.name),
    summary: s(row.summary).slice(0, 100),
  }))

  const factionMap = new Map((payload.factions ?? []).map((f) => [s(f.id), s(f.name)]))
  const charMap = new Map((payload.characters ?? []).map((c) => [s(c.id), s(c.name)]))
  const memberships = (payload.characterFactionMemberships ?? [])
    .map((m) => {
      const charName = charMap.get(s(m.characterId))
      const facName = factionMap.get(s(m.factionId))
      return charName && facName ? `${charName} → ${facName}` : ''
    })
    .filter(Boolean)
    .slice(0, 20)

  const timelineEvents = (payload.timelineEvents ?? []).slice(0, 8).map((row) => ({
    title: s(row.title),
    summary: s(row.summary).slice(0, 80),
    storyLabel: s(row.storyLabel),
    chapterNoStart: row.chapterNoStart,
  }))

  const outlineBeats = (payload.outline ?? [])
    .filter((row) => (chapter.outlineItemIds ?? []).includes(s(row.id)))
    .map((row) => ({
      title: s(row.title),
      goal: s(row.goal),
      conflict: s(row.conflict),
      twist: s(row.twist),
      result: s(row.result),
      suspense: s(row.suspense),
    }))

  const recentSummaries = chapters
    .filter((c) => c.chapterNo >= chapter.chapterNo - 5 && c.chapterNo < chapter.chapterNo)
    .map((c) => ({
      chapterNo: c.chapterNo,
      title: c.title,
      annotation: (c.annotation || '').slice(0, 200),
    }))

  const prompt = [
    `检查章节：第${chapter.chapterNo}章《${chapter.title || '未命名'}》`,
    `章节正文：${chapter.content}`,
    `角色档案 JSON：${stableStringify(characters)}`,
    `伏笔档案 JSON：${stableStringify(foreshadows)}`,
    factions.length > 0 ? `势力 JSON：${stableStringify(factions)}` : '',
    items.length > 0 ? `物品 JSON：${stableStringify(items)}` : '',
    memberships.length > 0 ? `势力归属：${memberships.join('；')}` : '',
    timelineEvents.length > 0 ? `时间线事件 JSON：${stableStringify(timelineEvents)}` : '',
    outlineBeats.length > 0 ? `大纲节拍 JSON：${stableStringify(outlineBeats)}` : '',
    `近期章节总结 JSON：${stableStringify(recentSummaries)}`,
  ].filter(Boolean).join('\n\n')

  const { text: raw } = await postAiPromptStream({
    prompt_type: 'consistency_check',
    user_prompt: prompt,
    temperature: 0.2,
  }, callbacks, signal)
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      characterIssues: Array.isArray(parsed.characterIssues) ? parsed.characterIssues : [],
      timelineIssues: Array.isArray(parsed.timelineIssues) ? parsed.timelineIssues : [],
      foreshadowIssues: Array.isArray(parsed.foreshadowIssues) ? parsed.foreshadowIssues : [],
      settingIssues: Array.isArray(parsed.settingIssues) ? parsed.settingIssues : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    }
  } catch {
    return emptyResult
  }
}

export type AiFixResult = {
  fixedContent: string
  explanation: string
}

export async function fixConsistencyIssueByAi(
  payload: WorkspaceSnapshotPayload,
  chapterId: string,
  issue: { issue: string; characterName?: string; foreshadowTitle?: string; suggestion?: string },
): Promise<AiFixResult> {
  assertAiReady()
  const chapters = (payload.chapters ?? []).map((c) => ({
    id: String(c.id ?? ''),
    chapterNo: Number(c.chapterNo ?? 0),
    title: String(c.title ?? ''),
    content: String(c.content ?? ''),
  }))
  const chapter = chapters.find((c) => c.id === chapterId)
  if (!chapter || !chapter.content) throw new Error('找不到要修复的章节')

  const characters = (payload.characters ?? []).filter((c) => {
    if (!issue.characterName) return false
    return String(c.name ?? '').includes(issue.characterName)
  }).map((c) => ({
    name: String(c.name ?? ''),
    aliases: Array.isArray(c.aliases) ? c.aliases : [],
    age: c.age,
    gender: c.gender,
    personality: c.personality,
    goal: c.goal,
    secret: c.secret,
    notes: c.notes,
  }))

  const prompt = [
    '你是小说一致性修复助手。以下是一个一致性问题：',
    `问题描述：${issue.issue}`,
    issue.characterName ? `涉及角色：${issue.characterName}` : '',
    issue.foreshadowTitle ? `涉及伏笔：${issue.foreshadowTitle}` : '',
    issue.suggestion ? `建议方向：${issue.suggestion}` : '',
    '',
    characters.length > 0 ? `相关角色档案 JSON：${stableStringify(characters)}` : '',
    '',
    `当前章节（第${chapter.chapterNo}章《${chapter.title || '未命名'}》）正文：`,
    chapter.content,
    '',
    '请修改正文中与此问题相关的段落，使其符合角色档案设定和逻辑一致性。',
    '只修改必要部分，保持其余正文不变。',
    '输出 JSON 格式：{"fixedContent": "完整修改后的章节正文", "explanation": "简要说明修改了什么"}',
  ].filter(Boolean).join('\n')

  const result = await postAiPrompt({
    prompt_type: 'qa',
    user_prompt: prompt,
    temperature: 0.3,
    max_tokens: 16384,
    response_format: 'json',
  })

  const content = result.content
  if (!content) throw new Error('AI 未返回有效内容')
  const parsed = parseAiJsonContent(content)
  return {
    fixedContent: String(parsed.fixedContent ?? ''),
    explanation: String(parsed.explanation ?? '修改完成'),
  }
}

export async function askAiAboutWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: AiExtractMode
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
): Promise<string> {
  const built = buildAskUserPrompt(payload, {
    mode: input.mode,
    chapterIds: input.chapterIds,
    question: input.question,
    selectionQuote: input.selectionQuote,
    prevSummaryCount: input.prevSummaryCount,
    enableRag: input.enableRag,
    novel: input.novel,
  })
  if (!built.prompt || built.prompt.includes('没有可供阅读')) {
    return built.prompt || '当前范围里没有可供阅读的章节正文。'
  }

  assertAiReady()
  const result = await postAiPrompt({
    prompt_type: 'qa',
    user_prompt: built.prompt,
    temperature: 0.25,
  })
  return s(result.content) || '这次没有拿到可展示的回答。'
}

export async function askAiAboutWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: AiExtractMode
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
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
): Promise<string> {
  const built = buildAskUserPrompt(payload, {
    mode: input.mode,
    chapterIds: input.chapterIds,
    question: input.question,
    selectionQuote: input.selectionQuote,
    prevSummaryCount: input.prevSummaryCount,
    enableRag: input.enableRag,
    novel: input.novel,
  })
  if (!built.prompt || built.prompt.includes('没有可供阅读')) {
    return built.prompt || '当前范围里没有可供阅读的章节正文。'
  }

  const { text } = await postAiPromptStream({
    prompt_type: 'qa',
    user_prompt: built.prompt,
    temperature: 0.25,
  }, callbacks)
  return text || '这次没有拿到可展示的回答。'
}

async function callAiWithTools(
  messages: AiMessage[],
  tools: AiToolDefinition[],
  signal?: AbortSignal,
): Promise<{ content: string; toolCalls: AiToolCall[]; reasoningContent: string }> {
  assertAiReady()
  const result = await postAiCompletion(
    {
      temperature: 0.25,
      messages,
      tools,
      tool_choice: 'auto',
    },
    signal,
  )
  return {
    content: s(result.content),
    toolCalls: result.toolCalls,
    reasoningContent: s(result.reasoningContent),
  }
}

export async function askAiWithToolsStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: AiExtractMode
    chapterIds?: string[]
    question: string
    novelId: string
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
  callbacks: {
    onChunk: (text: string) => void
    onError: (err: Error) => void
  },
  existingHistory?: AiMessage[],
  signal?: AbortSignal,
  options: {
    alwaysEnableTools?: boolean
    confirmBeforeApply?: boolean
    toolContext?: AiToolExecutionContext
  } = {},
): Promise<{
  text: string
  history: AiMessage[]
  contextMeta: AskPromptBuildResult
  pendingToolActions?: AiPendingToolAction[]
}> {
  const question = s(input.question)
  const actionKeywords =
    /(创建|新建|添加|增加|补充|生成|删除|移除|清空|修改|更新|编辑|调整|设为|绑定|关联|整理|总结|提取|归纳|采用|确认|写入|保存|续写|改正文|改大纲)/
  const shouldUseTools = options.alwaysEnableTools === true || actionKeywords.test(question)
  const confirmBeforeApply = options.confirmBeforeApply === true
  const toolContext = options.toolContext ?? {}
  const actionHint = shouldUseTools
    ? confirmBeforeApply
      ? '【重要提示】当作者要求创建、修改、删除、设为、标记数据时，你必须调用对应工具提交修改提案。作者会在侧栏确认后才真正写入。禁止只给文字建议而不调用工具。'
      : '【重要提示】如果作者是在要求你直接创建、修改、删除、绑定、整理或写入数据，你必须优先调用工具完成操作，而不是只给文字建议。'
    : ''

  const askInput = {
    mode: input.mode,
    chapterIds: input.chapterIds,
    question,
    selectionQuote: input.selectionQuote,
    prevSummaryCount: input.prevSummaryCount,
    enableRag: input.enableRag,
    novel: input.novel,
  }

  const isFollowUp = Boolean(existingHistory && existingHistory.length > 0)
  const contextMeta = isFollowUp
    ? buildAskFollowUpPrompt(payload, askInput)
    : buildAskUserPrompt(payload, askInput)

  if (!contextMeta.prompt || contextMeta.prompt.includes('没有可供阅读')) {
    return {
      text: contextMeta.prompt || '当前范围里没有可供阅读的章节正文。',
      history: existingHistory ?? [],
      contextMeta,
    }
  }

  let messages: AiMessage[]
  const userContent = [contextMeta.prompt, ...(actionHint ? [actionHint] : [])].join('\n\n')

  if (isFollowUp) {
    // Follow-up: 历史中已含系统提示词（由后端首次注入），直接追加用户消息
    const sanitized = sanitizeToolCallHistory(existingHistory ?? [])
    const trimmed = trimAskConversationHistory(sanitized)
    messages = [...trimmed, { role: 'user', content: userContent }]
  } else {
    // 首次调用：系统提示词由后端注入，前端不发送
    messages = [{ role: 'user', content: userContent }]
  }

  if (!shouldUseTools) {
    if (!isFollowUp) {
      // 首次调用走 /ai/prompt，系统提示词由后端组装
      const { text } = await postAiPromptStream(
        { prompt_type: 'qa', user_prompt: userContent },
        callbacks,
        signal,
      )
      const finalText = text || '这次没有拿到可展示的回答。'
      // 构造含后端系统提示词的历史（后续 follow-up 需要）
      const fullMessages: AiMessage[] = [
        { role: 'system', content: '__backend_injected__' }, // 占位，实际由后端注入
        { role: 'user', content: userContent },
        { role: 'assistant', content: finalText },
      ]
      return { text: finalText, history: fullMessages, contextMeta }
    }
    // Follow-up 调用：历史已含系统提示词，走 /ai/chat
    const text = await callAiMessagesStream(messages, callbacks, signal)
    const finalText = text || '这次没有拿到可展示的回答。'
    messages.push({ role: 'assistant', content: finalText })
    return { text: finalText, history: messages, contextMeta }
  }

  let maxRounds = 5
  let isFirstRound = !isFollowUp

  while (maxRounds-- > 0) {
    let content: string
    let toolCalls: AiToolCall[]
    let reasoningContent: string

    if (isFirstRound) {
      // 首次调用走 /ai/prompt，系统提示词由后端注入
      const result = await postAiPrompt(
        {
          prompt_type: 'qa_tools',
          user_prompt: userContent,
          tools: AI_WRITE_TOOLS as any,
          tool_choice: 'auto',
        },
        signal,
      )
      content = s(result.content)
      toolCalls = result.toolCalls
      reasoningContent = s(result.reasoningContent)
      // 将后端注入的系统提示词加入历史（占位，后续 follow-up 需要）
      messages.unshift({ role: 'system', content: '__injected_by_backend__' })
      isFirstRound = false
    } else {
      // 后续轮次（含 follow-up）：历史已含系统提示词，走 /ai/chat
      ;({ content, toolCalls, reasoningContent } = await callAiWithTools(messages, AI_WRITE_TOOLS, signal))
    }

    if (toolCalls.length === 0) {
      const cleanedContent = stripDsmlToolCalls(content) || '这次没有拿到可展示的回答。'
      callbacks.onChunk(cleanedContent)
      messages.push({ role: 'assistant', content: cleanedContent })
      return { text: cleanedContent, history: messages, contextMeta }
    }

    if (confirmBeforeApply) {
      const pendingToolActions = buildPendingToolActions(toolCalls)
      const intro = stripDsmlToolCalls(s(content)) || '我整理了以下修改方案，请你在侧栏确认是否采用：'
      messages.push({
        role: 'assistant',
        content: intro,
        tool_calls: toolCalls,
        ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
      })
      return { text: intro, history: messages, contextMeta, pendingToolActions }
    }

    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls,
      ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
    })

    for (const tc of toolCalls) {
      const result = executeToolCall(input.novelId, tc, toolContext)
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }
  }

  return { text: '这次工具调用轮次过多，未能顺利完成。', history: messages, contextMeta }
}

/**
 * Self-critique loop: takes a draft output and the original prompt, asks the AI to review and fix.
 * Returns the corrected output with an optional critiqueNotes field.
 */
async function critiqueAndFixOutlineByAi(
  originalPrompt: string,
  draftOutput: JsonRecord,
): Promise<JsonRecord & { critiqueNotes?: string }> {
  try {
    const draftStr = stableStringify(draftOutput)
    if (draftStr.length > 8000) {
      // Truncate for token budget
      draftOutput = JSON.parse(draftStr.slice(0, 8000) + ']}')
    }

    const critiquePrompt = [
      '以下是大纲草案和原始创作要求，请审读并修正。',
      '',
      '【原始创作要求】',
      originalPrompt.slice(0, 4000),
      '',
      '【大纲草案】',
      stableStringify(draftOutput),
    ].join('\n')

    const fixed = await callAiPromptJson('outline_critique', critiquePrompt, { temperature: 0.3 })
    return {
      ...fixed,
      critiqueNotes: s(fixed.critiqueNotes) || undefined,
    }
  } catch {
    return draftOutput
  }
}

export async function expandOutlineItemByAi(
  item: Pick<OutlineItem, 'title' | 'summary' | 'goal' | 'conflict' | 'twist' | 'result' | 'suspense'>,
  mode: 'full' | 'conflict' | 'twist' | 'suspense',
): Promise<Pick<OutlineItem, 'conflict' | 'twist' | 'suspense'>> {
  const prompt = [
    `任务：${mode}`,
    `标题：${item.title ?? ''}`,
    `摘要：${item.summary ?? ''}`,
    `目标：${item.goal ?? ''}`,
    `已有冲突：${item.conflict ?? ''}`,
    `已有转折：${item.twist ?? ''}`,
    `已有悬念：${item.suspense ?? ''}`,
    `已有结果：${item.result ?? ''}`,
  ].join('\n')

  const raw = await callAiPromptJson('extract_outline_item', prompt, { temperature: 0.1 })
  return {
    conflict: s(raw.conflict),
    twist: s(raw.twist),
    suspense: s(raw.suspense),
  }
}

type OutlineAiNovelBrief = Pick<Novel, 'title' | 'summary' | 'continuityBrief' | 'genre' | 'perspective' | 'tone'>

function resolveOutlineAiNovelBrief(input: {
  novelTitle: string
  novelSummary?: string
  novel?: OutlineAiNovelBrief
}): OutlineAiNovelBrief {
  if (input.novel) return input.novel
  return {
    title: s(input.novelTitle),
    summary: s(input.novelSummary),
    continuityBrief: '',
    genre: '',
    perspective: '',
    tone: '',
  }
}

export async function designOutlineOptionsByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    novel?: OutlineAiNovelBrief
    aiStylePrompt?: string
    history: Array<{ label: string; prompt: string; answer: string }>
  },
): Promise<{
  brief: string
  options: Array<{
    id: string
    title: string
    premise: string
    structure: string
    highlights: string[]
    endingTone: string
    beats: string[]
  }>
}> {
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
    `访谈记录：${stableStringify(input.history.map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`,
    `已有大纲节点：${stableStringify((payload.outline ?? []).map((item) => ({
      title: item.title,
      summary: item.summary,
      level: item.level,
      goal: item.goal,
      conflict: item.conflict,
      twist: item.twist,
      result: item.result,
      suspense: item.suspense,
    })))}`,
    `已有故事线：${stableStringify((payload.outlineStorylines ?? []).map((item) => ({
      name: item.name,
      type: item.type,
      description: item.description,
    })))}`,
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
    '请给出 3 套风格有区别、但都适合当前回答的大纲方向。',
  ].filter(Boolean).join('\n')

  const parsed = await callAiPromptJson('outline_options', prompt, { temperature: OUTLINE_DESIGN_JSON_TEMPERATURE, aiStylePrompt: input.aiStylePrompt })
  return parseOutlineDesignOptionsPayload(parsed)
}

export async function refineOutlineOptionsByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    aiStylePrompt?: string
    history: Array<{ label: string; prompt: string; answer: string }>
    currentOptions: OutlineDesignOption[]
    selectedOptionId: string
    refineNote: string
    allOptionNotes?: Record<string, string>
    priorRevisions?: Array<{ selectedOptionId: string; selectedTitle: string; note: string }>
  },
): Promise<{ brief: string; options: OutlineDesignOption[] }> {
  const selected = input.currentOptions.find((row) => row.id === input.selectedOptionId) ?? null
  const otherNotes = Object.entries(input.allOptionNotes ?? {})
    .filter(([id, note]) => id !== input.selectedOptionId && s(note))
    .map(([id, note]) => {
      const option = input.currentOptions.find((row) => row.id === id)
      return { title: option?.title ?? id, note: s(note) }
    })

  const prompt = [
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
    `访谈记录：${stableStringify(input.history.map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`,
    `当前 3 套方案：${stableStringify(input.currentOptions)}`,
    `作者选中的基准方案 id：${s(input.selectedOptionId)}`,
    `作者选中的基准方案：${stableStringify(selected)}`,
    `针对选中方案的修改意见：${s(input.refineNote)}`,
    otherNotes.length > 0 ? `其他方案的附带意见：${stableStringify(otherNotes)}` : '',
    input.priorRevisions && input.priorRevisions.length > 0
      ? `此前调整记录：${stableStringify(input.priorRevisions)}`
      : '',
    '请根据修改意见重新给出 3 套备选方案。',
  ]
    .filter(Boolean)
    .join('\n')

  const parsed = await callAiPromptJson('outline_refine', prompt, { temperature: OUTLINE_DESIGN_JSON_TEMPERATURE, aiStylePrompt: input.aiStylePrompt })
  return parseOutlineDesignOptionsPayload(parsed)
}

export async function designOutlineInterviewTurnByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    novel?: OutlineAiNovelBrief
    aiStylePrompt?: string
    history?: Array<{ label: string; prompt: string; answer: string }>
    remainingRounds: number
  },
): Promise<{
  shouldAsk: boolean
  rationale: string
  coveredDimensions: string[]
  question: {
    label: string
    prompt: string
    options: string[]
    placeholder: string
  } | null
}> {
  const genreProfiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
  const genreBlock = buildGenrePromptInjection(genreProfiles)
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `类型：${s(input.novel?.genre) || '未指定'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
    `已确认的访谈记录：${stableStringify((input.history ?? []).map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`,
    `剩余追问轮次：${Math.max(0, i(input.remainingRounds) ?? 0)}`,
    genreBlock ? `【类型指导】\n${genreBlock}` : '',
    '上文已附本书现有设定（作品信息/写作进度/已有大纲/角色档案/关系/伏笔等）。提问前先读这些，已知的信息不要再问；只针对仍然空白或矛盾的关键点提问。如果还有一个最该补的关键信息，就提出 1 个问题；如果已经足够，就明确结束追问。',
  ].filter(Boolean).join('\n')

  const parsed = await callAiPromptJson('outline_interview', prompt, { temperature: OUTLINE_DESIGN_JSON_TEMPERATURE, aiStylePrompt: input.aiStylePrompt })
  const shouldAsk = Boolean(parsed.shouldAsk) && (input.remainingRounds > 0)
  const question = shouldAsk && parsed.question && typeof parsed.question === 'object'
    ? {
        label: s((parsed.question as JsonRecord).label) || '补充问题',
        prompt: s((parsed.question as JsonRecord).prompt) || '还有一个关键点想确认。',
        options: stringList((parsed.question as JsonRecord).options).slice(0, 5),
        placeholder: s((parsed.question as JsonRecord).placeholder) || '直接用一句到几句话回答这个问题',
      }
    : null
  return {
    shouldAsk: Boolean(question),
    rationale: s(parsed.rationale),
    coveredDimensions: stringList(parsed.coveredDimensions),
    question,
  }
}

export async function designWorldSettingInterviewTurnByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    novel?: { title: string; summary?: string; genre?: string; perspective?: string; tone?: string }
    aiStylePrompt?: string
    existingSetting?: { name: string; content: string }
    history?: Array<{ label: string; prompt: string; answer: string }>
    remainingRounds: number
  },
): Promise<{
  shouldAsk: boolean
  rationale: string
  coveredDimensions: string[]
  question: {
    label: string
    prompt: string
    options: string[]
    placeholder: string
  } | null
}> {
  const parts = [
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `类型：${s(input.novel?.genre) || '未指定'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
  ]
  if (input.existingSetting) {
    parts.push(`已有世界观设定「${input.existingSetting.name}」：\n${input.existingSetting.content}`)
  }
  parts.push(`已确认的访谈记录：${stableStringify((input.history ?? []).map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`)
  parts.push(`剩余追问轮次：${Math.max(0, i(input.remainingRounds) ?? 0)}`)
  parts.push('如果还有一个最该补的关键信息，就提出 1 个问题；如果已经足够，就明确结束追问。')
  const prompt = parts.filter(Boolean).join('\n')

  const parsed = await callAiPromptJson('world_setting_interview', prompt, { temperature: OUTLINE_DESIGN_JSON_TEMPERATURE, aiStylePrompt: input.aiStylePrompt })
  const shouldAsk = Boolean(parsed.shouldAsk) && (input.remainingRounds > 0)
  const question = shouldAsk && parsed.question && typeof parsed.question === 'object'
    ? {
        label: s((parsed.question as JsonRecord).label) || '补充问题',
        prompt: s((parsed.question as JsonRecord).prompt) || '还有一个关键点想确认。',
        options: stringList((parsed.question as JsonRecord).options).slice(0, 5),
        placeholder: s((parsed.question as JsonRecord).placeholder) || '直接用一句到几句话回答这个问题',
      }
    : null
  return {
    shouldAsk: Boolean(question),
    rationale: s(parsed.rationale),
    coveredDimensions: stringList(parsed.coveredDimensions),
    question,
  }
}

export async function generateWorldSettingDraftByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    novel?: { title: string; summary?: string; genre?: string; perspective?: string; tone?: string }
    aiStylePrompt?: string
    /** 用户用自己的话描述想要一个什么样的世界（自由文本，主输入） */
    userBrief: string
    /** 迭代修订：在上一版基础上按修改意见重写 */
    revise?: { previousName?: string; previousContent: string; feedback: string }
    /** 流式输出回调，便于 UI 实时展示生成过程 */
    onChunk?: (delta: string) => void
  },
  signal?: AbortSignal,
): Promise<{ name: string; content: string; cards: Array<{ key: string; value: string }> }> {
  const parts = [
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `类型：${s(input.novel?.genre) || '未指定'}`,
  ]
  if (s(input.novelSummary)) parts.push(`作品简介：${s(input.novelSummary)}`)

  if (input.revise) {
    // 修订模式：给上一版全文 + 修改意见，让 AI 基于上一版改写
    parts.push(
      '',
      '【上一版世界观】',
      s(input.revise.previousContent),
      '',
      '【作者的修改意见（请只改动这些地方，其余保留）】',
      s(input.revise.feedback) || '（作者未给出具体意见，请整体润色提升一档）',
    )
  } else {
    parts.push('', '【作者的核心设定 — 不可更改，整个世界观必须以此为基础展开】', s(input.userBrief) || '（作者没有特别说明，请发挥你的想象，创作一个有新意、自洽、适合这个题材的世界）')
  }
  const prompt = parts.filter((p) => p !== undefined).join('\n')

  // 世界观走自然语言长文（非 JSON 模式），max_tokens 拉满到模型上限，让模型尽情展开；
  // 拿到 Markdown 长文后在前端按 # 名称 / ## 维度 切分成卡片。
  const { text } = await postAiPromptStream(
    {
      prompt_type: 'world_setting_draft',
      user_prompt: prompt,
      ai_style_prompt: input.aiStylePrompt,
      temperature: OUTLINE_DESIGN_JSON_TEMPERATURE,
      max_tokens: 16384,
    },
    { onChunk: (d) => input.onChunk?.(d), onError: () => {} },
    signal,
  )

  return parseWorldSettingMarkdown(text, input.revise?.previousName)
}

/**
 * 把世界观长文 Markdown 切成卡片。
 * 约定：第一行 `# 名称` 是设定名；其后每个 `## 维度` 起一张卡片，
 * 标题作 key、小节正文作 value。无标题时整段兜底为「概述」卡。
 */
function parseWorldSettingMarkdown(
  raw: string,
  fallbackName?: string,
): { name: string; content: string; cards: Array<{ key: string; value: string }> } {
  const content = s(raw).trim()
  const lines = content.split('\n')
  let name = s(fallbackName)
  const cards: Array<{ key: string; value: string }> = []
  let curKey = ''
  let curBuf: string[] = []

  const flush = (): void => {
    if (!curKey) return
    const value = curBuf.join('\n').trim()
    if (value) cards.push({ key: curKey, value })
    curBuf = []
  }

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+?)\s*$/)
    const h2 = line.match(/^#{2,3}\s+(.+?)\s*$/)
    if (h1) {
      // 一级标题作设定名（取第一个；已有 fallbackName 时不覆盖）
      if (!name) name = h1[1].trim()
      continue
    }
    if (h2) {
      flush()
      curKey = h2[1].trim()
      continue
    }
    if (curKey) curBuf.push(line)
  }
  flush()

  // 整篇没有 ## 小节时，把全文作为一张概述卡，保证不丢内容
  if (cards.length === 0) {
    const stripped = content.replace(/^#\s+.+\n?/, '').trim()
    if (stripped) cards.push({ key: '概述', value: stripped })
  }

  return {
    name: name || '未命名世界观设定',
    content,
    cards,
  }
}

export async function expandOutlineDesignByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novelTitle: string
    novelSummary?: string
    novel?: OutlineAiNovelBrief
    aiStylePrompt?: string
    history: Array<{ label: string; prompt: string; answer: string }>
    selectedOption: {
      title: string
      premise: string
      structure: string
      highlights: string[]
      endingTone: string
      beats: string[]
    }
    selectedOptionId?: string
    optionRefinement?: string
    optionRevisionHistory?: Array<{ selectedOptionId: string; selectedTitle: string; note: string }>
    onChunk?: (delta: string) => void
  },
  signal?: AbortSignal,
): Promise<{
  title: string
  summary: string
  storylines: Array<{
    name: string
    type: OutlineStorylineType
    description: string
    colorHint: string
  }>
  characterCast: OutlineAiCharacterCastRow[]
  relationCast: OutlineAiRelationCastRow[]
  items: Array<{
    tempId: string
    parentTempId: string
    title: string
    summary: string
    level: 'volume' | 'act' | 'chapter' | 'scene'
    goal: string
    conflict: string
    twist: string
    result: string
    suspense: string
    plotStage: 'idea' | 'drafted' | 'written' | 'resolved'
    storylineNames: string[]
    tension: 1 | 2 | 3 | 4 | 5
    location: string
    timeLabel: string
    characterNames: string[]
    povCharacterName: string
    emotionalTurn: string
    proseHint: string
  }>
  critiqueNotes?: string
}> {
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    buildOutlineDesignSelectedOptionContext(input),
    `已有故事线：${stableStringify((payload.outlineStorylines ?? []).map((item) => ({
      name: item.name,
      type: item.type,
      description: item.description,
    })))}`,
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
    '请把这一方案展开成一个可直接写入写作工具的大纲结构，严格遵循卷→幕→章→场景的层级：幕代表一个大的故事弧/副本（统领若干章），章是单个章节。每幕要给足章（至少 8-15 章），绝不能一幕只有两三章就结束。大纲可以留白：靠后的幕/章只给标题和方向、细节留到写正文时逐步补充，但章的数量必须给足、骨架要完整。',
  ].filter(Boolean).join('\n\n')

  assertAiReady()
  const { text } = await postAiPromptStream(
    {
      prompt_type: 'outline_expand',
      user_prompt: prompt,
      ai_style_prompt: input.aiStylePrompt,
      temperature: OUTLINE_DESIGN_JSON_TEMPERATURE,
      max_tokens: 16384,
      response_format: 'json',
    },
    { onChunk: (d) => input.onChunk?.(d), onError: () => {} },
    signal,
  )
  const parsed = parseAiJsonContent(text)
  const storylineTypeSet = new Set<OutlineStorylineType>(['main', 'subplot', 'character', 'romance', 'antagonist', 'world', 'custom'])
  const levelSet = new Set(['volume', 'act', 'chapter', 'scene'])
  const plotStageSet = new Set(['idea', 'drafted', 'written', 'resolved'])
  const normalizeTension = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    const raw = i(value)
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5) return raw
    return 3
  }

  const normalizeItems = (items: JsonRecord[]) =>
    items
      .map((item: JsonRecord, index: number) => {
        const rawLevel = s(item.level)
        const rawPlotStage = s(item.plotStage)
        const emotionalTurn = s(item.emotionalTurn)
        const proseHint = s(item.proseHint)
        return {
          tempId: s(item.tempId) || `node-${index + 1}`,
          parentTempId: s(item.parentTempId),
          title: s(item.title) || `节点 ${index + 1}`,
          summary: s(item.summary),
          emotionalTurn,
          proseHint,
          level: (levelSet.has(rawLevel) ? rawLevel : 'scene') as 'volume' | 'act' | 'chapter' | 'scene',
          goal: s(item.goal),
          conflict: s(item.conflict),
          twist: s(item.twist),
          result: s(item.result),
          suspense: s(item.suspense),
          plotStage: (plotStageSet.has(rawPlotStage) ? rawPlotStage : 'idea') as 'idea' | 'drafted' | 'written' | 'resolved',
          storylineNames: stringList(item.storylineNames),
          tension: normalizeTension(item.tension),
          location: s(item.location),
          timeLabel: s(item.timeLabel),
          characterNames: stringList(item.characterNames).slice(0, 8),
          povCharacterName: s(item.povCharacterName),
        }
      })
      .filter((item) => item.title)

  const rawItems = Array.isArray(parsed.items) ? parsed.items : []
  let resultItems = normalizeItems(rawItems)
  let critiqueNotes: string | undefined

  // Self-critique loop: run on drafts with 8+ items
  if (resultItems.length >= 8) {
    const critiqued = await critiqueAndFixOutlineByAi(prompt, parsed)
    if (Array.isArray(critiqued.items) && critiqued.items.length >= resultItems.length * 0.5) {
      resultItems = normalizeItems(critiqued.items)
      critiqueNotes = s(critiqued.critiqueNotes) || undefined
    }
  }

  return {
    title: s(parsed.title),
    summary: s(parsed.summary),
    storylines: Array.isArray(parsed.storylines)
      ? parsed.storylines
          .map((item: JsonRecord) => {
            const rawType = s(item.type) as OutlineStorylineType
            return {
              name: s(item.name),
              type: storylineTypeSet.has(rawType) ? rawType : 'custom',
              description: s(item.description),
              colorHint: s(item.colorHint),
            }
          })
          .filter((item) => item.name)
      : [],
    characterCast: parseOutlineCharacterCast(parsed.characterCast),
    relationCast: parseOutlineRelationCast(parsed.relationCast),
    items: resultItems,
    critiqueNotes,
  }
}

type OutlineAiCharacterCastRow = {
  name: string
  role: string
  voice: string
  personality: string
  desire: string
  fear: string
  secret: string
  arc: string
}

type OutlineAiRelationCastRow = {
  fromName: string
  toName: string
  relationType: string
  note: string
  dynamic: string
}

function parseOutlineCharacterCast(raw: unknown): OutlineAiCharacterCastRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: JsonRecord) => ({
      name: s(item.name),
      role: s(item.role),
      voice: s(item.voice),
      personality: s(item.personality),
      desire: s(item.desire),
      fear: s(item.fear),
      secret: s(item.secret),
      arc: s(item.arc),
    }))
    .filter((item) => item.name)
}

function parseOutlineRelationCast(raw: unknown): OutlineAiRelationCastRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item: JsonRecord) => ({
      fromName: s(item.fromName),
      toName: s(item.toName),
      relationType: s(item.relationType),
      note: [s(item.note), s(item.dynamic)].filter(Boolean).join('；'),
      dynamic: s(item.dynamic),
    }))
    .filter((item) => item.fromName && item.toName && item.relationType)
}

function buildOutlineDesignSelectedOptionContext(input: {
  novelTitle: string
  novelSummary?: string
  history: Array<{ label: string; prompt: string; answer: string }>
  selectedOption: {
    title: string
    premise: string
    structure: string
    highlights: string[]
    endingTone: string
    beats: string[]
  }
  optionRefinement?: string
  optionRevisionHistory?: Array<{ selectedOptionId: string; selectedTitle: string; note: string }>
}): string {
  return [
    `作品名：${s(input.novelTitle) || '未命名作品'}`,
    `现有简介：${s(input.novelSummary) || '暂无'}`,
    `访谈记录：${stableStringify(input.history.map((row) => ({ label: s(row.label), prompt: s(row.prompt), answer: s(row.answer) })))}`,
    `作者选中的方案：${stableStringify({
      title: s(input.selectedOption.title),
      premise: s(input.selectedOption.premise),
      structure: s(input.selectedOption.structure),
      narrativeShape: s((input.selectedOption as OutlineDesignOption).narrativeShape),
      coreQuestion: s((input.selectedOption as OutlineDesignOption).coreQuestion),
      forbiddenCliche: s((input.selectedOption as OutlineDesignOption).forbiddenCliche),
      highlights: input.selectedOption.highlights ?? [],
      endingTone: s(input.selectedOption.endingTone),
      beats: input.selectedOption.beats ?? [],
    })}`,
    s(input.optionRefinement) ? `作者对该方案的补充调整意见：${s(input.optionRefinement)}` : '',
    input.optionRevisionHistory && input.optionRevisionHistory.length > 0
      ? `方案调整历史：${stableStringify(input.optionRevisionHistory)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function expandOutlineSkeletonByAi(
  payload: WorkspaceSnapshotPayload,
  input: Parameters<typeof expandOutlineDesignByAi>[1],
): Promise<{
  title: string
  summary: string
  storylines: Array<{
    name: string
    type: OutlineStorylineType
    description: string
    colorHint: string
  }>
  items: Array<{
    tempId: string
    parentTempId: string
    title: string
    summary: string
    level: 'volume' | 'act' | 'chapter'
    goal: string
    storylineNames: string[]
  }>
}> {
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    buildOutlineDesignSelectedOptionContext(input),
    `已有故事线：${stableStringify((payload.outlineStorylines ?? []).map((item) => ({
      name: item.name,
      type: item.type,
      description: item.description,
    })))}`,
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
    '请生成卷→幕→章三级骨架（不要生成场景）：每卷下要有若干幕，每幕下要有足够多的章（每幕至少 8-15 章，绝不能一幕只有两三章就结束，否则故事会显得太短）。幕代表一个大的故事弧/副本，章是单个章节。大纲可以留白：靠后的幕/章只给标题和方向、细节留到写正文时再补，但章的数量必须给足。章节 goal 须考虑核心角色动机与关系走向。',
  ].filter(Boolean).join('\n\n')

  const parsed = await callAiPromptJson('outline_skeleton', prompt, { temperature: OUTLINE_DESIGN_JSON_TEMPERATURE, aiStylePrompt: input.aiStylePrompt, maxTokens: 16384 })
  const storylineTypeSet = new Set<OutlineStorylineType>(['main', 'subplot', 'character', 'romance', 'antagonist', 'world', 'custom'])
  const skeletonLevels = new Set(['volume', 'act', 'chapter'])

  return {
    title: s(parsed.title),
    summary: s(parsed.summary),
    storylines: Array.isArray(parsed.storylines)
      ? parsed.storylines
          .map((item: JsonRecord) => {
            const rawType = s(item.type) as OutlineStorylineType
            return {
              name: s(item.name),
              type: storylineTypeSet.has(rawType) ? rawType : 'custom',
              description: s(item.description),
              colorHint: s(item.colorHint),
            }
          })
          .filter((item) => item.name)
      : [],
    items: Array.isArray(parsed.items)
      ? parsed.items
          .map((item: JsonRecord, index: number) => {
            const rawLevel = s(item.level)
            const level = (skeletonLevels.has(rawLevel) ? rawLevel : 'chapter') as 'volume' | 'act' | 'chapter'
            return {
              tempId: s(item.tempId) || `sk-${index + 1}`,
              parentTempId: s(item.parentTempId),
              title: s(item.title) || `节点 ${index + 1}`,
              summary: s(item.summary),
              level,
              goal: s(item.goal),
              storylineNames: stringList(item.storylineNames),
            }
          })
          .filter((item) => item.title)
      : [],
  }
}

export async function expandOutlineScenesForSkeletonByAi(
  payload: WorkspaceSnapshotPayload,
  input: Parameters<typeof expandOutlineDesignByAi>[1] & {
    skeletonItems: Array<{
      tempId: string
      parentTempId: string
      title: string
      summary: string
      level: 'volume' | 'act' | 'chapter'
      goal: string
      storylineNames: string[]
    }>
    characterCast?: Array<{ name: string; role: string }>
  },
): Promise<{
  items: Awaited<ReturnType<typeof expandOutlineDesignByAi>>['items']
  characterCast: OutlineAiCharacterCastRow[]
  relationCast: OutlineAiRelationCastRow[]
  critiqueNotes?: string
}> {
  const chapterNodes = input.skeletonItems.filter((row) => row.level === 'chapter')
  const contextPack = buildOutlineAiContextPack(payload, resolveOutlineAiNovelBrief(input))
  const prompt = [
    contextPack.text,
    buildOutlineDesignSelectedOptionContext(input),
    `已确认章节骨架：${stableStringify(chapterNodes)}`,
    input.characterCast && input.characterCast.length > 0
      ? `角色表：${stableStringify(input.characterCast)}`
      : '',
    '请只为上述 chapter 节点补充 scene 子节点；每场须体现出场人物的性格差异与关系张力。',
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
  ].filter(Boolean).join('\n\n')

  const parsed = await callAiPromptJson('outline_fill_scenes', prompt, { temperature: OUTLINE_DESIGN_JSON_TEMPERATURE, aiStylePrompt: input.aiStylePrompt, maxTokens: 16384 })
  const levelSet = new Set(['scene'])
  const plotStageSet = new Set(['idea', 'drafted', 'written', 'resolved'])
  const normalizeTension = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    const raw = i(value)
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5) return raw
    return 3
  }

  const sceneItems = Array.isArray(parsed.items)
    ? parsed.items
        .map((item: JsonRecord, index: number) => {
          const rawLevel = s(item.level)
          const rawPlotStage = s(item.plotStage)
          return {
            tempId: s(item.tempId) || `sc-${index + 1}`,
            parentTempId: s(item.parentTempId),
            title: s(item.title) || `场景 ${index + 1}`,
            summary: s(item.summary),
            emotionalTurn: s(item.emotionalTurn),
            proseHint: s(item.proseHint),
            level: (levelSet.has(rawLevel) ? rawLevel : 'scene') as 'scene',
            goal: s(item.goal),
            conflict: s(item.conflict),
            twist: s(item.twist),
            result: s(item.result),
            suspense: s(item.suspense),
            plotStage: (plotStageSet.has(rawPlotStage) ? rawPlotStage : 'idea') as 'idea' | 'drafted' | 'written' | 'resolved',
            storylineNames: stringList(item.storylineNames),
            tension: normalizeTension(item.tension),
            location: s(item.location),
            timeLabel: s(item.timeLabel),
            characterNames: stringList(item.characterNames).slice(0, 8),
            povCharacterName: s(item.povCharacterName),
          }
        })
        .filter((item) => item.title && item.parentTempId)
    : []

  let resultItems = sceneItems
  let critiqueNotes: string | undefined

  // Self-critique loop: run on drafts with 8+ items
  if (resultItems.length >= 8) {
    const critiqued = await critiqueAndFixOutlineByAi(prompt, parsed)
    if (Array.isArray(critiqued.items) && critiqued.items.length >= resultItems.length * 0.5) {
      resultItems = critiqued.items
        .map((item: JsonRecord, index: number) => {
          const rawLevel = s(item.level)
          const rawPlotStage = s(item.plotStage)
          return {
            tempId: s(item.tempId) || `sc-${index + 1}`,
            parentTempId: s(item.parentTempId),
            title: s(item.title) || `场景 ${index + 1}`,
            summary: s(item.summary),
            emotionalTurn: s(item.emotionalTurn),
            proseHint: s(item.proseHint),
            level: 'scene' as const,
            goal: s(item.goal),
            conflict: s(item.conflict),
            twist: s(item.twist),
            result: s(item.result),
            suspense: s(item.suspense),
            plotStage: (plotStageSet.has(rawPlotStage) ? rawPlotStage : 'idea') as 'idea' | 'drafted' | 'written' | 'resolved',
            storylineNames: stringList(item.storylineNames),
            tension: normalizeTension(item.tension),
            location: s(item.location),
            timeLabel: s(item.timeLabel),
            characterNames: stringList(item.characterNames).slice(0, 8),
            povCharacterName: s(item.povCharacterName),
          }
        })
        .filter((item: { title: string; parentTempId: string }) => item.title && item.parentTempId)
      critiqueNotes = s(critiqued.critiqueNotes) || undefined
    }
  }

  return {
    items: resultItems,
    characterCast: parseOutlineCharacterCast(parsed.characterCast),
    relationCast: parseOutlineRelationCast(parsed.relationCast),
    critiqueNotes,
  }
}

function parseOutlineDesignItemRows(parsed: JsonRecord): Array<{
  tempId: string
  parentTempId: string
  title: string
  summary: string
  level: 'volume' | 'act' | 'chapter' | 'scene'
  goal: string
  conflict: string
  twist: string
  result: string
  suspense: string
  plotStage: 'idea' | 'drafted' | 'written' | 'resolved'
  storylineNames: string[]
  tension: 1 | 2 | 3 | 4 | 5
  location: string
  timeLabel: string
  characterNames: string[]
  povCharacterName: string
  emotionalTurn: string
  proseHint: string
}> {
  const levelSet = new Set(['volume', 'act', 'chapter', 'scene'])
  const plotStageSet = new Set(['idea', 'drafted', 'written', 'resolved'])
  const normalizeTension = (value: unknown): 1 | 2 | 3 | 4 | 5 => {
    const raw = i(value)
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5) return raw
    return 3
  }
  if (!Array.isArray(parsed.items)) return []
  return parsed.items
    .map((item: JsonRecord, index: number) => {
      const rawLevel = s(item.level)
      const rawPlotStage = s(item.plotStage)
      return {
        tempId: s(item.tempId) || `node-${index + 1}`,
        parentTempId: s(item.parentTempId),
        title: s(item.title) || `节点 ${index + 1}`,
        summary: s(item.summary),
        emotionalTurn: s(item.emotionalTurn),
        proseHint: s(item.proseHint),
        level: (levelSet.has(rawLevel) ? rawLevel : 'scene') as 'volume' | 'act' | 'chapter' | 'scene',
        goal: s(item.goal),
        conflict: s(item.conflict),
        twist: s(item.twist),
        result: s(item.result),
        suspense: s(item.suspense),
        plotStage: (plotStageSet.has(rawPlotStage) ? rawPlotStage : 'idea') as 'idea' | 'drafted' | 'written' | 'resolved',
        storylineNames: stringList(item.storylineNames),
        tension: normalizeTension(item.tension),
        location: s(item.location),
        timeLabel: s(item.timeLabel),
        characterNames: stringList(item.characterNames).slice(0, 8),
        povCharacterName: s(item.povCharacterName),
      }
    })
    .filter((item) => item.title)
}

export async function expandOutlineFromExistingByAi(
  payload: WorkspaceSnapshotPayload,
  input: {
    novel: {
      title: string
      summary?: string
      continuityBrief?: string
      genre?: string
      perspective?: string
      tone?: string
    }
    aiStylePrompt?: string
    anchorOutlineId: string
    expandNote?: string
    expandPreset?: 'auto' | 'next_chapters' | 'split_scenes' | 'subplot'
  },
): Promise<{
  brief: string
  items: ReturnType<typeof parseOutlineDesignItemRows>
}> {
  const presetHint =
    input.expandPreset === 'next_chapters'
      ? '优先在锚点后新增若干 chapter 节点（每条含简要 goal），必要时再拆 scene。'
      : input.expandPreset === 'split_scenes'
        ? '若锚点是 chapter，为其下拆 2 到 4 个 scene；若已是 scene，可在同级补充衔接场。'
        : input.expandPreset === 'subplot'
          ? '围绕锚点补一条支线走向（chapter/scene），与主线形成交叉但勿抢戏。'
          : '根据作者说明与现有缺口自行判断扩展 chapter 或 scene。'

  const context = buildOutlineAiContextPack(payload, input.novel, {
    anchorOutlineId: input.anchorOutlineId,
  })

  const prompt = [
    context.text,
    `扩展锚点节点 id：${s(input.anchorOutlineId)}`,
    `扩展要求：${s(input.expandNote) || '沿现有大纲自然往后推进'}`,
    presetHint,
    (() => {
      const profiles = matchGenreProfiles(s(input.novel?.genre ?? ''))
      const block = buildGenrePromptInjection(profiles)
      return block ? `【类型指导】\n${block}` : ''
    })(),
    '请只输出新增节点 JSON。',
  ].join('\n\n')

  const parsed = await callAiPromptJson('outline_expand_existing', prompt, { temperature: OUTLINE_DESIGN_JSON_TEMPERATURE, aiStylePrompt: input.aiStylePrompt })
  return {
    brief: s(parsed.brief),
    items: parseOutlineDesignItemRows(parsed),
  }
}
