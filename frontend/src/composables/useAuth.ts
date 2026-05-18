import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AuthSession, AuthUser, SendCodeResult } from '../lib/auth'
import {
  getCurrentUser,
  login,
  logout,
  resetPassword,
  register,
  restoreSession,
  sendRegisterCode,
  sendResetPasswordCode,
} from '../lib/auth'

const user = ref<AuthUser | null>(getCurrentUser())
const restoring = ref(false)
let restorePromise: Promise<AuthUser | null> | null = null

async function ensureRestored(): Promise<AuthUser | null> {
  if (restorePromise) return restorePromise
  restoring.value = true
  restorePromise = restoreSession()
    .then((nextUser) => {
      user.value = nextUser
      return nextUser
    })
    .finally(() => {
      restoring.value = false
      restorePromise = null
    })
  return restorePromise
}

function refresh(): void {
  user.value = getCurrentUser()
}

async function doLogin(input: { email: string; password: string }): Promise<AuthSession> {
  const session = await login(input)
  refresh()
  return session
}

async function doRegister(input: {
  email: string
  password: string
  code: string
  displayName?: string
}): Promise<AuthSession> {
  const session = await register(input)
  refresh()
  return session
}

async function doSendRegisterCode(input: { email: string }): Promise<SendCodeResult> {
  return sendRegisterCode(input)
}

async function doSendResetPasswordCode(input: { email: string }): Promise<SendCodeResult> {
  return sendResetPasswordCode(input)
}

async function doResetPassword(input: {
  email: string
  code: string
  newPassword: string
}): Promise<{ message: string }> {
  return resetPassword(input)
}

async function doLogout(): Promise<void> {
  await logout()
  refresh()
}

export function useAuth() {
  const isLoggedIn = computed(() => !!user.value)
  const displayName = computed(() => user.value?.displayName ?? '')

  const onStorage = () => refresh()
  onMounted(() => {
    window.addEventListener('storage', onStorage)
    void ensureRestored()
  })
  onUnmounted(() => window.removeEventListener('storage', onStorage))

  return {
    user,
    isLoggedIn,
    displayName,
    restoring,
    login: doLogin,
    register: doRegister,
    sendRegisterCode: doSendRegisterCode,
    sendResetPasswordCode: doSendResetPasswordCode,
    resetPassword: doResetPassword,
    logout: doLogout,
    refresh,
    restore: ensureRestored,
  }
}
