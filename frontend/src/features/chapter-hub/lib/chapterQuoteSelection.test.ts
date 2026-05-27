import { describe, expect, it } from 'vitest'
import { normalizeQuoteRange, tokenOverlapsQuoteSelection } from './chapterQuoteSelection'

describe('chapterQuoteSelection', () => {
  it('normalizes forward ranges', () => {
    expect(normalizeQuoteRange(3, 10, 100)).toEqual({ start: 3, end: 10 })
  })

  it('rejects empty ranges', () => {
    expect(normalizeQuoteRange(5, 5, 100)).toBeNull()
  })

  it('detects token overlap', () => {
    const hit = tokenOverlapsQuoteSelection({ range: { start: 4, end: 8 } }, { start: 6, end: 12 })
    const miss = tokenOverlapsQuoteSelection({ range: { start: 0, end: 3 } }, { start: 6, end: 12 })
    expect(hit).toBe(true)
    expect(miss).toBe(false)
  })
})
