import type { AiPendingToolAction, AiToolCall, OutlineRewriteResult } from '../../../types'

function n(value: unknown): string {
  return String(value ?? '').trim()
}

function parseArgs(argsJson: string): Record<string, unknown> | null {
  const raw = String(argsJson ?? '').trim()
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    /* fall through */
  }
  let s = raw
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  s = s.replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(s) as Record<string, unknown>
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
  update_faction: '势力',
  delete_faction: '势力',
  create_character_relation: '角色关系',
  delete_character_relation: '角色关系',
  create_foreshadow_plant: '伏笔',
  update_foreshadow_plant: '伏笔',
  delete_foreshadow_plant: '伏笔',
  create_timeline_event: '时间线',
  update_timeline_event: '时间线',
  delete_timeline_event: '时间线',
  create_chapter: '章节',
  update_chapter_content: '正文',
  update_chapter_summary: '章总结',
  create_category: '分类',
  update_category: '分类',
  delete_category: '分类',
  create_world_setting: '世界观',
  update_world_setting: '世界观',
  delete_world_setting: '世界观',
  create_item: '物品',
  update_item: '物品',
  delete_item: '物品',
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
    case 'update_faction':
      return `${area}：更新势力${args.name ? `「${clip(String(args.name))}」` : ''}`
    case 'delete_faction':
      return `${area}：删除一个势力`
    case 'create_character_relation':
      return `${area}：新建关系「${clip(String(args.relationType))}」`
    case 'delete_character_relation':
      return `${area}：删除一条角色关系`
    case 'create_foreshadow_plant':
      return `${area}：新建伏笔「${clip(String(args.title))}」`
    case 'update_foreshadow_plant':
      return `${area}：更新伏笔${args.title ? `「${clip(String(args.title))}」` : ''}`
    case 'delete_foreshadow_plant':
      return `${area}：删除一个伏笔`
    case 'create_timeline_event':
      return `${area}：新建时间线事件「${clip(String(args.title))}」`
    case 'update_timeline_event':
      return `${area}：更新时间线事件${args.title ? `「${clip(String(args.title))}」` : ''}`
    case 'delete_timeline_event':
      return `${area}：删除一个时间线事件`
    case 'create_chapter':
      return `${area}：在末尾新建一章${args.title ? `「${clip(String(args.title))}」` : ''}`
    case 'update_chapter_content': {
      const rawMode = n(args.mode)
      const mode = rawMode === 'replace' ? '替换整章正文' : rawMode === 'replace_selection' ? '替换选中片段' : '追加正文'
      const len = n(args.text).length
      return `${area}：${mode}${len > 0 ? `（约 ${len} 字）` : ''}`
    }
    case 'update_chapter_summary':
      return `${area}：更新章总结（${clip(String(args.summary), 60)}）`
    case 'create_category':
      return `${area}：新建分类「${clip(String(args.name))}」`
    case 'update_category':
      return `${area}：更新分类${args.name ? `「${clip(String(args.name))}」` : ''}`
    case 'delete_category':
      return `${area}：删除一个分类`
    case 'create_world_setting':
      return `${area}：新建设定「${clip(String(args.name))}」`
    case 'update_world_setting':
      return `${area}：更新设定${args.name ? `「${clip(String(args.name))}」` : ''}`
    case 'delete_world_setting':
      return `${area}：删除一个世界观设定`
    case 'create_item':
      return `${area}：新建物品「${clip(String(args.name))}」`
    case 'update_item':
      return `${area}：更新物品${args.name ? `「${clip(String(args.name))}」` : ''}`
    case 'delete_item':
      return `${area}：删除一个物品`
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

let outlineRewriteToolSeq = 0

function makeToolCallId(): string {
  outlineRewriteToolSeq += 1
  return `outline-rewrite-${Date.now()}-${outlineRewriteToolSeq}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 把动态大纲回写结果转成工具调用：
 * - revision → update_outline_item（按 id 改未写节点）
 * - addition → create_outline_item（补新节拍，可带 parentId）
 * 返回的 AiToolCall[] 交给 buildPendingToolActions 走现有"先预览后确认"面板。
 */
export function buildOutlineRewriteToolCalls(result: OutlineRewriteResult): AiToolCall[] {
  const calls: AiToolCall[] = []

  for (const rev of result.revisions ?? []) {
    if (!n(rev.id)) continue
    const args: Record<string, unknown> = { id: rev.id }
    for (const field of ['title', 'summary', 'goal', 'conflict', 'twist', 'result', 'suspense'] as const) {
      if (rev[field] !== undefined && n(rev[field] as string)) args[field] = rev[field]
    }
    if (typeof rev.tension === 'number') args.tension = rev.tension
    // 除 id 外没有任何改动字段则跳过
    if (Object.keys(args).length <= 1) continue
    calls.push({
      id: makeToolCallId(),
      type: 'function',
      function: { name: 'update_outline_item', arguments: JSON.stringify(args) },
    })
  }

  for (const add of result.additions ?? []) {
    if (!n(add.title)) continue
    const args: Record<string, unknown> = {
      title: add.title,
      summary: n(add.summary),
      level: add.level,
    }
    if (add.parentOutlineId) args.parentId = add.parentOutlineId
    if (add.afterOutlineId) args.afterId = add.afterOutlineId
    for (const field of ['goal', 'conflict', 'twist', 'result', 'suspense'] as const) {
      if (add[field] !== undefined && n(add[field] as string)) args[field] = add[field]
    }
    if (typeof add.tension === 'number') args.tension = add.tension
    calls.push({
      id: makeToolCallId(),
      type: 'function',
      function: { name: 'create_outline_item', arguments: JSON.stringify(args) },
    })
  }

  return calls
}
