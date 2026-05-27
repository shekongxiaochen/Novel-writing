import { describe, expect, it } from 'vitest'
import { buildChapterContinueOutlineHint } from './outlineContinueHint'
import type { Chapter, OutlineItem } from '../types'

describe('buildChapterContinueOutlineHint', () => {
  it('returns empty hint when chapter has no outline binding', () => {
    const hint = buildChapterContinueOutlineHint([], { outlineItemIds: [] } as Chapter)
    expect(hint.bound).toBe(false)
    expect(hint.beatLine).toBe('')
  })

  it('builds beat line from linked scene', () => {
    const outline: OutlineItem[] = [
      {
        id: 's1',
        novelId: 'n1',
        order: 1,
        title: '夜袭',
        summary: '',
        status: 'todo',
        level: 'scene',
        goal: '潜入仓库',
        parentId: null,
        createdAt: '',
        updatedAt: '',
      },
    ]
    const chapter = { outlineItemIds: ['s1'] } as Chapter
    const hint = buildChapterContinueOutlineHint(outline, chapter)
    expect(hint.bound).toBe(true)
    expect(hint.beatLine).toContain('夜袭')
    expect(hint.suggestedDirection).toContain('潜入')
  })
})
