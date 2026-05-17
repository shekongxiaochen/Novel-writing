export type AiSettings = {
  apiKey: string
  baseUrl: string
  model: string
}

export type AiConnectionTestResult = {
  ok: boolean
  message: string
}

const AI_SETTINGS_KEY = 'novel-writing.ai.settings'

const DEFAULT_SETTINGS: AiSettings = {
  apiKey: '',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  model: 'qwen-plus',
}

function emitAiSettingsChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('novel-writing:ai-settings-changed'))
}

export function getAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AiSettings>
    return {
      apiKey: String(parsed.apiKey ?? '').trim(),
      baseUrl: String(parsed.baseUrl ?? DEFAULT_SETTINGS.baseUrl).trim() || DEFAULT_SETTINGS.baseUrl,
      model: String(parsed.model ?? DEFAULT_SETTINGS.model).trim() || DEFAULT_SETTINGS.model,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function normalizeAiSettings(input?: Partial<AiSettings>): AiSettings {
  const current = getAiSettings()
  return {
    apiKey: String(input?.apiKey ?? current.apiKey).trim(),
    baseUrl: String(input?.baseUrl ?? current.baseUrl).trim() || DEFAULT_SETTINGS.baseUrl,
    model: String(input?.model ?? current.model).trim() || DEFAULT_SETTINGS.model,
  }
}

export function saveAiSettings(input: Partial<AiSettings>): AiSettings {
  const next = normalizeAiSettings(input)
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(next))
  emitAiSettingsChanged()
  return next
}

export function hasAiApiKey(): boolean {
  return !!getAiSettings().apiKey.trim()
}

export async function testAiConnection(input?: Partial<AiSettings>): Promise<AiConnectionTestResult> {
  const settings = normalizeAiSettings(input)
  if (!settings.apiKey) {
    return { ok: false, message: '请先填写 API Key。' }
  }
  if (!settings.baseUrl) {
    return { ok: false, message: '请先填写 Base URL。' }
  }
  if (!settings.model) {
    return { ok: false, message: '请先填写 Model。' }
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 15000)

  try {
    const resp = await fetch(settings.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0,
        max_tokens: 16,
        messages: [
          { role: 'system', content: '你是连接测试助手。' },
          { role: 'user', content: '请回复：连接成功' },
        ],
      }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const text = await resp.text()
      return {
        ok: false,
        message: text || `连接失败：HTTP ${resp.status}`,
      }
    }

    const data = await resp.json()
    const content = String(data?.choices?.[0]?.message?.content ?? '').trim()
    return {
      ok: true,
      message: content ? `连接成功：${content}` : '连接成功，接口已返回有效响应。',
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, message: '连接超时，请检查 Base URL、网络或模型服务状态。' }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : '连接失败，请检查配置。',
    }
  } finally {
    window.clearTimeout(timer)
  }
}
