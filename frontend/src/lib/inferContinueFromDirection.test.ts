import { describe, expect, it } from 'vitest'
import { inferContinueOptionsFromDirection, isNextChapterIntent, isRewriteIntent } from './inferContinueFromDirection'

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

  it('detects rewrite intent and maps to replace position', () => {
    expect(isRewriteIntent('重写第一章')).toBe(true)
    expect(isRewriteIntent('重新写这章')).toBe(true)
    expect(isRewriteIntent('把本章重写一遍')).toBe(true)
    expect(inferContinueOptionsFromDirection('重写本章').position).toBe('replace')
  })

  it('does not treat next-chapter or plain continue as rewrite', () => {
    expect(isRewriteIntent('写下一章')).toBe(false)
    expect(isRewriteIntent('续写本章末尾')).toBe(false)
    expect(inferContinueOptionsFromDirection('写下一章').position).toBe('end')
  })
})
