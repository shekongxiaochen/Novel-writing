import type { Character } from '../types'

/** 规范化别名列表：去空、trim、按小写去重（保留首次出现的写法） */
export function normalizeCharacterAliases(raw: string[] | undefined | null): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of raw) {
    const t = (a ?? '').trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/** 正文匹配 / 提示用：主名 + 别名；与主名同字的别名条目会省略 */
export function characterMatchLabels(c: Character): string[] {
  const name = (c.name ?? '').trim()
  const aliases = normalizeCharacterAliases(c.aliases)
  const seen = new Set<string>()
  const out: string[] = []
  if (name) {
    seen.add(name.toLowerCase())
    out.push(name)
  }
  for (const a of aliases) {
    const key = a.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

export function findCharacterByLabel(characters: Character[], needle: string): Character | null {
  const t = needle.trim()
  if (!t) return null
  return characters.find((c) => characterMatchLabels(c).some((l) => l === t)) ?? null
}

export function someCharacterHasLabel(characters: Character[], needle: string): boolean {
  return findCharacterByLabel(characters, needle) != null
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 将文本中命中的旧角色标签（主名/别名）统一替换成新主名。
 * 注意：这里按“纯文本子串”替换，不做分词边界判断，和正文实体命中策略保持一致。
 */
export function replaceCharacterLabelsInText(
  content: string,
  oldLabels: string[],
  nextName: string,
): string {
  const base = String(content ?? '')
  const target = String(nextName ?? '').trim()
  if (!target) return base
  const labels = normalizeCharacterAliases(oldLabels)
    .map((x) => x.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (labels.length === 0) return base
  const pattern = new RegExp(labels.map((x) => escapeRegExp(x)).join('|'), 'g')
  return base.replace(pattern, target)
}
