// 轻量 Markdown 渲染：支持标题(# ~ ####)、无序列表、加粗、斜体、行内代码。
// 自带 HTML 转义，输出可安全用于 v-html。无第三方依赖。

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(text: string): string {
  let t = escapeHtml(text)
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  return t
}

export function renderMarkdown(content: string): string {
  const src = String(content ?? '').replace(/\r\n/g, '\n').trim()
  if (!src) return ''
  const blocks: string[] = []
  let list: string[] = []
  const flushList = (): void => {
    if (list.length) {
      blocks.push(`<ul>${list.map((li) => `<li>${renderInline(li)}</li>`).join('')}</ul>`)
      list = []
    }
  }
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trim()
    if (!line) { flushList(); continue }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) { flushList(); const lv = h[1].length; blocks.push(`<h${lv}>${renderInline(h[2])}</h${lv}>`); continue }
    const li = line.match(/^[-*+]\s+(.*)$/)
    if (li) { list.push(li[1]); continue }
    flushList()
    blocks.push(`<p>${renderInline(line)}</p>`)
  }
  flushList()
  return blocks.join('')
}
