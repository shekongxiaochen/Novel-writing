import type { AiMessage, AiToolCall, AiToolDefinition } from '../types'
import { getOrCreateDeviceId } from './device'
import { getCurrentSession, type AuthSession } from './auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')

export type AiCompletionResult = {
  content: string
  toolCalls: AiToolCall[]
  reasoningContent: string
  balanceYuan: number
}

type AiCompletionBody = {
  messages: Record<string, unknown>[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
  tools?: AiToolDefinition[]
  tool_choice?: string | Record<string, unknown>
  response_format?: { type: string }
}

type AiChatApiResponse = {
  choices?: Array<{
    message?: {
      role?: string
      content?: string | null
      tool_calls?: unknown
      reasoning_content?: string
    }
    finish_reason?: string
  }>
  balance_yuan?: number
  balance_tokens?: number
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

function deviceHeaders(): Record<string, string> {
  return { 'X-Device-Id': getOrCreateDeviceId() }
}

function requireSession(): AuthSession {
  const session = getCurrentSession()
  if (!session?.token) {
    throw new Error('请先登录后再使用 AI 功能')
  }
  return session
}

function mapAiError(status: number, detail: string): Error {
  if (status === 401) return new Error('请先登录后再使用 AI 功能')
  if (status === 402) return new Error(detail || '余额不足，请充值后再试')
  if (status === 503 || status === 500) {
    return new Error(detail || 'AI 服务暂不可用，请确认管理后台已配置 DeepSeek')
  }
  return new Error(detail || `AI 请求失败（${status}）`)
}

function readBalanceYuan(payload: { balance_yuan?: number; balance_tokens?: number } | null | undefined): number | null {
  if (!payload) return null
  if (payload.balance_yuan != null && Number.isFinite(Number(payload.balance_yuan))) {
    return Math.max(0, Number(payload.balance_yuan))
  }
  return null
}

export function patchSessionBalance(balanceYuan: number): void {
  if (typeof window === 'undefined') return
  if (!Number.isFinite(balanceYuan)) return
  try {
    const raw = localStorage.getItem('novel-writing.auth.session')
    if (!raw) return
    const parsed = JSON.parse(raw) as { token?: string; user?: { balanceYuan?: number; balanceTokens?: number } }
    if (!parsed?.user) return
    const next = Math.max(0, Math.round(balanceYuan * 10_000) / 10_000)
    const prev = Number(parsed.user.balanceYuan ?? parsed.user.balanceTokens ?? 0)
    if (Math.abs(prev - next) < 0.000_05) return
    parsed.user.balanceYuan = next
    delete parsed.user.balanceTokens
    localStorage.setItem('novel-writing.auth.session', JSON.stringify(parsed))
    window.dispatchEvent(new Event('novel-writing:changed'))
  } catch {
    /* ignore */
  }
}

function toApiMessages(messages: AiMessage[]): Record<string, unknown>[] {
  return messages.map((message) => {
    const row: Record<string, unknown> = { role: message.role }
    if (message.content !== undefined) row.content = message.content
    if (message.tool_calls?.length) row.tool_calls = message.tool_calls
    if (message.tool_call_id) row.tool_call_id = message.tool_call_id
    if (message.name) row.name = message.name
    if (message.reasoning_content) row.reasoning_content = message.reasoning_content
    return row
  })
}

function parseToolCalls(raw: unknown): AiToolCall[] {
  if (!Array.isArray(raw)) return []
  const out: AiToolCall[] = []
  for (const tc of raw) {
    const row = tc as {
      type?: string
      id?: string
      function?: { name?: string; arguments?: string }
    }
    if (row.type === 'function' && row.id && row.function?.name) {
      out.push({
        id: row.id,
        type: 'function',
        function: {
          name: row.function.name,
          arguments: row.function.arguments || '{}',
        },
      })
    }
  }
  return out
}

function parseCompletion(data: AiChatApiResponse): AiCompletionResult {
  const message = data.choices?.[0]?.message
  const balanceYuan = readBalanceYuan(data) ?? 0
  if (readBalanceYuan(data) != null) {
    patchSessionBalance(balanceYuan)
  }
  return {
    content: String(message?.content ?? '').trim(),
    toolCalls: parseToolCalls(message?.tool_calls),
    reasoningContent: String(message?.reasoning_content ?? '').trim(),
    balanceYuan,
  }
}

async function aiRequest(path: string, body: AiCompletionBody, signal?: AbortSignal): Promise<Response> {
  const session = requireSession()
  let resp: Response
  try {
    resp = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        ...deviceHeaders(),
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认 Rust 后端已启动且已登录。`,
    )
  }
  return resp
}

export async function postAiCompletion(
  input: Omit<AiCompletionBody, 'messages' | 'stream'> & { messages: AiMessage[] },
  signal?: AbortSignal,
): Promise<AiCompletionResult> {
  const resp = await aiRequest(
    '/ai/chat',
    {
      ...input,
      messages: toApiMessages(input.messages),
      stream: false,
    },
    signal,
  )

  const text = await resp.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!resp.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail?: unknown }).detail ?? '')
        : text
    throw mapAiError(resp.status, detail)
  }

  return parseCompletion((payload ?? {}) as AiChatApiResponse)
}

export async function postAiCompletionStream(
  input: Omit<AiCompletionBody, 'messages' | 'stream'> & { messages: AiMessage[] },
  callbacks: {
    onChunk: (text: string) => void
    onError: (err: Error) => void
    onReasoningChunk?: (text: string) => void
  },
  signal?: AbortSignal,
): Promise<{ text: string; balanceYuan: number }> {
  const resp = await aiRequest(
    '/ai/chat',
    {
      ...input,
      messages: toApiMessages(input.messages),
      stream: true,
    },
    signal,
  )

  if (!resp.ok) {
    const text = await resp.text()
    let detail = text
    try {
      const parsed = JSON.parse(text) as { detail?: string }
      if (parsed.detail) detail = parsed.detail
    } catch {
      /* ignore */
    }
    const err = mapAiError(resp.status, detail)
    callbacks.onError(err)
    throw err
  }

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式读取')

  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  let balanceYuan = 0
  let balancePatched = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
            novel_meta?: { balance_yuan?: number; balance_tokens?: number }
            error?: { message?: string }
          }
          if (parsed.error?.message) {
            throw new Error(parsed.error.message)
          }
          const metaYuan = readBalanceYuan(parsed.novel_meta)
          if (metaYuan != null) {
            balanceYuan = metaYuan
            patchSessionBalance(balanceYuan)
            balancePatched = true
            continue
          }
          const delta = String(parsed?.choices?.[0]?.delta?.content ?? '')
          const reasoningDelta = String(
            (parsed?.choices?.[0]?.delta as { reasoning_content?: string } | undefined)?.reasoning_content ?? '',
          )
          if (reasoningDelta) callbacks.onReasoningChunk?.(reasoningDelta)
          if (delta) {
            full += delta
            callbacks.onChunk(delta)
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.message) throw error
        }
      }
    }
    if (!balancePatched) {
      try {
        balanceYuan = await fetchWalletBalance()
      } catch {
        /* 流式未带回余额时，向服务端拉取最新值 */
      }
    }
    return { text: full, balanceYuan }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    callbacks.onError(err)
    throw err
  }
}

export async function fetchWalletBalance(): Promise<number> {
  const session = requireSession()
  const resp = await fetch(`${API_BASE_URL}/billing/wallet`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...deviceHeaders(),
    },
  })
  const text = await resp.text()
  const payload = text
    ? (JSON.parse(text) as { balance_yuan?: number; balance_tokens?: number; detail?: string })
    : null
  if (!resp.ok) {
    throw new Error(payload?.detail || `读取余额失败（${resp.status}）`)
  }
  const balance = readBalanceYuan(payload) ?? 0
  patchSessionBalance(balance)
  return balance
}

// ── POST /ai/prompt — 后端组装系统提示词 ──

type AiPromptBody = {
  prompt_type: string
  user_prompt: string
  context_prompt?: string
  ai_style_prompt?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
  response_format?: string
  tools?: AiToolDefinition[]
  tool_choice?: string | Record<string, unknown>
}

async function aiPromptRequest(path: string, body: AiPromptBody, signal?: AbortSignal): Promise<Response> {
  const session = requireSession()
  let resp: Response
  try {
    resp = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        ...deviceHeaders(),
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new Error(
      `无法连接后端（${API_BASE_URL}）。请确认 Rust 后端已启动且已登录。`,
    )
  }
  return resp
}

export async function postAiPrompt(
  input: Omit<AiPromptBody, 'stream'>,
  signal?: AbortSignal,
): Promise<AiCompletionResult> {
  const resp = await aiPromptRequest('/ai/prompt', { ...input, stream: false }, signal)

  const text = await resp.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!resp.ok) {
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail?: unknown }).detail ?? '')
        : text
    throw mapAiError(resp.status, detail)
  }

  return parseCompletion((payload ?? {}) as AiChatApiResponse)
}

export async function postAiPromptStream(
  input: Omit<AiPromptBody, 'stream'>,
  callbacks: {
    onChunk: (text: string) => void
    onError: (err: Error) => void
    onReasoningChunk?: (text: string) => void
  },
  signal?: AbortSignal,
): Promise<{ text: string; balanceYuan: number }> {
  const resp = await aiPromptRequest('/ai/prompt', { ...input, stream: true }, signal)

  if (!resp.ok) {
    const text = await resp.text()
    let detail = text
    try {
      const parsed = JSON.parse(text) as { detail?: string }
      if (parsed.detail) detail = parsed.detail
    } catch {
      /* ignore */
    }
    const err = mapAiError(resp.status, detail)
    callbacks.onError(err)
    throw err
  }

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式读取')

  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  let balanceYuan = 0
  let balancePatched = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
            novel_meta?: { balance_yuan?: number; balance_tokens?: number }
            error?: { message?: string }
          }
          if (parsed.error?.message) {
            throw new Error(parsed.error.message)
          }
          const metaYuan = readBalanceYuan(parsed.novel_meta)
          if (metaYuan != null) {
            balanceYuan = metaYuan
            patchSessionBalance(balanceYuan)
            balancePatched = true
            continue
          }
          const delta = String(parsed?.choices?.[0]?.delta?.content ?? '')
          const reasoningDelta = String(
            (parsed?.choices?.[0]?.delta as { reasoning_content?: string } | undefined)?.reasoning_content ?? '',
          )
          if (reasoningDelta) callbacks.onReasoningChunk?.(reasoningDelta)
          if (delta) {
            full += delta
            callbacks.onChunk(delta)
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.message) throw error
        }
      }
    }
    if (!balancePatched) {
      try {
        balanceYuan = await fetchWalletBalance()
      } catch {
        /* 流式未带回余额时，向服务端拉取最新值 */
      }
    }
    return { text: full, balanceYuan }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    callbacks.onError(err)
    throw err
  }
}

export function isAiReady(): boolean {
  const session = getCurrentSession()
  return Boolean(session?.token && Number(session.user.balanceYuan) > 0)
}

export function assertAiReady(): void {
  requireSession()
  const session = getCurrentSession()
  if (!session?.token) {
    throw new Error('请先登录后再使用 AI 功能')
  }
  if (Number(session.user.balanceYuan) <= 0) {
    throw new Error('余额不足，请充值后再试')
  }
}
