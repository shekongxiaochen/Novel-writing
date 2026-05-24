<template>
  <section class="auth-page">
    <div class="auth-shell">
      <div class="card auth-card">
        <div class="auth-card__header">
          <p class="auth-card__eyebrow">{{ pageTitle }}</p>
          <h2 class="auth-card__title">{{ formTitle }}</h2>
          <p class="muted auth-card__description">{{ pageDescription }}</p>
        </div>

        <div v-if="loadingStatus" class="auth-form">
          <p class="muted">正在检查本设备注册状态…</p>
        </div>

        <div v-else-if="mode === 'register' && !deviceStatus?.hasAccount && credentials" class="auth-form">
          <p class="auth-success">账号已创建，请立即保存以下信息（仅显示一次）：</p>
          <div class="auth-credentials">
            <p><strong>账号：</strong>{{ credentials.username }}</p>
            <p><strong>密码：</strong>{{ credentials.password }}</p>
          </div>
          <div class="auth-actions">
            <button type="button" class="btn-primary" @click="goHome">已保存，进入作品列表</button>
          </div>
        </div>

        <form v-else class="auth-form" @submit.prevent="onSubmit">
          <label v-if="mode === 'login'">
            账号 *
            <input
              v-model="form.username"
              type="text"
              autocomplete="username"
              maxlength="64"
              placeholder="注册时系统分配的账号"
              required
            />
          </label>

          <label v-if="mode === 'login'">
            密码 *
            <input
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>

          <p v-if="error" class="auth-error">{{ error }}</p>

          <div class="auth-actions">
            <button v-if="mode === 'register'" type="submit" class="btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? '注册中...' : '本设备注册新账号' }}
            </button>

            <button v-else type="submit" class="btn-primary" :disabled="isSubmitting">
              {{ isSubmitting ? '登录中...' : '登录进入' }}
            </button>

            <button type="button" class="auth-switch" :disabled="isSubmitting" @click="goBackHome">
              返回作品列表
            </button>

            <button
              v-if="mode === 'login' && !deviceStatus?.hasAccount"
              type="button"
              class="auth-switch"
              :disabled="isSubmitting"
              @click="goRegister"
            >
              本设备尚未注册，去注册
            </button>

            <button
              v-if="mode === 'register' && deviceStatus?.hasAccount"
              type="button"
              class="auth-switch"
              :disabled="isSubmitting"
              @click="goLogin"
            >
              本设备已有账号，去登录
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import type { DeviceStatus } from '../../lib/auth'

type AuthMode = 'login' | 'register'

const props = defineProps<{ mode: AuthMode }>()
const mode = computed(() => props.mode)

const router = useRouter()
const { login, registerByDevice, fetchDeviceStatus } = useAuth()

const form = ref({
  username: '',
  password: '',
})

const error = ref('')
const isSubmitting = ref(false)
const loadingStatus = ref(true)
const deviceStatus = ref<DeviceStatus | null>(null)
const credentials = ref<{ username: string; password: string } | null>(null)

const pageTitle = computed(() =>
  mode.value === 'login' ? '欢迎回来' : '本设备首次使用',
)

const formTitle = computed(() => (mode.value === 'login' ? '登录' : '注册'))

const pageDescription = computed(() => {
  if (mode.value === 'login') {
    return '使用注册时保存的账号与密码登录。同一账号可在任意网络下登录。'
  }
  if (deviceStatus.value?.hasAccount) {
    return '本设备已绑定账号，请直接登录。'
  }
  return '每台设备仅可注册一个账号。注册成功后会显示系统分配的账号与密码，请务必保存（无法自助改密）。'
})

async function loadDeviceStatus() {
  loadingStatus.value = true
  error.value = ''
  try {
    deviceStatus.value = await fetchDeviceStatus()
    if (deviceStatus.value.username) {
      form.value.username = deviceStatus.value.username
    }
    if (mode.value === 'register' && deviceStatus.value.hasAccount) {
      void router.replace('/login')
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '无法连接服务器'
  } finally {
    loadingStatus.value = false
  }
}

onMounted(() => {
  void loadDeviceStatus()
})

function goBackHome() {
  void router.push('/')
}

function goHome() {
  void router.push('/')
}

function goLogin() {
  void router.push('/login')
}

function goRegister() {
  void router.push('/register')
}

async function onSubmit() {
  if (isSubmitting.value) return
  error.value = ''

  if (mode.value === 'register') {
    if (deviceStatus.value?.hasAccount) {
      error.value = '本设备已注册，请登录'
      return
    }
    isSubmitting.value = true
    try {
      const result = await registerByDevice()
      credentials.value = {
        username: result.username,
        password: result.password,
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '注册失败'
    } finally {
      isSubmitting.value = false
    }
    return
  }

  const username = form.value.username.trim()
  const password = form.value.password
  if (!username || !password) {
    error.value = '请输入账号和密码'
    return
  }

  isSubmitting.value = true
  try {
    await login({ username, password })
    void router.push('/')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.auth-credentials {
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 8px;
  background: var(--surface-elevated, #f4f4f5);
  font-family: ui-monospace, monospace;
  word-break: break-all;
}
</style>
