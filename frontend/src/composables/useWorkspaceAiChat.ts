import { ref } from 'vue'
import type { AiMessage, AiPendingToolAction, Novel } from '../types'
import { askAiWithToolsStream } from '../lib/localAi'
import { buildNovelWorkspacePayload } from '../lib/storage'
import { executeToolCall } from '../lib/aiTools'

export type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string }
export type FocusEntity = { kind: string; id: string; label: string } | null

/**
 * 工作台 AI 侧边栏的会话与流式状态。
 *
 * 关键点：状态保存在模块级单例里（按 novelId 分桶），不随侧边栏组件挂载/卸载而销毁。
 * 这样在流式输出过程中切换标签页（组件被 v-if 卸载）再切回来，
 * 正在进行的请求不会被中断，已输出的内容也不会丢失。
 */

const STORAGE_PREFIX = 'novel-writing.workspace-ai-chat.'
function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`
}

type ChatStore = {
  novelId: string
  messages: ReturnType<typeof ref<ChatMsg[]>>
  history: ReturnType<typeof ref<AiMessage[]>>
  pendingActions: ReturnType<typeof ref<AiPendingToolAction[]>>
  loading: ReturnType<typeof ref<boolean>>
  thinking: ReturnType<typeof ref<boolean>>
  errorText: ReturnType<typeof ref<string>>
  abort: AbortController | null
}

// novelId -> 该作品的会话状态。单例，跨组件挂载存活。
const stores = new Map<string, ChatStore>()

function createStore(novelId: string): ChatStore {
  const store: ChatStore = {
    novelId,
    messages: ref<ChatMsg[]>([]),
    history: ref<AiMessage[]>([]),
    pendingActions: ref<AiPendingToolAction[]>([]),
    loading: ref(false),
    thinking: ref(false),
    errorText: ref(''),
    abort: null,
  }
  // 从 localStorage 恢复已结束的历史会话
  if (novelId && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey(novelId))
      if (raw) {
        const parsed = JSON.parse(raw) as { messages?: ChatMsg[]; history?: AiMessage[] }
        if (Array.isArray(parsed.messages)) store.messages.value = parsed.messages.slice(-100)
        if (Array.isArray(parsed.history)) store.history.value = parsed.history.slice(-40)
      }
    } catch {
      /* ignore */
    }
  }
  return store
}

function getStore(novelId: string): ChatStore {
  let store = stores.get(novelId)
  if (!store) {
    store = createStore(novelId)
    stores.set(novelId, store)
  }
  return store
}

/** 工作台 AI 会话 composable：返回常驻状态与操作方法。 */
export function useWorkspaceAiChat(novelId: string) {
  const store = getStore(novelId)
  const messages = store.messages
  const history = store.history
  const pendingActions = store.pendingActions
  const loading = store.loading
  const thinking = store.thinking
  const errorText = store.errorText

  function persistChat(): void {
    if (!novelId || typeof window === 'undefined') return
    try {
      localStorage.setItem(
        storageKey(novelId),
        JSON.stringify({ messages: messages.value!.slice(-100), history: history.value!.slice(-40) }),
      )
    } catch {
      /* ignore */
    }
  }

  function pushMsg(role: 'user' | 'assistant', content: string): void {
    messages.value = [
      ...messages.value!,
      { id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, role, content },
    ]
  }

  function toolContext(focus: FocusEntity) {
    return focus ? { focusEntity: { ...focus } } : {}
  }

  async function send(
    question: string,
    opts: { novel: Novel | null; focus: FocusEntity },
  ): Promise<void> {
    if (!question || loading.value) return
    // 仍有未处理的待确认工具调用时，先给它们补上「未采用」工具响应，
    // 否则历史里会出现 tool_calls 后缺少对应 tool 消息，上游 API 会报 400。
    if (pendingActions.value!.length > 0) ignoreAll()
    const focus = opts.focus
    const composed = focus
      ? `【当前聚焦】${focus.kind}「${focus.label}」(内部 id=${focus.id}，仅供你调用工具时使用，禁止在回复里向用户显示 id 或工具名称)\n\n${question}`
      : question
    pushMsg('user', focus ? `[${focus.label}] ${question}` : question)
    loading.value = true
    thinking.value = true
    errorText.value = ''
    store.abort?.abort()
    store.abort = new AbortController()
    const signal = store.abort.signal
    const assistant: ChatMsg = { id: `${Date.now()}-a`, role: 'assistant', content: '' }
    messages.value = [...messages.value!, assistant]
    // 通过 id 在数组里就地更新助手消息内容，保证流式追加对 UI 响应式可见
    const patchAssistant = (mut: (m: ChatMsg) => void): void => {
      const idx = messages.value!.findIndex((m) => m.id === assistant.id)
      if (idx < 0) return
      const next = [...messages.value!]
      const copy = { ...next[idx] }
      mut(copy)
      next[idx] = copy
      messages.value = next
    }
    try {
      const snapshot = buildNovelWorkspacePayload(novelId)
      const { history: nextHistory, pendingToolActions, text } = await askAiWithToolsStream(
        snapshot,
        {
          mode: 'all',
          question: composed,
          chapterIds: [],
          novelId,
          prevSummaryCount: 3,
          enableRag: true,
          novel: opts.novel
            ? {
                title: opts.novel.title,
                summary: opts.novel.summary,
                continuityBrief: opts.novel.continuityBrief,
                genre: opts.novel.genre,
                perspective: opts.novel.perspective,
                tone: opts.novel.tone,
              }
            : undefined,
        },
        {
          onChunk: (t) => {
            if (thinking.value) thinking.value = false
            patchAssistant((m) => {
              m.content += t
            })
          },
          onError: (err) => {
            if (err.name === 'AbortError') return
            errorText.value = err.message || 'AI 请求失败'
          },
        },
        history.value!.length > 0 ? history.value! : undefined,
        signal,
        { alwaysEnableTools: true, confirmBeforeApply: true, toolContext: toolContext(focus) },
      )
      history.value = nextHistory
      const cleaned = String(messages.value!.find((m) => m.id === assistant.id)?.content ?? '')
        .replace(/<｜｜DSML｜｜[^>]*>[\s\S]*?<｜｜DSML｜｜[^>]*>/g, '')
        .trim()
      let finalContent = cleaned
      if (pendingToolActions && pendingToolActions.length > 0) {
        pendingActions.value = pendingToolActions
        finalContent = cleaned
          ? `${cleaned}\n\n下方有待确认的修改，点「采用」后才会写入。`
          : '已生成待确认的修改，点「采用」后才会写入。'
      } else if (!cleaned) {
        finalContent = text?.trim() || '已回答完毕，但这次没有可显示的内容。'
      }
      patchAssistant((m) => {
        m.content = finalContent
      })
      persistChat()
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        patchAssistant((m) => {
          if (!m.content.trim()) m.content = '已停止回答。'
        })
      } else {
        messages.value = messages.value!.filter((m) => m.id !== assistant.id)
        errorText.value = e instanceof Error ? e.message : 'AI 请求失败，请稍后重试'
      }
    } finally {
      loading.value = false
      thinking.value = false
      store.abort = null
    }
  }

  function stop(): void {
    store.abort?.abort()
    loading.value = false
    thinking.value = false
  }

  function applyOne(action: AiPendingToolAction, focus: FocusEntity, onApplied: () => void): void {
    if (!novelId) return
    const result = executeToolCall(novelId, action.toolCall, toolContext(focus))
    const toolMsg: AiMessage = { role: 'tool', tool_call_id: action.toolCall.id, content: JSON.stringify(result) }
    history.value = [...history.value!, toolMsg].slice(-40)
    pendingActions.value = pendingActions.value!.filter((row) => row.id !== action.id)
    pushMsg('assistant', `【已采用】${result.message}`)
    persistChat()
    onApplied()
  }

  function applyOneById(id: string, focus: FocusEntity, onApplied: () => void): void {
    const action = pendingActions.value!.find((row) => row.id === id)
    if (action) applyOne(action, focus, onApplied)
  }

  function ignoreOneById(id: string): void {
    const action = pendingActions.value!.find((row) => row.id === id)
    if (action) {
      const toolMsg: AiMessage = {
        role: 'tool',
        tool_call_id: action.toolCall.id,
        content: JSON.stringify({ success: false, message: '作者未采用此修改' }),
      }
      history.value = [...history.value!, toolMsg].slice(-40)
    }
    pendingActions.value = pendingActions.value!.filter((row) => row.id !== id)
    persistChat()
  }

  function applyAll(focus: FocusEntity, onApplied: () => void): void {
    const pending = [...pendingActions.value!]
    if (!novelId || pending.length === 0) return
    const msgs: string[] = []
    for (const action of pending) {
      const result = executeToolCall(novelId, action.toolCall, toolContext(focus))
      msgs.push(result.message)
      const toolMsg: AiMessage = { role: 'tool', tool_call_id: action.toolCall.id, content: JSON.stringify(result) }
      history.value = [...history.value!, toolMsg].slice(-40)
    }
    pendingActions.value = []
    pushMsg('assistant', `【已采用】${msgs.join('；')}`)
    persistChat()
    onApplied()
  }

  function ignoreAll(): void {
    if (pendingActions.value!.length > 0) {
      const toolMsgs: AiMessage[] = pendingActions.value!.map((action) => ({
        role: 'tool',
        tool_call_id: action.toolCall.id,
        content: JSON.stringify({ success: false, message: '作者未采用此修改' }),
      }))
      history.value = [...history.value!, ...toolMsgs].slice(-40)
    }
    pendingActions.value = []
    persistChat()
  }

  function clearChat(): void {
    messages.value = []
    history.value = []
    pendingActions.value = []
    persistChat()
  }

  return {
    messages,
    history,
    pendingActions,
    loading,
    thinking,
    errorText,
    send,
    stop,
    applyOne,
    applyOneById,
    ignoreOneById,
    applyAll,
    ignoreAll,
    clearChat,
  }
}
