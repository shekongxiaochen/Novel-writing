export type TextSearchMatch = { start: number; end: number }

export type TextSearchSegment =
  | { kind: 'text'; text: string }
  | { kind: 'match'; text: string; matchIndex: number }

export function findTextSearchMatches(text: string, query: string): TextSearchMatch[] {
  const haystack = String(text ?? '')
  const needle = String(query ?? '')
  if (!needle) return []

  const matches: TextSearchMatch[] = []
  let from = 0
  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from)
    if (index === -1) break
    matches.push({ start: index, end: index + needle.length })
    from = index + Math.max(needle.length, 1)
  }
  return matches
}

export function buildTextSearchSegments(text: string, matches: TextSearchMatch[]): TextSearchSegment[] {
  if (matches.length === 0) return [{ kind: 'text', text }]

  const segments: TextSearchSegment[] = []
  let cursor = 0
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    if (match.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, match.start) })
    }
    segments.push({ kind: 'match', text: text.slice(match.start, match.end), matchIndex: i })
    cursor = match.end
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) })
  }
  return segments
}

export function resolveSearchMatchHighlight(
  range: { start: number; end: number } | null | undefined,
  matches: TextSearchMatch[],
  activeMatchIndex: number,
): 'active' | 'match' | null {
  if (!range || matches.length === 0) return null
  let found: 'active' | 'match' | null = null
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    if (range.start >= match.end || range.end <= match.start) continue
    if (i === activeMatchIndex) return 'active'
    found = 'match'
  }
  return found
}
