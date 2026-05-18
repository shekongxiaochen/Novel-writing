<template>
  <div v-if="open" class="confirm-overlay auth-dialog-overlay" @pointerdown.self="emitClose">
    <div class="confirm-dialog auth-dialog" role="dialog" aria-modal="true" @pointerdown.stop>
      <div class="confirm-dialog__accent auth-dialog__accent" aria-hidden="true" />
      <div class="confirm-dialog__body auth-dialog__body">
        <div class="auth-dialog__head">
          <div class="auth-dialog__head-text">
            <p class="auth-dialog__eyebrow">{{ currentMode === 'login' ? '账号' : currentMode === 'register' ? '新账号' : '找回密码' }}</p>
            <h2 class="confirm-dialog__title auth-dialog__title">{{ formTitle }}</h2>
          </div>
          <button type="button" class="auth-dialog__close" aria-label="关闭" @click="emitClose">×</button>
        </div>

        <form class="auth-dialog__form" @submit.prevent="onSubmit">
          <label class="auth-dialog__field">
            <span>邮箱</span>
            <input
              v-model="form.email"
              class="auth-dialog__input"
              type="email"
              autocomplete="username"
              maxlength="255"
              placeholder="name@example.com"
              required
            />
          </label>

          <label v-if="requiresCode" class="auth-dialog__field">
            <span>验证码</span>
            <div class="auth-dialog__inline">
              <input
                v-model="form.code"
                class="auth-dialog__input"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                minlength="6"
                maxlength="6"
                placeholder="6 位验证码"
                required
              />
              <button
                type="button"
                class="confirm-dialog__btn confirm-dialog__btn--ghost auth-dialog__inline-btn"
                :disabled="isSubmitting || isSendingCode || countdown > 0"
                @click="onSendCode"
              >
                {{ isSendingCode ? '发送中' : countdown > 0 ? `${countdown}s` : '发送' }}
              </button>
            </div>
          </label>

          <label class="auth-dialog__field">
            <span>{{ passwordLabel }}</span>
            <input
              v-model="form.password"
              class="auth-dialog__input"
              type="password"
              :autocomplete="currentMode === 'login' ? 'current-password' : 'new-password'"
              minlength="6"
              placeholder="至少 6 位"
              required
            />
          </label>

          <label v-if="requiresConfirmPassword" class="auth-dialog__field">
            <span>确认密码</span>
            <input
              v-model="form.confirmPassword"
              class="auth-dialog__input"
              type="password"
              autocomplete="new-password"
              minlength="6"
              placeholder="再次输入"
              required
            />
          </label>

          <p v-if="success" class="auth-dialog__success">{{ success }}</p>
          <p v-if="codeHint" class="auth-dialog__success">{{ codeHint }}</p>
          <p v-if="error" class="auth-dialog__error">{{ error }}</p>

          <div class="confirm-dialog__actions auth-dialog__actions">
            <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger auth-dialog__submit" :disabled="isSubmitting">
              {{ submitLabel }}
            </button>

            <button
              v-if="currentMode === 'login'"
              type="button"
              class="confirm-dialog__btn confirm-dialog__btn--ghost"
              :disabled="isSubmitting"
              @click="currentMode = 'reset-password'"
            >
              忘记密码
            </button>

            <button
              v-if="currentMode !== 'reset-password'"
              type="button"
              class="confirm-dialog__btn confirm-dialog__btn--ghost"
              :disabled="isSubmitting"
              @click="currentMode = currentMode === 'login' ? 'register' : 'login'"
            >
              {{ currentMode === 'login' ? '去注册' : '去登录' }}
            </button>

            <button
              v-if="currentMode === 'reset-password'"
              type="button"
              class="confirm-dialog__btn confirm-dialog__btn--ghost"
              :disabled="isSubmitting"
              @click="currentMode = 'login'"
            >
              返回登录
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useAuth } from '../composables/useAuth'

type AuthMode = 'login' | 'register' | 'reset-password'

const props = defineProps<{
  open: boolean
  initialMode: AuthMode
}>()

const emit = defineEmits<{
  close: []
  authenticated: []
}>()

const { login, register: doRegister, resetPassword, sendRegisterCode, sendResetPasswordCode } = useAuth()

const currentMode = ref<AuthMode>(props.initialMode)
const form = reactive({
  email: '',
  code: '',
  password: '',
  confirmPassword: '',
})

const error = ref('')
const success = ref('')
const codeHint = ref('')
const isSubmitting = ref(false)
const isSendingCode = ref(false)
const countdown = ref(0)
let countdownTimer: number | null = null

const requiresCode = computed(() => currentMode.value !== 'login')
const requiresConfirmPassword = computed(() => currentMode.value !== 'login')
const formTitle = computed(() => {
  if (currentMode.value === 'login') return '登录'
  if (currentMode.value === 'register') return '注册'
  return '重置密码'
})
const passwordLabel = computed(() => (currentMode.value === 'reset-password' ? '新密码' : '密码'))
const submitLabel = computed(() => {
  if (isSubmitting.value) return '处理中...'
  if (currentMode.value === 'login') return '登录'
  if (currentMode.value === 'register') return '创建账号'
  return '重置密码'
})

watch(
  () => props.initialMode,
  (mode) => {
    currentMode.value = mode
    resetMessages()
  },
);

watch(
  () => props.open,
  (open) => {
    if (!open) return
    currentMode.value = props.initialMode
    resetMessages()
  },
);

function emitClose(): void {
  resetMessages()
  emit('close')
}

function resetMessages(): void {
  error.value = ''
  success.value = ''
  codeHint.value = ''
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function stopCountdown(): void {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown(seconds: number): void {
  stopCountdown()
  countdown.value = seconds
  countdownTimer = window.setInterval(() => {
    if (countdown.value <= 1) {
      countdown.value = 0
      stopCountdown()
      return
    }
    countdown.value -= 1
  }, 1000)
}

async function onSendCode(): Promise<void> {
  if (isSendingCode.value || isSubmitting.value || !requiresCode.value) return
  resetMessages()

  const email = normalizeEmail(form.email)
  if (!email) {
    error.value = '请输入邮箱'
    return
  }

  isSendingCode.value = true
  try {
    const result =
      currentMode.value === 'register'
        ? await sendRegisterCode({ email })
        : await sendResetPasswordCode({ email })
    codeHint.value = result.debugCode ? `调试验证码：${result.debugCode}` : result.message
    startCountdown(60)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '验证码发送失败'
  } finally {
    isSendingCode.value = false
  }
}

async function onSubmit(): Promise<void> {
  if (isSubmitting.value) return
  resetMessages()

  const email = normalizeEmail(form.email)
  const password = form.password

  if (!email) {
    error.value = '请输入邮箱'
    return
  }
  if (!password || password.length < 6) {
    error.value = '密码至少 6 个字符'
    return
  }
  if (requiresCode.value && !form.code.trim()) {
    error.value = '请输入验证码'
    return
  }
  if (requiresConfirmPassword.value && form.confirmPassword !== form.password) {
    error.value = '两次输入的密码不一致'
    return
  }

  isSubmitting.value = true
  try {
    if (currentMode.value === 'login') {
      await login({ email, password })
      emit('authenticated')
      return
    }

    if (currentMode.value === 'register') {
      await doRegister({ email, password, code: form.code.trim() })
      emit('authenticated')
      return
    }

    const result = await resetPassword({
      email,
      code: form.code.trim(),
      newPassword: password,
    })
    success.value = result.message || '密码已重置'
    form.code = ''
    form.password = ''
    form.confirmPassword = ''
    stopCountdown()
    countdown.value = 0
    currentMode.value = 'login'
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    isSubmitting.value = false
  }
}

onUnmounted(() => stopCountdown())
</script>

<style scoped>
.auth-dialog-overlay {
  z-index: 1200;
}

.auth-dialog {
  width: min(460px, calc(100vw - 28px));
  overflow: hidden;
}

.auth-dialog__accent {
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 42%, transparent), color-mix(in srgb, var(--color-primary-soft) 78%, transparent));
}

.auth-dialog__body {
  padding: 0;
}

.auth-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 22px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 30%, transparent);
}

.auth-dialog__head-text {
  display: grid;
  gap: 6px;
}

.auth-dialog__eyebrow {
  margin: 0;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.auth-dialog__title {
  margin: 0;
}

.auth-dialog__close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.35rem;
  line-height: 1;
}

.auth-dialog__close:hover {
  background: color-mix(in srgb, var(--color-surface-muted) 70%, transparent);
  color: var(--color-text);
}

.auth-dialog__form {
  display: grid;
  gap: 14px;
  padding: 20px 22px 22px;
}

.auth-dialog__field {
  display: grid;
  gap: 8px;
  font-size: 0.92rem;
  font-weight: 600;
}

.auth-dialog__input {
  min-height: 46px;
  width: 100%;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 36%, transparent);
  background: color-mix(in srgb, #fff 76%, var(--color-surface) 24%);
  outline: none;
}

.auth-dialog__input:focus {
  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border-strong) 50%);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary-soft) 20%, transparent);
}

.auth-dialog__inline {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.auth-dialog__inline-btn {
  min-width: 88px;
  min-height: 46px;
  border-radius: 12px;
}

.auth-dialog__success,
.auth-dialog__error {
  margin: 0;
  font-size: 0.9rem;
}

.auth-dialog__success {
  color: color-mix(in srgb, var(--color-primary) 72%, var(--success-text, #1c9b63) 28%);
}

.auth-dialog__error {
  color: var(--danger-text);
}

.auth-dialog__actions {
  justify-content: flex-start;
  gap: 10px;
  margin-top: 4px;
}

.auth-dialog__submit {
  min-width: 120px;
}

@media (max-width: 640px) {
  .auth-dialog__inline {
    grid-template-columns: 1fr;
  }

  .auth-dialog__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
