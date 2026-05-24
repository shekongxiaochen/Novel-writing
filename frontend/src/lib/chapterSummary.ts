/** 章总结正文格式化（写作台 / 侧栏与 App 章节目录共用） */
export function formatChapterSummaryText(text: string): string {
  const normalized = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]*\n([，。！？；：、])/g, '$1')
    .trim()
  if (!normalized) return ''

  const plotted = normalized
    .replace(/\n*(情节[一二三四五六七八九十\d]+[：:])/g, '\n\n$1')
    .replace(/(情节[一二三四五六七八九十\d]+[：:][^\n]*)\n?(?!\n)/g, '$1\n')
    .replace(/[ \t]*\n([，。！？；：、])/g, '$1')
    .trim()

  if (/情节[一二三四五六七八九十\d]+[：:]/.test(plotted)) {
    return plotted.replace(/\n{3,}/g, '\n\n')
  }

  const existingParagraphs = normalized
    .split(/\n\s*\n+/)
    .map((row) => row.replace(/[ \t]+\n/g, '\n').replace(/[ \t]*\n([，。！？；：、])/g, '$1').replace(/\n{3,}/g, '\n\n').trim())
    .filter(Boolean)
  if (existingParagraphs.length >= 2) return existingParagraphs.join('\n\n')

  const sentenceGroups = normalized
    .replace(/\n+/g, ' ')
    .split(/(?<=[。！？!?；;])\s+/)
    .map((row) => row.trim())
    .filter(Boolean)
  if (sentenceGroups.length <= 2) return sentenceGroups.join('\n\n')

  const grouped: string[] = []
  for (let index = 0; index < sentenceGroups.length; index += 2) {
    grouped.push(sentenceGroups.slice(index, index + 2).join(' '))
  }
  return grouped.join('\n\n')
}
