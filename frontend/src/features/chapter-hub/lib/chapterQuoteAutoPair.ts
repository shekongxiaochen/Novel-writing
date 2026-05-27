export type QuotePair = { open: string; close: string }

/** 前引号 → 后引号（ASCII 直引号、中文弯引号、直角引号） */
export const CHAPTER_QUOTE_PAIRS: QuotePair[] = [
  { open: '\u0022', close: '\u0022' },
  { open: '\u0027', close: '\u0027' },
  { open: '\u201c', close: '\u201d' },
  { open: '\u2018', close: '\u2019' },
  { open: '\u300c', close: '\u300d' },
  { open: '\u300e', close: '\u300f' },
]

export function findQuotePairByOpen(char: string): QuotePair | undefined {
  return CHAPTER_QUOTE_PAIRS.find((pair) => pair.open === char)
}

export function findQuotePairByClose(char: string): QuotePair | undefined {
  return CHAPTER_QUOTE_PAIRS.find((pair) => pair.close === char)
}

export type QuoteAutoPairEdit =
  | { kind: 'skip-close'; caret: number }
  | { kind: 'insert-pair'; text: string; caret: number }

/**
 * 输入前引号时插入成对引号；若下一字符已是后引号则跳过（过键入后引号）。
 */
export function planQuoteAutoPairEdit(
  key: string,
  content: string,
  selectionStart: number,
  selectionEnd: number,
): QuoteAutoPairEdit | null {
  if (key.length !== 1) return null

  const start = Math.max(0, selectionStart)
  const end = Math.max(0, selectionEnd)

  const closePair = findQuotePairByClose(key)
  if (closePair && start === end && content[start] === key) {
    return { kind: 'skip-close', caret: start + 1 }
  }

  const openPair = findQuotePairByOpen(key)
  if (!openPair) return null

  const insert = openPair.open + openPair.close
  const next = content.slice(0, start) + insert + content.slice(end)
  return { kind: 'insert-pair', text: next, caret: start + openPair.open.length }
}

export function applyQuoteAutoPairEdit(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  edit: QuoteAutoPairEdit,
): { text: string; caret: number } {
  if (edit.kind === 'skip-close') {
    return { text: content, caret: edit.caret }
  }
  return { text: edit.text, caret: edit.caret }
}
