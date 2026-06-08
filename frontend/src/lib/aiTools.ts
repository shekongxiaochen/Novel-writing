import type { AiToolCall, AiToolDefinition, AiToolResult, AiToolExecutionContext, OutlineTension } from '../types'
import {
  createCategory,
  createChapter,
  createCharacter,
  createCharacterRelation,
  createFaction,
  createForeshadowPlant,
  createItem,
  createOutlineItem,
  createTimelineEvent,
  createWorldSetting,
  deleteCategory,
  deleteCharacter,
  deleteCharacterRelation,
  deleteFaction,
  deleteForeshadowPlant,
  deleteItem,
  deleteOutlineItem,
  deleteTimelineEvent,
  deleteWorldSetting,
  getChaptersByNovelId,
  updateCategory,
  updateCharacter,
  updateChapter,
  updateFaction,
  updateForeshadowPlant,
  updateItem,
  updateOutlineItem,
  updateTimelineEvent,
  updateWorldSetting,
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
          plantText: { type: 'string', description: '植入的原文片段（必须是正文中精确存在的文字，用于定位伏笔标记位置）' },
          plantChapterId: { type: 'string', description: '植入章节 ID' },
          plantChapterNo: { type: 'integer', description: '植入章节序号' },
          plantChapterTitle: { type: 'string', description: '植入章节标题' },
          expectedFulfillChapterNo: { type: 'integer', description: '预计填坑章节号' },
          expectedFulfillNotes: { type: 'string', description: '预计填坑方式说明' },
        },
        required: ['title', 'description', 'plantText', 'plantChapterId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_foreshadow_plant',
      description:
        '修改已有伏笔。需提供伏笔 id。重写正文后若旧伏笔对应的原文已改变，应优先用本工具更新 plantText/描述，而不是新建一个重复伏笔。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '伏笔 ID（必填）' },
          title: { type: 'string', description: '伏笔标签' },
          description: { type: 'string', description: '伏笔详细描述' },
          plantText: { type: 'string', description: '新的植入原文片段（必须是当前正文中精确存在的文字）' },
          status: { type: 'string', enum: ['open', 'fulfilled'], description: '伏笔状态' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_foreshadow_plant',
      description:
        '删除指定伏笔（连同其所有照应）。重写正文后若某伏笔依托的原文片段已不存在、该伏笔不再成立，应调用本工具删除，而不是放任残留。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的伏笔 ID' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_faction',
      description: '修改已有势力/组织信息。需提供势力 id。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '势力 ID（必填）' },
          name: { type: 'string', description: '势力名称' },
          leader: { type: 'string', description: '首领名称或描述' },
          notes: { type: 'string', description: '势力说明' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_faction',
      description: '删除指定势力。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的势力 ID' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_character_relation',
      description: '删除指定的角色关系。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的关系 ID' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_timeline_event',
      description: '修改已有时间线事件。需提供事件 id。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '事件 ID（必填）' },
          storyLabel: { type: 'string', description: '故事内时间标签' },
          title: { type: 'string', description: '事件标题' },
          summary: { type: 'string', description: '事件摘要' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_timeline_event',
      description: '删除指定时间线事件。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的事件 ID' } },
        required: ['id'],
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
        '修改当前或指定章节的正文。mode=replace_selection 只替换作者当前选中的片段（作者选中了一段文字并要求改写/润色时，必须用这个，绝不能整章替换）；mode=append 在章末追加 text；mode=replace 用 text 替换整章正文（仅在作者明确要求重写整章时使用，慎用）。未传 chapterId 时使用作者当前正在编辑的章节。',
      parameters: {
        type: 'object',
        properties: {
          chapterId: { type: 'string', description: '章节 ID，可省略则使用当前章' },
          mode: { type: 'string', enum: ['append', 'replace', 'replace_selection'], description: 'replace_selection 只改选中片段（首选）；append 追加；replace 整章替换（慎用）' },
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
  {
    type: 'function',
    function: {
      name: 'create_category',
      description: '创建分类标签（用于归类角色/势力/世界观设定）。',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: '分类名称' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_category',
      description: '修改已有分类。需提供分类 id。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '分类 ID（必填）' },
          name: { type: 'string', description: '分类名称' },
          notes: { type: 'string', description: '分类备注' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_category',
      description: '删除指定分类（会从所有角色/势力/设定上解绑该分类）。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的分类 ID' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_world_setting',
      description: '创建世界观设定。内容按维度拆成卡片放进 cards（如 力量体系/地理/历史/社会规则/核心设定），每张卡 key 是标题、value 是该维度内容。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '设定名称' },
          cards: {
            type: 'array',
            description: '结构化卡片数组，每项 { key: 标题, value: 内容 }',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', description: '卡片标题' },
                value: { type: 'string', description: '卡片内容' },
              },
            },
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_world_setting',
      description: '修改已有世界观设定。需提供设定 id。可用 cards 整体替换设定卡片（每张卡 { key: 标题, value: 内容 }）。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '世界观设定 ID（必填）' },
          name: { type: 'string', description: '设定名称' },
          cards: {
            type: 'array',
            description: '结构化卡片数组，每项 { key: 标题, value: 内容 }',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', description: '卡片标题' },
                value: { type: 'string', description: '卡片内容' },
              },
            },
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_world_setting',
      description: '删除指定世界观设定。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的设定 ID' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_item',
      description: '创建物品/道具（关键信物、法宝、线索物等）。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '物品名称' },
          summary: { type: 'string', description: '物品简介' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_item',
      description: '修改已有物品。需提供物品 id。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '物品 ID（必填）' },
          name: { type: 'string', description: '物品名称' },
          summary: { type: 'string', description: '物品简介' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_item',
      description: '删除指定物品。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的物品 ID' } },
        required: ['id'],
      },
    },
  },
]

function parseArgs(argsJson: string): Record<string, any> | null {
  const raw = String(argsJson ?? '').trim()
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    /* fall through to salvage */
  }
  // 容错：AI 偶尔返回带 markdown 围栏、尾随逗号或真实换行（未转义）的参数
  let s = raw
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  // 截取首个 { 到最后一个 } 之间
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) s = s.slice(first, last + 1)
  // 去掉对象/数组里的尾随逗号
  s = s.replace(/,\s*([}\]])/g, '$1')
  try {
    return JSON.parse(s)
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
    case 'update_faction':
      return execUpdateFaction(args)
    case 'delete_faction':
      return execDeleteFaction(args)
    case 'create_character_relation':
      return execCreateCharacterRelation(novelId, args)
    case 'delete_character_relation':
      return execDeleteCharacterRelation(args)
    case 'create_foreshadow_plant':
      return execCreateForeshadow(novelId, args)
    case 'update_foreshadow_plant':
      return execUpdateForeshadow(args)
    case 'delete_foreshadow_plant':
      return execDeleteForeshadow(args)
    case 'create_timeline_event':
      return execCreateTimelineEvent(novelId, args)
    case 'update_timeline_event':
      return execUpdateTimelineEvent(args)
    case 'delete_timeline_event':
      return execDeleteTimelineEvent(args)
    case 'create_chapter':
      return execCreateChapter(novelId, args)
    case 'update_chapter_content':
      return execUpdateChapterContent(novelId, args, ctx)
    case 'update_chapter_summary':
      return execUpdateChapterSummary(novelId, args, ctx)
    case 'create_category':
      return execCreateCategory(novelId, args)
    case 'update_category':
      return execUpdateCategory(args)
    case 'delete_category':
      return execDeleteCategory(args)
    case 'create_world_setting':
      return execCreateWorldSetting(novelId, args)
    case 'update_world_setting':
      return execUpdateWorldSetting(args)
    case 'delete_world_setting':
      return execDeleteWorldSetting(args)
    case 'create_item':
      return execCreateItem(novelId, args)
    case 'update_item':
      return execUpdateItem(args)
    case 'delete_item':
      return execDeleteItem(args)
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
  const rawMode = n(args.mode)
  const mode = rawMode === 'replace' ? 'replace' : rawMode === 'replace_selection' ? 'replace_selection' : 'append'

  if (mode === 'replace_selection') {
    const sel = ctx.selectionRange
    const content = chapter.content ?? ''
    if (!sel || sel.chapterId !== chapter.id || sel.end <= sel.start || sel.end > content.length) {
      return { success: false, message: '没有有效的选中片段，无法定向替换。请先在正文中选中要修改的文字。' }
    }
    const nextContent = content.slice(0, sel.start) + text + content.slice(sel.end)
    const updated = updateChapter({ id: chapter.id, content: nextContent })
    if (!updated) return { success: false, message: '更新章节正文失败' }
    return {
      success: true,
      message: `已替换第 ${updated.chapterNo} 章选中片段（${sel.end - sel.start} 字 → ${text.length} 字）`,
      data: { chapterId: updated.id, chapterNo: updated.chapterNo },
    }
  }

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
    parentId: typeof args.parentId === 'string' && args.parentId ? args.parentId : undefined,
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
  const plantText = n(args.plantText)
  const plantChapterId = n(args.plantChapterId)
  if (!plantText) return { success: false, message: 'plantText 不能为空，必须提供正文中精确存在的原文片段' }
  if (!plantChapterId) return { success: false, message: 'plantChapterId 不能为空' }

  const plant = createForeshadowPlant({
    novelId,
    title,
    description,
    plantText,
    plantChapterId,
    plantChapterNo: typeof args.plantChapterNo === 'number' ? args.plantChapterNo : undefined,
    plantChapterTitle: n(args.plantChapterTitle),
    expectedFulfillChapterNo: typeof args.expectedFulfillChapterNo === 'number' ? args.expectedFulfillChapterNo : undefined,
    expectedFulfillNotes: n(args.expectedFulfillNotes),
  } as any)

  // 自动从章节正文中定位 plantText 位置，写入 plantStart/plantEnd
  if (!plant.plantStart || !plant.plantEnd) {
    const chapter = getChaptersByNovelId(novelId).find((c) => c.id === plantChapterId)
    if (chapter?.content) {
      const idx = chapter.content.indexOf(plantText)
      if (idx >= 0) {
        updateForeshadowPlant({ id: plant.id, plantStart: idx, plantEnd: idx + plantText.length })
      }
    }
  }

  return { success: true, message: `已创建伏笔「${plant.title}」`, data: { id: plant.id } }
}

function execUpdateForeshadow(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '伏笔 id 不能为空' }
  const partial: Record<string, any> = { id }
  if (args.title != null) partial.title = n(args.title)
  if (args.description != null) partial.description = n(args.description)
  if (args.plantText != null) partial.plantText = n(args.plantText)
  if (args.status === 'open' || args.status === 'fulfilled') partial.status = args.status
  const updated = updateForeshadowPlant(partial as any)
  if (!updated) return { success: false, message: '未找到该伏笔，无法更新' }
  return { success: true, message: `已更新伏笔「${updated.title}」`, data: { id: updated.id } }
}

function execDeleteForeshadow(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '伏笔 id 不能为空' }
  const ok = deleteForeshadowPlant(id)
  if (!ok) return { success: false, message: '未找到该伏笔，无法删除' }
  return { success: true, message: '已删除伏笔', data: { id } }
}

function execCreateCategory(novelId: string, args: Record<string, any>): AiToolResult {
  const name = n(args.name)
  if (!name) return { success: false, message: '分类名称不能为空' }
  const cat = createCategory({ novelId, name })
  return { success: true, message: `已创建分类「${cat.name}」`, data: { id: cat.id } }
}

function execUpdateCategory(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '分类 id 不能为空' }
  const partial: Record<string, any> = { id }
  if (args.name != null) partial.name = n(args.name)
  if (args.notes != null) partial.notes = n(args.notes)
  const updated = updateCategory(partial as any)
  if (!updated) return { success: false, message: '未找到该分类，无法更新' }
  return { success: true, message: `已更新分类「${updated.name}」`, data: { id: updated.id } }
}

function execDeleteCategory(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '分类 id 不能为空' }
  const ok = deleteCategory(id)
  if (!ok) return { success: false, message: '未找到该分类，无法删除' }
  return { success: true, message: '已删除分类', data: { id } }
}

function toWorldSettingCards(raw: unknown): Array<{ key: string; value: string }> | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .map((c) => c as { key?: string; title?: string; value?: string; content?: string })
    .map((c) => ({ key: n(c.key ?? c.title), value: n(c.value ?? c.content) }))
    .filter((c) => c.key || c.value)
}

function execCreateWorldSetting(novelId: string, args: Record<string, any>): AiToolResult {
  const name = n(args.name)
  if (!name) return { success: false, message: '设定名称不能为空' }
  const cards = toWorldSettingCards(args.cards)
  const ws = createWorldSetting({
    novelId,
    name,
    content: n(args.content),
    attributes: cards ?? (n(args.content) ? [{ id: '', key: '概述', value: n(args.content) }] : []),
  } as any)
  return { success: true, message: `已创建世界观设定「${ws.name}」`, data: { id: ws.id } }
}

function execUpdateWorldSetting(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '设定 id 不能为空' }
  const partial: Record<string, any> = { id }
  if (args.name != null) partial.name = n(args.name)
  const cards = toWorldSettingCards(args.cards)
  if (cards) partial.attributes = cards
  else if (args.content != null) partial.attributes = [{ id: '', key: '概述', value: n(args.content) }]
  const updated = updateWorldSetting(partial as any)
  if (!updated) return { success: false, message: '未找到该设定，无法更新' }
  return { success: true, message: `已更新世界观设定「${updated.name}」`, data: { id: updated.id } }
}

function execDeleteWorldSetting(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '设定 id 不能为空' }
  const ok = deleteWorldSetting(id)
  if (!ok) return { success: false, message: '未找到该设定，无法删除' }
  return { success: true, message: '已删除世界观设定', data: { id } }
}

function execCreateItem(novelId: string, args: Record<string, any>): AiToolResult {
  const name = n(args.name)
  if (!name) return { success: false, message: '物品名称不能为空' }
  const item = createItem({ novelId, name, summary: n(args.summary) } as any)
  return { success: true, message: `已创建物品「${item.name}」`, data: { id: item.id } }
}

function execUpdateItem(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '物品 id 不能为空' }
  const partial: Record<string, any> = { id }
  if (args.name != null) partial.name = n(args.name)
  if (args.summary != null) partial.summary = n(args.summary)
  const updated = updateItem(partial as any)
  if (!updated) return { success: false, message: '未找到该物品，无法更新' }
  return { success: true, message: `已更新物品「${updated.name}」`, data: { id: updated.id } }
}

function execDeleteItem(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '物品 id 不能为空' }
  const ok = deleteItem(id)
  if (!ok) return { success: false, message: '未找到该物品，无法删除' }
  return { success: true, message: '已删除物品', data: { id } }
}

function execUpdateFaction(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '势力 id 不能为空' }
  const partial: Record<string, any> = { id }
  if (args.name != null) partial.name = n(args.name)
  if (args.leader != null) partial.leader = n(args.leader)
  if (args.notes != null) partial.notes = n(args.notes)
  const updated = updateFaction(partial as any)
  if (!updated) return { success: false, message: '未找到该势力，无法更新' }
  return { success: true, message: `已更新势力「${updated.name}」`, data: { id: updated.id } }
}

function execDeleteFaction(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '势力 id 不能为空' }
  const ok = deleteFaction(id)
  if (!ok) return { success: false, message: '未找到该势力，无法删除' }
  return { success: true, message: '已删除势力', data: { id } }
}

function execDeleteCharacterRelation(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '关系 id 不能为空' }
  const ok = deleteCharacterRelation(id)
  if (!ok) return { success: false, message: '未找到该关系，无法删除' }
  return { success: true, message: '已删除角色关系', data: { id } }
}

function execUpdateTimelineEvent(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '事件 id 不能为空' }
  const partial: Record<string, any> = { id }
  if (args.storyLabel != null) partial.storyLabel = n(args.storyLabel)
  if (args.title != null) partial.title = n(args.title)
  if (args.summary != null) partial.summary = n(args.summary)
  const updated = updateTimelineEvent(partial as any)
  if (!updated) return { success: false, message: '未找到该事件，无法更新' }
  return { success: true, message: `已更新时间线事件「${updated.title}」`, data: { id: updated.id } }
}

function execDeleteTimelineEvent(args: Record<string, any>): AiToolResult {
  const id = n(args.id)
  if (!id) return { success: false, message: '事件 id 不能为空' }
  const ok = deleteTimelineEvent(id)
  if (!ok) return { success: false, message: '未找到该事件，无法删除' }
  return { success: true, message: '已删除时间线事件', data: { id } }
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
