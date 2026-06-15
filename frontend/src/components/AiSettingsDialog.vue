<template>
  <Transition :name="inline ? '' : 'ai-settings-dialog-pop'">
  <div
    v-if="inline || open"
    class="ai-settings-dialog"
    :class="{ 'ai-settings-dialog--inline': inline }"
    role="dialog"
    aria-modal="false"
  >
    <div class="ai-settings-dialog__body">
      <div class="ai-settings-dialog__head">
        <div>
          <p class="ai-settings-dialog__eyebrow">Server AI</p>
          <h3 class="confirm-dialog__title">AI 服务说明</h3>
          <p class="muted ai-settings-dialog__sub">
            写作助手、AI 阅读台、档案整理等均通过服务端代理调用 DeepSeek，按实际用量扣减账户余额。
          </p>
        </div>
        <button
          v-if="!inline"
          type="button"
          class="ai-settings-dialog__close"
          aria-label="关闭"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>

      <section class="ai-settings-dialog__preset-card">
        <div>
          <strong>当前账户</strong>
          <p class="muted">API 密钥与模型由管理后台配置，前端不再保存 Key。</p>
        </div>
        <div class="ai-settings-dialog__hint">
          <p v-if="!account.loggedIn" class="ai-settings-dialog__status ai-settings-dialog__status--error">
            未登录：请先在首页完成设备注册或账号登录。
          </p>
          <template v-else>
            <p>
              余额：<strong>{{ formattedBalance }}</strong>
            </p>
            <p class="muted">每次请求结束后余额会自动更新；不足时请联系管理员充值。</p>
          </template>
        </div>
      </section>

      <div class="ai-settings-dialog__field-grid">
        <div class="ai-settings-dialog__hint">
          <span class="ai-settings-dialog__hint-kicker">复用范围</span>
          <p>大纲补全、章节分析、档案整理、AI 阅读台、章总结等，均走同一后端接口。</p>
        </div>
      </div>

      <div class="ai-settings-dialog__footer-shell">
        <p
          v-if="statusNote"
          class="ai-settings-dialog__status"
          :class="{
            'ai-settings-dialog__status--error': statusKind === 'error',
            'ai-settings-dialog__status--success': statusKind === 'success',
          }"
        >
          {{ statusNote }}
        </p>

        <div class="confirm-dialog__actions ai-settings-dialog__footer">
          <button
            v-if="!inline"
            type="button"
            class="confirm-dialog__btn confirm-dialog__btn--secondary"
            @click="$emit('close')"
          >
            关闭
          </button>
          <button
            type="button"
            class="confirm-dialog__btn confirm-dialog__btn--secondary"
            :disabled="isRefreshing || !account.loggedIn"
            @click="handleRefresh"
          >
            {{ isRefreshing ? '刷新中...' : '刷新余额' }}
          </button>
        </div>
      </div>
    </div>
  </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { getAiAccountState, refreshAiAccount, type AiAccountState } from '../lib/aiSettings'

const props = withDefaults(
  defineProps<{
    open?: boolean
    inline?: boolean
  }>(),
  {
    open: false,
    inline: false,
  },
)

defineEmits<{ close: [] }>()

const account = reactive<AiAccountState>(getAiAccountState())
const statusNote = ref('')
const statusKind = ref<'idle' | 'success' | 'error'>('idle')
const isRefreshing = ref(false)

const formattedBalance = computed(() => {
  const n = Number(account.balanceYuan ?? 0)
  return Number.isFinite(n) ? `¥${n.toFixed(2)}` : '¥0.00'
})

function syncAccount(): void {
  Object.assign(account, getAiAccountState())
}

function onAccountChanged(): void {
  syncAccount()
}

async function loadAccount(): Promise<void> {
  syncAccount()
  if (!account.loggedIn) return
  await handleRefresh()
}

async function handleRefresh(): Promise<void> {
  isRefreshing.value = true
  statusNote.value = ''
  statusKind.value = 'idle'
  try {
    const next = await refreshAiAccount()
    Object.assign(account, next)
    statusNote.value = '余额已更新。'
    statusKind.value = 'success'
  } catch (error: unknown) {
    statusNote.value = error instanceof Error ? error.message : '刷新失败'
    statusKind.value = 'error'
  } finally {
    isRefreshing.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open && !props.inline) return
    void loadAccount()
  },
)

watch(
  () => props.inline,
  (inline) => {
    if (!inline) return
    void loadAccount()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('novel-writing:changed', onAccountChanged)
  window.addEventListener('novel-writing:ai-account-changed', onAccountChanged)
})

onUnmounted(() => {
  window.removeEventListener('novel-writing:changed', onAccountChanged)
  window.removeEventListener('novel-writing:ai-account-changed', onAccountChanged)
})
</script>
