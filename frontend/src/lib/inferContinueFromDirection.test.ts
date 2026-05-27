import { describe, expect, it } from 'vitest'
import { inferContinueOptionsFromDirection, isNextChapterIntent } from './inferContinueFromDirection'

describe('inferContinueOptionsFromDirection', () => {
  it('defaults to chapter end and 1500 chars', () => {
    expect(inferContinueOptionsFromDirection('')).toEqual({
      position: 'end',
      targetChars: 1500,
      prevSummaryCount: 3,
    })
  })

  it('detects cursor position and word count', () => {
    expect(inferContinueOptionsFromDirection('在光标处续写约800字')).toEqual({
      position: 'cursor',
      targetChars: 800,
      prevSummaryCount: 3,
    })
  })

  it('detects next chapter intent', () => {
    expect(isNextChapterIntent('按大纲写下一章')).toBe(true)
    expect(inferContinueOptionsFromDirection('写下一章').targetChars).toBe(1500)
  })
})
