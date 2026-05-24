import type { OutlineItem } from '../types'

type CharacterRef = { id: string; name: string; goal?: string; arc?: string }

const LEVEL_RANK: Record<string, number> = {
  volume: 0,
  act: 1,
  chapter: 2,
  scene: 3,
}

function s(value: unknown): string {
  return String(value ?? '').trim()
}

function levelRank(level: unknown): number {
  return LEVEL_RANK[s(level)] ?? 2
}

function buildById(items: OutlineItem[]): Map<string, OutlineItem> {
  return new Map(items.map((row) => [s(row.id), row]))
}

function buildChildrenMap(items: OutlineItem[]): Map<string | null, OutlineItem[]> {
  const map = new Map<string | null, OutlineItem[]>()
  for (const item of items) {
    const parentId = s(item.parentId) || null
    if (!map.has(parentId)) map.set(parentId, [])
    map.get(parentId)!.push(item)
  }
  for (const [, children] of map) {
    children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  return map
}

function dfsSequence(childrenMap: Map<string | null, OutlineItem[]>, parentId: string | null = null): OutlineItem[] {
  const result: OutlineItem[] = []
  const walk = (pid: string | null) => {
    for (const child of childrenMap.get(pid) ?? []) {
      result.push(child)
      walk(s(child.id))
    }
  }
  walk(parentId)
  return result
}

function collectAncestors(id: string, byId: Map<string, OutlineItem>): OutlineItem[] {
  const chain: OutlineItem[] = []
  let current = byId.get(id)
  while (current) {
    const parentId = s(current.parentId)
    if (!parentId) break
    const parent = byId.get(parentId)
    if (!parent) break
    chain.unshift(parent)
    current = parent
  }
  return chain
}

function collectDescendants(rootId: string, childrenMap: Map<string | null, OutlineItem[]>): OutlineItem[] {
  const result: OutlineItem[] = []
  const walk = (id: string) => {
    for (const child of childrenMap.get(id) ?? []) {
      result.push(child)
      walk(s(child.id))
    }
  }
  walk(rootId)
  return result
}

function characterNameById(id: string, characters: CharacterRef[]): string {
  return characters.find((row) => s(row.id) === s(id))?.name ?? ''
}

function formatBeat(
  item: OutlineItem,
  characters: CharacterRef[],
  tag?: string,
): string {
  const names = (item.characterIds ?? [])
    .map((id) => characterNameById(s(id), characters))
    .filter(Boolean)
  const pov = item.povCharacterId ? characterNameById(s(item.povCharacterId), characters) : ''
  const prefix = tag ? `【${tag}】` : ''
  const levelLabel = s(item.level) || 'scene'
  return [
    `${prefix}【${levelLabel}】${s(item.title)}`,
    s(item.summary) && `摘要：${s(item.summary)}`,
    s(item.goal) && `目标：${s(item.goal)}`,
    s(item.conflict) && `冲突：${s(item.conflict)}`,
    s(item.twist) && `转折：${s(item.twist)}`,
    s(item.result) && `结果：${s(item.result)}`,
    s(item.suspense) && `悬念/钩子：${s(item.suspense)}`,
    s(item.location) && `地点：${s(item.location)}`,
    s(item.timeLabel) && `时间：${s(item.timeLabel)}`,
    typeof item.tension === 'number' && `张力：${item.tension}/5`,
    names.length > 0 && `出场：${names.join('、')}`,
    pov && `视角人物：${pov}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function collectCharacterIdsFromNodes(nodes: OutlineItem[]): string[] {
  const ids = new Set<string>()
  for (const node of nodes) {
    for (const id of node.characterIds ?? []) {
      const trimmed = s(id)
      if (trimmed) ids.add(trimmed)
    }
    const pov = s(node.povCharacterId)
    if (pov) ids.add(pov)
  }
  return [...ids]
}

export function buildOutlineBeatPathForChapter(
  outline: OutlineItem[],
  chapterOutlineIds: string[],
  characters: CharacterRef[],
): { text: string; warnings: string[]; outlineCharacterIds: string[] } {
  const warnings: string[] = []
  const linkedIds = chapterOutlineIds.map((id) => s(id)).filter(Boolean)
  if (linkedIds.length === 0) {
    return {
      text: '',
      warnings: ['本章未绑定大纲节点，续写缺少节拍约束；请在大纲或章节关联里绑定当前要写的情节点。'],
      outlineCharacterIds: [],
    }
  }

  const byId = buildById(outline ?? [])
  const linkedNodes = linkedIds.map((id) => byId.get(id)).filter((row): row is OutlineItem => Boolean(row))
  if (linkedNodes.length === 0) {
    return {
      text: '',
      warnings: ['本章绑定的大纲节点已不存在或无效，请重新关联。'],
      outlineCharacterIds: [],
    }
  }

  const childrenMap = buildChildrenMap(outline ?? [])
  const sequence = dfsSequence(childrenMap)
  const primary = [...linkedNodes].sort((a, b) => levelRank(b.level) - levelRank(a.level))[0]
  const ancestors = collectAncestors(s(primary.id), byId)

  const sections: string[] = []
  if (ancestors.length > 0) {
    sections.push(
      ['【大纲路径】', ...ancestors.map((row) => formatBeat(row, characters))].join('\n\n'),
    )
  }

  const writingTasks = linkedNodes
    .sort((a, b) => levelRank(b.level) - levelRank(a.level))
    .map((row) => formatBeat(row, characters, '本章写作任务 — 必须在本段推进'))
  sections.push(['【写作任务】', ...writingTasks].join('\n\n'))

  const parentId = s(primary.parentId) || null
  const siblings = (childrenMap.get(parentId) ?? []).filter((row) => s(row.level) === 'scene')
  if (siblings.length > 1) {
    sections.push(
      ['【同章细纲（scene 级）】', ...siblings.map((row) => formatBeat(row, characters))].join('\n\n'),
    )
  }

  const descendantScenes = collectDescendants(s(primary.id), childrenMap).filter((row) => s(row.level) === 'scene')
  if (descendantScenes.length > 0 && levelRank(primary.level) < levelRank('scene')) {
    sections.push(
      ['【下属细纲】', ...descendantScenes.map((row) => formatBeat(row, characters))].join('\n\n'),
    )
  }

  const primaryIndex = sequence.findIndex((row) => s(row.id) === s(primary.id))
  if (primaryIndex >= 0) {
    const upcoming = sequence
      .slice(primaryIndex + 1)
      .filter((row) => s(row.level) === 'scene' || s(row.level) === 'chapter')
      .slice(0, 2)
    if (upcoming.length > 0) {
      sections.push(
        [
          '【后续节拍预告 — 可铺垫但不要提前写完】',
          ...upcoming.map((row) => formatBeat(row, characters)),
        ].join('\n\n'),
      )
    }
  }

  const relatedNodes = [...ancestors, ...linkedNodes, ...siblings, ...descendantScenes]
  const outlineCharacterIds = collectCharacterIdsFromNodes(relatedNodes)
  const castLines = outlineCharacterIds
    .map((id) => {
      const row = characters.find((item) => s(item.id) === s(id))
      if (!row) return ''
      const bits = [s(row.goal) && `目标：${s(row.goal)}`, s(row.arc) && `弧光：${s(row.arc)}`].filter(Boolean)
      return bits.length > 0 ? `${row.name}（${bits.join('；')}）` : row.name
    })
    .filter(Boolean)
  if (castLines.length > 0) {
    sections.push(['【本节拍相关角色】', castLines.join('\n')].join('\n'))
  }

  if (linkedNodes.every((row) => s(row.level) !== 'scene')) {
    warnings.push('本章绑定的大纲节点较粗（卷/幕/章级），建议细化到 scene 并绑定具体场景节点，续写会更准。')
  }

  return {
    text: sections.filter(Boolean).join('\n\n'),
    warnings,
    outlineCharacterIds,
  }
}
