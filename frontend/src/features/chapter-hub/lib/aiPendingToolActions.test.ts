import { describe, expect, it } from 'vitest'
import { describeToolCall } from './aiPendingToolActions'
import type { AiToolCall } from '../../../types'

function mockToolCall(name: string, args: Record<string, unknown>): AiToolCall {
  return {
    id: 'tc-1',
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  }
}

describe('describeToolCall', () => {
  it('labels chapter content append', () => {
    const label = describeToolCall(mockToolCall('update_chapter_content', { mode: 'append', text: '一二三四五' }))
    expect(label).toContain('正文')
    expect(label).toContain('追加')
  })

  it('labels outline create', () => {
    const label = describeToolCall(mockToolCall('create_outline_item', { title: '夜访' }))
    expect(label).toContain('大纲')
    expect(label).toContain('夜访')
  })
})
