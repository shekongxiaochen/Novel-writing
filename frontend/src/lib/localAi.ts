import type {
  AiExtractMode,
  AiMessage,
  AiToolCall,
  AiToolDefinition,
  EntityMatch,
  EntityMatchType,
  NovelChapterClassificationResult,
  NovelEntityExtractResult,
  NovelForeshadowAnalysisResult,
  OutlineItem,
} from '../types'
import type { AiToolResult } from '../types'
import { getAiSettings } from './aiSettings'
import { AI_WRITE_TOOLS, executeToolCall } from './aiTools'
import type { WorkspaceSnapshotPayload } from './storage'

type JsonRecord = Record<string, any>

const JSON_ONLY_SYSTEM_PROMPT = [
  '你只输出合法 JSON，不输出解释，不输出 Markdown，不输出代码块。',
  '如果字段不确定，保留空字符串、空数组，或直接不输出该项；不要编造。',
].join('\n')

const EXTRACT_SYSTEM_PROMPT = [
  '你是中文小说实体整理助手，不是续写助手。',
  '你的任务是从给定的小说上下文中，整理出值得作者确认的角色、势力、物品、角色所属势力、角色关系，以及提醒信息。',
  '你只依据输入文本和给定档案工作，不能凭常识补写设定，不能脑补未出现的事实。',
  '如果同一人物前文只出现无名指代，后文才揭示真名，只输出一个角色：name 用真名，无名称呼放进 aliases。',
  '角色除了基础字段外，还要尽量提炼可稳定复用的人物画像，尤其是性格、气质、说话风格、行事风格、习惯、立场、价值取向、待人方式、情绪底色等，放进 characters[].attributes。',
  '这类人物画像不要塞进 notes，优先写进扩展条目 attributes；key 要短，像“性格”“气质”“说话风格”“习惯”“立场”。',
  '关系方向必须严格遵守语义方向。若识别为“A是B的师傅”，则 fromCharacterName 必须是 A，toCharacterName 必须是 B，relationType 必须是“师傅”。不要反过来写。',
  'memberships 表示角色属于某势力；relations 表示 fromCharacterName 相对于 toCharacterName 的称谓或关系。',
  '只有在文本证据足够明确时才输出关系、归属、秘密、目标、扩展条目；证据不足就留空或不输出。',
  '宁可多提取候选，也不要因为保守而漏掉正文里已经出现且有文本依据的人物、势力、物品、归属、关系和可复用描述。只要值得作者确认，就应该输出。',
  '输出必须是单个 JSON 对象，顶层只包含以下键：characters, factions, items, memberships, relations, warnings。',
  'characters[].字段：name, aliases, gender, age, goal, secret, notes, attributes, firstAppearanceChapterNo, confidence, evidences, warnings。',
  'characters[].attributes 的格式必须是数组，每项为 { "key": "...", "value": "..." }。',
  'factions[].字段：name, leader, notes, confidence, evidences, warnings。',
  'items[].字段：name, summary, ownerType, ownerName, firstAppearanceChapterNo, confidence, evidences, warnings。',
  'memberships[].字段：characterName, factionName, description, confidence, evidences, warnings。',
  'relations[].字段：fromCharacterName, toCharacterName, relationType, note, confidence, evidences, warnings。',
  'evidences 是证据数组，每项尽量包含 chapterId, chapterNo, quote。quote 要短，抓最能支持判断的原文片段。',
  'warnings 用于写总结性提醒，例如信息冲突、身份仍不确定、像是伏笔呼应但证据未闭合等。',
  '如果现有档案里已经有实体，本轮更像是补充新信息或修正信息，也照样输出建议，由调用方决定是新建还是合并。',
  '不要输出空壳实体：没有名字的角色、没有名字的势力、没有名字的物品都不要输出。',
].join('\n')

const FORESHADOW_SYSTEM_PROMPT = [
  '你是中文小说伏笔分析助手，不是续写助手。',
  '你的任务是结合章节正文、已有伏笔档案、相关大纲与分类信息，分析当前范围内的伏笔价值。',
  '输出必须是单个 JSON 对象，顶层只包含以下键：newPlants, fulfillments, danglingThreads, warnings。',
  'newPlants 表示本次正文里新出现、值得作者考虑立档的伏笔候选。',
  'fulfillments 表示本次正文里对已有伏笔的回收、呼应或疑似回收。',
  'danglingThreads 表示已有伏笔中，在本次范围尤其值得作者注意的悬而未收线索。',
  'newPlants[].字段：title, summary, payoffHint, confidence, evidences, warnings。',
  'fulfillments[].字段：title, summary, relatedPlantTitle, status, confidence, evidences, warnings。status 只能是 existing 或 implicit。',
  'danglingThreads[].字段：title, summary, lastMentionChapterNo, suggestedPayoff, confidence, evidences, warnings。',
  'evidences 每项尽量包含 chapterId, chapterNo, quote。',
  '不要把泛泛的悬念都当成伏笔；只有当文本里存在可复用、可回收的信息钩子时才输出。',
  '不要编造尚未出现的回收；证据不足就写进 warnings，或者不输出该项。',
].join('\n')

const CLASSIFICATION_SYSTEM_PROMPT = [
  '你是中文小说章节诊断助手，不是续写助手。',
  '你的任务是判断当前分析范围内章节的功能类型、节奏和信息推进情况，帮助作者理解这一章“在干什么”。',
  '输出必须是单个 JSON 对象，顶层只包含以下键：chapterType, pacing, tensionLevel, storyFunctions, informationGain, activeForeshadows, tags, mainConflict, summary, rationale, warnings。',
  'chapterType 用简短中文概括，如“铺垫章”“冲突升级章”“揭示章”“转折章”“回收章”“过渡章”。',
  'pacing 用简短中文概括节奏，如“慢热铺陈”“平稳推进”“快速推进”“高压爆发”“回落收束”。',
  'tensionLevel 用 1 到 5 的整数。',
  'storyFunctions, informationGain, activeForeshadows, tags 都是字符串数组。',
  'mainConflict, summary, rationale 是简短中文句子。',
  'warnings 用于提示分类犹豫、信息不足、功能混杂等情况。',
  '只基于输入文本和档案，不要编造未写出的剧情功能。',
].join('\n')

const CHAPTER_SUMMARY_SYSTEM_PROMPT = [
  '你是中文小说章节总结助手，不是续写助手。',
  '你的任务是根据给定的章节正文、相关上下文和档案信息，生成适合作者回顾使用的章节总结。',
  '总结要忠于原文，不要编造剧情，不要补写设定。',
  '优先说明这一章实际发生了什么、人物推进了什么、冲突或悬念停在何处。',
  '输出纯中文正文，不要使用 Markdown。',
  '默认按“情节一：……”“情节二：……”这样的结构分段输出。',
  '每一段只写一个连续情节单元，先点明该段发生了什么，再补充关键人物动作、信息推进或悬念落点。',
  '段落数量通常为 3 到 6 段；如果章节内容更集中，也可以少于 3 段，但不要硬拆。',
  '不要写“第一部分”“第二部分”“总结如下”等套话，不要输出项目符号。',
  '语言清楚、完整，适合作为作者回顾章节时直接保存的章总结草稿。',
].join('\n')

const QA_SYSTEM_PROMPT = [
  '你是中文小说写作阅读助手。你的职责是根据给定的正文、角色、势力、物品、关系、伏笔、时间线和大纲，回答作者的具体问题。',
  '',
  '【核心规则】',
  '1. 你只有阅读权限，不能执行任何操作。你无法创建、修改、删除任何角色、大纲、章节或其他数据。当用户要求你”做”某事时，你只能给出建议或操作步骤，绝不能说自己已经完成了操作。严禁使用”已清空””已删除””已创建””已完成””操作成功”等表述。',
  '2. 只基于输入上下文回答；不要编造，不要把猜测说成事实。如果证据不足，要明确说”不确定”或”当前上下文不足以确认”。',
  '3. 回答要直接、简洁、对写作有帮助；优先给结论，再补一两句依据。',
  '4. 如果问题涉及人物身份、关系方向、伏笔是否回收、信息是否冲突，要明确指出依据来自哪一章。',
  '5. 如果作者引用了一段正文，要优先围绕那段内容作答，再联系相关档案解释。',
  '',
  '【输出格式禁忌 —— 极其重要】',
  '你的回答是写给小说作者看的，不是写给程序员看的。严格禁止：',
  '- 不要出现任何内部 ID（如 1778600425576-a57fa8a1）',
  '- 不要出现任何英文字段名（如 summary、conflict、goal、characterRelations、JSON 等）',
  '- 不要出现数据结构术语（如”档案底座””节点””字段””列表””数组”等）',
  '- 不要用括号标注类型或来源（如”见characterRelations””依据大纲JSON”等）',
  '用自然的中文叙述来表达所有信息。把字段含义用人话翻译出来，不要照搬字段名。',
].join('\n')

const QA_WITH_TOOLS_SYSTEM_PROMPT = [
  '你是中文小说写作助手。你不仅能回答问题，更能直接操作数据。',
  '',
  '【核心原则 —— 优先行动】',
  '当用户的请求涉及以下意图时，你必须调用对应的函数，而不是只给文字说明：',
  '- "创建"/"新建"/"添加"/"加一个" → 调用 create_xxx',
  '- "删除"/"清空"/"移除"/"去掉"/"删掉" → 调用 delete_xxx',
  '- "修改"/"改"/"更新"/"设置"/"调整" → 调用 update_xxx',
  '宁可多调用一次工具，也不要在能操作的情况下只给文字建议。',
  '',
  '【绝对禁止】',
  '- 严禁说"已完成"但实际没有调用函数',
  '- 严禁说"我无法执行"或"建议你手动操作"——你有工具，用工具',
  '- 严禁在有匹配工具的情况下只做文字分析而不调用',
  '',
  '【你可以做的操作】',
  '- 大纲：创建/修改/删除情节点 (create_outline_item, update_outline_item, delete_outline_item)',
  '- 角色：创建/修改/删除角色 (create_character, update_character, delete_character)',
  '- 势力：创建势力 (create_faction)',
  '- 角色关系：创建两个角色之间的关系 (create_character_relation)',
  '- 伏笔：创建伏笔记录 (create_foreshadow_plant)',
  '- 时间线：创建时间线事件 (create_timeline_event)',
  '',
  '【操作规则】',
  '1. 执行操作前，简短说明你打算做什么（一句即可）',
  '2. 操作完成后，用自然语言总结结果',
  '3. 修改或删除前确认目标 ID 存在于上下文中；模糊时先问',
  '4. "清空所有"等批量操作要对每个目标分别调用删除函数',
  '5. 创建角色时填充丰富画像：性格、气质、目标、秘密、年龄等',
  '6. 只基于输入上下文操作，不编造不存在的信息',
  '7. 先执行操作再回应，不要在还没操作的情况下说"已完成"',
  '',
  '【回答规范】',
  '- 回答写给小说作者看，不是程序员',
  '- 不要输出内部 ID、英文字段名、数据结构术语',
  '- 用自然中文叙述表达所有信息',
].join('\n')

function s(value: unknown): string {
  return String(value ?? '').trim()
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
              chapterId: item.chapterId,
              chapterNo: item.chapterNo,
              text: item.text,
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

async function callAiJson(prompt: string, systemPrompt: string = EXTRACT_SYSTEM_PROMPT): Promise<JsonRecord> {
  const settings = getAiSettings()
  if (!settings.apiKey) throw new Error('请先在 AI 设置里填写 API Key')
  const resp = await fetch(settings.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: JSON_ONLY_SYSTEM_PROMPT },
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `AI 请求失败：HTTP ${resp.status}`)
  }
  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') return parseAiJsonContent(content)
  if (content && typeof content === 'object') return content as JsonRecord
  throw new Error('AI 返回格式无效')
}

async function callAiText(systemPrompt: string, userPrompt: string): Promise<string> {
  const settings = getAiSettings()
  if (!settings.apiKey) throw new Error('请先在 AI 设置里填写 API Key')
  const resp = await fetch(settings.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.25,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `AI 请求失败：HTTP ${resp.status}`)
  }
  const data = await resp.json()
  return s(data?.choices?.[0]?.message?.content)
}

async function callAiTextStream(
  systemPrompt: string,
  userPrompt: string,
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<string> {
  const settings = getAiSettings()
  if (!settings.apiKey) throw new Error('请先在 AI 设置里填写 API Key')
  const resp = await fetch(settings.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.25,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
    }),
    signal,
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `AI 请求失败：HTTP ${resp.status}`)
  }
  const reader = resp.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式读取')
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = s(parsed?.choices?.[0]?.delta?.content)
          if (delta) {
            full += delta
            callbacks.onChunk(delta)
          }
        } catch {
          /* skip unparseable lines */
        }
      }
    }
    return full
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    callbacks.onError(err)
    throw err
  }
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
  if (isLikelyUnnamedDescriptor(s(entity.name)) && best.row && best.score >= 0.66) {
    return createMatch('possible_duplicate', best.row)
  }
  return best.row && best.score >= 0.78 ? createMatch('possible_duplicate', best.row) : createMatch('new')
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
    let next = {
      ...current,
      aliases: [...current.aliases],
      attributes: [...current.attributes],
      evidences: [...current.evidences],
      warnings: [...current.warnings],
    }

    for (let otherIndex = index + 1; otherIndex < rows.length; otherIndex += 1) {
      if (consumed.has(otherIndex)) continue
      const other = rows[otherIndex]
      const currentNames = uniqueStrings([next.name, ...next.aliases])
      const otherNames = uniqueStrings([other.name, ...other.aliases])
      const namesOverlap =
        currentNames.some((name) => otherNames.some((candidate) => normName(name) === normName(candidate))) ||
        currentNames.some((name) => similarity(name, other.name) >= 0.92) ||
        otherNames.some((name) => similarity(name, next.name) >= 0.92)
      const genericPair =
        (isLikelyUnnamedDescriptor(next.name) && !isLikelyUnnamedDescriptor(other.name)) ||
        (!isLikelyUnnamedDescriptor(next.name) && isLikelyUnnamedDescriptor(other.name))

      if (!namesOverlap && !genericPair) continue

      const primary =
        isLikelyUnnamedDescriptor(next.name) && !isLikelyUnnamedDescriptor(other.name)
          ? other
          : next

      next = {
        ...next,
        name: primary.name,
        aliases: uniqueStrings([next.name, other.name, ...next.aliases, ...other.aliases]).filter(
          (alias) => normName(alias) !== normName(primary.name),
        ),
        gender: next.gender || other.gender,
        age: next.age || other.age,
        goal: next.goal || other.goal,
        secret: next.secret || other.secret,
        notes: uniqueStrings([next.notes, other.notes]).join('；'),
        attributes: uniqueStrings(
          [...next.attributes, ...other.attributes].map((attr) => `${s(attr.key)}::${s(attr.value)}`),
        )
          .map((pair) => {
            const [key, ...rest] = pair.split('::')
            return { id: '', key: s(key), value: s(rest.join('::')) }
          })
          .filter((attr) => attr.key && attr.value),
        firstAppearanceChapterNo:
          next.firstAppearanceChapterNo == null
            ? other.firstAppearanceChapterNo
            : other.firstAppearanceChapterNo == null
              ? next.firstAppearanceChapterNo
              : Math.min(next.firstAppearanceChapterNo, other.firstAppearanceChapterNo),
        confidence: Math.max(next.confidence, other.confidence),
        match: next.match.type === 'new' && other.match.type !== 'new' ? other.match : next.match,
        evidences: [...next.evidences, ...other.evidences].slice(0, 8),
        warnings: uniqueStrings([...next.warnings, ...other.warnings]),
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
    return { characters: [], factions: [], items: [], memberships: [], relations: [], warnings: ['没有可分析的章节正文'] }
  }

  const prompt = [
    `提取范围：${input.mode}`,
    '请严格按既定 JSON 结构输出结果。',
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

  const raw = await callAiJson(prompt)
  const characters: NovelEntityExtractResult['characters'] = Array.isArray(raw.characters)
    ? raw.characters
        .filter((row: any) => s(row?.name))
        .map((row: any) => ({
          name: s(row.name),
          aliases: stringList(row.aliases),
          gender: s(row.gender),
          age: s(row.age),
          goal: s(row.goal),
          secret: s(row.secret),
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
          firstAppearanceChapterNo: i(row.firstAppearanceChapterNo ?? row.first_appearance_chapter_no),
          confidence: f(row.confidence),
          match: characterMatch(row, payload),
          evidences: normalizeEvidences(row.evidences),
          warnings: stringList(row.warnings),
        }))
    : []

  return {
    characters: mergeCharacterRows(characters),
    factions: Array.isArray(raw.factions)
      ? raw.factions
          .filter((row: any) => s(row?.name))
          .map((row: any) => ({
            name: s(row.name),
            leader: s(row.leader),
            notes: s(row.notes),
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
    warnings: stringList(raw.warnings),
  }
}

async function callAiMessagesStream(
  messages: AiMessage[],
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
  signal?: AbortSignal,
): Promise<string> {
  const settings = getAiSettings()
  if (!settings.apiKey) throw new Error('请先在 AI 设置里填写 API Key')
  const resp = await fetch(settings.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.25,
      messages,
      stream: true,
    }),
    signal,
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `AI 请求失败：HTTP ${resp.status}`)
  }
  const reader = resp.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式读取')
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const delta = s(parsed?.choices?.[0]?.delta?.content)
          if (delta) {
            full += delta
            callbacks.onChunk(delta)
          }
        } catch {
          /* skip unparseable lines */
        }
      }
    }
    return full
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    callbacks.onError(err)
    throw err
  }
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
        chapterId: row.chapterId ?? null,
        happenedAt: row.happenedAt,
      })), ['happenedAt', 'chapterId', 'title', 'id']),
    })}`,
    `章节正文 JSON：${stableStringify({
      chapters: context.chapters,
    })}`,
    `补充上下文 JSON：${stableStringify({
      nearbyChapters: buildNearbyChapterContext(payload, input.chapterIds),
    })}`,
  ].join('\n')

  const raw = await callAiJson(prompt, FORESHADOW_SYSTEM_PROMPT)
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

  const raw = await callAiJson(prompt, CLASSIFICATION_SYSTEM_PROMPT)
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

  return callAiTextStream(CHAPTER_SUMMARY_SYSTEM_PROMPT, prompt, callbacks, signal)
}

export async function askAiAboutWorkspace(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[]; question: string },
): Promise<string> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return '当前范围里没有可供阅读的章节正文。'
  }

  const userPrompt = [
    `提问范围：${input.mode}`,
    `作者问题：${s(input.question)}`,
    '下面内容分为两部分：先给相对稳定的档案底座，再给本次最易变化的章节正文与附加上下文。',
    `档案底座 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      foreshadows: context.foreshadows,
      characterRelations: context.characterRelations,
      characterFactionMemberships: context.characterFactionMemberships,
    })}`,
    `章节与附加上下文 JSON：${stableStringify({
      chapters: context.chapters,
      timelineEvents: stableSortByKeys((payload.timelineEvents ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        happenedAt: row.happenedAt,
        chapterId: row.chapterId ?? null,
      })), ['happenedAt', 'chapterId', 'title', 'id']),
      outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        level: row.level,
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
  ].join('\n')

  return (await callAiText(QA_SYSTEM_PROMPT, userPrompt)) || '这次没有拿到可展示的回答。'
}

export async function askAiAboutWorkspaceStream(
  payload: WorkspaceSnapshotPayload,
  input: { mode: AiExtractMode; chapterIds?: string[]; question: string },
  callbacks: { onChunk: (text: string) => void; onError: (err: Error) => void },
): Promise<string> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return '当前范围里没有可供阅读的章节正文。'
  }

  const userPrompt = [
    `提问范围：${input.mode}`,
    `作者问题：${s(input.question)}`,
    '下面内容分为两部分：先给相对稳定的档案底座，再给本次最易变化的章节正文与附加上下文。',
    `档案底座 JSON：${stableStringify({
      characters: context.characters,
      factions: context.factions,
      items: context.items,
      foreshadows: context.foreshadows,
      characterRelations: context.characterRelations,
      characterFactionMemberships: context.characterFactionMemberships,
    })}`,
    `章节与附加上下文 JSON：${stableStringify({
      chapters: context.chapters,
      timelineEvents: stableSortByKeys((payload.timelineEvents ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        happenedAt: row.happenedAt,
        chapterId: row.chapterId ?? null,
      })), ['happenedAt', 'chapterId', 'title', 'id']),
      outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        level: row.level,
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
  ].join('\n')

  return (await callAiTextStream(QA_SYSTEM_PROMPT, userPrompt, callbacks)) || '这次没有拿到可展示的回答。'
}

async function callAiWithTools(
  messages: AiMessage[],
  tools: AiToolDefinition[],
  signal?: AbortSignal,
): Promise<{ content: string; toolCalls: AiToolCall[]; reasoningContent: string }> {
  const settings = getAiSettings()
  if (!settings.apiKey) throw new Error('请先在 AI 设置里填写 API Key')

  // Non-streaming: reliable tool_call detection across all providers
  const resp = await fetch(settings.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.25,
      messages,
      tools,
      tool_choice: 'auto',
      stream: false,
    }),
    signal,
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `AI 请求失败：HTTP ${resp.status}`)
  }

  const data = await resp.json()
  const choice = data?.choices?.[0]
  const message = choice?.message

  const content = s(message?.content)
  const reasoningContent = s(message?.reasoning_content)
  const rawCalls = message?.tool_calls
  const toolCalls: AiToolCall[] = []
  if (Array.isArray(rawCalls)) {
    for (const tc of rawCalls) {
      if (tc.type === 'function' && tc.id && tc.function?.name) {
        toolCalls.push({
          id: tc.id,
          type: 'function',
          function: { name: tc.function.name, arguments: tc.function.arguments || '{}' },
        })
      }
    }
  }

  return { content, toolCalls, reasoningContent }
}

export async function askAiWithToolsStream(
  payload: WorkspaceSnapshotPayload,
  input: {
    mode: AiExtractMode
    chapterIds?: string[]
    question: string
    novelId: string
  },
  callbacks: {
    onChunk: (text: string) => void
    onError: (err: Error) => void
  },
  existingHistory?: AiMessage[],
  signal?: AbortSignal,
): Promise<{ text: string; history: AiMessage[] }> {
  const context = buildExtractContext(payload, input.mode, input.chapterIds)
  if (context.chapters.length === 0) {
    return { text: '当前范围里没有可供阅读的章节正文。', history: existingHistory ?? [] }
  }

  const question = s(input.question)
  const actionKeywords =
    /(创建|新建|添加|增加|补充|生成|删除|移除|清空|修改|更新|编辑|调整|设为|绑定|关联|整理|总结|提取|归纳|采用|确认|写入|保存)/
  const shouldUseTools = actionKeywords.test(question)
  const actionHint = shouldUseTools
    ? '【重要提示】如果作者是在要求你直接创建、修改、删除、绑定、整理或写入数据，你必须优先调用工具完成操作，而不是只给文字建议。'
    : ''

  let messages: AiMessage[]
  if (existingHistory && existingHistory.length > 0) {
    const userContent = [`作者追问：${question}`, ...(actionHint ? [actionHint] : [])].join('\n')
    messages = [...existingHistory, { role: 'user', content: userContent }]
  } else {
    const userPrompt = [
      `提问范围：${input.mode}`,
      `作者问题：${question}`,
      ...(actionHint ? [actionHint] : []),
      '下面内容分为两部分：先给相对稳定的档案底座，再给本次最容易变化的章节正文与附加上下文。',
      `档案底座 JSON：${stableStringify({
        characters: context.characters,
        factions: context.factions,
        items: context.items,
        foreshadows: context.foreshadows,
        characterRelations: context.characterRelations,
        characterFactionMemberships: context.characterFactionMemberships,
      })}`,
      `章节与附加上下文 JSON：${stableStringify({
        chapters: context.chapters,
        timelineEvents: stableSortByKeys((payload.timelineEvents ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          happenedAt: row.happenedAt,
          chapterId: row.chapterId ?? null,
        })), ['happenedAt', 'chapterId', 'title', 'id']),
        outline: stableSortByKeys((payload.outline ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          level: row.level,
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
    ].join('\n')
    messages = [
      { role: 'system', content: QA_WITH_TOOLS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]
  }

  if (!shouldUseTools) {
    const text = await callAiMessagesStream(messages, callbacks, signal)
    const finalText = text || '这次没有拿到可展示的回答。'
    messages.push({ role: 'assistant', content: finalText })
    return { text: finalText, history: messages }
  }

  let maxRounds = 5
  while (maxRounds-- > 0) {
    const { content, toolCalls, reasoningContent } = await callAiWithTools(messages, AI_WRITE_TOOLS, signal)
    if (toolCalls.length === 0) {
      const text = await callAiMessagesStream(messages, callbacks, signal)
      const finalText = text || content || '这次没有拿到可展示的回答。'
      messages.push({ role: 'assistant', content: finalText })
      return { text: finalText, history: messages }
    }

    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls,
      ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
    })

    for (const tc of toolCalls) {
      const result = executeToolCall(input.novelId, tc)
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }
  }

  return { text: '这次工具调用轮次过多，未能顺利完成。', history: messages }
}

export async function expandOutlineItemByAi(
  item: Pick<OutlineItem, 'title' | 'summary' | 'goal' | 'conflict' | 'twist' | 'result' | 'suspense'>,
  mode: 'full' | 'conflict' | 'twist' | 'suspense',
): Promise<Pick<OutlineItem, 'conflict' | 'twist' | 'suspense'>> {
  const prompt = [
    '你是中文小说策划编辑。',
    '请根据给定情节点补全内容，要求短句、可直接落地写作。',
    '输出必须是 JSON 对象，键仅包含 conflict, twist, suspense。',
    `任务：${mode}`,
    `标题：${item.title ?? ''}`,
    `摘要：${item.summary ?? ''}`,
    `目标：${item.goal ?? ''}`,
    `已有冲突：${item.conflict ?? ''}`,
    `已有转折：${item.twist ?? ''}`,
    `已有悬念：${item.suspense ?? ''}`,
    `已有结果：${item.result ?? ''}`,
  ].join('\n')

  const raw = await callAiJson(prompt)
  return {
    conflict: s(raw.conflict),
    twist: s(raw.twist),
    suspense: s(raw.suspense),
  }
}
