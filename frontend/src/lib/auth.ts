export type AuthUser = {
  id: string
  email: string
  displayName: string
  createdAt: string
}

export type AuthSession = {
  token: string
  expiresAt: string
  user: AuthUser
}

export type SendCodeResult = {
  message: string
  debugCode?: string
}

type AuthApiUser = {
  id: string
  email: string
  display_name: string
  created_at: string
}

type AuthApiSession = {
  token: string
  expires_at: string
  user: AuthApiUser
}

type SendCodeApiResult = {
  message: string
  debug_code?: string
}

const SESSION_KEY = 'novel-writing.auth.session'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

function emitAuthSessionChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('novel-writing:changed'))
}

function normalizeEmail(input: string): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
}

function mapUser(user: AuthApiUser): AuthUser {
  return {
    id: String(user.id),
    email: String(user.email),
    displayName: String(user.display_name ?? ''),
    createdAt: String(user.created_at ?? ''),
  }
}

function mapSession(session: AuthApiSession): AuthSession {
  return {
    token: String(session.token),
    expiresAt: String(session.expires_at),
    user: mapUser(session.user),
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
      expiresAt: String(parsed.expiresAt ?? ''),
      user: {
        id: String(parsed.user.id),
        email: String(parsed.user.email ?? ''),
        displayName: String(parsed.user.displayName ?? ''),
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
  const resp = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const text = await resp.text()
  const payload = text ? JSON.parse(text) as unknown : null

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

export async function sendRegisterCode(input: { email: string }): Promise<SendCodeResult> {
  return sendCode({ email: input.email, purpose: 'register' })
}

export async function sendResetPasswordCode(input: { email: string }): Promise<SendCodeResult> {
  return sendCode({ email: input.email, purpose: 'reset_password' })
}

async function sendCode(input: { email: string; purpose: 'register' | 'reset_password' }): Promise<SendCodeResult> {
  const email = normalizeEmail(input.email)
  if (!email) throw new Error('请输入邮箱')

  const result = await request<SendCodeApiResult>('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({
      email,
      purpose: input.purpose,
    }),
  })

  return {
    message: String(result.message ?? ''),
    debugCode: result.debug_code ? String(result.debug_code) : undefined,
  }
}

export async function register(input: {
  email: string
  password: string
  code: string
  displayName?: string
}): Promise<AuthSession> {
  const session = await request<AuthApiSession>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(input.email),
      password: String(input.password ?? ''),
      code: String(input.code ?? '').trim(),
      display_name: String(input.displayName ?? '').trim(),
    }),
  })

  const mapped = mapSession(session)
  writeSession(mapped)
  return mapped
}

export async function resetPassword(input: {
  email: string
  code: string
  newPassword: string
}): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(input.email),
      code: String(input.code ?? '').trim(),
      new_password: String(input.newPassword ?? ''),
    }),
  })
}

export async function login(input: { email: string; password: string }): Promise<AuthSession> {
  const session = await request<AuthApiSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: normalizeEmail(input.email),
      password: String(input.password ?? ''),
    }),
  })

  const mapped = mapSession(session)
  writeSession(mapped)
  return mapped
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
