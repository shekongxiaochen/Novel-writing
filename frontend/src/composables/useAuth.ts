import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AuthSession, AuthUser } from '../lib/auth'
import { getCurrentUser, login, logout, register } from '../lib/auth'

export function useAuth() {
  const user = ref<AuthUser | null>(getCurrentUser())

  const isLoggedIn = computed(() => !!user.value)
  const displayName = computed(() => user.value?.displayName ?? '')

  function refresh(): void {
    user.value = getCurrentUser()
  }

  async function doLogin(input: { identifier: string; password: string }): Promise<AuthSession> {
    const session = await login(input)
    refresh()
    return session
  }

  async function doRegister(input: { identifier: string; password: string }): Promise<AuthUser> {
    const u = await register(input)
    // 注册后不自动登录（更可控）；如果你想自动登录，把这里改成调用 doLogin
    refresh()
    return u
  }

  function doLogout(): void {
    logout()
    refresh()
  }

  const onStorage = () => refresh()
  onMounted(() => window.addEventListener('storage', onStorage))
  onUnmounted(() => window.removeEventListener('storage', onStorage))

  return {
    user,
    isLoggedIn,
    displayName,
    login: doLogin,
    register: doRegister,
    logout: doLogout,
    refresh,
  }
}
