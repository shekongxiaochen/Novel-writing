import { describe, expect, it } from 'vitest'
import { buildOutlineBeatPathForChapter } from './outlineBeatPack'
import type { OutlineItem } from '../types'

function makeItem(partial: Partial<OutlineItem> & Pick<OutlineItem, 'id' | 'title' | 'order'>): OutlineItem {
  return {
    novelId: 'n1',
    summary: '',
    status: 'todo',
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('buildOutlineBeatPathForChapter', () => {
  it('warns when chapter has no outline binding', () => {
    const result = buildOutlineBeatPathForChapter([], [], [])
    expect(result.text).toBe('')
    expect(result.warnings[0]).toContain('未绑定')
  })

  it('builds path, task, siblings and upcoming beats', () => {
    const outline: OutlineItem[] = [
      makeItem({ id: 'v1', title: '第一卷', order: 1, level: 'volume' }),
      makeItem({ id: 'a1', title: '第一幕', order: 2, level: 'act', parentId: 'v1' }),
      makeItem({ id: 'c1', title: '第三章', order: 3, level: 'chapter', parentId: 'a1', goal: '揭开秘密' }),
      makeItem({
        id: 's1',
        title: '雨夜对峙',
        order: 4,
        level: 'scene',
        parentId: 'c1',
        goal: '逼问真相',
        conflict: '对方拒不承认',
        characterIds: ['char-a'],
        povCharacterId: 'char-a',
      }),
      makeItem({
        id: 's2',
        title: '线索交换',
        order: 5,
        level: 'scene',
        parentId: 'c1',
        goal: '换到钥匙',
      }),
      makeItem({
        id: 's3',
        title: '下一章开场',
        order: 6,
        level: 'scene',
        parentId: 'c1',
        goal: '逃离追踪',
      }),
    ]
    const characters = [{ id: 'char-a', name: '林晚', goal: '找到妹妹', arc: '从退缩到直面' }]
    const result = buildOutlineBeatPathForChapter(outline, ['s1'], characters)

    expect(result.text).toContain('大纲路径')
    expect(result.text).toContain('雨夜对峙')
    expect(result.text).toContain('逼问真相')
    expect(result.text).toContain('同章细纲')
    expect(result.text).toContain('后续节拍预告')
    expect(result.text).toContain('林晚')
    expect(result.outlineCharacterIds).toContain('char-a')
  })
})
