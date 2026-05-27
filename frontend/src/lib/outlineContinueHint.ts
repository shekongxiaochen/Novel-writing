import type { Chapter, OutlineItem } from '../types'
import { buildOutlineBeatPathForChapter } from './outlineBeatPack'

function s(value: unknown): string {
  return String(value ?? '').trim()
}

export type ChapterContinueOutlineHint = {
  bound: boolean
  beatLine: string
  suggestedDirection: string
  primaryTitle: string
}

function buildSuggestedDirection(item: OutlineItem): string {
  const parts = [s(item.goal), s(item.conflict), s(item.suspense)].filter(Boolean)
  if (parts.length === 0) return s(item.summary).slice(0, 120)
  return parts.join('；').slice(0, 160)
}

function buildBeatLine(item: OutlineItem): string {
  const level = item.level === 'chapter' ? '章' : item.level === 'scene' ? '场' : '节点'
  const focus = s(item.goal) || s(item.summary) || s(item.title)
  return focus ? `${level} · ${s(item.title)}：${focus}` : `${level} · ${s(item.title)}`
}

export function buildChapterContinueOutlineHint(
  outline: OutlineItem[],
  chapter: Pick<Chapter, 'outlineItemIds'> | null | undefined,
  characters: Array<{ id: string; name: string; goal?: string; arc?: string }> = [],
): ChapterContinueOutlineHint {
  const linkedIds = (chapter?.outlineItemIds ?? []).map((id) => s(id)).filter(Boolean)
  if (linkedIds.length === 0) {
    return {
      bound: false,
      beatLine: '',
      suggestedDirection: '',
      primaryTitle: '',
    }
  }

  const beatPack = buildOutlineBeatPathForChapter(outline, linkedIds, characters)
  const byId = new Map(outline.map((row) => [s(row.id), row]))
  const linked = linkedIds.map((id) => byId.get(id)).filter((row): row is OutlineItem => Boolean(row))
  const primary = [...linked].sort((a, b) => {
    const rank = (level?: string) => (level === 'scene' ? 3 : level === 'chapter' ? 2 : 1)
    return rank(b.level) - rank(a.level)
  })[0]

  if (!primary) {
    return {
      bound: false,
      beatLine: '',
      suggestedDirection: '',
      primaryTitle: '',
    }
  }

  const beatLine = buildBeatLine(primary)
  const suggestedDirection = buildSuggestedDirection(primary)

  return {
    bound: true,
    beatLine,
    suggestedDirection,
    primaryTitle: s(primary.title),
    ...(beatPack.warnings.length > 0 ? {} : {}),
  }
}
