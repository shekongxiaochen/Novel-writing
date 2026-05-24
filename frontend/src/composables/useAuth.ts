import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AuthSession, AuthUser, DeviceStatus, RegisterByDeviceResult } from '../lib/auth'
import {
  fetchDeviceStatus,
  getCurrentUser,
  login,
  logout,
  registerByDevice,
  restoreSession,
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

async function doLogin(input: { username: string; password: string }): Promise<AuthSession> {
  const session = await login(input)
  refresh()
  return session
}

async function doRegisterByDevice(): Promise<RegisterByDeviceResult> {
  const result = await registerByDevice()
  refresh()
  return result
}

async function doFetchDeviceStatus(): Promise<DeviceStatus> {
  return fetchDeviceStatus()
}

async function doLogout(): Promise<void> {
  await logout()
  refresh()
}

export function useAuth() {
  const isLoggedIn = computed(() => !!user.value)
  const displayName = computed(() => user.value?.username ?? user.value?.displayName ?? '')
  const balanceYuan = computed(() => user.value?.balanceYuan ?? 0)
  const balance = balanceYuan

  const onStorage = () => refresh()
  const onSessionChanged = () => refresh()
  onMounted(() => {
    window.addEventListener('storage', onStorage)
    window.addEventListener('novel-writing:changed', onSessionChanged)
    void ensureRestored()
  })
  onUnmounted(() => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('novel-writing:changed', onSessionChanged)
  })

  return {
    user,
    isLoggedIn,
    displayName,
    balanceYuan,
    balance,
    restoring,
    login: doLogin,
    registerByDevice: doRegisterByDevice,
    fetchDeviceStatus: doFetchDeviceStatus,
    logout: doLogout,
    refresh,
    restore: ensureRestored,
  }
}
