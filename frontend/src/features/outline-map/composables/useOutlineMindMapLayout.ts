import { computed, unref, type Ref } from 'vue'
import type { OutlineItem, OutlineNodeLevel, OutlinePlotStage, OutlineStatus } from '../../../types'

type MaybeRef<T> = T | Ref<T>

function buildOutlineNodeSubtitle(item: OutlineItem): string {
  const level = item.level ?? 'scene'
  if (level === 'scene') {
    return String(item.goal ?? '').trim() || String(item.result ?? '').trim() || String(item.summary ?? '').trim()
  }
  if (level === 'chapter') {
    return String(item.goal ?? '').trim() || String(item.summary ?? '').trim()
  }
  return String(item.summary ?? '').trim() || String(item.goal ?? '').trim()
}

export type OutlineMindMapNodeView = {
  id: string
  order: number
  title: string
  summary: string
  subtitle: string
  status: OutlineStatus
  plotStage?: OutlinePlotStage
  level?: OutlineNodeLevel
  storylineIds: string[]
  parentId: string | null
  linkedChapterCount: number
  isLinkedToActiveChapter: boolean
  isDimmed: boolean
  column: number
  row: number
  x: number
  y: number
  height: number
}

export type OutlineMindMapEdgeView = {
  id: string
  fromId: string
  toId: string
  path: string
}

const levelOrder: OutlineNodeLevel[] = ['volume', 'act', 'chapter', 'scene']
export const OUTLINE_MIND_MAP_NODE_WIDTH = 260
const nodeWidth = OUTLINE_MIND_MAP_NODE_WIDTH
/** 布局用最小高度；实际卡片由 estimateOutlineNodeHeight 按文案估算 */
const nodeHeightFallback = 168
const nodeHeightMin = 156
const nodeHeightMax = 300
const charsPerLine = 34
const lineHeightPx = 13
const columnGap = 250
const siblingGap = 44
const rootGap = 108
const columnOverlapGap = 24
const paddingX = 96
const paddingY = 72
const rootX = 120

/** 按标题/副标题/摘要行数估算卡片高度，避免布局间距小于真实渲染高度 */
export function estimateOutlineNodeHeight(item: Pick<OutlineItem, 'title' | 'summary' | 'goal' | 'result' | 'level'>): number {
  const subtitle = buildOutlineNodeSubtitle(item as OutlineItem)
  const summary = String(item.summary ?? '').trim()
  const hasExtraSummary = Boolean(summary && summary !== subtitle)
  const title = String(item.title ?? '').trim() || '未命名情节点'

  let textLines = Math.max(1, Math.ceil(title.length / 18))
  if (subtitle) textLines += Math.ceil(subtitle.length / charsPerLine)
  if (hasExtraSummary) textLines += Math.ceil(summary.length / charsPerLine)
  textLines += 1

  const chrome = 12 + 12 + 8 + 18 + 6 + 28 + 10
  return Math.max(nodeHeightMin, Math.min(nodeHeightMax, chrome + textLines * lineHeightPx))
}

function levelRank(level?: OutlineNodeLevel): number {
  const normalized = (level ?? 'scene') as OutlineNodeLevel
  const idx = levelOrder.indexOf(normalized)
  return idx >= 0 ? idx : levelOrder.length - 1
}

function byOrderAsc(a: OutlineItem, b: OutlineItem): number {
  if (a.order === b.order) return a.title.localeCompare(b.title, 'zh-Hans-CN')
  return a.order - b.order
}

function edgePath(fromX: number, fromY: number, toX: number, toY: number): string {
  const deltaX = Math.abs(toX - fromX)
  const direction = toX >= fromX ? 1 : -1
  const curve = Math.max(72, Math.min(180, deltaX * 0.45))
  return `M ${fromX} ${fromY} C ${fromX + curve * direction} ${fromY}, ${toX - curve * direction} ${toY}, ${toX} ${toY}`
}

export function useOutlineMindMapLayout(deps: {
  outlineItems: MaybeRef<OutlineItem[]>
  linkedChapterCountByOutlineId?: MaybeRef<Record<string, number>>
  activeChapterLinkedOutlineIdSet?: MaybeRef<Set<string>>
  dimmedOutlineIdSet?: MaybeRef<Set<string>>
}) {
  const nodes = computed<OutlineMindMapNodeView[]>(() => {
    const outlineItems = [...unref(deps.outlineItems)].sort(byOrderAsc)
    const linkedCountMap = unref(deps.linkedChapterCountByOutlineId) ?? {}
    const activeLinkedSet = unref(deps.activeChapterLinkedOutlineIdSet) ?? new Set<string>()
    const dimmedSet = unref(deps.dimmedOutlineIdSet) ?? new Set<string>()

    if (outlineItems.length === 0) return []

    const itemById = new Map(outlineItems.map((item) => [item.id, item]))
    const childrenByParentId = new Map<string, OutlineItem[]>()
    for (const item of outlineItems) {
      childrenByParentId.set(item.id, [])
    }

    const roots: OutlineItem[] = []
    for (const item of outlineItems) {
      const parentId = String(item.parentId ?? '').trim()
      const parent = parentId ? itemById.get(parentId) : null
      if (!parent) {
        roots.push(item)
        continue
      }
      const list = childrenByParentId.get(parent.id) ?? []
      list.push(item)
      childrenByParentId.set(parent.id, list)
    }

    for (const list of childrenByParentId.values()) {
      list.sort(byOrderAsc)
    }
    roots.sort(byOrderAsc)

    type SubtreePlan = {
      aboveChildren: OutlineItem[]
      belowChildren: OutlineItem[]
      aboveHeight: number
      belowHeight: number
      subtreeHeight: number
    }

    const heightById = new Map<string, number>()
    for (const item of outlineItems) {
      heightById.set(item.id, estimateOutlineNodeHeight(item))
    }

    const nodeHeightOf = (item: OutlineItem): number => heightById.get(item.id) ?? nodeHeightFallback

    const planById = new Map<string, SubtreePlan>()
    const measuring = new Set<string>()

    const measureSubtreeHeight = (item: OutlineItem): number => {
      const cached = planById.get(item.id)
      if (cached) return cached.subtreeHeight
      if (measuring.has(item.id)) return nodeHeightOf(item)
      measuring.add(item.id)

      const children = childrenByParentId.get(item.id) ?? []
      const aboveChildren = children.filter((_, index) => index % 2 === 0)
      const belowChildren = children.filter((_, index) => index % 2 === 1)

      const aboveHeight = aboveChildren.reduce((sum, child, index) => {
        return sum + measureSubtreeHeight(child) + (index === 0 ? 0 : siblingGap)
      }, 0)
      const belowHeight = belowChildren.reduce((sum, child, index) => {
        return sum + measureSubtreeHeight(child) + (index === 0 ? 0 : siblingGap)
      }, 0)

      const plan: SubtreePlan = {
        aboveChildren,
        belowChildren,
        aboveHeight,
        belowHeight,
        subtreeHeight: aboveHeight + nodeHeightOf(item) + belowHeight,
      }
      planById.set(item.id, plan)
      measuring.delete(item.id)
      return plan.subtreeHeight
    }

    roots.forEach(measureSubtreeHeight)
    outlineItems.forEach((item) => {
      if (!planById.has(item.id)) measureSubtreeHeight(item)
    })

    const positioned = new Map<string, OutlineMindMapNodeView>()
    const visited = new Set<string>()

    const placeSubtree = (item: OutlineItem, depth: number, topY: number) => {
      if (visited.has(item.id)) return
      visited.add(item.id)

      const plan = planById.get(item.id)
      if (!plan) return

      const cardHeight = nodeHeightOf(item)
      const nodeY = topY + plan.aboveHeight
      positioned.set(item.id, {
        id: item.id,
        order: item.order,
        title: item.title,
        summary: item.summary,
        subtitle: buildOutlineNodeSubtitle(item),
        status: item.status,
        plotStage: item.plotStage,
        level: item.level,
        storylineIds: item.storylineIds ?? [],
        parentId: item.parentId ?? null,
        linkedChapterCount: Number(linkedCountMap[item.id] ?? 0),
        isLinkedToActiveChapter: activeLinkedSet.has(item.id),
        isDimmed: dimmedSet.has(item.id),
        column: depth,
        row: positioned.size,
        x: rootX + depth * columnGap,
        y: nodeY,
        height: cardHeight,
      })

      let childTop = topY
      for (const child of plan.aboveChildren) {
        placeSubtree(child, depth + 1, childTop)
        childTop += measureSubtreeHeight(child) + siblingGap
      }

      childTop = nodeY + cardHeight + siblingGap
      for (const child of plan.belowChildren) {
        placeSubtree(child, depth + 1, childTop)
        childTop += measureSubtreeHeight(child) + siblingGap
      }
    }

    let rootTop = paddingY
    for (const root of roots) {
      placeSubtree(root, 0, rootTop)
      rootTop += measureSubtreeHeight(root) + rootGap
    }

    const orphanStartY = rootTop + rootGap
    outlineItems.forEach((item, index) => {
      if (visited.has(item.id)) return
      const fallbackDepth = Math.min(levelRank(item.level), 3)
      placeSubtree(item, fallbackDepth, orphanStartY + index * (nodeHeightOf(item) + rootGap))
    })

    resolveColumnOverlaps(positioned, childrenByParentId)

    const rawNodes = Array.from(positioned.values())
    const minX = rawNodes.reduce((min, node) => Math.min(min, node.x), Number.POSITIVE_INFINITY)
    const minY = rawNodes.reduce((min, node) => Math.min(min, node.y), Number.POSITIVE_INFINITY)
    const shiftX = Number.isFinite(minX) ? Math.max(0, paddingX - minX) : paddingX
    const shiftY = Number.isFinite(minY) ? Math.max(0, paddingY - minY) : paddingY

    return rawNodes
      .map((node) => ({
        ...node,
        x: node.x + shiftX,
        y: node.y + shiftY,
      }))
      .sort((a, b) => a.row - b.row || a.order - b.order)
  })

  const edges = computed<OutlineMindMapEdgeView[]>(() => {
    const nodeById = new Map(nodes.value.map((node) => [node.id, node]))
    const next: OutlineMindMapEdgeView[] = []

    for (const node of nodes.value) {
      const parentId = String(node.parentId ?? '').trim()
      if (!parentId) continue
      const parent = nodeById.get(parentId)
      if (!parent) continue

      const fromX = parent.x + nodeWidth
      const fromY = parent.y + parent.height / 2
      const toX = node.x
      const toY = node.y + node.height / 2

      next.push({
        id: `${parent.id}__${node.id}`,
        fromId: parent.id,
        toId: node.id,
        path: edgePath(fromX, fromY, toX, toY),
      })
    }

    return next
  })

  const sceneWidth = computed(() => {
    const maxRight = nodes.value.reduce((max, node) => Math.max(max, node.x + nodeWidth), paddingX)
    return Math.ceil(maxRight + paddingX)
  })

  const sceneHeight = computed(() => {
    const maxBottom = nodes.value.reduce((max, node) => Math.max(max, node.y + node.height), paddingY)
    return Math.ceil(maxBottom + paddingY)
  })

  return {
    nodes,
    edges,
    sceneWidth,
    sceneHeight,
    nodeWidth,
    nodeHeight: nodeHeightFallback,
  }
}

function shiftSubtreeY(
  rootId: string,
  deltaY: number,
  positioned: Map<string, OutlineMindMapNodeView>,
  childrenByParentId: Map<string, OutlineItem[]>,
): void {
  const stack = [rootId]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    const node = positioned.get(id)
    if (node) node.y += deltaY
    for (const child of childrenByParentId.get(id) ?? []) {
      stack.push(child.id)
    }
  }
}

/** 同列节点若估算后仍重叠，整棵子树下移 */
function resolveColumnOverlaps(
  positioned: Map<string, OutlineMindMapNodeView>,
  childrenByParentId: Map<string, OutlineItem[]>,
): void {
  const byColumn = new Map<number, OutlineMindMapNodeView[]>()
  for (const node of positioned.values()) {
    const list = byColumn.get(node.column) ?? []
    list.push(node)
    byColumn.set(node.column, list)
  }

  for (const list of byColumn.values()) {
    list.sort((a, b) => a.y - b.y || a.order - b.order)
    let cursor = Number.NEGATIVE_INFINITY
    for (const node of list) {
      const minY = cursor + columnOverlapGap
      if (node.y < minY) {
        const delta = minY - node.y
        shiftSubtreeY(node.id, delta, positioned, childrenByParentId)
        node.y = minY
      }
      cursor = node.y + node.height
    }
  }
}
