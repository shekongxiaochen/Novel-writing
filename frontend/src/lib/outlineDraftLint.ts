export type OutlineDraftLintIssue = {
  severity: 'info' | 'warn'
  message: string
}

export type OutlineDraftLintItem = {
  tempId?: string
  parentTempId?: string
  level?: string
  goal?: string
  conflict?: string
  twist?: string
  suspense?: string
  tension?: number
  storylineNames?: string[]
  characterNames?: string[]
}

/** 每幕建议的最少章节数；低于此值视为「幕太单薄」。与生成提示词里的「每幕至少 8-15 章」一致取下限。 */
const MIN_CHAPTERS_PER_ACT = 8

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

  // --- Rule 0: Under-chaptered acts（每幕章节太少）---
  // 大纲常见问题：AI 一幕只给一两章，撑不起一个故事弧。统计每个「幕」直接挂的「章」数。
  const acts = items.filter((row) => s(row.level) === 'act')
  if (acts.length > 0) {
    const chapterCountByAct = new Map<string, number>()
    for (const row of items) {
      if (s(row.level) !== 'chapter') continue
      const pid = s(row.parentTempId)
      if (!pid) continue
      chapterCountByAct.set(pid, (chapterCountByAct.get(pid) ?? 0) + 1)
    }
    const thinActs = acts.filter((act) => (chapterCountByAct.get(s(act.tempId)) ?? 0) < MIN_CHAPTERS_PER_ACT)
    if (thinActs.length > 0) {
      issues.push({
        severity: 'warn',
        message: `有 ${thinActs.length} 个幕的章节偏少（少于 ${MIN_CHAPTERS_PER_ACT} 章）。一个幕是一段大故事弧，章太少会让故事显得仓促；可让 AI 重新生成或写入后手动补章（场景可后补）。`,
      })
    }
  }

  // --- Rule 1: Duplicate conflict ---
  const conflicts = scenes.map((row) => s(row.conflict)).filter(Boolean)
  const duplicateConflicts = [...countByPhrase(conflicts).entries()].filter(([, count]) => count >= 3)
  if (duplicateConflicts.length > 0) {
    issues.push({
      severity: 'warn',
      message: `有 ${duplicateConflicts.length} 组场景「冲突」表述几乎相同，写入后可在右侧按需改掉套话。`,
    })
  }

  // --- Rule 2: Twist cliché ---
  const twistCliche = scenes.filter((row) => /没想到|竟然是|原来/.test(s(row.twist))).length
  if (twistCliche >= 3) {
    issues.push({
      severity: 'warn',
      message: '多处转折用了「没想到/原来是」一类句式，建议挑几处改成更具体的反转。',
    })
  }

  // --- Rule 3: Flat tension ---
  const sceneTensions = scenes.map((row) => row.tension).filter((value) => typeof value === 'number')
  if (sceneTensions.length >= 5 && sceneTensions.every((value) => value === 3)) {
    issues.push({
      severity: 'info',
      message: '场景张力几乎都是「推进(3)」，若需要节奏起伏，写入后可挑高潮场改为 4–5。',
    })
  }

  // --- Rule 4: Missing goal ---
  const scenesMissingGoal = scenes.filter((row) => !s(row.goal)).length
  if (scenesMissingGoal >= Math.max(3, Math.ceil(scenes.length * 0.4))) {
    issues.push({
      severity: 'info',
      message: `约 ${scenesMissingGoal} 个场景未写目标，不影响写入；需要驱动 AI 续写时再补「目标」即可。`,
    })
  }

  // --- Rule 5: Orphan nodes (parentId references nonexistent tempId) ---
  const tempIds = new Set(items.map((row) => s(row.tempId)).filter(Boolean))
  const orphans = items.filter((row) => {
    const pid = s(row.parentTempId)
    return pid && pid !== 'anchor' && !tempIds.has(pid)
  })
  if (orphans.length > 0) {
    issues.push({
      severity: 'warn',
      message: `有 ${orphans.length} 个节点的父节点引用不存在，结构可能断裂。`,
    })
  }

  // --- Rule 6: Excessive nesting depth (>4 levels) ---
  const byTempId = new Map(items.map((row) => [s(row.tempId), row]))
  function getDepth(item: OutlineDraftLintItem, visited = new Set<string>()): number {
    const pid = s(item.parentTempId)
    if (!pid || pid === 'anchor' || visited.has(pid)) return 1
    visited.add(pid)
    const parent = byTempId.get(pid)
    if (!parent) return 1
    return 1 + getDepth(parent, visited)
  }
  const deepNodes = items.filter((row) => getDepth(row) > 4)
  if (deepNodes.length > 0) {
    issues.push({
      severity: 'warn',
      message: `有 ${deepNodes.length} 个节点嵌套超过 4 层，建议合并或调整层级。`,
    })
  }

  // --- Rule 7: Storyline coverage gaps ---
  if (scenes.length >= 4) {
    const withStoryline = scenes.filter((row) => (row.storylineNames ?? []).length > 0).length
    const coverage = withStoryline / scenes.length
    if (coverage < 0.6) {
      issues.push({
        severity: 'info',
        message: `仅 ${Math.round(coverage * 100)}% 的场景关联了故事线，建议为更多场景指定故事线归属。`,
      })
    }
  }

  // --- Rule 8: Tension curve monotonicity ---
  if (sceneTensions.length >= 8) {
    let allRising = true
    let allFalling = true
    for (let i = 1; i < sceneTensions.length; i++) {
      if (sceneTensions[i] <= sceneTensions[i - 1]) allRising = false
      if (sceneTensions[i] >= sceneTensions[i - 1]) allFalling = false
    }
    if (allRising || allFalling) {
      issues.push({
        severity: 'info',
        message: allRising
          ? '张力曲线单调递增，缺少舒缓段落；建议在中段插入低张力过渡场景。'
          : '张力曲线单调递减，缺少高潮回升；建议在后段加入高张力转折。',
      })
    }
  }

  // --- Rule 9: Missing character presence ---
  if (scenes.length >= 4) {
    const hasAnyCharacter = scenes.some((row) => (row.characterNames ?? []).length > 0)
    if (!hasAnyCharacter) {
      issues.push({
        severity: 'info',
        message: '所有场景均未指定出场角色，建议标注角色以增强人设一致性。',
      })
    }
  }

  // --- Rule 10: Act structure imbalance ---
  if (sceneTensions.length >= 12) {
    const quarterLen = Math.ceil(sceneTensions.length / 4)
    const firstQuarter = sceneTensions.slice(0, quarterLen)
    const lastQuarter = sceneTensions.slice(-quarterLen)
    const hasSetup = firstQuarter.some((t) => t <= 2)
    const hasClimax = lastQuarter.some((t) => t >= 4)
    if (!hasSetup) {
      issues.push({
        severity: 'info',
        message: '前段缺少低张力铺垫场景（张力 ≤ 2），可能导致读者缺少入戏缓冲。',
      })
    }
    if (!hasClimax) {
      issues.push({
        severity: 'info',
        message: '后段缺少高张力高潮场景（张力 ≥ 4），可能导致结尾缺乏冲击力。',
      })
    }
  }

  return issues
}
