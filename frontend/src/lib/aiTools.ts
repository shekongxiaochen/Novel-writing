import type { AiToolCall, AiToolDefinition, AiToolResult, AiToolExecutionContext, OutlineTension } from '../types'
import {
  createChapter,
  createCharacter,
  createCharacterRelation,
  createFaction,
  createForeshadowPlant,
  createOutlineItem,
  createTimelineEvent,
  deleteCharacter,
  deleteOutlineItem,
  getChaptersByNovelId,
  updateCharacter,
  updateChapter,
  updateOutlineItem,
} from './storage'

const OUTLINE_PROPS = {
  title: { type: 'string', description: '情节点标题' },
  summary: { type: 'string', description: '剧情摘要' },
  level: { type: 'string', enum: ['volume', 'act', 'chapter', 'scene'], description: '层级' },
  goal: { type: 'string', description: '叙事目标' },
  conflict: { type: 'string', description: '核心冲突' },
  twist: { type: 'string', description: '转折' },
  suspense: { type: 'string', description: '悬念设置' },
  result: { type: 'string', description: '结果或收尾' },
  plotStage: { type: 'string', enum: ['idea', 'drafted', 'written', 'resolved'], description: '写作阶段' },
  tension: { type: 'integer', minimum: 1, maximum: 5, description: '紧张度 1-5' },
  location: { type: 'string', description: '发生地点' },
  timeLabel: { type: 'string', description: '时间标签' },
  characterIds: { type: 'array', items: { type: 'string' }, description: '关联角色 ID 列表' },
  factionIds: { type: 'array', items: { type: 'string' }, description: '关联势力 ID 列表' },
  storylineIds: { type: 'array', items: { type: 'string' }, description: '关联故事线 ID 列表' },
} as const

const CHARACTER_PROPS = {
  name: { type: 'string', description: '角色姓名' },
  gender: { type: 'string', description: '性别' },
  age: { type: 'string', description: '年龄或年龄段' },
  goal: { type: 'string', description: '角色目标' },
  secret: { type: 'string', description: '角色秘密' },
  arc: { type: 'string', description: '角色弧光/成长线' },
  notes: { type: 'string', description: '补充说明' },
  aliases: { type: 'array', items: { type: 'string' }, description: '别名列表' },
} as const

export const AI_WRITE_TOOLS: AiToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_outline_item',
      description: '创建新的大纲/情节点。',
      parameters: {
        type: 'object',
        properties: { ...OUTLINE_PROPS },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_outline_item',
      description: '修改已有的大纲/情节点。需要提供情节点 ID 和要修改的字段。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '情节点 ID（必填）' }, ...OUTLINE_PROPS },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_outline_item',
      description: '删除指定的大纲/情节点。如果用户说"清空所有大纲"，则对每个情节点分别调用。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的情节点 ID' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_character',
      description: '创建新角色。尽量填充丰富的角色画像信息。',
      parameters: {
        type: 'object',
        properties: { ...CHARACTER_PROPS },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_character',
      description: '修改已有角色信息。需要提供角色 ID 和要修改的字段。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '角色 ID（必填）' }, ...CHARACTER_PROPS },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_character',
      description: '删除指定角色（会级联删除该角色的所有关系）。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的角色 ID' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_faction',
      description: '创建新势力/组织。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '势力名称' },
          leader: { type: 'string', description: '首领名称或描述' },
          notes: { type: 'string', description: '势力说明' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_character_relation',
      description:
        '创建两个角色之间的关系。fromCharacterId 和 toCharacterId 都必须是有角色的 ID。例如"A 是 B 的师傅"，则 fromCharacterId 为 A，toCharacterId 为 B，relationType 为"师傅"。',
      parameters: {
        type: 'object',
        properties: {
          fromCharacterId: { type: 'string', description: '关系主体的角色 ID' },
          toCharacterId: { type: 'string', description: '关系客体的角色 ID' },
          relationType: { type: 'string', description: '关系类型，如"师傅"、"朋友"、"敌人"、"父亲"等' },
          note: { type: 'string', description: '补充说明' },
        },
        required: ['fromCharacterId', 'toCharacterId', 'relationType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_foreshadow_plant',
      description: '创建伏笔植入记录。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '伏笔标签' },
          description: { type: 'string', description: '伏笔详细描述：想说明什么、需要怎样收尾' },
          plantText: { type: 'string', description: '植入的原文片段（如有）' },
          plantChapterId: { type: 'string', description: '植入章节 ID' },
          plantChapterNo: { type: 'integer', description: '植入章节序号' },
          plantChapterTitle: { type: 'string', description: '植入章节标题' },
          expectedFulfillChapterNo: { type: 'integer', description: '预计填坑章节号' },
          expectedFulfillNotes: { type: 'string', description: '预计填坑方式说明' },
        },
        required: ['title', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_chapter',
      description:
        '在作品末尾新建一章。用于「写下一章」「新开章节」等需求；可选 title、章总结 annotation、初稿 content（replace 写入）、绑定的大纲节点 outlineItemIds。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '章节标题，可省略则自动生成「第N章」' },
          annotation: { type: 'string', description: '章总结（可选）' },
          content: { type: 'string', description: '初稿正文（可选，有则写入新章）' },
          outlineItemIds: {
            type: 'array',
            items: { type: 'string' },
            description: '绑定的大纲情节点 ID 列表（可选）',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_chapter_content',
      description:
        '修改当前或指定章节的正文。mode=append 在章末追加 text；mode=replace 用 text 替换整章正文（慎用）。未传 chapterId 时使用作者当前正在编辑的章节。',
      parameters: {
        type: 'object',
        properties: {
          chapterId: { type: 'string', description: '章节 ID，可省略则使用当前章' },
          mode: { type: 'string', enum: ['append', 'replace'], description: 'append 追加；replace 整章替换' },
          text: { type: 'string', description: '要写入的正文片段' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_chapter_summary',
      description: '更新章节总结（写作台「总结」字段）。未传 chapterId 时使用当前章。',
      parameters: {
        type: 'object',
        properties: {
          chapterId: { type: 'string', description: '章节 ID，可省略则使用当前章' },
          summary: { type: 'string', description: '章总结正文' },
        },
        required: ['summary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_timeline_event',
      description: '创建故事时间线事件。',
      parameters: {
        type: 'object',
        properties: {
          storyLabel: { type: 'string', description: '故事内时间标签，如"三年前"、"卷一末"' },
          title: { type: 'string', description: '事件标题' },
          summary: { type: 'string', description: '事件摘要' },
          chapterNoStart: { type: 'integer', description: '关联章节起始号' },
          chapterNoEnd: { type: 'integer', description: '关联章节结束号' },
          outlineItemId: { type: 'string', description: '关联大纲节点 ID' },
        },
        required: ['title'],
      },
    },
  },
]

function parseArgs(argsJson: string): Record<string, any> | null {
  try {
    return JSON.parse(argsJson)
  } catch {
    return null
  }
}

function n(value: unknown): string {
  return String(value ?? '').trim()
}

function toTension(value: unknown): OutlineTension | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const t = Math.round(value)
  if (t < 1 || t > 5) return undefined
  return t as OutlineTension
}

export function executeToolCall(
  novelId: string,
  toolCall: AiToolCall,
  ctx: AiToolExecutionContext = {},
): AiToolResult {
  const args = parseArgs(toolCall.function.arguments)
  if (!args) {
    return { success: false, message: `参数解析失败` }
  }
  const name = toolCall.function.name
  switch (name) {
    case 'create_outline_item':
      return execCreateOutlineItem(novelId, args)
    case 'update_outline_item':
      return execUpdateOutlineItem(args)
    case 'delete_outline_item':
      return execDeleteOutlineItem(args)
    case 'create_character':
      return execCreateCharacter(novelId, args)
    case 'update_character':
      return execUpdateCharacter(args)
    case 'delete_character':
      return execDeleteCharacter(args)
    case 'create_faction':
      return execCreateFaction(novelId, args)
    case 'create_character_relation':
      return execCreateCharacterRelation(novelId, args)
    case 'create_foreshadow_plant':
      return execCreateForeshadow(novelId, args)
    case 'create_timeline_event':
      return execCreateTimelineEvent(novelId, args)
    case 'create_chapter':
      return execCreateChapter(novelId, args)
    case 'update_chapter_content':
      return execUpdateChapterContent(novelId, args, ctx)
    case 'update_chapter_summary':
      return execUpdateChapterSummary(novelId, args, ctx)
    default:
      return { success: false, message: `未知操作: ${name}` }
  }
}

function resolveChapter(novelId: string, chapterId: unknown, ctx: AiToolExecutionContext) {
  const id = n(chapterId) || n(ctx.defaultChapterId)
  if (!id) return null
  return getChaptersByNovelId(novelId).find((row) => row.id === id) ?? null
}

function execCreateChapter(novelId: string, args: Record<string, any>): AiToolResult {
  const created = createChapter({
    novelId,
    title: n(args.title),
    notes: '',
    annotation: n(args.annotation) || n(args.summary),
  })
  const content = n(args.content) || n(args.text)
  const outlineItemIds = Array.isArray(args.outlineItemIds)
    ? args.outlineItemIds.map((id: unknown) => n(id)).filter(Boolean)
    : []
  let chapter = created
  if (content) {
    const updated = updateChapter({ id: created.id, content })
    if (updated) chapter = updated
  }
  if (outlineItemIds.length > 0) {
    const updated = updateChapter({ id: chapter.id, outlineItemIds })
    if (updated) chapter = updated
  }
  return {
    success: true,
    message: `已新建第 ${chapter.chapterNo} 章「${chapter.title}」`,
    data: { chapterId: chapter.id, chapterNo: chapter.chapterNo },
  }
}

function execUpdateChapterContent(
  novelId: string,
  args: Record<string, any>,
  ctx: AiToolExecutionContext,
): AiToolResult {
  const chapter = resolveChapter(novelId, args.chapterId, ctx)
  if (!chapter) return { success: false, message: '未找到目标章节，请先选择章节或提供 chapterId' }
  const text = n(args.text)
  if (!text) return { success: false, message: '正文内容不能为空' }
  const mode = n(args.mode) === 'replace' ? 'replace' : 'append'
  const nextContent = mode === 'replace' ? text : `${chapter.content ?? ''}${text}`
  const updated = updateChapter({ id: chapter.id, content: nextContent })
  if (!updated) return { success: false, message: '更新章节正文失败' }
  const verb = mode === 'replace' ? '已替换' : '已向末尾追加'
  return {
    success: true,
    message: `${verb}第 ${updated.chapterNo} 章正文（${text.length} 字）`,
    data: { chapterId: updated.id, chapterNo: updated.chapterNo },
  }
}

function execUpdateChapterSummary(
  novelId: string,
  args: Record<string, any>,
  ctx: AiToolExecutionContext,
): AiToolResult {
  const chapter = resolveChapter(novelId, args.chapterId, ctx)
  if (!chapter) return { success: false, message: '未找到目标章节' }
  const summary = n(args.summary)
  if (!summary) return { success: false, message: '章总结不能为空' }
  const updated = updateChapter({ id: chapter.id, annotation: summary })
  if (!updated) return { success: false, message: '更新章总结失败' }
  return {
    success: true,
    message: `已更新第 ${updated.chapterNo} 章总结`,
    data: { chapterId: updated.id, chapterNo: updated.chapterNo },
  }
}

function execCreateOutlineItem(novelId: string, args: Record<string, any>): AiToolResult {
  const title = n(args.title)
  if (!title) return { success: false, message: '情节点标题不能为空' }
  const item = createOutlineItem({
    novelId,
    title,
    summary: n(args.summary),
    level: args.level,
    goal: n(args.goal),
    conflict: n(args.conflict),
    twist: n(args.twist),
    suspense: n(args.suspense),
    result: n(args.result),
    plotStage: args.plotStage,
    tension: toTension(args.tension),
    location: n(args.location),
    timeLabel: n(args.timeLabel),
    characterIds: Array.isArray(args.characterIds) ? args.characterIds : undefined,
    factionIds: Array.isArray(args.factionIds) ? args.factionIds : undefined,
    storylineIds: Array.isArray(args.storylineIds) ? args.storylineIds : undefined,
  })
  return { success: true, message: `已创建情节点「${item.title}」`, data: { id: item.id, title: item.title } }
}

function execUpdateOutlineItem(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '未提供情节点 ID' }
  const partial: Record<string, any> = { id }
  const strFields = ['title', 'summary', 'goal', 'conflict', 'twist', 'suspense', 'result', 'location', 'timeLabel']
  for (const f of strFields) if (args[f] !== undefined) partial[f] = n(args[f])
  if (args.plotStage !== undefined) partial.plotStage = args.plotStage
  if (args.level !== undefined) partial.level = args.level
  if (typeof args.tension === 'number') partial.tension = toTension(args.tension)
  if (Array.isArray(args.characterIds)) partial.characterIds = args.characterIds
  if (Array.isArray(args.factionIds)) partial.factionIds = args.factionIds
  if (Array.isArray(args.storylineIds)) partial.storylineIds = args.storylineIds
  const result = updateOutlineItem(partial as any)
  if (!result) return { success: false, message: `未找到 ID 为 ${id} 的情节点` }
  return { success: true, message: `已更新情节点「${result.title}」` }
}

function execDeleteOutlineItem(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '未提供情节点 ID' }
  const ok = deleteOutlineItem(id)
  return ok ? { success: true, message: `已删除情节点` } : { success: false, message: `删除失败，未找到情节点` }
}

function execCreateCharacter(novelId: string, args: Record<string, any>): AiToolResult {
  const name = n(args.name)
  if (!name) return { success: false, message: '角色姓名不能为空' }
  const char = createCharacter({
    novelId,
    name,
    gender: n(args.gender),
    age: n(args.age),
    goal: n(args.goal),
    secret: n(args.secret),
    arc: n(args.arc),
    notes: n(args.notes),
    aliases: Array.isArray(args.aliases) ? args.aliases : undefined,
  } as any)
  return { success: true, message: `已创建角色「${char.name}」`, data: { id: char.id, name: char.name } }
}

function execUpdateCharacter(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '未提供角色 ID' }
  const partial: Record<string, any> = { id }
  const strFields = ['name', 'gender', 'age', 'goal', 'secret', 'arc', 'notes']
  for (const f of strFields) if (args[f] !== undefined) partial[f] = n(args[f])
  if (Array.isArray(args.aliases)) partial.aliases = args.aliases
  const result = updateCharacter(partial as any)
  if (!result) return { success: false, message: `未找到 ID 为 ${id} 的角色` }
  return { success: true, message: `已更新角色「${result.name}」` }
}

function execDeleteCharacter(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '未提供角色 ID' }
  const ok = deleteCharacter(id)
  return ok ? { success: true, message: `已删除角色` } : { success: false, message: `删除失败，未找到角色` }
}

function execCreateFaction(novelId: string, args: Record<string, any>): AiToolResult {
  const name = n(args.name)
  if (!name) return { success: false, message: '势力名称不能为空' }
  const faction = createFaction({
    novelId,
    name,
    leader: n(args.leader),
    notes: n(args.notes),
  } as any)
  return { success: true, message: `已创建势力「${faction.name}」`, data: { id: faction.id, name: faction.name } }
}

function execCreateCharacterRelation(novelId: string, args: Record<string, any>): AiToolResult {
  const fromId = n(args.fromCharacterId)
  const toId = n(args.toCharacterId)
  const relType = n(args.relationType)
  if (!fromId || !toId || !relType) return { success: false, message: 'fromCharacterId、toCharacterId 和 relationType 都是必填的' }
  const rel = createCharacterRelation({ novelId, fromCharacterId: fromId, toCharacterId: toId, relationType: relType, note: n(args.note) })
  return { success: true, message: `已创建关系「${rel.relationType}」`, data: { id: rel.id } }
}

function execCreateForeshadow(novelId: string, args: Record<string, any>): AiToolResult {
  const title = n(args.title)
  const description = n(args.description)
  if (!title || !description) return { success: false, message: '伏笔标题和描述不能为空' }
  const plant = createForeshadowPlant({
    novelId,
    title,
    description,
    plantText: n(args.plantText),
    plantChapterId: n(args.plantChapterId),
    plantChapterNo: typeof args.plantChapterNo === 'number' ? args.plantChapterNo : undefined,
    plantChapterTitle: n(args.plantChapterTitle),
    expectedFulfillChapterNo: typeof args.expectedFulfillChapterNo === 'number' ? args.expectedFulfillChapterNo : undefined,
    expectedFulfillNotes: n(args.expectedFulfillNotes),
  } as any)
  return { success: true, message: `已创建伏笔「${plant.title}」`, data: { id: plant.id } }
}

function execCreateTimelineEvent(novelId: string, args: Record<string, any>): AiToolResult {
  const title = n(args.title)
  if (!title) return { success: false, message: '事件标题不能为空' }
  const event = createTimelineEvent({
    novelId,
    title,
    storyLabel: n(args.storyLabel),
    summary: n(args.summary),
    chapterNoStart: typeof args.chapterNoStart === 'number' ? args.chapterNoStart : undefined,
    chapterNoEnd: typeof args.chapterNoEnd === 'number' ? args.chapterNoEnd : undefined,
    outlineItemId: n(args.outlineItemId),
  } as any)
  return { success: true, message: `已创建时间线事件「${event.title}」` }
}
