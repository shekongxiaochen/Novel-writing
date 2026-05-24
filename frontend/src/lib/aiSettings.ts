import { fetchWalletBalance, isAiReady } from './backendAi'
import { getCurrentSession } from './auth'

export type AiAccountState = {
  loggedIn: boolean
  balanceYuan: number
}

function emitAiAccountChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('novel-writing:ai-account-changed'))
}

export function getAiAccountState(): AiAccountState {
  const session = getCurrentSession()
  return {
    loggedIn: Boolean(session?.token),
    balanceYuan: Number(session?.user.balanceYuan ?? 0),
  }
}

export async function refreshAiAccount(): Promise<AiAccountState> {
  const session = getCurrentSession()
  if (!session?.token) {
    return { loggedIn: false, balanceYuan: 0 }
  }
  try {
    const balanceYuan = await fetchWalletBalance()
    emitAiAccountChanged()
    return { loggedIn: true, balanceYuan }
  } catch {
    return getAiAccountState()
  }
}

/** @deprecated 使用 isAiReady */
export function hasAiApiKey(): boolean {
  return isAiReady()
}
