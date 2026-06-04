<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OutlineItem, OutlineNodeLevel, OutlineStatus, OutlineStoryline, OutlineTension } from '../../../../types'

type TreeNode = { item: OutlineItem; depth: number; children: TreeNode[] }
type FlatRow = { item: OutlineItem; depth: number; hasChildren: boolean; collapsed: boolean }
type DropPos = 'before' | 'after' | 'child'

const props = defineProps<{
  tree: TreeNode[]
  activeId: string
  linkedCount: (id: string) => number
  storylines: OutlineStoryline[]
  dimmedIds?: Set<string>
}>()

const emit = defineEmits<{
  select: [id: string]
  'create-child': [id: string]
  'create-sibling': [id: string]
  'create-root': []
  'cycle-status': [id: string]
  'toggle-storyline': [payload: { outlineId: string; storylineId: string }]
  reorder: [payload: { draggedId: string; targetId: string; position: DropPos }]
  'ai-design': []
}>()

const storylinePickerId = ref('')
function toggleStorylinePicker(id: string): void {
  storylinePickerId.value = storylinePickerId.value === id ? '' : id
}
function isStorylineBound(item: OutlineItem, storylineId: string): boolean {
  return (item.storylineIds ?? []).includes(storylineId)
}
function boundStorylines(item: OutlineItem): OutlineStoryline[] {
  const ids = item.storylineIds ?? []
  return props.storylines.filter((sl) => ids.includes(sl.id))
}

const collapsed = ref<Set<string>>(new Set())
function toggleCollapse(id: string): void {
  const next = new Set(collapsed.value)
  next.has(id) ? next.delete(id) : next.add(id)
  collapsed.value = next
}

const storylineColorById = computed(() => {
  const map = new Map<string, string>()
  for (const sl of props.storylines) map.set(sl.id, sl.color)
  return map
})
function accentColor(item: OutlineItem): string {
  const first = (item.storylineIds ?? [])[0]
  return (first && storylineColorById.value.get(first)) || ''
}

const columns = computed(() => {
  if (props.tree.length === 0) return []
  const flatten = (node: TreeNode, acc: FlatRow[]): FlatRow[] => {
    const hasChildren = node.children.length > 0
    const isCollapsed = collapsed.value.has(node.item.id)
    acc.push({ item: node.item, depth: node.depth, hasChildren, collapsed: isCollapsed })
    if (!isCollapsed) for (const child of node.children) flatten(child, acc)
    return acc
  }
  return props.tree.map((root) => {
    const rows = flatten(root, [])
    const all = collectAll(root)
    const done = all.filter((i) => i.status === 'done').length
    return { root: root.item, rows, total: all.length, done }
  })
})
function collectAll(node: TreeNode): OutlineItem[] {
  const out: OutlineItem[] = [node.item]
  for (const c of node.children) out.push(...collectAll(c))
  return out
}

const draggedId = ref('')
const dropTarget = ref<{ id: string; pos: DropPos } | null>(null)
function onDragStart(id: string, ev: DragEvent): void {
  draggedId.value = id
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
}
function onDragOver(id: string, ev: DragEvent): void {
  if (!draggedId.value || draggedId.value === id) return
  ev.preventDefault()
  const el = ev.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const ratio = (ev.clientY - rect.top) / rect.height
  const pos: DropPos = ratio < 0.28 ? 'before' : ratio > 0.72 ? 'after' : 'child'
  dropTarget.value = { id, pos }
}
function onDrop(id: string): void {
  if (draggedId.value && dropTarget.value && draggedId.value !== id) {
    emit('reorder', { draggedId: draggedId.value, targetId: id, position: dropTarget.value.pos })
  }
  draggedId.value = ''
  dropTarget.value = null
}
function onDragEnd(): void {
  draggedId.value = ''
  dropTarget.value = null
}

function levelText(level?: OutlineNodeLevel): string {
  if (level === 'volume') return '卷'
  if (level === 'act') return '幕'
  if (level === 'chapter') return '章'
  return '场景'
}
function statusText(status: OutlineStatus): string {
  if (status === 'todo') return '待写'
  if (status === 'doing') return '进行中'
  return '已完成'
}
function tensionLevel(t?: OutlineTension): number {
  return typeof t === 'number' ? Math.max(1, Math.min(5, t)) : 3
}
</script>

<template>
  <div class="ob">
    <div v-if="columns.length === 0" class="ob__empty">
      <div class="ob__empty-card">
        <span class="ob__empty-badge">卷</span>
        <h3 class="ob__empty-title">还没有情节点</h3>
        <p class="ob__empty-hint">从第一个顶层节点开始搭你的故事骨架，或让 AI 帮你生成一份大纲。</p>
        <div class="ob__empty-actions">
          <button type="button" class="btn-secondary" @click="emit('ai-design')">AI 设计大纲</button>
          <button type="button" class="btn-primary" @click="emit('create-root')">＋ 新增顶层节点</button>
        </div>
      </div>
    </div>
    <div v-else class="ob__scroll">
      <section v-for="col in columns" :key="col.root.id" class="ob__col">
        <header class="ob__col-head">
          <div class="ob__col-head-main">
            <span class="ob__col-badge">{{ levelText(col.root.level) }}</span>
            <h3 class="ob__col-title" :title="col.root.title">{{ col.root.title || '未命名' }}</h3>
          </div>
          <div class="ob__col-progress" :title="`${col.done}/${col.total} 已完成`">
            <span class="ob__col-progress-bar"><i :style="{ width: col.total ? `${(col.done / col.total) * 100}%` : '0%' }" /></span>
            <span class="ob__col-progress-num">{{ col.done }}/{{ col.total }}</span>
          </div>
        </header>

        <div class="ob__cards">
          <article
            v-for="row in col.rows"
            :key="row.item.id"
            class="ob__card"
            :class="{
              'is-active': row.item.id === activeId,
              'is-dragging': row.item.id === draggedId,
              'is-dimmed': dimmedIds?.has(row.item.id),
              'is-drop-before': dropTarget?.id === row.item.id && dropTarget?.pos === 'before',
              'is-drop-after': dropTarget?.id === row.item.id && dropTarget?.pos === 'after',
              'is-drop-child': dropTarget?.id === row.item.id && dropTarget?.pos === 'child',
            }"
            :style="{ marginLeft: `${Math.min(row.depth, 4) * 18}px`, '--accent': accentColor(row.item) || 'var(--color-border-strong)' }"
            draggable="true"
            @click="emit('select', row.item.id)"
            @dragstart="onDragStart(row.item.id, $event)"
            @dragover="onDragOver(row.item.id, $event)"
            @drop="onDrop(row.item.id)"
            @dragend="onDragEnd"
          >
            <span v-if="row.depth > 0" class="ob__card-rail" aria-hidden="true" />
            <div class="ob__card-row">
              <button
                v-if="row.hasChildren"
                type="button"
                class="ob__caret"
                :class="{ 'is-collapsed': row.collapsed }"
                @click.stop="toggleCollapse(row.item.id)"
                :aria-label="row.collapsed ? '展开' : '折叠'"
              >▾</button>
              <span v-else class="ob__caret ob__caret--placeholder" aria-hidden="true" />
              <span class="ob__level">{{ levelText(row.item.level) }}</span>
              <span class="ob__name">{{ row.item.title || '未命名节点' }}</span>
              <span
                class="ob__status"
                :class="`is-${row.item.status}`"
                role="button"
                tabindex="0"
                @click.stop="emit('cycle-status', row.item.id)"
                @keydown.enter.stop="emit('cycle-status', row.item.id)"
              >{{ statusText(row.item.status) }}</span>
            </div>
            <p v-if="row.item.summary" class="ob__summary">{{ row.item.summary }}</p>
            <div class="ob__meta">
              <span class="ob__tension" :title="`张力 ${tensionLevel(row.item.tension)}/5`">
                <i v-for="n in 5" :key="n" :class="{ 'is-on': n <= tensionLevel(row.item.tension) }" />
              </span>
              <span
                v-for="sl in boundStorylines(row.item)"
                :key="sl.id"
                class="ob__sl-dot"
                :style="{ background: sl.color }"
                :title="sl.name"
              />
              <span v-if="linkedCount(row.item.id) > 0" class="ob__linked">绑 {{ linkedCount(row.item.id) }} 章</span>
              <span class="ob__spacer" />
              <button
                v-if="storylines.length > 0"
                type="button"
                class="ob__mini"
                :class="{ 'is-on': storylinePickerId === row.item.id }"
                title="绑定故事线"
                @click.stop="toggleStorylinePicker(row.item.id)"
              >线</button>
              <button type="button" class="ob__mini" title="新增子节点" @click.stop="emit('create-child', row.item.id)">＋子</button>
              <button type="button" class="ob__mini" title="新增同级节点" @click.stop="emit('create-sibling', row.item.id)">＋同级</button>
            </div>
            <div v-if="storylinePickerId === row.item.id" class="ob__sl-picker" @click.stop>
              <button
                v-for="sl in storylines"
                :key="sl.id"
                type="button"
                class="ob__sl-chip"
                :class="{ 'is-bound': isStorylineBound(row.item, sl.id) }"
                :style="{ '--sl-color': sl.color }"
                @click.stop="emit('toggle-storyline', { outlineId: row.item.id, storylineId: sl.id })"
              >{{ sl.name }}</button>
            </div>
          </article>
        </div>
      </section>

      <button type="button" class="ob__add-col" @click="emit('create-root')">＋ 新增顶层节点</button>
    </div>
  </div>
</template>

<style scoped>
.ob {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.ob__empty {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  padding: 16px;
}
.ob__empty-card {
  flex: 0 0 300px;
  width: 300px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  background: color-mix(in srgb, var(--color-surface) 88%, var(--color-surface-muted) 12%);
  border: 1px dashed color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  border-radius: 16px;
  padding: 18px 16px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 30%, transparent);
}
.ob__empty-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary-soft) 80%, transparent);
  color: var(--color-primary);
}
.ob__empty-title {
  margin: 0;
  font-size: 1.02rem;
}
.ob__empty-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}
.ob__empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.ob__scroll {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 2px 14px;
}
.ob__col {
  flex: 0 0 300px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  background: color-mix(in srgb, var(--color-surface) 88%, var(--color-surface-muted) 12%);
  border: 1px solid color-mix(in srgb, var(--color-border) 76%, transparent);
  border-radius: 16px;
  padding: 12px 10px 10px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 30%, transparent);
}
.ob__col-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 4px 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
}
.ob__col-head-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.ob__col-badge {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
}
.ob__col-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ob__col-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ob__col-progress-bar {
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border) 60%, transparent);
  overflow: hidden;
}
.ob__col-progress-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--color-success, #16a34a);
  transition: width 0.25s ease;
}
.ob__col-progress-num {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
.ob__cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  padding: 2px;
}
.ob__card {
  position: relative;
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
  border-left: 3px solid var(--accent);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;
}
.ob__card:hover {
  border-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-text) 8%, transparent);
}
.ob__card.is-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1.5px var(--color-primary) inset;
}
.ob__card.is-dragging {
  opacity: 0.45;
}
.ob__card.is-dimmed {
  opacity: 0.32;
  filter: saturate(0.5);
}
.ob__card.is-drop-before {
  box-shadow: 0 -3px 0 -1px var(--color-primary);
}
.ob__card.is-drop-after {
  box-shadow: 0 3px 0 -1px var(--color-primary);
}
.ob__card.is-drop-child {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.ob__card-rail {
  position: absolute;
  left: -1px;
  top: -3px;
  bottom: 50%;
  width: 10px;
  border-left: 1.5px solid color-mix(in srgb, var(--color-border-strong) 50%, transparent);
  border-bottom: 1.5px solid color-mix(in srgb, var(--color-border-strong) 50%, transparent);
  border-bottom-left-radius: 8px;
  pointer-events: none;
}
.ob__card-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ob__caret {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.7rem;
  cursor: pointer;
  border-radius: 4px;
  transition: transform 0.15s ease, background 0.15s ease;
}
.ob__caret:hover {
  background: color-mix(in srgb, var(--color-border) 50%, transparent);
}
.ob__caret.is-collapsed {
  transform: rotate(-90deg);
}
.ob__caret--placeholder {
  cursor: default;
}
.ob__level {
  flex-shrink: 0;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-border) 40%, transparent);
  padding: 1px 6px;
  border-radius: 5px;
}
.ob__name {
  flex: 1;
  min-width: 0;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ob__status {
  flex-shrink: 0;
  font-size: 0.66rem;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 999px;
  cursor: pointer;
}
.ob__status.is-todo { background: color-mix(in srgb, var(--color-text-muted) 16%, transparent); color: var(--color-text-muted); }
.ob__status.is-doing { background: color-mix(in srgb, var(--color-info, #3b82f6) 18%, transparent); color: var(--color-info, #2563eb); }
.ob__status.is-done { background: color-mix(in srgb, var(--color-success, #16a34a) 18%, transparent); color: var(--color-success, #15803d); }
.ob__summary {
  margin: 6px 0 0;
  padding-left: 22px;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ob__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-left: 22px;
}
.ob__tension {
  display: inline-flex;
  gap: 2px;
}
.ob__tension i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-border-strong) 50%, transparent);
}
.ob__tension i.is-on {
  background: var(--color-warning, #f97316);
}
.ob__linked {
  font-size: 0.66rem;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-border) 36%, transparent);
  padding: 1px 6px;
  border-radius: 5px;
}
.ob__spacer {
  flex: 1;
}
.ob__mini {
  font-size: 0.66rem;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.ob__card:hover .ob__mini {
  opacity: 1;
}
.ob__mini:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.ob__mini.is-on {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-soft);
}
.ob__sl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px color-mix(in srgb, #000 12%, transparent) inset;
}
.ob__sl-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed color-mix(in srgb, var(--color-border) 70%, transparent);
}
.ob__sl-chip {
  font-size: 0.66rem;
  padding: 2px 8px;
  border-radius: 999px;
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--sl-color, #64748b) 55%, transparent);
  background: color-mix(in srgb, var(--sl-color, #64748b) 10%, transparent);
  color: var(--color-text);
  transition: background 0.14s ease;
}
.ob__sl-chip.is-bound {
  background: color-mix(in srgb, var(--sl-color, #64748b) 32%, transparent);
  font-weight: 700;
}
.ob__add-col {
  flex: 0 0 180px;
  align-self: stretch;
  min-height: 72px;
  border: 1.5px dashed color-mix(in srgb, var(--color-primary) 30%, var(--color-border-strong));
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-primary-soft) 18%, transparent);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.ob__add-col:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 40%, transparent);
}
@media (max-width: 720px) {
  .ob__mini { opacity: 1; }
}
</style>







