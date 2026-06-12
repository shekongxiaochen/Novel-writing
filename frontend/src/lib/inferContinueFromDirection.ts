import type { AiContinuePosition, AiContinuePrevSummaryCount, AiContinueTargetChars } from '../types'

export const NEXT_CHAPTER_INTENT_RE =
  /(写下一章|续写下一章|下一章|新开.*章|新建.*章|开新章|新的一章|新章|按大纲写下一)/

// 重写整章意图：注意排在「写下一章」之后判定，含「下一章/新章」的优先归续写。
export const REWRITE_INTENT_RE =
  /(重写|重新写|再写一遍|重写一遍|推翻重写|整章重写|换个写法重写|换种写法重写|重新生成本?章|重新润色整章)/

export type InferredContinueOptions = {
  position: AiContinuePosition
  targetChars: AiContinueTargetChars
  prevSummaryCount: AiContinuePrevSummaryCount
}

const TARGET_CHAR_MAP: Array<{ re: RegExp; chars: AiContinueTargetChars }> = [
  { re: /(?:约|大概|写)?\s*3000\s*字|三千字/, chars: 3000 },
  { re: /(?:约|大概|写)?\s*1500\s*字|一千五|一千五百/, chars: 1500 },
  { re: /(?:约|大概|写)?\s*800\s*字|八百字/, chars: 800 },
]

export function isNextChapterIntent(text: string): boolean {
  return NEXT_CHAPTER_INTENT_RE.test(String(text ?? '').trim())
}

/**
 * 重写整章意图：命中「重写/重新写本章」等表达，但排除「写下一章」类
 * （含下一章/新章时归续写，避免把「重写后写下一章」误判为重写）。
 */
export function isRewriteIntent(text: string): boolean {
  const t = String(text ?? '').trim()
  if (isNextChapterIntent(t)) return false
  return REWRITE_INTENT_RE.test(t)
}

export function inferContinueOptionsFromDirection(direction: string): InferredContinueOptions {
  const text = String(direction ?? '').trim()
  const position: AiContinuePosition = isRewriteIntent(text)
    ? 'replace'
    : /光标|此处|这里|当前位置|插入点/.test(text)
      ? 'cursor'
      : 'end'

  let targetChars: AiContinueTargetChars = 1500
  if (isNextChapterIntent(text)) {
    targetChars = 1500
  } else {
    for (const row of TARGET_CHAR_MAP) {
      if (row.re.test(text)) {
        targetChars = row.chars
        break
      }
    }
  }

  let prevSummaryCount: AiContinuePrevSummaryCount = 3
  if (/前\s*5\s*章|前五章/.test(text)) prevSummaryCount = 5
  else if (/前\s*2\s*章|前两章/.test(text)) prevSummaryCount = 2

  return { position, targetChars, prevSummaryCount }
}
