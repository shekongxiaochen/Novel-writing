import type { Character, Faction, Item } from '../../types'
import { characterMatchLabels } from '../../lib/characterLabels'

/** 文本中 needle 每一次出现的起始下标（允许重叠，如连续相同字） */
export function findNameOccurrences(haystack: string, needle: string): number[] {
  if (!needle) return []
  const out: number[] = []
  const n = needle.length
  for (let i = 0; i <= haystack.length - n; i++) {
    if (haystack.slice(i, i + n) === needle) out.push(i)
  }
  return out
}

/** 去掉选区首尾空白后的 [start, end)，无效则 null */
export function trimSelectionRange(
  text: string,
  selStart: number,
  selEnd: number
): { start: number; end: number } | null {
  let rs = selStart
  let re = selEnd
  while (rs < re && /\s/.test(text.charAt(rs))) rs++
  while (re > rs && /\s/.test(text.charAt(re - 1))) re--
  if (re <= rs) return null
  return { start: rs, end: re }
}

/**
 * 选区是否落在正文里某次「完整角色名」出现之中，且与名称对应子串一致。
 * 多角色同时匹配时取名称更长者（避免「平安」盖住「陈平安」内的「平安」应归为陈平安）。
 */
export function resolveCharacterCoveringSelection(
  fullText: string,
  selStart: number,
  selEnd: number,
  characters: Character[]
): Character | null {
  if (selEnd <= selStart) return null
  const slice = fullText.slice(selStart, selEnd)
  if (!slice) return null

  let best: Character | null = null
  let bestLen = -1

  for (const c of characters) {
    for (const name of characterMatchLabels(c)) {
      if (!name) continue
      for (const i of findNameOccurrences(fullText, name)) {
        const occEnd = i + name.length
        if (selStart >= i && selEnd <= occEnd) {
          const expected = name.slice(selStart - i, selEnd - i)
          if (slice === expected && name.length > bestLen) {
            best = c
            bestLen = name.length
          }
        }
      }
    }
  }
  return best
}

/** 同上，针对势力名 */
export function resolveFactionCoveringSelection(
  fullText: string,
  selStart: number,
  selEnd: number,
  factions: Faction[]
): Faction | null {
  if (selEnd <= selStart) return null
  const slice = fullText.slice(selStart, selEnd)
  if (!slice) return null

  let best: Faction | null = null
  let bestLen = -1

  for (const f of factions) {
    const name = (f.name ?? '').trim()
    if (!name) continue
    for (const i of findNameOccurrences(fullText, name)) {
      const occEnd = i + name.length
      if (selStart >= i && selEnd <= occEnd) {
        const expected = name.slice(selStart - i, selEnd - i)
        if (slice === expected && name.length > bestLen) {
          best = f
          bestLen = name.length
        }
      }
    }
  }
  return best
}

/** 同上，针对物品名 */
export function resolveItemCoveringSelection(
  fullText: string,
  selStart: number,
  selEnd: number,
  items: Item[]
): Item | null {
  if (selEnd <= selStart) return null
  const slice = fullText.slice(selStart, selEnd)
  if (!slice) return null

  let best: Item | null = null
  let bestLen = -1

  for (const item of items) {
    const name = (item.name ?? '').trim()
    if (!name) continue
    for (const i of findNameOccurrences(fullText, name)) {
      const occEnd = i + name.length
      if (selStart >= i && selEnd <= occEnd) {
        const expected = name.slice(selStart - i, selEnd - i)
        if (slice === expected && name.length > bestLen) {
          best = item
          bestLen = name.length
        }
      }
    }
  }
  return best
}
