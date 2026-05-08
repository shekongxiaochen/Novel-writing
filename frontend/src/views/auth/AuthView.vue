<template>
  <section class="auth-page">
    <div class="auth-shell">
      <div class="auth-left">
        <LoginMonsterEyes class="auth-monster" />
        <div class="auth-left-text">
          <h2 class="auth-left-title">{{ mode === 'login' ? '欢迎回来' : '开始创作前，先注册一下' }}</h2>
          <p class="muted">
            {{ mode === 'login' ? '输入账号密码即可进入你的作品空间。' : '注册后可以随时登录。该演示版本只保存在本地浏览器。' }}
          </p>
        </div>
      </div>

      <div class="auth-right">
        <div class="card auth-card">
          <h2 class="auth-card__title">{{ mode === 'login' ? '登录' : '注册' }}</h2>

          <form class="auth-form" @submit.prevent="onSubmit">
            <label>
              账号 / 邮箱 *
              <input
                v-model="form.identifier"
                type="text"
                autocomplete="username"
                maxlength="40"
                placeholder="例如：xiaoming 或 xiaoming@example.com"
                required
              />
            </label>

            <label>
              密码 *
              <input
                v-model="form.password"
                type="password"
                autocomplete="current-password"
                minlength="6"
                placeholder="至少 6 位"
                required
              />
            </label>

            <label v-if="mode === 'register'">
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

            <p v-if="error" class="auth-error">{{ error }}</p>

            <div class="auth-actions">
              <button type="submit" class="btn-primary" :disabled="isSubmitting">
                {{ isSubmitting ? '处理中...' : mode === 'login' ? '登录进入' : '创建账号' }}
              </button>

              <button type="button" class="auth-switch" :disabled="isSubmitting" @click="goBackHome">
                返回作品列表
              </button>

              <button type="button" class="auth-switch" :disabled="isSubmitting" @click="goOtherMode">
                {{ mode === 'login' ? '没有账号？去注册' : '已有账号？去登录' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import LoginMonsterEyes from '../../components/LoginMonsterEyes.vue'
import { useAuth } from '../../composables/useAuth'

type AuthMode = 'login' | 'register'

const props = defineProps<{ mode: AuthMode }>()
const mode = computed(() => props.mode)

const router = useRouter()
const { login, register: doRegister } = useAuth()

const form = reactive({
  identifier: '',
  password: '',
  confirmPassword: '',
})

const error = ref<string>('')
const isSubmitting = ref(false)

const otherMode = computed<AuthMode>(() => (mode.value === 'login' ? 'register' : 'login'))

function resetError() {
  error.value = ''
}

function goOtherMode() {
  resetError()
  void router.push(otherMode.value === 'login' ? '/login' : '/register')
}

function goBackHome() {
  resetError()
  void router.push('/')
}

async function onSubmit() {
  if (isSubmitting.value) return
  resetError()

  const identifier = form.identifier.trim()
  const password = form.password

  if (!identifier) {
    error.value = '请输入账号/邮箱'
    return
  }
  if (!password || password.length < 6) {
    error.value = '密码至少 6 个字符'
    return
  }

  if (mode.value === 'register') {
    if (form.confirmPassword !== form.password) {
      error.value = '两次输入的密码不一致'
      return
    }
  }

  isSubmitting.value = true
  try {
    if (mode.value === 'login') {
      await login({ identifier, password })
      void router.push('/')
      return
    }

    await doRegister({ identifier, password })
    // 注册成功后引导回登录页
    void router.push('/login')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '操作失败，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

