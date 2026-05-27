import { describe, expect, it } from 'vitest'
import { planQuoteAutoPairEdit } from './chapterQuoteAutoPair'

describe('planQuoteAutoPairEdit', () => {
  it('inserts paired ASCII double quotes', () => {
    const edit = planQuoteAutoPairEdit('"', 'hello', 5, 5)
    expect(edit).toEqual({ kind: 'insert-pair', text: 'hello""', caret: 6 })
  })

  it('inserts paired ASCII single quotes', () => {
    const edit = planQuoteAutoPairEdit("'", 'ab', 0, 0)
    expect(edit).toEqual({ kind: 'insert-pair', text: "''ab", caret: 1 })
  })

  it('inserts paired curly double quotes', () => {
    const edit = planQuoteAutoPairEdit('\u201c', '你好', 2, 2)
    expect(edit).toEqual({ kind: 'insert-pair', text: '你好\u201c\u201d', caret: 3 })
  })

  it('inserts paired Chinese corner quotes', () => {
    const edit = planQuoteAutoPairEdit('「', '测试', 2, 2)
    expect(edit).toEqual({ kind: 'insert-pair', text: '测试「」', caret: 3 })
  })

  it('skips over existing closing quote when typing the same character', () => {
    const edit = planQuoteAutoPairEdit('"', 'say""', 4, 4)
    expect(edit).toEqual({ kind: 'skip-close', caret: 5 })
  })

  it('returns null for unrelated keys', () => {
    expect(planQuoteAutoPairEdit('a', 'text', 0, 0)).toBeNull()
  })
})
