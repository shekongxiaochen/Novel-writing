import type { Chapter } from '../types'

export type ContinueRagSnippet = {
  chapterId: string
  chapterNo: number
  chapterTitle: string
  excerpt: string
  matchedTerms: string[]
  score: number
  /** 命中来源，便于 UI 区分 */
  source: 'character' | 'foreshadow' | 'location'
}

export type ContinueRagSearchInput = {
  chapters: Chapter[]
  currentChapterId: string
  terms: string[]
  source?: ContinueRagSnippet['source']
  minTermLength?: number
  /** 最多返回片段数 */
  maxSnippets?: number
  /** 每章最多片段数 */
  maxPerChapter?: number
  /** 只检索当前章之前多少章（0 = 不限制） */
  maxChaptersBack?: number
  excerptLen?: number
}

export type CollectContinueTermsInput = {
  characters: Array<{ name?: string; aliases?: unknown }>
  direction?: string
  foreshadows?: Array<{
    id?: string
    title?: string
    description?: string
    plantChapterId?: string
    status?: string
  }>
  scanText?: string
  currentChapterId?: string
  outlineForeshadowIds?: string[]
  outlineLocations?: string[]
}

function normalizeTerm(term: string): string {
  return String(term ?? '').trim()
}

function splitParagraphs(text: string): string[] {
  return String(text ?? '')
    .split(/\n\s*\n+/)
    .map((row) => row.replace(/\s+/g, ' ').trim())
    .filter((row) => row.length >= 24)
}

function extractExcerptAroundMatch(text: string, term: string, maxLen: number): string {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const token = normalizeTerm(term)
  const idx = token.length >= 2 ? normalized.indexOf(token) : -1
  if (idx < 0) {
    if (normalized.length <= maxLen) return normalized
    return `${normalized.slice(0, maxLen - 1).trim()}…`
  }
  const half = Math.floor(maxLen / 2)
  const start = Math.max(0, idx - half)
  const end = Math.min(normalized.length, start + maxLen)
  let excerpt = normalized.slice(start, end).trim()
  if (start > 0) excerpt = `…${excerpt}`
  if (end < normalized.length) excerpt = `${excerpt}…`
  return excerpt
}

function matchedTermsInText(terms: string[], text: string, minLen: number): string[] {
  const hits: string[] = []
  for (const term of terms) {
    const token = normalizeTerm(term)
    if (token.length >= minLen && text.includes(token)) hits.push(token)
  }
  return hits
}

/**
 * 按关键词在旧章正文中检索相关片段（关键词 RAG，无需 embedding）。
 */
export function searchContinueRagSnippets(input: ContinueRagSearchInput): ContinueRagSnippet[] {
  const minLen = Math.max(2, Math.trunc(Number(input.minTermLength ?? 2)))
  const terms = [...new Set(input.terms.map(normalizeTerm).filter((term) => term.length >= minLen))].slice(0, 16)
  if (terms.length === 0) return []

  const chapters = [...input.chapters].sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
  const currentIndex = chapters.findIndex((row) => row.id === input.currentChapterId)
  if (currentIndex <= 0) return []

  const maxSnippets = Math.max(1, Math.min(8, Math.trunc(Number(input.maxSnippets ?? 5))))
  const maxPerChapter = Math.max(1, Math.min(3, Math.trunc(Number(input.maxPerChapter ?? 1))))
  const maxChaptersBack = Math.max(0, Math.trunc(Number(input.maxChaptersBack ?? 120)))
  const excerptLen = Math.max(180, Math.min(520, Math.trunc(Number(input.excerptLen ?? 380))))
  const source = input.source ?? 'character'
  const sourceBoost = source === 'foreshadow' ? 40 : source === 'location' ? 20 : 0

  const startIndex = Math.max(0, currentIndex - (maxChaptersBack > 0 ? maxChaptersBack : currentIndex))
  const searchPool = chapters.slice(startIndex, currentIndex).reverse()

  type Candidate = ContinueRagSnippet & { paragraphIndex: number }
  const candidates: Candidate[] = []

  for (const chapter of searchPool) {
    let perChapter = 0
    const paragraphs = splitParagraphs(chapter.content ?? '')
    if (paragraphs.length === 0) {
      const whole = String(chapter.content ?? '').replace(/\s+/g, ' ').trim()
      if (!whole) continue
      paragraphs.push(whole)
    }

    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
      const paragraph = paragraphs[paragraphIndex]
      const matched = matchedTermsInText(terms, paragraph, minLen)
      if (matched.length === 0) continue

      const primary = matched[0]
      const score = matched.length * 100 + sourceBoost + (chapter.chapterNo ?? 0) * 0.1 + paragraph.length * 0.001
      candidates.push({
        chapterId: chapter.id,
        chapterNo: chapter.chapterNo ?? 0,
        chapterTitle: String(chapter.title ?? '').trim() || '未命名章节',
        excerpt: extractExcerptAroundMatch(paragraph, primary, excerptLen),
        matchedTerms: matched,
        score,
        source,
        paragraphIndex,
      })
      perChapter += 1
      if (perChapter >= maxPerChapter) break
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  const picked: ContinueRagSnippet[] = []
  const perChapterCount = new Map<string, number>()
  for (const row of candidates) {
    if (picked.length >= maxSnippets) break
    const count = perChapterCount.get(row.chapterId) ?? 0
    if (count >= maxPerChapter) continue
    picked.push({
      chapterId: row.chapterId,
      chapterNo: row.chapterNo,
      chapterTitle: row.chapterTitle,
      excerpt: row.excerpt,
      matchedTerms: row.matchedTerms,
      score: row.score,
      source: row.source,
    })
    perChapterCount.set(row.chapterId, count + 1)
  }

  return picked.sort((a, b) => a.chapterNo - b.chapterNo)
}

export function collectForeshadowSearchTerms(input: {
  foreshadows: CollectContinueTermsInput['foreshadows']
  scanText: string
  currentChapterId: string
  outlineForeshadowIds: string[]
}): string[] {
  const terms = new Set<string>()
  const text = String(input.scanText ?? '')
  const outlineSet = new Set(input.outlineForeshadowIds.map(normalizeTerm).filter(Boolean))
  for (const row of input.foreshadows ?? []) {
    if (normalizeTerm(String(row.status ?? '')) === 'fulfilled') continue
    const id = normalizeTerm(String(row.id ?? ''))
    const title = normalizeTerm(String(row.title ?? ''))
    if (title.length < 3) continue
    const inOutline = id && outlineSet.has(id)
    const inText = text.includes(title)
    const plantedHere = normalizeTerm(String(row.plantChapterId ?? '')) === normalizeTerm(input.currentChapterId)
    if (inOutline || inText || plantedHere) terms.add(title)
  }
  return [...terms].slice(0, 8)
}

export function collectLocationSearchTerms(input: {
  locations: string[]
  scanText: string
}): string[] {
  const text = String(input.scanText ?? '')
  const terms = new Set<string>()
  for (const location of input.locations) {
    const token = normalizeTerm(location)
    if (token.length >= 2 && text.includes(token)) terms.add(token)
  }
  return [...terms].slice(0, 4)
}

export function collectContinueSearchTerms(input: CollectContinueTermsInput): string[] {
  const terms = new Set<string>()
  for (const row of input.characters) {
    const name = normalizeTerm(String(row.name ?? ''))
    if (name.length >= 2) terms.add(name)
    const aliases = Array.isArray(row.aliases) ? row.aliases : []
    for (const alias of aliases) {
      const token = normalizeTerm(String(alias ?? ''))
      if (token.length >= 2) terms.add(token)
    }
  }

  const directionText = normalizeTerm(input.direction ?? '')
  if (directionText.length >= 2) {
    for (const row of input.characters) {
      const name = normalizeTerm(String(row.name ?? ''))
      if (name.length >= 2 && directionText.includes(name)) terms.add(name)
    }
  }

  return [...terms].slice(0, 16)
}

export function mergeContinueRagSnippets(groups: ContinueRagSnippet[], maxTotal: number): ContinueRagSnippet[] {
  const merged: ContinueRagSnippet[] = []
  const seen = new Set<string>()
  for (const row of groups) {
    const key = `${row.chapterId}:${row.excerpt.slice(0, 48)}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(row)
    if (merged.length >= maxTotal) break
  }
  return merged.sort((a, b) => a.chapterNo - b.chapterNo)
}

export function buildContinueRagHits(input: {
  chapters: Chapter[]
  currentChapterId: string
  characters: CollectContinueTermsInput['characters']
  direction?: string
  foreshadows?: CollectContinueTermsInput['foreshadows']
  scanText: string
  outlineForeshadowIds: string[]
  outlineLocations: string[]
}): ContinueRagSnippet[] {
  const characterTerms = collectContinueSearchTerms({
    characters: input.characters,
    direction: input.direction,
  })
  const foreshadowTerms = collectForeshadowSearchTerms({
    foreshadows: input.foreshadows,
    scanText: input.scanText,
    currentChapterId: input.currentChapterId,
    outlineForeshadowIds: input.outlineForeshadowIds,
  })
  const locationTerms = collectLocationSearchTerms({
    locations: input.outlineLocations,
    scanText: input.scanText,
  })

  const base = {
    chapters: input.chapters,
    currentChapterId: input.currentChapterId,
    maxChaptersBack: 100,
    maxPerChapter: 1,
    excerptLen: 380,
  }

  const charHits =
    characterTerms.length > 0
      ? searchContinueRagSnippets({
          ...base,
          terms: characterTerms,
          source: 'character',
          maxSnippets: 4,
        })
      : []

  const foreshadowHits =
    foreshadowTerms.length > 0
      ? searchContinueRagSnippets({
          ...base,
          terms: foreshadowTerms,
          source: 'foreshadow',
          minTermLength: 3,
          maxSnippets: 3,
        })
      : []

  const locationHits =
    locationTerms.length > 0
      ? searchContinueRagSnippets({
          ...base,
          terms: locationTerms,
          source: 'location',
          minTermLength: 2,
          maxSnippets: 2,
        })
      : []

  return mergeContinueRagSnippets([...charHits, ...foreshadowHits, ...locationHits], 6)
}

export function formatContinueRagSnippetsForPrompt(snippets: ContinueRagSnippet[]): string {
  if (snippets.length === 0) return ''
  const sourceLabel = (source: ContinueRagSnippet['source']) => {
    if (source === 'foreshadow') return '伏笔'
    if (source === 'location') return '地点'
    return '人物'
  }
  const lines = snippets.map(
    (row, index) =>
      `${index + 1}. 第 ${row.chapterNo} 章《${row.chapterTitle}》【${sourceLabel(row.source)}：${row.matchedTerms.join('、')}】\n${row.excerpt}`,
  )
  return ['【旧章检索片段 —— 仅供设定与语气参考，勿复述】', ...lines].join('\n\n')
}
