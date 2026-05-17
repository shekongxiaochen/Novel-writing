export type AuthUser = {
  id: string
  /**
   * 登录标识（用户名或邮箱，已做 normalize）
   * - 用于唯一性校验与登录匹配
   */
  loginId: string
  /** 展示用名称 */
  displayName: string
  passwordSalt: string
  passwordHash: string
  createdAt: string
}

export type AuthSession = {
  token: string
  userId: string
  createdAt: string
}

const USERS_KEY = 'novel-writing.auth.users'
const SESSION_KEY = 'novel-writing.auth.session'

function nowIso(): string {
  return new Date().toISOString()
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function normalizeLoginId(input: string): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
}

function readUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((u) => u as Partial<AuthUser>).filter((u) => u && typeof u === 'object')
      .map((u) => ({
        id: String((u as AuthUser).id ?? ''),
        loginId: String((u as AuthUser).loginId ?? ''),
        displayName: String((u as AuthUser).displayName ?? ''),
        passwordSalt: String((u as AuthUser).passwordSalt ?? ''),
        passwordHash: String((u as AuthUser).passwordHash ?? ''),
        createdAt: String((u as AuthUser).createdAt ?? ''),
      }))
      .filter((u) => u.id && u.loginId && u.passwordSalt && u.passwordHash)
  } catch {
    return []
  }
}

function writeUsers(users: AuthUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const s = parsed as Partial<AuthSession>
    if (!s.token || !s.userId) return null
    return {
      token: String(s.token),
      userId: String(s.userId),
      createdAt: String(s.createdAt ?? ''),
    }
  } catch {
    return null
  }
}

function writeSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function randomHex(bytes = 16): string {
  // 仍尽量保持鲁棒性：在极端环境下退回到非安全实现
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    return uid().replace(/[-.]/g, '').slice(0, bytes * 2)
  }
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle || typeof TextEncoder === 'undefined') {
    // fallback：仅用于本地 MVP（不应视为安全方案）
    return `weak:${text}`
  }
  const enc = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  const hashArr = Array.from(new Uint8Array(buf))
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function getCurrentUser(): AuthUser | null {
  const session = readSession()
  if (!session) return null
  const users = readUsers()
  return users.find((u) => u.id === session.userId) ?? null
}

export function logout(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export async function register(input: { identifier: string; password: string }): Promise<AuthUser> {
  const loginId = normalizeLoginId(input.identifier)
  const password = String(input.password ?? '')
  if (loginId.length < 3) throw new Error('用户名/邮箱至少 3 个字符')
  if (password.length < 6) throw new Error('密码至少 6 个字符')

  const users = readUsers()
  if (users.some((u) => u.loginId === loginId)) {
    throw new Error('该用户名/邮箱已注册')
  }

  const salt = randomHex(16)
  const hash = await sha256Hex(`${salt}:${password}`)

  const user: AuthUser = {
    id: uid(),
    loginId,
    displayName: loginId,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: nowIso(),
  }

  users.push(user)
  writeUsers(users)
  return user
}

export async function login(input: { identifier: string; password: string }): Promise<AuthSession> {
  const loginId = normalizeLoginId(input.identifier)
  const password = String(input.password ?? '')
  if (!loginId) throw new Error('请输入用户名/邮箱')
  if (!password) throw new Error('请输入密码')

  const users = readUsers()
  const user = users.find((u) => u.loginId === loginId)
  if (!user) throw new Error('账号或密码错误')

  const hash = await sha256Hex(`${user.passwordSalt}:${password}`)
  if (hash !== user.passwordHash) throw new Error('账号或密码错误')

  const session: AuthSession = {
    token: randomHex(16),
    userId: user.id,
    createdAt: nowIso(),
  }
  writeSession(session)
  return session
}
