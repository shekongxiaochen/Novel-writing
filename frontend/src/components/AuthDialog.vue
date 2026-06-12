<template>
  <Transition name="confirm">
    <div v-if="open" class="confirm-overlay auth-dialog-overlay" @pointerdown.self="emitClose">
    <div class="confirm-dialog auth-dialog" role="dialog" aria-modal="true" @pointerdown.stop>
      <button type="button" class="auth-dialog__close" aria-label="关闭" @click="emitClose">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
        </svg>
      </button>

      <div class="auth-dialog__hero" aria-hidden="true">
        <div class="auth-dialog__hero-glow" />
        <div class="auth-dialog__brand">
          <span class="auth-dialog__brand-mark">L</span>
          <span class="auth-dialog__brand-name">Lumen 流明</span>
        </div>
        <p class="auth-dialog__hero-tagline">{{ heroTagline }}</p>
      </div>

      <div class="auth-dialog__body">
        <div class="auth-dialog__head">
          <p class="auth-dialog__eyebrow">{{ currentMode === 'login' ? 'Welcome back' : 'Get started' }}</p>
          <h2 class="auth-dialog__title">{{ formTitle }}</h2>
          <p class="auth-dialog__subtitle">{{ headSubtitle }}</p>
        </div>

        <div v-if="credentials" class="auth-dialog__credentials">
          <div v-if="credentials.bonusYuan > 0" class="auth-dialog__bonus">
            <span class="auth-dialog__bonus-coin" aria-hidden="true">¥</span>
            <span class="auth-dialog__bonus-text">
              新用户礼包 · 已到账 <strong>{{ formatYuan(credentials.bonusYuan) }} 元</strong> 体验金
            </span>
          </div>
          <p class="auth-dialog__credentials-hint">请立即妥善保存，以下信息仅显示一次</p>
          <div class="auth-dialog__credential-row">
            <span class="auth-dialog__credential-key">账号</span>
            <code class="auth-dialog__credential-val">{{ credentials.username }}</code>
          </div>
          <div class="auth-dialog__credential-row">
            <span class="auth-dialog__credential-key">密码</span>
            <code class="auth-dialog__credential-val">{{ credentials.password }}</code>
          </div>
          <button type="button" class="auth-dialog__primary" @click="onSaved">
            我已保存，进入工作台
          </button>
        </div>

        <form v-else class="auth-dialog__form" @submit.prevent="onSubmit">
          <template v-if="currentMode === 'login'">
            <label class="auth-dialog__field">
              <span class="auth-dialog__field-label">账号</span>
              <input
                v-model="form.username"
                class="auth-dialog__input"
                type="text"
                autocomplete="username"
                maxlength="64"
                placeholder="输入账号"
                required
              />
            </label>

            <label class="auth-dialog__field">
              <span class="auth-dialog__field-label">密码</span>
              <input
                v-model="form.password"
                class="auth-dialog__input"
                type="password"
                autocomplete="current-password"
                placeholder="输入密码"
                required
              />
            </label>
          </template>

          <p v-else class="auth-dialog__register-note">
            将基于当前设备为你生成一个专属账号与密码，无需填写任何信息。
          </p>

          <Transition name="auth-fade">
            <p v-if="error" class="auth-dialog__error">{{ error }}</p>
          </Transition>

          <button type="submit" class="auth-dialog__primary" :disabled="isSubmitting">
            {{ submitLabel }}
          </button>

          <button
            type="button"
            class="auth-dialog__switch"
            :disabled="isSubmitting"
            @click="currentMode = currentMode === 'login' ? 'register' : 'login'"
          >
            {{ currentMode === 'login' ? '没有账号？本设备注册' : '已有账号？去登录' }}
          </button>
        </form>
      </div>
    </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'

type AuthMode = 'login' | 'register'

const props = defineProps<{
  open: boolean
  initialMode: AuthMode
}>()

const emit = defineEmits<{
  close: []
  authenticated: []
}>()

const { login, registerByDevice, fetchDeviceStatus } = useAuth()

const currentMode = ref<AuthMode>(props.initialMode)
const form = reactive({
  username: '',
  password: '',
})

const error = ref('')
const isSubmitting = ref(false)
const credentials = ref<{ username: string; password: string; bonusYuan: number } | null>(null)

function formatYuan(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

const formTitle = computed(() => (currentMode.value === 'login' ? '登录' : '本设备注册'))
const headSubtitle = computed(() =>
  currentMode.value === 'login' ? '登录后即可同步与管理你的全部作品。' : '为这台设备创建一个专属账号，几秒即可完成。',
)
const heroTagline = computed(() =>
  currentMode.value === 'login' ? '继续你的故事。' : '从这里开始你的第一部作品。',
)
const submitLabel = computed(() => {
  if (isSubmitting.value) return '处理中...'
  return currentMode.value === 'login' ? '登录' : '创建账号'
})

watch(
  () => props.initialMode,
  (mode) => {
    currentMode.value = mode
    resetMessages()
  },
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    currentMode.value = props.initialMode
    credentials.value = null
    resetMessages()
    void loadStatus()
  },
)

onMounted(() => {
  if (props.open) void loadStatus()
})

async function loadStatus(): Promise<void> {
  try {
    const status = await fetchDeviceStatus()
    if (status.username) form.username = status.username
    if (currentMode.value === 'register' && status.hasAccount) {
      currentMode.value = 'login'
    }
  } catch {
    /* ignore */
  }
}

function emitClose(): void {
  resetMessages()
  credentials.value = null
  emit('close')
}

function onSaved(): void {
  credentials.value = null
  emit('authenticated')
}

function resetMessages(): void {
  error.value = ''
}

async function onSubmit(): Promise<void> {
  if (isSubmitting.value) return
  resetMessages()

  isSubmitting.value = true
  try {
    if (currentMode.value === 'register') {
      const result = await registerByDevice()
      credentials.value = {
        username: result.username,
        password: result.password,
        bonusYuan: result.user.balanceYuan,
      }
      return
    }

    const username = form.username.trim()
    if (!username || !form.password) {
      error.value = '请输入账号和密码'
      return
    }
    await login({ username, password: form.password })
    emit('authenticated')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.auth-dialog-overlay {
  z-index: 1200;
}

.auth-dialog {
  position: relative;
  width: min(720px, calc(100vw - 32px));
  max-width: 720px;
  display: grid;
  grid-template-columns: 240px 1fr;
  border-radius: 22px;
  overflow: hidden;
}

/* 关闭按钮：绝对定位在右上角，svg 自动居中 */
.auth-dialog__close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.auth-dialog__close:hover {
  background: color-mix(in srgb, var(--color-surface-muted) 80%, transparent);
  color: var(--color-text);
  transform: rotate(90deg);
}

.auth-dialog__close svg {
  display: block;
}

/* 左侧品牌区 */
.auth-dialog__hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
  padding: 28px 24px;
  overflow: hidden;
  background:
    linear-gradient(155deg, color-mix(in srgb, var(--color-primary) 92%, #000 8%) 0%, color-mix(in srgb, var(--color-primary) 64%, var(--color-accent, var(--color-primary)) 36%) 100%);
  color: #fff;
}

.auth-dialog__hero-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.28) 0%, transparent 44%),
    radial-gradient(circle at 14% 92%, rgba(255, 255, 255, 0.16) 0%, transparent 46%);
  pointer-events: none;
}

.auth-dialog__brand {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
}

.auth-dialog__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.32);
  font-size: 1.15rem;
  font-weight: 800;
  backdrop-filter: blur(4px);
}

.auth-dialog__brand-name {
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.auth-dialog__hero-tagline {
  position: relative;
  margin: 0;
  font-size: 1.32rem;
  font-weight: 700;
  line-height: 1.4;
  text-wrap: balance;
}

/* 右侧表单区 */
.auth-dialog__body {
  padding: 32px 30px 30px;
  background: var(--color-surface);
}

.auth-dialog__head {
  margin-bottom: 22px;
}

.auth-dialog__eyebrow {
  margin: 0 0 8px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.auth-dialog__title {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: var(--color-text);
}

.auth-dialog__subtitle {
  margin: 8px 0 0;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.auth-dialog__form {
  display: grid;
  gap: 16px;
}

.auth-dialog__field {
  display: grid;
  gap: 7px;
}

.auth-dialog__field-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.auth-dialog__input {
  min-height: 46px;
  width: 100%;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 42%, transparent);
  background: color-mix(in srgb, var(--color-surface-muted) 30%, var(--color-surface));
  color: var(--color-text);
  font-size: 0.94rem;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.auth-dialog__input::placeholder {
  color: color-mix(in srgb, var(--color-text-muted) 68%, transparent);
}

.auth-dialog__input:hover {
  border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border-strong));
}

.auth-dialog__input:focus {
  border-color: color-mix(in srgb, var(--color-primary) 62%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
  background: var(--color-surface);
}

.auth-dialog__register-note {
  margin: 0;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px dashed color-mix(in srgb, var(--color-primary) 32%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary-soft) 26%, var(--color-surface));
  font-size: 0.86rem;
  line-height: 1.6;
  color: color-mix(in srgb, var(--color-text) 80%, var(--color-primary) 20%);
}

.auth-dialog__error {
  margin: 0;
  padding: 10px 14px;
  border-radius: 11px;
  border: 1px solid color-mix(in srgb, var(--danger-text) 32%, transparent);
  background: color-mix(in srgb, var(--danger-text) 10%, var(--color-surface));
  color: var(--danger-text);
  font-size: 0.84rem;
  line-height: 1.5;
}

.auth-dialog__primary {
  min-height: 46px;
  margin-top: 2px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 96%, #fff 4%) 0%, color-mix(in srgb, var(--color-primary) 78%, #000 8%) 100%);
  color: var(--color-primary-contrast, #fff);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 8px 20px color-mix(in srgb, var(--color-primary) 28%, transparent);
  transition: transform 0.12s ease, box-shadow 0.16s ease, filter 0.16s ease;
}

.auth-dialog__primary:hover:not(:disabled) {
  filter: brightness(1.04);
  box-shadow: 0 10px 26px color-mix(in srgb, var(--color-primary) 36%, transparent);
}

.auth-dialog__primary:active:not(:disabled) {
  transform: scale(0.985);
}

.auth-dialog__primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.auth-dialog__switch {
  justify-self: center;
  margin-top: 2px;
  padding: 6px 8px;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.16s ease;
}

.auth-dialog__switch:hover:not(:disabled) {
  color: var(--color-primary);
}

.auth-dialog__switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 注册成功后的凭据展示 */
.auth-dialog__credentials {
  display: grid;
  gap: 12px;
}

.auth-dialog__bonus {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, #f5a623 38%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, #ffd76a 24%, var(--color-surface)) 0%,
    color-mix(in srgb, #f5a623 14%, var(--color-surface)) 100%
  );
  color: color-mix(in srgb, #8a5a00 78%, var(--color-text) 22%);
  animation: auth-dialog-bonus-in 0.42s cubic-bezier(0.22, 1.2, 0.36, 1) both;
}

.auth-dialog__bonus-coin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #ffe79a 0%, #f5b324 62%, #d98a0d 100%);
  box-shadow: 0 2px 7px rgba(180, 120, 0, 0.34), inset 0 1px 2px rgba(255, 255, 255, 0.5);
  color: #7a4d00;
  font-weight: 800;
  font-size: 0.98rem;
  animation: auth-dialog-coin-pop 0.6s cubic-bezier(0.18, 1.5, 0.4, 1) 0.12s both;
}

.auth-dialog__bonus-text {
  font-size: 0.9rem;
  line-height: 1.4;
}

@keyframes auth-dialog-bonus-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes auth-dialog-coin-pop {
  0% {
    opacity: 0;
    transform: translateY(-15px) scale(0.3) rotate(-25deg);
  }
  60% {
    opacity: 1;
    transform: translateY(2px) scale(1.18) rotate(8deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-dialog__bonus,
  .auth-dialog__bonus-coin {
    animation: none;
  }
}

.auth-dialog__credentials-hint {
  margin: 0 0 2px;
  font-size: 0.85rem;
  color: color-mix(in srgb, var(--color-text) 78%, var(--color-primary) 22%);
}

.auth-dialog__credential-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 40%, transparent);
  background: color-mix(in srgb, var(--color-surface-muted) 32%, var(--color-surface));
}

.auth-dialog__credential-key {
  flex-shrink: 0;
  min-width: 36px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.auth-dialog__credential-val {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.96rem;
  font-weight: 600;
  color: var(--color-text);
  word-break: break-all;
}

.auth-fade-enter-active,
.auth-fade-leave-active {
  transition: opacity 0.18s ease;
}

.auth-fade-enter-from,
.auth-fade-leave-to {
  opacity: 0;
}

@media (max-width: 560px) {
  .auth-dialog {
    grid-template-columns: 1fr;
    width: min(420px, calc(100vw - 28px));
  }

  .auth-dialog__hero {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px;
  }

  .auth-dialog__hero-tagline {
    display: none;
  }

  .auth-dialog__body {
    padding: 24px 22px 24px;
  }
}
</style>
