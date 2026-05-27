import type { EntityToken } from '../types'

export type ChapterQuoteSelectionRange = {
  start: number
  end: number
}

export type ChapterPinnedQuoteSelection = {
  chapterId: string
  start: number
  end: number
}

export function normalizeQuoteRange(start: number, end: number, contentLength: number): ChapterQuoteSelectionRange | null {
  const max = Math.max(0, contentLength)
  const left = Math.min(Math.max(0, start), max)
  const right = Math.min(Math.max(0, end), max)
  if (right <= left) return null
  return { start: left, end: right }
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart
}

export function tokenOverlapsQuoteSelection(
  token: Pick<EntityToken, 'range'>,
  quote: ChapterQuoteSelectionRange | null | undefined,
): boolean {
  if (!quote || !token.range) return false
  return rangesOverlap(token.range.start, token.range.end, quote.start, quote.end)
}
