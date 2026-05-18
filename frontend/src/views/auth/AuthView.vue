<template>
  <section class="auth-page">
    <div class="auth-shell">
      <div class="card auth-card">
        <div class="auth-card__header">
          <p class="auth-card__eyebrow">{{ pageTitle }}</p>
          <h2 class="auth-card__title">{{ formTitle }}</h2>
          <p class="muted auth-card__description">{{ pageDescription }}</p>
        </div>

        <form class="auth-form" @submit.prevent="onSubmit">
          <label>
            邮箱 *
            <input
              v-model="form.email"
              type="email"
              autocomplete="username"
              maxlength="255"
              placeholder="例如：xiaoming@example.com"
              required
            />
          </label>

          <label v-if="requiresCode">
            验证码 *
            <div class="auth-inline-field">
              <input
                v-model="form.code"
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
                class="auth-inline-action"
                :disabled="isSubmitting || isSendingCode || countdown > 0"
                @click="onSendCode"
              >
                {{ isSendingCode ? '发送中...' : countdown > 0 ? `${countdown}s 后重发` : '发送验证码' }}
              </button>
            </div>
          </label>

          <label>
            {{ passwordLabel }} *
            <input
              v-model="form.password"
              type="password"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              minlength="6"
              placeholder="至少 6 位"
              required
            />
          </label>

          <label v-if="requiresConfirmPassword">
            确认密码 *
            <input
              v-model="form.confirmPassword"
              type="password"
              autocomplete="new-password"
              minlength="6"
              placeholder="再次输入密码"
              required
            />
          </label>

          <p v-if="success" class="auth-success">{{ success }}</p>
          <p v-if="codeHint" class="auth-success">{{ codeHint }}</p>
          <p v-if="error" class="auth-error">{{ error }}</p>

          <div class="auth-actions">
            <button type="submit" class="btn-primary" :disabled="isSubmitting">
              {{ submitLabel }}
            </button>

            <button type="button" class="auth-switch" :disabled="isSubmitting" @click="goBackHome">
              返回作品列表
            </button>

            <button
              v-if="mode === 'login'"
              type="button"
              class="auth-switch"
              :disabled="isSubmitting"
              @click="goResetPassword"
            >
              忘记密码？
            </button>

            <button
              v-if="mode !== 'reset-password'"
              type="button"
              class="auth-switch"
              :disabled="isSubmitting"
              @click="goOtherMode"
            >
              {{ mode === 'login' ? '没有账号？去注册' : '已有账号？去登录' }}
            </button>

            <button
              v-if="mode === 'reset-password'"
              type="button"
              class="auth-switch"
              :disabled="isSubmitting"
              @click="goLogin"
            >
              返回登录
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'

type AuthMode = 'login' | 'register' | 'reset-password'

const props = defineProps<{ mode: AuthMode }>()
const mode = computed(() => props.mode)

const router = useRouter()
const { login, register: doRegister, resetPassword, sendRegisterCode, sendResetPasswordCode } = useAuth()

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

const requiresCode = computed(() => mode.value !== 'login')
const requiresConfirmPassword = computed(() => mode.value !== 'login')
const otherMode = computed<'login' | 'register'>(() => (mode.value === 'login' ? 'register' : 'login'))

const pageTitle = computed(() => {
  if (mode.value === 'login') return '欢迎回来'
  if (mode.value === 'register') return '开始创作前，先注册一下'
  return '把账号找回来'
})

const pageDescription = computed(() => {
  if (mode.value === 'login') return '输入邮箱和密码即可进入你的作品空间。'
  if (mode.value === 'register') return '注册后可以随时登录。开发环境下未配置邮件时，会直接显示调试验证码。'
  return '输入邮箱、验证码和新密码。开发环境下未配置邮件时，会直接显示调试验证码。'
})

const formTitle = computed(() => {
  if (mode.value === 'login') return '登录'
  if (mode.value === 'register') return '注册'
  return '重置密码'
})

const passwordLabel = computed(() => (mode.value === 'reset-password' ? '新密码' : '密码'))

const submitLabel = computed(() => {
  if (isSubmitting.value) return '处理中...'
  if (mode.value === 'login') return '登录进入'
  if (mode.value === 'register') return '创建账号'
  return '重置密码'
})

function resetMessages() {
  error.value = ''
  success.value = ''
  codeHint.value = ''
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function stopCountdown() {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown(seconds: number) {
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

function goOtherMode() {
  resetMessages()
  void router.push(otherMode.value === 'login' ? '/login' : '/register')
}

function goBackHome() {
  resetMessages()
  void router.push('/')
}

function goLogin() {
  resetMessages()
  void router.push('/login')
}

function goResetPassword() {
  resetMessages()
  void router.push('/reset-password')
}

async function onSendCode() {
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
      mode.value === 'register'
        ? await sendRegisterCode({ email })
        : await sendResetPasswordCode({ email })
    codeHint.value = result.debugCode ? `验证码已发送。当前开发环境调试码：${result.debugCode}` : result.message
    startCountdown(60)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '验证码发送失败，请稍后重试'
  } finally {
    isSendingCode.value = false
  }
}

async function onSubmit() {
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
    if (mode.value === 'login') {
      await login({ email, password })
      void router.push('/')
      return
    }

    if (mode.value === 'register') {
      await doRegister({ email, password, code: form.code.trim() })
      void router.push('/')
      return
    }

    const result = await resetPassword({
      email,
      code: form.code.trim(),
      newPassword: password,
    })
    success.value = result.message || '密码已重置，请重新登录'
    form.code = ''
    form.password = ''
    form.confirmPassword = ''
    stopCountdown()
    countdown.value = 0
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '操作失败，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}

onUnmounted(() => stopCountdown())
</script>
