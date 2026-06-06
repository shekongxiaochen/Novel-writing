<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AiMessage, AiPendingToolAction, Novel } from '../../../types'
import { askAiWithToolsStream } from '../../../lib/localAi'
import { buildNovelWorkspacePayload } from '../../../lib/storage'
import { executeToolCall } from '../../../lib/aiTools'
import { fetchWalletBalance } from '../../../lib/backendAi'
import { requestAiAccess } from '../../../composables/useAiAccess'
import { useAuth } from '../../../composables/useAuth'
import { formatBalanceYuan } from '../../../lib/balanceFormat'
import { describeToolCall } from '../../../features/chapter-hub/lib/aiPendingToolActions'

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string }
type FocusEntity = { kind: string; id: string; label: string } | null

const props = defineProps<{
  novelId: string
  novel: Novel | null
  focusEntity?: FocusEntity
}>()

const emit = defineEmits<{ applied: []; 'pending-change': [actions: AiPendingToolAction[]]; 'open-change': [open: boolean]; 'width-change': [width: number] }>()

const open = ref(false)
const WIDTH_KEY = 'novel-writing.workspace-ai-width'
const MIN_W = 320
const MAX_W = 720
function readInitWidth(): number {
  if (typeof window === 'undefined') return 420
  const raw = Number(localStorage.getItem(WIDTH_KEY))
  if (Number.isFinite(raw) && raw >= MIN_W) return Math.min(MAX_W, raw)
  return 420
}
const panelWidth = ref(readInitWidth())
let resizing = false
function onResizeStart(e: PointerEvent): void {
  resizing = true
  e.preventDefault()
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd)
}
function onResizeMove(e: PointerEvent): void {
  if (!resizing) return
  // 面板贴右边，宽度 = 视口右沿到指针的距离
  const w = Math.round(window.innerWidth - e.clientX)
  panelWidth.value = Math.max(MIN_W, Math.min(MAX_W, w))
  emit('width-change', panelWidth.value)
}
function onResizeEnd(): void {
  if (!resizing) return
  resizing = false
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  try { localStorage.setItem(WIDTH_KEY, String(panelWidth.value)) } catch { /* ignore */ }
}
const draft = ref('')
const { balance, refresh: refreshAuth } = useAuth()
const balanceRefreshing = ref(false)
const balanceLabel = computed(() => formatBalanceYuan(balance.value))
async function refreshBalance(): Promise<void> {
  if (!requestAiAccess()) return
  if (balanceRefreshing.value) return
  balanceRefreshing.value = true
  try {
    await fetchWalletBalance()
    refreshAuth()
  } catch {
    /* 静默失败 */
  } finally {
    balanceRefreshing.value = false
  }
}
const loading = ref(false)
const thinking = ref(false)
const errorText = ref('')
const messages = ref<ChatMsg[]>([])
const history = ref<AiMessage[]>([])
const pendingActions = ref<AiPendingToolAction[]>([])
const scrollRef = ref<HTMLElement | null>(null)
let abort: AbortController | null = null

const STORAGE_PREFIX = 'novel-writing.workspace-ai-chat.'
function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`
}

function loadChat(id: string): void {
  messages.value = []
  history.value = []
  pendingActions.value = []
  if (!id || typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return
    const parsed = JSON.parse(raw) as { messages?: ChatMsg[]; history?: AiMessage[] }
    if (Array.isArray(parsed.messages)) messages.value = parsed.messages.slice(-100)
    if (Array.isArray(parsed.history)) history.value = parsed.history.slice(-40)
  } catch {
    /* ignore */
  }
}

function persistChat(): void {
  if (!props.novelId || typeof window === 'undefined') return
  try {
    localStorage.setItem(
      storageKey(props.novelId),
      JSON.stringify({ messages: messages.value.slice(-100), history: history.value.slice(-40) }),
    )
  } catch {
    /* ignore */
  }
}

watch(() => props.novelId, (id) => loadChat(id), { immediate: true })

const focusLabel = computed(() => props.focusEntity?.label ?? '')

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(text: string): string {
  let t = escapeHtml(text)
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  return t
}

function renderMd(content: string): string {
  const src = String(content ?? '').replace(/\r\n/g, '\n').trim()
  if (!src) return ''
  const blocks: string[] = []
  let list: string[] = []
  const flushList = () => {
    if (list.length) {
      blocks.push(`<ul>${list.map((li) => `<li>${renderInline(li)}</li>`).join('')}</ul>`)
      list = []
    }
  }
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim()
    if (!line) { flushList(); continue }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { flushList(); const lv = h[1].length; blocks.push(`<h${lv}>${renderInline(h[2])}</h${lv}>`); continue }
    const li = line.match(/^[-*+]\s+(.*)$/)
    if (li) { list.push(li[1]); continue }
    flushList()
    blocks.push(`<p>${renderInline(line)}</p>`)
  }
  flushList()
  return blocks.join('')
}

function scrollToBottom(): void {
  void nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function pushMsg(role: 'user' | 'assistant', content: string): void {
  messages.value = [...messages.value, { id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, role, content }]
  scrollToBottom()
}

// 流式输出时内容逐字追加，需跟随滚动到底
watch(messages, scrollToBottom, { deep: true })
// 打开侧栏时默认停在最新消息（底部）
watch(open, (v) => {
  if (v) {
    scrollToBottom()
    emit('width-change', panelWidth.value)
  }
  emit('open-change', v)
})

function toolContext() {
  return props.focusEntity ? { focusEntity: { ...props.focusEntity } } : {}
}

async function send(): Promise<void> {
  const question = draft.value.trim()
  if (!question || loading.value) return
  if (!requestAiAccess()) return
  // 仍有未处理的待确认工具调用时，先给它们补上「未采用」工具响应，
  // 否则历史里会出现 tool_calls 后缺少对应 tool 消息，上游 API 会报 400。
  if (pendingActions.value.length > 0) ignoreAll()
  const focus = props.focusEntity
  const composed = focus
    ? `【当前聚焦】${focus.kind}「${focus.label}」(内部 id=${focus.id}，仅供你调用工具时使用，禁止在回复里向用户显示 id 或工具名称)\n\n${question}`
    : question
  pushMsg('user', focus ? `[${focus.label}] ${question}` : question)
  draft.value = ''
  loading.value = true
  thinking.value = true
  errorText.value = ''
  abort?.abort()
  abort = new AbortController()
  const assistant: ChatMsg = { id: `${Date.now()}-a`, role: 'assistant', content: '' }
  messages.value = [...messages.value, assistant]
  try {
    const snapshot = buildNovelWorkspacePayload(props.novelId)
    const { history: nextHistory, pendingToolActions, text } = await askAiWithToolsStream(
      snapshot,
      {
        mode: 'all',
        question: composed,
        chapterIds: [],
        novelId: props.novelId,
        prevSummaryCount: 3,
        enableRag: true,
        novel: props.novel
          ? {
              title: props.novel.title,
              summary: props.novel.summary,
              continuityBrief: props.novel.continuityBrief,
              genre: props.novel.genre,
              perspective: props.novel.perspective,
              tone: props.novel.tone,
            }
          : undefined,
      },
      {
        onChunk: (t) => {
          if (thinking.value) thinking.value = false
          assistant.content += t
        },
        onError: (err) => {
          if (err.name === 'AbortError') return
          errorText.value = err.message || 'AI 请求失败'
        },
      },
      history.value.length > 0 ? history.value : undefined,
      abort.signal,
      { alwaysEnableTools: true, confirmBeforeApply: true, toolContext: toolContext() },
    )
    history.value = nextHistory
    assistant.content = String(assistant.content ?? '')
      .replace(/<｜｜DSML｜｜[^>]*>[\s\S]*?<｜｜DSML｜｜[^>]*>/g, '')
      .trim()
    if (pendingToolActions && pendingToolActions.length > 0) {
      pendingActions.value = pendingToolActions
      assistant.content = assistant.content
        ? `${assistant.content}\n\n下方有待确认的修改，点「采用」后才会写入。`
        : '已生成待确认的修改，点「采用」后才会写入。'
    } else if (!assistant.content.trim()) {
      assistant.content = text?.trim() || '已回答完毕，但这次没有可显示的内容。'
    }
    persistChat()
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      if (!assistant.content.trim()) assistant.content = '已停止回答。'
    } else {
      messages.value = messages.value.filter((m) => m.id !== assistant.id)
      errorText.value = e instanceof Error ? e.message : 'AI 请求失败，请稍后重试'
    }
  } finally {
    loading.value = false
    thinking.value = false
    abort = null
  }
}

function stop(): void {
  abort?.abort()
  loading.value = false
  thinking.value = false
}

function applyOne(action: AiPendingToolAction): void {
  if (!props.novelId) return
  const result = executeToolCall(props.novelId, action.toolCall, toolContext())
  const toolMsg: AiMessage = { role: 'tool', tool_call_id: action.toolCall.id, content: JSON.stringify(result) }
  history.value = [...history.value, toolMsg].slice(-40)
  pendingActions.value = pendingActions.value.filter((row) => row.id !== action.id)
  pushMsg('assistant', `【已采用】${result.message}`)
  persistChat()
  emit('applied')
}

function applyOneById(id: string): void {
  const action = pendingActions.value.find((row) => row.id === id)
  if (action) applyOne(action)
}

function ignoreOneById(id: string): void {
  const action = pendingActions.value.find((row) => row.id === id)
  if (action) {
    const toolMsg: AiMessage = {
      role: 'tool',
      tool_call_id: action.toolCall.id,
      content: JSON.stringify({ success: false, message: '作者未采用此修改' }),
    }
    history.value = [...history.value, toolMsg].slice(-40)
  }
  pendingActions.value = pendingActions.value.filter((row) => row.id !== id)
  persistChat()
}

function applyAll(): void {
  const pending = [...pendingActions.value]
  if (!props.novelId || pending.length === 0) return
  const msgs: string[] = []
  for (const action of pending) {
    const result = executeToolCall(props.novelId, action.toolCall, toolContext())
    msgs.push(result.message)
    const toolMsg: AiMessage = { role: 'tool', tool_call_id: action.toolCall.id, content: JSON.stringify(result) }
    history.value = [...history.value, toolMsg].slice(-40)
  }
  pendingActions.value = []
  pushMsg('assistant', `【已采用】${msgs.join('；')}`)
  persistChat()
  emit('applied')
}

function ignoreAll(): void {
  if (pendingActions.value.length > 0) {
    const toolMsgs: AiMessage[] = pendingActions.value.map((action) => ({
      role: 'tool',
      tool_call_id: action.toolCall.id,
      content: JSON.stringify({ success: false, message: '作者未采用此修改' }),
    }))
    history.value = [...history.value, ...toolMsgs].slice(-40)
  }
  pendingActions.value = []
  persistChat()
}

watch(pendingActions, (v) => emit('pending-change', v), { deep: true })

defineExpose({ open, applyOneById, ignoreOneById, applyAll, ignoreAll })

function clearChat(): void {
  messages.value = []
  history.value = []
  pendingActions.value = []
  persistChat()
}

function onComposerKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void send()
  }
}
</script>

<template>
  <div class="wai" :class="{ 'wai--open': open }">
    <button
      v-if="!open"
      type="button"
      class="wai__toggle"
      aria-label="打开 AI 助手"
      @click="requestAiAccess() && (open = true)"
    >AI</button>

    <aside v-else class="wai__panel" :style="{ width: panelWidth + 'px' }" aria-label="AI 助手">
      <div class="wai__resizer" @pointerdown="onResizeStart" title="拖拽调整宽度"></div>
      <header class="wai__head">
        <span class="wai__title">AI 助手</span>
        <div class="wai__head-actions">
          <span class="wai__wallet" title="账户余额">
            <span class="wai__wallet-icon" aria-hidden="true">◎</span>
            <span class="wai__wallet-balance">{{ balanceLabel }}</span>
            <button
              type="button"
              class="wai__wallet-refresh"
              :class="{ 'is-spinning': balanceRefreshing }"
              :disabled="balanceRefreshing"
              title="刷新余额"
              aria-label="刷新余额"
              @click="refreshBalance"
            >↻</button>
          </span>
          <button type="button" class="wai__icon-btn" title="清空对话" @click="clearChat">清空</button>
          <button type="button" class="wai__icon-btn" title="收起" @click="open = false">⟩</button>
        </div>
      </header>

      <div v-if="focusLabel" class="wai__focus">
        聚焦：<strong>{{ focusLabel }}</strong>
      </div>

      <div ref="scrollRef" class="wai__scroll">
        <p v-if="messages.length === 0" class="wai__empty">
          选中左侧的角色/势力/分类/世界观/物品/大纲节点后，可在这里让 AI 帮你补充、修改或归类。也可以直接提问。
        </p>
        <article
          v-for="m in messages"
          :key="m.id"
          class="wai__msg"
          :class="m.role === 'user' ? 'wai__msg--user' : 'wai__msg--assistant'"
        >
          <div v-if="m.role === 'assistant'" class="wai__msg-body wai__msg-body--md" v-html="m.content ? renderMd(m.content) : (thinking ? '思考中…' : '')"></div>
          <div v-else class="wai__msg-body">{{ m.content }}</div>
        </article>

        <div v-if="pendingActions.length > 0" class="wai__pending">
          <p class="wai__pending-title">待确认的修改（{{ pendingActions.length }}）</p>
          <ul class="wai__pending-list">
            <li v-for="action in pendingActions" :key="action.id" class="wai__pending-item">
              <span class="wai__pending-label">{{ describeToolCall(action.toolCall) }}</span>
              <button type="button" class="wai__mini-btn wai__mini-btn--primary" @click="applyOne(action)">采用</button>
            </li>
          </ul>
          <div class="wai__pending-actions">
            <button type="button" class="wai__mini-btn" @click="ignoreAll">全部忽略</button>
            <button type="button" class="wai__mini-btn wai__mini-btn--primary" @click="applyAll">全部采用</button>
          </div>
        </div>
      </div>

      <p v-if="errorText" class="wai__error">{{ errorText }}</p>

      <footer class="wai__composer">
        <textarea
          v-model="draft"
          class="wai__input"
          rows="3"
          :placeholder="focusLabel ? `对「${focusLabel}」做什么？` : '问点什么，或让 AI 帮你整理设定…'"
          @keydown="onComposerKeydown"
        />
        <div class="wai__composer-actions">
          <button v-if="loading" type="button" class="wai__send wai__send--stop" @click="stop">停止</button>
          <button v-else type="button" class="wai__send" :disabled="!draft.trim()" @click="send">发送</button>
        </div>
      </footer>
    </aside>
  </div>
</template>

<style scoped>
.wai__toggle {
  position: fixed;
  right: 14px;
  bottom: 22px;
  z-index: 40;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  background: var(--cta-gradient, var(--color-primary));
  color: var(--btn-on-primary, #fff);
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-md);
}
.wai__panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 40;
  width: min(420px, 92vw);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-lg);
}
.wai__resizer {
  position: absolute;
  top: 0;
  left: -3px;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  z-index: 1;
}
.wai__resizer:hover {
  background: color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.wai__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}
.wai__title {
  font-weight: 750;
}
.wai__head-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.wai__wallet {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-soft) 40%, var(--color-surface));
  font-size: 0.74rem;
}
.wai__wallet-icon {
  color: var(--color-primary);
}
.wai__wallet-balance {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}
.wai__wallet-refresh {
  border: 0;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0 2px;
  line-height: 1;
}
.wai__wallet-refresh:hover {
  color: var(--color-primary);
}
.wai__wallet-refresh.is-spinning {
  animation: wai-spin 0.7s linear infinite;
}
.wai__wallet-refresh:disabled {
  cursor: default;
}
@keyframes wai-spin {
  to { transform: rotate(360deg); }
}
.wai__icon-btn {
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 8px;
  padding: 3px 9px;
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--color-text-muted);
}
.wai__icon-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.wai__focus {
  padding: 8px 14px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-primary-soft) 40%, transparent);
  border-bottom: 1px solid var(--color-border);
}
.wai__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wai__empty {
  margin: 0;
  font-size: 0.84rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}
.wai__msg {
  display: flex;
  flex-direction: column;
}
.wai__msg--user {
  align-items: flex-end;
}
.wai__msg-body {
  max-width: 92%;
  padding: 8px 11px;
  border-radius: 10px;
  font-size: 0.86rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.wai__msg--user .wai__msg-body {
  background: color-mix(in srgb, var(--color-primary-soft) 50%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent);
}
.wai__msg--assistant .wai__msg-body {
  background: color-mix(in srgb, var(--color-surface-muted) 50%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
}
.wai__msg-body--md {
  white-space: normal;
}
.wai__msg-body--md :deep(p) {
  margin: 0 0 8px;
}
.wai__msg-body--md :deep(p:last-child) {
  margin-bottom: 0;
}
.wai__msg-body--md :deep(h1),
.wai__msg-body--md :deep(h2),
.wai__msg-body--md :deep(h3),
.wai__msg-body--md :deep(h4) {
  margin: 10px 0 6px;
  font-size: 0.9rem;
  font-weight: 700;
}
.wai__msg-body--md :deep(ul) {
  margin: 4px 0 8px;
  padding-left: 18px;
}
.wai__msg-body--md :deep(li) {
  margin: 3px 0;
}
.wai__msg-body--md :deep(strong) {
  font-weight: 700;
}
.wai__msg-body--md :deep(code) {
  padding: 1px 5px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--color-surface-muted) 70%, transparent);
  font-size: 0.8rem;
}
.wai__pending {
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  border-radius: 10px;
  padding: 10px;
  background: color-mix(in srgb, var(--color-primary-soft) 22%, transparent);
}
.wai__pending-title {
  margin: 0 0 8px;
  font-size: 0.78rem;
  font-weight: 700;
}
.wai__pending-list {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wai__pending-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.8rem;
}
.wai__pending-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wai__pending-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.wai__mini-btn {
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 7px;
  padding: 3px 10px;
  font-size: 0.76rem;
  cursor: pointer;
  color: var(--color-text);
}
.wai__mini-btn--primary {
  background: var(--color-primary);
  color: var(--btn-on-primary, #fff);
  border-color: transparent;
}
.wai__error {
  margin: 0;
  padding: 6px 14px;
  font-size: 0.8rem;
  color: var(--danger-text, #c0392b);
}
.wai__composer {
  border-top: 1px solid var(--color-border);
  padding: 10px 12px;
}
.wai__input {
  width: 100%;
  resize: none;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.86rem;
  background: var(--color-surface);
  color: var(--color-text);
  box-sizing: border-box;
}
.wai__composer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.wai__send {
  border: 0;
  border-radius: 8px;
  padding: 6px 18px;
  font-weight: 600;
  cursor: pointer;
  background: var(--color-primary);
  color: var(--btn-on-primary, #fff);
}
.wai__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.wai__send--stop {
  background: var(--danger-bg, #c0392b);
}
</style>
