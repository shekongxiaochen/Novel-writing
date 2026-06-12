import { describe, it, expect } from 'vitest'
import {
  childLevelOf,
  isValidParentLevel,
  levelRank,
  levelText,
  canHaveChildren,
  OUTLINE_LEVEL_RANK,
} from './outlineHierarchy'

describe('childLevelOf', () => {
  it('严格四级、幕必填、不跳级', () => {
    expect(childLevelOf(null)).toBe('volume')
    expect(childLevelOf(undefined)).toBe('volume')
    expect(childLevelOf('volume')).toBe('act')
    expect(childLevelOf('act')).toBe('chapter')
    expect(childLevelOf('chapter')).toBe('scene')
  })
  it('场景下仍回落场景（场景无子层）', () => {
    expect(childLevelOf('scene')).toBe('scene')
  })
})

describe('isValidParentLevel', () => {
  it('合法的严格相邻父子关系', () => {
    expect(isValidParentLevel('volume', null)).toBe(true)
    expect(isValidParentLevel('act', 'volume')).toBe(true)
    expect(isValidParentLevel('chapter', 'act')).toBe(true)
    expect(isValidParentLevel('scene', 'chapter')).toBe(true)
  })
  it('拒绝跳级与错配', () => {
    expect(isValidParentLevel('chapter', 'volume')).toBe(false) // 章不能直接挂卷下（缺幕）
    expect(isValidParentLevel('scene', 'volume')).toBe(false)
    expect(isValidParentLevel('volume', 'volume')).toBe(false)
    expect(isValidParentLevel('act', null)).toBe(false) // 顶层只能是卷
    expect(isValidParentLevel('scene', 'scene')).toBe(false)
  })
})

describe('levelRank', () => {
  it('深度递增', () => {
    expect(levelRank('volume')).toBeLessThan(levelRank('act'))
    expect(levelRank('act')).toBeLessThan(levelRank('chapter'))
    expect(levelRank('chapter')).toBeLessThan(levelRank('scene'))
  })
  it('缺省按最深（场景）处理', () => {
    expect(levelRank(undefined)).toBe(OUTLINE_LEVEL_RANK.scene)
    expect(levelRank(null)).toBe(OUTLINE_LEVEL_RANK.scene)
  })
})

describe('levelText', () => {
  it('中文名映射', () => {
    expect(levelText('volume')).toBe('卷')
    expect(levelText('act')).toBe('幕')
    expect(levelText('chapter')).toBe('章')
    expect(levelText('scene')).toBe('场景')
  })
  it('缺省回落场景', () => {
    expect(levelText(undefined)).toBe('场景')
    expect(levelText(null)).toBe('场景')
  })
})

describe('canHaveChildren', () => {
  it('场景外都能有子', () => {
    expect(canHaveChildren('volume')).toBe(true)
    expect(canHaveChildren('act')).toBe(true)
    expect(canHaveChildren('chapter')).toBe(true)
    expect(canHaveChildren('scene')).toBe(false)
  })
})
