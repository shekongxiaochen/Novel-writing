import { getOrCreateDeviceId } from './device'
import { getCurrentSession } from './auth'
import { patchSessionBalance } from './backendAi'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')

function deviceHeaders(): Record<string, string> {
  return { 'X-Device-Id': getOrCreateDeviceId() }
}

export type RedeemResult = {
  balanceYuan: number
  creditedYuan: number
  amountYuan: number
}

export async function redeemCardKey(code: string): Promise<RedeemResult> {
  const session = getCurrentSession()
  if (!session?.token) {
    throw new Error('请先登录后再兑换卡密')
  }

  const resp = await fetch(`${API_BASE_URL}/billing/redeem`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...deviceHeaders(),
    },
    body: JSON.stringify({ code }),
  })

  const text = await resp.text()
  const payload = text
    ? (JSON.parse(text) as {
        balance_yuan?: number
        credited_yuan?: number
        amount_yuan?: number
        detail?: string
      })
    : null

  if (!resp.ok) {
    throw new Error(payload?.detail || `兑换失败（${resp.status}）`)
  }

  const balanceYuan = Number(payload?.balance_yuan ?? 0)
  patchSessionBalance(balanceYuan)

  return {
    balanceYuan,
    creditedYuan: Number(payload?.credited_yuan ?? 0),
    amountYuan: Number(payload?.amount_yuan ?? 0),
  }
}
