import type { AutoApplyModule } from '../../types'

export type ConflictSeverity = 'error' | 'warning'

export type ConflictItem = {
  id: string
  novelId: string
  chapterId: string
  chapterNo: number | null
  module: AutoApplyModule
  entityId: string
  entityLabel: string
  field: string
  existingValue: string
  existingSource: string
  incomingValue: string
  incomingSource: string
  severity: ConflictSeverity
  suggestion?: string
  resolved: boolean
  resolution?: 'keep_existing' | 'accept_incoming' | 'ignored'
  resolvedAt?: string | null
  createdAt: string
}

type FieldPair = {
  field: string
  existing: string
  incoming: string
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function s(value: unknown): string {
  return String(value ?? '').trim()
}

function extractNumber(text: string): number | null {
  const match = text.match(/\d+/)
  return match ? Number(match[0]) : null
}

function isNumericConflict(a: string, b: string): boolean {
  const na = extractNumber(a)
  const nb = extractNumber(b)
  if (na === null || nb === null) return false
  return na !== nb
}

function inferSeverity(field: string, existing: string, incoming: string): ConflictSeverity {
  if (isNumericConflict(existing, incoming)) return 'error'
  if (field === 'age' || field === 'gender') return 'error'
  return 'warning'
}

function diffFields(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  fields: string[],
): FieldPair[] {
  const conflicts: FieldPair[] = []
  for (const field of fields) {
    const ev = s(existing[field])
    const iv = s(incoming[field])
    if (!ev || !iv) continue
    if (ev === iv) continue
    if (iv.includes(ev) || ev.includes(iv)) continue
    conflicts.push({ field, existing: ev, incoming: iv })
  }
  return conflicts
}

export function detectCharacterConflicts(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  context: { novelId: string; chapterId: string; chapterNo: number | null },
): ConflictItem[] {
  const fields = ['age', 'gender', 'goal', 'secret']
  const pairs = diffFields(existing, incoming, fields)
  const label = s(incoming.name) || s(existing.name)
  return pairs.map((p) => ({
    id: uid(),
    novelId: context.novelId,
    chapterId: context.chapterId,
    chapterNo: context.chapterNo,
    module: 'characters' as AutoApplyModule,
    entityId: s(existing.id),
    entityLabel: label,
    field: p.field,
    existingValue: p.existing,
    existingSource: '档案已有记录',
    incomingValue: p.incoming,
    incomingSource: context.chapterNo ? `第${context.chapterNo}章正文` : '当前章正文',
    severity: inferSeverity(p.field, p.existing, p.incoming),
    resolved: false,
    createdAt: new Date().toISOString(),
  }))
}

export function detectFactionConflicts(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  context: { novelId: string; chapterId: string; chapterNo: number | null },
): ConflictItem[] {
  const fields = ['leader', 'notes']
  const pairs = diffFields(existing, incoming, fields)
  const label = s(incoming.name) || s(existing.name)
  return pairs.map((p) => ({
    id: uid(),
    novelId: context.novelId,
    chapterId: context.chapterId,
    chapterNo: context.chapterNo,
    module: 'factions' as AutoApplyModule,
    entityId: s(existing.id),
    entityLabel: label,
    field: p.field,
    existingValue: p.existing,
    existingSource: '档案已有记录',
    incomingValue: p.incoming,
    incomingSource: context.chapterNo ? `第${context.chapterNo}章正文` : '当前章正文',
    severity: inferSeverity(p.field, p.existing, p.incoming),
    resolved: false,
    createdAt: new Date().toISOString(),
  }))
}

export function detectItemConflicts(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  context: { novelId: string; chapterId: string; chapterNo: number | null },
): ConflictItem[] {
  const fields = ['summary']
  const pairs = diffFields(existing, incoming, fields)
  const label = s(incoming.name) || s(existing.name)
  return pairs.map((p) => ({
    id: uid(),
    novelId: context.novelId,
    chapterId: context.chapterId,
    chapterNo: context.chapterNo,
    module: 'items' as AutoApplyModule,
    entityId: s(existing.id),
    entityLabel: label,
    field: p.field,
    existingValue: p.existing,
    existingSource: '档案已有记录',
    incomingValue: p.incoming,
    incomingSource: context.chapterNo ? `第${context.chapterNo}章正文` : '当前章正文',
    severity: inferSeverity(p.field, p.existing, p.incoming),
    resolved: false,
    createdAt: new Date().toISOString(),
  }))
}

export function detectForeshadowConflicts(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  context: { novelId: string; chapterId: string; chapterNo: number | null },
): ConflictItem[] {
  const conflicts: ConflictItem[] = []
  const label = s(incoming.title) || s(existing.title)

  const existingExpected = s(existing.expectedFulfillChapterNo)
  const incomingExpected = s(incoming.expectedFulfillChapterNo)
  if (existingExpected && incomingExpected && isNumericConflict(existingExpected, incomingExpected)) {
    conflicts.push({
      id: uid(),
      novelId: context.novelId,
      chapterId: context.chapterId,
      chapterNo: context.chapterNo,
      module: 'foreshadows' as AutoApplyModule,
      entityId: s(existing.id),
      entityLabel: label,
      field: 'expectedFulfillChapterNo',
      existingValue: `预期第${existingExpected}章回收`,
      existingSource: '档案已有记录',
      incomingValue: `预期第${incomingExpected}章回收`,
      incomingSource: context.chapterNo ? `第${context.chapterNo}章正文` : '当前章正文',
      severity: 'warning',
      resolved: false,
      createdAt: new Date().toISOString(),
    })
  }

  return conflicts
}
