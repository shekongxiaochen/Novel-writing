import { getCurrentSession } from '../lib/auth'

/** 打开 AI 功能前需已登录；未登录时触发全局登录弹窗 */
export function requestAiAccess(): boolean {
  const session = getCurrentSession()
  if (session?.token) return true
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('novel-writing:open-auth', { detail: { mode: 'login' as const } }),
    )
  }
  return false
}
