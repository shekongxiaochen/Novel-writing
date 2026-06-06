/**
 * 复制纯文本到剪贴板。优先用现代 Clipboard API,降级到隐藏 textarea + execCommand。
 * 返回是否成功。
 */
export async function copyText(text: string): Promise<boolean> {
  const value = String(text ?? '')
  // 现代 API(需安全上下文 https/localhost)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // 落到降级方案
  }
  // 降级:隐藏 textarea + execCommand('copy')
  try {
    if (typeof document === 'undefined') return false
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
