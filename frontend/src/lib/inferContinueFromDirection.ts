import type { AiContinuePosition, AiContinuePrevSummaryCount, AiContinueTargetChars } from '../types'

export const NEXT_CHAPTER_INTENT_RE =
  /(写下一章|续写下一章|下一章|新开.*章|新建.*章|开新章|新的一章|新章|按大纲写下一)/

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

export function inferContinueOptionsFromDirection(direction: string): InferredContinueOptions {
  const text = String(direction ?? '').trim()
  const position: AiContinuePosition = /光标|此处|这里|当前位置|插入点/.test(text) ? 'cursor' : 'end'

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
