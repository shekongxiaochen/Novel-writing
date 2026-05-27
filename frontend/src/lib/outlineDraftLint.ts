export type OutlineDraftLintIssue = {
  severity: 'info' | 'warn'
  message: string
}

export type OutlineDraftLintItem = {
  level?: string
  goal?: string
  conflict?: string
  twist?: string
  suspense?: string
  tension?: number
}

function s(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizePhrase(value: string): string {
  return s(value).replace(/\s+/g, '').toLowerCase()
}

function countByPhrase(rows: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = normalizePhrase(row)
    if (!key || key.length < 6) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export function lintOutlineDraftItems(items: OutlineDraftLintItem[]): OutlineDraftLintIssue[] {
  const issues: OutlineDraftLintIssue[] = []
  if (!items.length) return issues

  const scenes = items.filter((row) => s(row.level) === 'scene' || !s(row.level))
  const conflicts = scenes.map((row) => s(row.conflict)).filter(Boolean)
  const duplicateConflicts = [...countByPhrase(conflicts).entries()].filter(([, count]) => count >= 3)
  if (duplicateConflicts.length > 0) {
    issues.push({
      severity: 'warn',
      message: `有 ${duplicateConflicts.length} 组场景「冲突」表述几乎相同，写入后可在右侧按需改掉套话。`,
    })
  }

  const twistCliche = scenes.filter((row) => /没想到|竟然是|原来/.test(s(row.twist))).length
  if (twistCliche >= 3) {
    issues.push({
      severity: 'warn',
      message: '多处转折用了「没想到/原来是」一类句式，建议挑几处改成更具体的反转。',
    })
  }

  const sceneTensions = scenes.map((row) => row.tension).filter((value) => typeof value === 'number')
  if (sceneTensions.length >= 5 && sceneTensions.every((value) => value === 3)) {
    issues.push({
      severity: 'info',
      message: '场景张力几乎都是「推进(3)」，若需要节奏起伏，写入后可挑高潮场改为 4–5。',
    })
  }

  const scenesMissingGoal = scenes.filter((row) => !s(row.goal)).length
  if (scenesMissingGoal >= Math.max(3, Math.ceil(scenes.length * 0.4))) {
    issues.push({
      severity: 'info',
      message: `约 ${scenesMissingGoal} 个场景未写目标，不影响写入；需要驱动 AI 续写时再补「目标」即可。`,
    })
  }

  return issues
}
