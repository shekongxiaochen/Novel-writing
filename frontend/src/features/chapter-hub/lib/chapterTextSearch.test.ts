import { describe, expect, it } from 'vitest'
import {
  buildTextSearchSegments,
  findTextSearchMatches,
  resolveSearchMatchHighlight,
} from './chapterTextSearch'

describe('chapterTextSearch', () => {
  it('finds all non-overlapping matches', () => {
    expect(findTextSearchMatches('abc abc', 'abc')).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
    ])
  })

  it('builds highlight segments', () => {
    const segments = buildTextSearchSegments('hello world', [{ start: 6, end: 11 }])
    expect(segments).toEqual([
      { kind: 'text', text: 'hello ' },
      { kind: 'match', text: 'world', matchIndex: 0 },
    ])
  })

  it('resolves active match highlight for overlapping range', () => {
    const matches = findTextSearchMatches('foo bar foo', 'foo')
    expect(resolveSearchMatchHighlight({ start: 0, end: 3 }, matches, 0)).toBe('active')
    expect(resolveSearchMatchHighlight({ start: 8, end: 11 }, matches, 0)).toBe('match')
  })
})
