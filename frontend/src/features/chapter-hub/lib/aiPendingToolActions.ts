import type { AiPendingToolAction, AiToolCall } from '../../../types'

function n(value: unknown): string {
  return String(value ?? '').trim()
}

function parseArgs(argsJson: string): Record<string, unknown> | null {
  try {
    return JSON.parse(argsJson) as Record<string, unknown>
  } catch {
    return null
  }
}

function clip(text: string, max = 48): string {
  const t = n(text)
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

const TOOL_AREA_LABEL: Record<string, string> = {
  create_outline_item: '大纲',
  update_outline_item: '大纲',
  delete_outline_item: '大纲',
  create_character: '角色',
  update_character: '角色',
  delete_character: '角色',
  create_faction: '势力',
  create_character_relation: '角色关系',
  create_foreshadow_plant: '伏笔',
  create_timeline_event: '时间线',
  create_chapter: '章节',
  update_chapter_content: '正文',
  update_chapter_summary: '章总结',
}

export function describeToolCall(toolCall: AiToolCall): string {
  const args = parseArgs(toolCall.function.arguments)
  const area = TOOL_AREA_LABEL[toolCall.function.name] ?? '档案'
  if (!args) return `${area}：参数无效`

  switch (toolCall.function.name) {
    case 'create_outline_item':
      return `${area}：新建情节点「${clip(String(args.title))}」`
    case 'update_outline_item':
      return `${area}：更新情节点${args.title ? `「${clip(String(args.title))}」` : ''}`
    case 'delete_outline_item':
      return `${area}：删除一个情节点`
    case 'create_character':
      return `${area}：新建角色「${clip(String(args.name))}」`
    case 'update_character':
      return `${area}：更新角色${args.name ? `「${clip(String(args.name))}」` : ''}`
    case 'delete_character':
      return `${area}：删除一个角色`
    case 'create_faction':
      return `${area}：新建势力「${clip(String(args.name))}」`
    case 'create_character_relation':
      return `${area}：新建关系「${clip(String(args.relationType))}」`
    case 'create_foreshadow_plant':
      return `${area}：新建伏笔「${clip(String(args.title))}」`
    case 'create_timeline_event':
      return `${area}：新建时间线事件「${clip(String(args.title))}」`
    case 'create_chapter':
      return `${area}：在末尾新建一章${args.title ? `「${clip(String(args.title))}」` : ''}`
    case 'update_chapter_content': {
      const mode = n(args.mode) === 'replace' ? '替换正文' : '追加正文'
      const len = n(args.text).length
      return `${area}：${mode}${len > 0 ? `（约 ${len} 字）` : ''}`
    }
    case 'update_chapter_summary':
      return `${area}：更新章总结（${clip(String(args.summary), 60)}）`
    default:
      return `${area}：${toolCall.function.name}`
  }
}

export function getToolCallPreviewText(toolCall: AiToolCall, max = 320): string {
  const args = parseArgs(toolCall.function.arguments)
  if (!args) return ''
  if (toolCall.function.name === 'create_chapter') {
    return clip(String(args.content || args.text || args.annotation || ''), max)
  }
  if (toolCall.function.name === 'update_chapter_content') return clip(String(args.text), max)
  if (toolCall.function.name === 'update_chapter_summary') return clip(String(args.summary), max)
  if (toolCall.function.name === 'create_outline_item' || toolCall.function.name === 'update_outline_item') {
    return clip([args.title, args.summary, args.goal].filter(Boolean).join(' · '), max)
  }
  return ''
}

export function buildPendingToolActions(toolCalls: AiToolCall[]): AiPendingToolAction[] {
  return toolCalls.map((toolCall) => {
    const previewText = getToolCallPreviewText(toolCall)
    return {
      id: toolCall.id,
      toolCall,
      label: describeToolCall(toolCall),
      ...(previewText ? { previewText } : {}),
      status: 'pending',
    }
  })
}
