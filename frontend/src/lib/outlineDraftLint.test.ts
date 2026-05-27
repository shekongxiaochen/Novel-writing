import { describe, expect, it } from 'vitest'
import { lintOutlineDraftItems } from './outlineDraftLint'

describe('lintOutlineDraftItems', () => {
  it('warns when many scenes share the same conflict phrase', () => {
    const issues = lintOutlineDraftItems([
      { level: 'scene', conflict: '主角被师兄陷害', goal: '逃命' },
      { level: 'scene', conflict: '主角被师兄陷害', goal: '反击' },
      { level: 'scene', conflict: '主角被师兄陷害', goal: '揭穿' },
    ])
    expect(issues.some((row) => row.severity === 'warn')).toBe(true)
  })

  it('returns empty for a small varied draft', () => {
    const issues = lintOutlineDraftItems([
      { level: 'chapter', summary: '进入新地图', goal: '找到线索' },
      { level: 'scene', goal: '问路', conflict: '村民隐瞒' },
    ])
    expect(issues).toEqual([])
  })
})
