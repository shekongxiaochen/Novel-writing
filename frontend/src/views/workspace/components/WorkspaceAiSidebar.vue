<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AiPendingToolAction, Novel } from '../../../types'
import { fetchWalletBalance } from '../../../lib/backendAi'
import { requestAiAccess } from '../../../composables/useAiAccess'
import { useAuth } from '../../../composables/useAuth'
import { formatBalanceYuan } from '../../../lib/balanceFormat'
import { describeToolCall } from '../../../features/chapter-hub/lib/aiPendingToolActions'
import { renderMarkdown } from '../../../lib/renderMarkdown'
import { useWorkspaceAiChat, type FocusEntity } from '../../../composables/useWorkspaceAiChat'

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
const scrollRef = ref<HTMLElement | null>(null)

// 会话与流式状态来自模块级单例 composable，不随本组件挂载/卸载而销毁。
// 切换标签页导致侧边栏卸载时，进行中的流式请求与已输出内容都能保活。
const chat = computed(() => useWorkspaceAiChat(props.novelId))
const messages = computed(() => chat.value.messages.value ?? [])
const pendingActions = computed(() => chat.value.pendingActions.value ?? [])
const loading = computed(() => chat.value.loading.value ?? false)
const thinking = computed(() => chat.value.thinking.value ?? false)
const errorText = computed(() => chat.value.errorText.value ?? '')

const focusLabel = computed(() => props.focusEntity?.label ?? '')

function renderMd(content: string): string {
  return renderMarkdown(content)
}

function scrollToBottom(): void {
  void nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
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

// 待确认工具调用变化时通知父组件；immediate 保证组件重新挂载时父组件能同步到当前待确认项
watch(pendingActions, (v) => emit('pending-change', v), { deep: true, immediate: true })

async function send(): Promise<void> {
  const question = draft.value.trim()
  if (!question || loading.value) return
  if (!requestAiAccess()) return
  draft.value = ''
  await chat.value.send(question, { novel: props.novel, focus: props.focusEntity ?? null })
}

function stop(): void {
  chat.value.stop()
}

function applyOneById(id: string): void {
  chat.value.applyOneById(id, props.focusEntity ?? null, () => emit('applied'))
}

function applyOne(action: AiPendingToolAction): void {
  applyOneById(action.id)
}

function ignoreOneById(id: string): void {
  chat.value.ignoreOneById(id)
}

function applyAll(): void {
  chat.value.applyAll(props.focusEntity ?? null, () => emit('applied'))
}

function ignoreAll(): void {
  chat.value.ignoreAll()
}

function clearChat(): void {
  chat.value.clearChat()
}

defineExpose({ open, applyOneById, ignoreOneById, applyAll, ignoreAll })

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
  right: 18px;
  bottom: 24px;
  z-index: 40;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--color-primary) 50%, transparent);
  background: var(--cta-gradient, var(--color-primary));
  color: var(--btn-on-primary, #fff);
  font-weight: 800;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow:
    0 10px 26px color-mix(in srgb, var(--color-primary) 38%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 36%, transparent);
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s ease;
}
.wai__toggle::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
  opacity: 0;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.wai__toggle:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow:
    0 16px 34px color-mix(in srgb, var(--color-primary) 46%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 40%, transparent);
}
.wai__toggle:hover::after {
  opacity: 1;
  transform: scale(1.06);
}
.wai__toggle:active {
  transform: translateY(0) scale(0.97);
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
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 98%, rgba(255,255,255,0.7)), color-mix(in srgb, var(--color-surface-muted) 92%, transparent)),
    radial-gradient(circle at top right, color-mix(in srgb, var(--color-primary-soft) 26%, transparent), transparent 42%);
  border-left: 1px solid color-mix(in srgb, var(--color-border-strong) 64%, transparent);
  border-top-left-radius: 18px;
  border-bottom-left-radius: 18px;
  box-shadow:
    -18px 0 48px color-mix(in srgb, #120f0b 16%, transparent),
    inset 1px 0 0 color-mix(in srgb, #fff 40%, transparent);
  overflow: hidden;
  animation: wai-panel-in 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes wai-panel-in {
  from {
    opacity: 0;
    transform: translateX(28px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .wai__panel {
    animation: none;
  }
  .wai__toggle {
    transition: none;
  }
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
  padding: 13px 15px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border-strong) 56%, transparent);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
  backdrop-filter: blur(6px);
}
.wai__title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--color-text) 84%, var(--color-primary) 16%);
}
.wai__title::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent);
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
  font-size: 0.6rem;
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
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 60%, transparent);
  background: color-mix(in srgb, var(--color-surface) 80%, transparent);
  border-radius: 9px;
  padding: 4px 10px;
  font-size: 0.64rem;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.wai__icon-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 30%, var(--color-surface));
}
.wai__focus {
  margin: 10px 14px 0;
  padding: 7px 12px;
  font-size: 0.64rem;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-primary-soft) 38%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
  border-radius: 10px;
}
.wai__focus strong {
  color: color-mix(in srgb, var(--color-primary) 72%, var(--color-text) 28%);
  font-weight: 750;
}
.wai__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-border-strong) 60%, transparent) transparent;
}
.wai__scroll::-webkit-scrollbar {
  width: 7px;
}
.wai__scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border-strong) 58%, transparent);
}
.wai__scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-primary) 30%, var(--color-border-strong));
}
.wai__empty {
  margin: auto 4px;
  padding: 16px 14px;
  font-size: 0.68rem;
  color: var(--color-text-muted);
  line-height: 1.7;
  text-align: center;
  border: 1px dashed color-mix(in srgb, var(--color-border-strong) 56%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
}
.wai__msg {
  display: flex;
  flex-direction: column;
  animation: wai-msg-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}
@keyframes wai-msg-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .wai__msg {
    animation: none;
  }
}
.wai__msg--user {
  align-items: flex-end;
}
.wai__msg-body {
  max-width: 92%;
  padding: 9px 12px;
  border-radius: 14px;
  font-size: 0.68rem;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}
.wai__msg--user .wai__msg-body {
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary-soft) 70%, var(--color-surface)), color-mix(in srgb, var(--color-primary-soft) 40%, var(--color-surface)));
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, transparent);
  border-bottom-right-radius: 5px;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 12%, transparent);
}
.wai__msg--assistant .wai__msg-body {
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 50%, transparent);
  border-left: 2px solid color-mix(in srgb, var(--color-primary) 42%, transparent);
  border-bottom-left-radius: 5px;
  box-shadow: 0 2px 10px color-mix(in srgb, #120f0b 6%, transparent);
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
  font-size: 0.72rem;
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
  font-size: 0.64rem;
}
.wai__pending {
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  border-radius: 10px;
  padding: 10px;
  background: color-mix(in srgb, var(--color-primary-soft) 22%, transparent);
}
.wai__pending-title {
  margin: 0 0 8px;
  font-size: 0.62rem;
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
  font-size: 0.64rem;
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
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 60%, transparent);
  background: color-mix(in srgb, var(--color-surface) 86%, transparent);
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-text);
  transition: transform 0.14s ease, border-color 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease;
}
.wai__mini-btn:hover {
  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border-strong));
  transform: translateY(-1px);
}
.wai__mini-btn--primary {
  background: var(--cta-gradient, var(--color-primary));
  color: var(--btn-on-primary, #fff);
  border-color: transparent;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 28%, transparent);
}
.wai__mini-btn--primary:hover {
  box-shadow: 0 5px 14px color-mix(in srgb, var(--color-primary) 38%, transparent);
}
.wai__error {
  margin: 0 14px 4px;
  padding: 8px 12px;
  font-size: 0.64rem;
  line-height: 1.5;
  color: var(--danger-text, #c0392b);
  background: color-mix(in srgb, var(--danger-bg, #c0392b) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger-bg, #c0392b) 28%, transparent);
  border-radius: 10px;
}
.wai__composer {
  border-top: 1px solid color-mix(in srgb, var(--color-border-strong) 56%, transparent);
  padding: 12px 14px 14px;
  background: color-mix(in srgb, var(--color-surface) 72%, transparent);
  backdrop-filter: blur(6px);
}
.wai__input {
  width: 100%;
  resize: none;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 56%, transparent);
  border-radius: 13px;
  padding: 10px 12px;
  font-size: 0.68rem;
  line-height: 1.6;
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  color: var(--color-text);
  box-sizing: border-box;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}
.wai__input::placeholder {
  color: color-mix(in srgb, var(--color-text-muted) 78%, transparent);
}
.wai__input:hover {
  border-color: color-mix(in srgb, var(--color-primary) 36%, var(--color-border-strong));
}
.wai__input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--color-primary) 60%, transparent);
  background: var(--color-surface);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
}
.wai__composer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 9px;
}
.wai__send {
  border: 0;
  border-radius: 10px;
  padding: 7px 22px;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  background: var(--cta-gradient, var(--color-primary));
  color: var(--btn-on-primary, #fff);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--color-primary) 30%, transparent);
  transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.15s ease, opacity 0.15s ease;
}
.wai__send:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 40%, transparent);
}
.wai__send:active:not(:disabled) {
  transform: translateY(0);
}
.wai__send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
.wai__send--stop {
  background: var(--danger-bg, #c0392b);
  box-shadow: 0 3px 10px color-mix(in srgb, #c0392b 30%, transparent);
}
</style>
