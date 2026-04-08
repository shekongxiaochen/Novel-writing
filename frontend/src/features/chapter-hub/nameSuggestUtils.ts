export function getTypingPrefixInfo(ta: HTMLTextAreaElement): { start: number; end: number; prefix: string } | null {
  const end = ta.selectionStart ?? 0
  const text = ta.value.slice(0, end)
  const m = text.match(/([\p{Script=Han}A-Za-z0-9_]+)$/u)
  if (!m || !m[1]) return null
  const prefix = m[1]
  return { start: end - prefix.length, end, prefix }
}

export function resolveNamePrefix(
  textPrefix: string,
  names: string[]
): { prefix: string; offsetFromEnd: number } | null {
  const s = textPrefix.trim()
  if (!s) return null

  const maxLen = Math.min(12, s.length)
  for (let len = maxLen; len >= 1; len--) {
    const suffix = s.slice(-len)
    if (!suffix) continue
    if (names.some((n) => n.startsWith(suffix))) {
      return { prefix: suffix, offsetFromEnd: len }
    }
  }
  return null
}
