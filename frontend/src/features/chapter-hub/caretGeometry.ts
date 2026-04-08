export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function getCaretPixelOffset(
  ta: HTMLTextAreaElement,
  position: number
): { top: number; left: number; height: number } | null {
  if (typeof document === 'undefined') return null

  const style = window.getComputedStyle(ta)

  const div = document.createElement('div')
  const span = document.createElement('span')

  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  div.style.overflow = 'hidden'

  div.style.fontFamily = style.fontFamily
  div.style.fontSize = style.fontSize
  div.style.lineHeight = style.lineHeight
  div.style.letterSpacing = style.letterSpacing
  div.style.padding = style.padding
  div.style.width = `${ta.clientWidth}px`

  div.style.border = 'none'
  div.style.boxSizing = style.boxSizing

  const value = ta.value ?? ''
  const before = value.slice(0, position)
  const after = value.slice(position)

  const beforeHtml = escapeHtml(before)
    .replace(/ {2}/g, ' &nbsp;')
    .replace(/ /g, '&nbsp;')
    .replace(/\n/g, '<br/>')
  const afterHtml = escapeHtml(after)
    .replace(/ {2}/g, ' &nbsp;')
    .replace(/ /g, '&nbsp;')
    .replace(/\n/g, '<br/>')

  span.innerHTML = '&#8203;'

  div.innerHTML = `${beforeHtml}` + `<span id="caret-marker">${span.innerHTML}</span>` + `${afterHtml}`

  document.body.appendChild(div)
  const marker = div.querySelector('#caret-marker') as HTMLElement | null
  if (!marker) {
    document.body.removeChild(div)
    return null
  }

  const rect = marker.getBoundingClientRect()
  const divRect = div.getBoundingClientRect()

  const top = rect.top - divRect.top
  const left = rect.left - divRect.left
  const height = marker.offsetHeight || parseFloat(style.lineHeight || '0') || 0

  document.body.removeChild(div)
  return { top, left, height }
}

export function scrollCaretIntoView(ta: HTMLTextAreaElement, caretPos: number): void {
  const coords = getCaretPixelOffset(ta, caretPos)
  if (!coords) return

  const style = window.getComputedStyle(ta)
  const paddingTop = parseFloat(style.paddingTop || '0') || 0

  const caretY = coords.top - paddingTop
  const caretBottom = caretY + (coords.height || 0)

  const viewTop = ta.scrollTop
  const viewBottom = viewTop + ta.clientHeight
  const pad = 18

  if (caretY < viewTop + pad) {
    ta.scrollTop = Math.max(0, caretY - pad)
  } else if (caretBottom > viewBottom - pad) {
    ta.scrollTop = Math.max(0, caretBottom - ta.clientHeight + pad)
  }
}
