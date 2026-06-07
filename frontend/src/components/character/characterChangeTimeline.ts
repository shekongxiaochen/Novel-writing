import type { CharacterChangeEvent } from '../../lib/storage'

export type CharacterChangeRow = {
  updatedAt: string
  when: string
  chapterId: string
  chapterLabel: string
  anchorStart: number | null
  anchorEnd: number | null
  fields: string[]
  details: Array<{ field: string; location: string; before: string; after: string }>
}

export function characterFieldLabel(field: string): string {
  const key = String(field ?? '').trim()
  if (key === 'age') return '年龄'
  if (key === 'gender') return '性别'
  if (key === 'name') return '姓名'
  if (key === 'notes') return '备注'
  if (key === 'aliases') return '别名'
  if (key === 'memberships') return '所属势力'
  if (key === 'items') return '绑定物品'
  if (key === 'categoryIds') return '分类'
  if (key === 'attributes') return '扩展条目'
  return key || '未知字段'
}

export function extractAttributeKeys(raw: string): string[] {
  const text = String(raw ?? '').trim()
  if (!text) return []
  return text
    .split(/[；;]/)
    .map((part) => {
      const i = part.indexOf(':')
      if (i < 0) return ''
      return part.slice(0, i).trim()
    })
    .filter(Boolean)
}

function normalizeAnchorSpan(ev: CharacterChangeEvent): { start: number; end: number } | null {
  const s = typeof ev.anchorStart === 'number' ? Math.max(0, Math.floor(ev.anchorStart)) : NaN
  const e = typeof ev.anchorEnd === 'number' ? Math.max(0, Math.floor(ev.anchorEnd)) : NaN
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null
  return { start: s, end: e }
}

export function groupChangesByAnchor(
  history: CharacterChangeEvent[],
  chapterLabelById: Map<string, string>,
): CharacterChangeRow[] {
  const groups = new Map<string, CharacterChangeEvent[]>()
  const order: string[] = []

  history.forEach((ev, idx) => {
    const chapterId = String(ev.chapterId ?? '').trim()
    const span = normalizeAnchorSpan(ev)
    const key = chapterId && span ? `ch:${chapterId}|a:${span.start}-${span.end}` : `free:${idx}:${ev.updatedAt ?? ''}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(ev)
  })

  const out: CharacterChangeRow[] = []
  for (const key of order) {
    const list = (groups.get(key) ?? []).slice()
    list.sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')))
    const first = list[0]
    const last = list[list.length - 1]
    if (!first || !last) continue

    const chapterId = String(last.chapterId ?? first.chapterId ?? '').trim()
    const span = normalizeAnchorSpan(last) ?? normalizeAnchorSpan(first)
    const fieldSet = new Set<string>()
    const detailMap = new Map<string, { field: string; location: string; before: string; after: string }>()

    for (const ev of list) {
      for (const f of ev.fields ?? []) {
        const x = String(f ?? '').trim()
        if (x) fieldSet.add(x)
      }
      for (const d of ev.details ?? []) {
        const field = String(d.field ?? '').trim()
        const location = String(d.location ?? '').trim()
        if (!field && !location) continue
        const k = `${field}@@${location}`
        const hit = detailMap.get(k)
        if (!hit) {
          detailMap.set(k, { field, location, before: String(d.before ?? ''), after: String(d.after ?? '') })
        } else {
          hit.after = String(d.after ?? '')
        }
      }
    }

    const updatedAt = String(last.updatedAt ?? '')
    const when = updatedAt ? new Date(updatedAt).toLocaleString() : '未知时间'
    out.push({
      updatedAt,
      when,
      chapterId,
      chapterLabel: chapterLabelById.get(chapterId) ?? '',
      anchorStart: span?.start ?? null,
      anchorEnd: span?.end ?? null,
      fields: Array.from(fieldSet),
      details: Array.from(detailMap.values()),
    })
  }
  return out
}

