<template>
  <Transition name="confirm">
    <div v-if="open" class="confirm-overlay auth-dialog-overlay" @pointerdown.self="emitClose">
    <div class="confirm-dialog auth-dialog" role="dialog" aria-modal="true" @pointerdown.stop>
      <div class="confirm-dialog__accent auth-dialog__accent" aria-hidden="true" />
      <div class="confirm-dialog__body auth-dialog__body">
        <div class="auth-dialog__head">
          <div class="auth-dialog__head-text">
            <p class="auth-dialog__eyebrow">{{ currentMode === 'login' ? '账号' : '新账号' }}</p>
            <h2 class="confirm-dialog__title auth-dialog__title">{{ formTitle }}</h2>
          </div>
          <button type="button" class="auth-dialog__close" aria-label="关闭" @click="emitClose">×</button>
        </div>

        <div v-if="credentials" class="auth-dialog__form">
          <p class="auth-dialog__success">请立即保存（仅显示一次）：</p>
          <p class="auth-dialog__success">账号：{{ credentials.username }}</p>
          <p class="auth-dialog__success">密码：{{ credentials.password }}</p>
          <div class="confirm-dialog__actions auth-dialog__actions">
            <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="onSaved">
              已保存
            </button>
          </div>
        </div>

        <form v-else class="auth-dialog__form" @submit.prevent="onSubmit">
          <label v-if="currentMode === 'login'" class="auth-dialog__field">
            <span>账号</span>
            <input
              v-model="form.username"
              class="auth-dialog__input"
              type="text"
              autocomplete="username"
              maxlength="64"
              required
            />
          </label>

          <label v-if="currentMode === 'login'" class="auth-dialog__field">
            <span>密码</span>
            <input
              v-model="form.password"
              class="auth-dialog__input"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>

          <p v-if="error" class="auth-dialog__error">{{ error }}</p>

          <div class="confirm-dialog__actions auth-dialog__actions">
            <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger auth-dialog__submit" :disabled="isSubmitting">
              {{ submitLabel }}
            </button>

            <button
              type="button"
              class="confirm-dialog__btn confirm-dialog__btn--ghost"
              :disabled="isSubmitting"
              @click="currentMode = currentMode === 'login' ? 'register' : 'login'"
            >
              {{ currentMode === 'login' ? '本设备注册' : '去登录' }}
            </button>
          </div>
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
const credentials = ref<{ username: string; password: string } | null>(null)

const formTitle = computed(() => (currentMode.value === 'login' ? '登录' : '本设备注册'))
const submitLabel = computed(() => {
  if (isSubmitting.value) return '处理中...'
  return currentMode.value === 'login' ? '登录' : '注册'
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
  .auth-dialog__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
