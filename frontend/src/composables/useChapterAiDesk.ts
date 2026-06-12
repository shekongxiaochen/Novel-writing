import { ref } from 'vue'
import type {
  AiChapterSummaryDraft,
  AiContinueDraft,
  AiDeskChatMessage,
  AiMessage,
} from '../types'

/**
 * 章节页（阅读台 / 续写台）AI 进行中状态的模块级单例。
 *
 * 关键点：续写草稿、提问会话、loading 标记和 AbortController 都存在按 novelId 分桶的
 * 单例 store 里，不随 NovelChapterHubView 组件的挂载/卸载而销毁。
 *
 * 这样在 AI 流式生成过程中切换到工作台（跨路由，组件被销毁/或 keep-alive 切走）再切回来时：
 *   - 正在进行的请求不会被中断（AbortController 只在用户点「停止」时才 abort）；
 *   - onChunk 持续把增量写进单例 ref，切回后组件读到的就是最新内容，绘制正确、不丢、不乱。
 *
 * 仿照 useWorkspaceAiChat.ts 的范式。本 composable 只承载「进行中的流式状态」，
 * 会话历史的持久化（localStorage、多会话切换）仍由视图层管理。
 */

export function emptyAiContinueDraft(): AiContinueDraft {
  return {
    text: '',
    loading: false,
    status: 'idle',
    position: 'end',
    targetChars: 1500,
    prevSummaryCount: 3,
    afterAdoptSummary: true,
    afterAdoptExtract: true,
    enableRag: true,
    insertOffset: null,
    warnings: [],
    droppedLayers: [],
    usedLayers: [],
    usedChars: 0,
    ragHits: [],
  }
}

export function emptyAiChapterSummaryDraft(): AiChapterSummaryDraft {
  return { chapterId: '', text: '', loading: false, status: 'idle' }
}

// 各类生成的 AbortController 持有器（非响应式，仅用于发起/停止）。
type AbortHolder = {
  continue: AbortController | null
  chat: AbortController | null
  chapterSummary: AbortController | null
  continuityBrief: AbortController | null
}

type ChapterAiDeskStore = {
  novelId: string
  // 续写
  continueDraft: ReturnType<typeof ref<AiContinueDraft>>
  continueThinkingText: ReturnType<typeof ref<string>>
  // 提问 / 阅读台对话
  chatMessages: ReturnType<typeof ref<AiDeskChatMessage[]>>
  conversationHistory: ReturnType<typeof ref<AiMessage[]>>
  chatLoading: ReturnType<typeof ref<boolean>>
  chatThinking: ReturnType<typeof ref<boolean>>
  // 整理 / 抽取
  extractLoading: ReturnType<typeof ref<boolean>>
  // 章总结
  chapterSummaryDraft: ReturnType<typeof ref<AiChapterSummaryDraft>>
  // 连续性摘要
  continuityBriefLoading: ReturnType<typeof ref<boolean>>
  // 进行中的 AbortController 们
  aborts: AbortHolder
}

// novelId -> 该作品的章节页 AI 进行中状态。单例，跨组件挂载存活。
const stores = new Map<string, ChapterAiDeskStore>()

function createStore(novelId: string): ChapterAiDeskStore {
  return {
    novelId,
    continueDraft: ref<AiContinueDraft>(emptyAiContinueDraft()),
    continueThinkingText: ref(''),
    chatMessages: ref<AiDeskChatMessage[]>([]),
    conversationHistory: ref<AiMessage[]>([]),
    chatLoading: ref(false),
    chatThinking: ref(false),
    extractLoading: ref(false),
    chapterSummaryDraft: ref<AiChapterSummaryDraft>(emptyAiChapterSummaryDraft()),
    continuityBriefLoading: ref(false),
    aborts: { continue: null, chat: null, chapterSummary: null, continuityBrief: null },
  }
}

function getStore(novelId: string): ChapterAiDeskStore {
  let store = stores.get(novelId)
  if (!store) {
    store = createStore(novelId)
    stores.set(novelId, store)
  }
  return store
}

/**
 * 章节页 AI 进行中状态 composable。
 *
 * 返回单例里的 ref 本身（同名）+ 一个可变的 `aborts` 持有器。
 * 视图层直接解构使用，组件重新挂载时拿到的还是同一组 ref / 同一个 aborts —— 进行中的流式内容不丢。
 */
export function useChapterAiDesk(novelId: string) {
  const store = getStore(novelId)
  return {
    aiContinueDraft: store.continueDraft,
    aiContinueThinkingText: store.continueThinkingText,
    aiChatMessages: store.chatMessages,
    conversationHistory: store.conversationHistory,
    aiChatLoading: store.chatLoading,
    aiChatThinking: store.chatThinking,
    aiExtractLoading: store.extractLoading,
    aiChapterSummaryDraft: store.chapterSummaryDraft,
    aiContinuityBriefLoading: store.continuityBriefLoading,
    aborts: store.aborts,
  }
}
