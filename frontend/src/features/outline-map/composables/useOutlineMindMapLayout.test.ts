import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { estimateOutlineNodeHeight, useOutlineMindMapLayout } from './useOutlineMindMapLayout'
import type { OutlineItem } from '../../../types'

function makeItem(partial: Partial<OutlineItem> & Pick<OutlineItem, 'id' | 'order' | 'title'>): OutlineItem {
  return {
    novelId: 'n1',
    summary: '',
    status: 'todo',
    level: 'scene',
    parentId: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

describe('estimateOutlineNodeHeight', () => {
  it('grows with longer subtitle and summary', () => {
    const short = estimateOutlineNodeHeight(makeItem({ id: 'a', order: 1, title: '短' }))
    const long = estimateOutlineNodeHeight(
      makeItem({
        id: 'b',
        order: 2,
        title: '催租与接单',
        summary: '让读者了解陆沉的窘境和破案开端。陆沉被房东催租，接到找龟任务。',
        goal: '让读者了解陆沉的窘境和破案开端',
      }),
    )
    expect(long).toBeGreaterThan(short)
  })
})

describe('useOutlineMindMapLayout', () => {
  it('keeps sibling nodes in the same column separated', () => {
    const parent = makeItem({ id: 'p', order: 1, title: '卷一', level: 'volume' })
    const childA = makeItem({
      id: 'a',
      order: 2,
      title: '催租与接单',
      level: 'chapter',
      parentId: 'p',
      summary: '让读者了解陆沉的窘境和破案开端。陆沉被房东催租，接到找龟任务。',
      goal: '让读者了解陆沉的窘境和破案开端',
    })
    const childB = makeItem({
      id: 'b',
      order: 3,
      title: '下一章',
      level: 'chapter',
      parentId: 'p',
      summary: '第二段也很长的摘要说明文字，用于撑高卡片高度，避免布局重叠。',
    })

    const { nodes } = useOutlineMindMapLayout({
      outlineItems: ref([parent, childA, childB]),
    })
    const layoutNodes = computed(() => nodes.value)
    const columnOne = layoutNodes.value.filter((node) => node.column === 1).sort((a, b) => a.y - b.y)
    expect(columnOne.length).toBe(2)
    const gap = columnOne[1].y - (columnOne[0].y + columnOne[0].height)
    expect(gap).toBeGreaterThanOrEqual(20)
  })
})
