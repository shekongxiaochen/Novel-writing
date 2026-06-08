import { getOrCreateDeviceId } from './device'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  balanceYuan: number
  createdAt: string
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export type DeviceStatus = {
  hasAccount: boolean
  username?: string
}

export type RegisterByDeviceResult = {
  username: string
  password: string
  token: string
  user: AuthUser
}

type AuthApiUser = {
  id: string
  username: string
  display_name: string
  balance_yuan: number
  balance_tokens?: number
  created_at: string
}

type AuthApiSession = {
  token: string
  user: AuthApiUser
}

type DeviceStatusApi = {
  has_account: boolean
  username?: string
}

type RegisterByDeviceApi = {
  username: string
  password: string
  token: string
  user: AuthApiUser
}

const SESSION_KEY = 'novel-writing.auth.session'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')

function emitAuthSessionChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('novel-writing:changed'))
}

function deviceHeaders(): Record<string, string> {
  return { 'X-Device-Id': getOrCreateDeviceId() }
}

function mapUser(user: AuthApiUser): AuthUser {
  return {
    id: String(user.id),
    username: String(user.username),
    displayName: String(user.display_name ?? ''),
    balanceYuan: Number(user.balance_yuan ?? user.balance_tokens ?? 0),
    createdAt: String(user.created_at ?? ''),
  }
}

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthSession> | null
    if (!parsed?.token || !parsed?.user?.id) return null
    return {
      token: String(parsed.token),
      user: {
        id: String(parsed.user.id),
        username: String(parsed.user.username ?? ''),
        displayName: String(parsed.user.displayName ?? ''),
        balanceYuan: Number(parsed.user.balanceYuan ?? parsed.user.balanceTokens ?? 0),
        createdAt: String(parsed.user.createdAt ?? ''),
      },
    }
  } catch {
    return null
  }
}

function writeSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emitAuthSessionChanged()
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
    emitAuthSessionChanged()
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response
  try {
    resp = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...deviceHeaders(),
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new Error('网络连接失败，请检查网络后重试。')
  }

  const text = await resp.text()
  const payload = text ? (JSON.parse(text) as unknown) : null

  if (!resp.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail?: unknown }).detail ?? '')
        : ''
    throw new Error(detail || `请求失败（${resp.status}）`)
  }

  return payload as T
}

export function getCurrentSession(): AuthSession | null {
  return readSession()
}

export function getCurrentUser(): AuthUser | null {
  return readSession()?.user ?? null
}

export async function fetchDeviceStatus(): Promise<DeviceStatus> {
  const data = await request<DeviceStatusApi>('/auth/device-status')
  return {
    hasAccount: Boolean(data.has_account),
    username: data.username ? String(data.username) : undefined,
  }
}

export async function registerByDevice(): Promise<RegisterByDeviceResult> {
  const data = await request<RegisterByDeviceApi>('/auth/register-by-device', {
    method: 'POST',
  })

  const session: AuthSession = {
    token: data.token,
    user: mapUser(data.user),
  }
  writeSession(session)

  return {
    username: data.username,
    password: data.password,
    token: data.token,
    user: session.user,
  }
}

export async function login(input: { username: string; password: string }): Promise<AuthSession> {
  const data = await request<AuthApiSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: String(input.username ?? '').trim(),
      password: String(input.password ?? ''),
    }),
  })

  const session: AuthSession = {
    token: data.token,
    user: mapUser(data.user),
  }
  writeSession(session)
  return session
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const session = readSession()
  if (!session?.token) {
    throw new Error('未登录')
  }

  const user = await request<AuthApiUser>('/auth/me', {
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  })

  const next: AuthSession = {
    ...session,
    user: mapUser(user),
  }
  writeSession(next)
  return next.user
}

export async function restoreSession(): Promise<AuthUser | null> {
  const session = readSession()
  if (!session?.token) return null

  try {
    return await fetchCurrentUser()
  } catch {
    clearSession()
    return null
  }
}

export async function logout(): Promise<void> {
  const session = readSession()
  try {
    if (session?.token) {
      await request<{ message: string }>('/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      })
    }
  } finally {
    clearSession()
  }
}
