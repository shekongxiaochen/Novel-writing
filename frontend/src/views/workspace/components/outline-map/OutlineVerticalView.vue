<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OutlineItem, OutlineNodeLevel, OutlineStatus, OutlineStoryline, OutlineTension } from '../../../../types'
import { levelText, canHaveChildren } from '../../../../lib/outlineHierarchy'

type TreeNode = { item: OutlineItem; depth: number; children: TreeNode[] }
type FlatRow = { item: OutlineItem; depth: number; hasChildren: boolean; collapsed: boolean }
type DropPos = 'before' | 'after' | 'child'

const props = defineProps<{
  tree: TreeNode[]
  activeId: string
  linkedCount: (id: string) => number
  chapterLabel: (id: string) => string
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
  'jump-chapter': [chapterId: string]
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
// 递归收集所有「有子级」的节点 id，用于一键全部收起
function collectCollapsibleIds(nodes: TreeNode[], acc: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.children.length > 0) {
      acc.add(node.item.id)
      collectCollapsibleIds(node.children, acc)
    }
  }
  return acc
}
function expandAll(): void {
  collapsed.value = new Set()
}
function collapseAll(): void {
  collapsed.value = collectCollapsibleIds(props.tree, new Set())
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

// 整棵树顺序 DFS 展平成单列（竖向），按 order 已在父层排好
const rows = computed<FlatRow[]>(() => {
  const out: FlatRow[] = []
  const walk = (node: TreeNode): void => {
    const hasChildren = node.children.length > 0
    const isCollapsed = collapsed.value.has(node.item.id)
    out.push({ item: node.item, depth: node.depth, hasChildren, collapsed: isCollapsed })
    if (!isCollapsed) for (const child of node.children) walk(child)
  }
  for (const root of props.tree) walk(root)
  return out
})

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

function statusText(status: OutlineStatus): string {
  if (status === 'todo') return '待写'
  if (status === 'doing') return '进行中'
  return '已完成'
}
function tensionLevel(t?: OutlineTension): number {
  return typeof t === 'number' ? Math.max(1, Math.min(5, t)) : 3
}
function levelClass(level?: OutlineNodeLevel): string {
  return `is-${level ?? 'volume'}`
}
</script>

<template>
  <div class="ov">
    <div v-if="rows.length === 0" class="ov__empty">
      <div class="ov__empty-card">
        <span class="ov__empty-badge">卷</span>
        <h3 class="ov__empty-title">还没有大纲节点</h3>
        <p class="ov__empty-hint">大纲按 卷 › 幕 › 章 › 场景 从上到下排布。手动新增顶层卷，或让 AI 帮你生成。</p>
        <div class="ov__empty-actions">
          <button type="button" class="btn-secondary" @click="emit('ai-design')">AI 设计大纲</button>
          <button type="button" class="btn-primary" @click="emit('create-root')">＋ 新增卷</button>
        </div>
      </div>
    </div>
    <div v-else class="ov__scroll">
      <div class="ov__toolbar">
        <button type="button" class="ov__tool-btn" @click="expandAll">全部展开</button>
        <button type="button" class="ov__tool-btn" @click="collapseAll">全部收起</button>
      </div>
      <article
        v-for="row in rows"
        :key="row.item.id"
        class="ov__row"
        :class="[
          levelClass(row.item.level),
          {
            'is-active': row.item.id === activeId,
            'is-dragging': row.item.id === draggedId,
            'is-dimmed': dimmedIds?.has(row.item.id),
            'is-drop-before': dropTarget?.id === row.item.id && dropTarget?.pos === 'before',
            'is-drop-after': dropTarget?.id === row.item.id && dropTarget?.pos === 'after',
            'is-drop-child': dropTarget?.id === row.item.id && dropTarget?.pos === 'child',
          },
        ]"
        :style="{ paddingLeft: `${Math.min(row.depth, 3) * 22 + 12}px`, '--accent': accentColor(row.item) || 'var(--color-border-strong)' }"
        draggable="true"
        @click="emit('select', row.item.id)"
        @dragstart="onDragStart(row.item.id, $event)"
        @dragover="onDragOver(row.item.id, $event)"
        @drop="onDrop(row.item.id)"
        @dragend="onDragEnd"
      >
        <span
          v-for="d in row.depth"
          :key="`g${d}`"
          class="ov__guide"
          :style="{ left: `${(d - 1) * 22 + 19}px` }"
          aria-hidden="true"
        />
        <div class="ov__main">
          <button
            v-if="row.hasChildren"
            type="button"
            class="ov__caret"
            :class="{ 'is-collapsed': row.collapsed }"
            @click.stop="toggleCollapse(row.item.id)"
            :aria-label="row.collapsed ? '展开' : '折叠'"
          >▾</button>
          <span v-else class="ov__caret ov__caret--placeholder" aria-hidden="true" />
          <span class="ov__level" :class="levelClass(row.item.level)">{{ levelText(row.item.level) }}</span>
          <span class="ov__name">{{ row.item.title || '未命名节点' }}</span>
          <span
            v-if="row.item.level === 'chapter' && chapterLabel(row.item.id)"
            class="ov__chapter-badge"
            title="点击跳到正文"
            role="button"
            tabindex="0"
            @click.stop="emit('jump-chapter', row.item.id)"
            @keydown.enter.stop="emit('jump-chapter', row.item.id)"
          >{{ chapterLabel(row.item.id) }}</span>
          <span
            class="ov__status"
            :class="`is-${row.item.status}`"
            role="button"
            tabindex="0"
            @click.stop="emit('cycle-status', row.item.id)"
            @keydown.enter.stop="emit('cycle-status', row.item.id)"
          >{{ statusText(row.item.status) }}</span>
        </div>
        <p v-if="row.item.summary" class="ov__summary">{{ row.item.summary }}</p>
        <p v-if="row.item.proseSummary" class="ov__prose" title="写入正文后的实际内容">✎ {{ row.item.proseSummary }}</p>
        <div class="ov__meta">
          <span class="ov__tension" :title="`张力 ${tensionLevel(row.item.tension)}/5`">
            <i v-for="n in 5" :key="n" :class="{ 'is-on': n <= tensionLevel(row.item.tension) }" />
          </span>
          <span
            v-for="sl in boundStorylines(row.item)"
            :key="sl.id"
            class="ov__sl-dot"
            :style="{ background: sl.color }"
            :title="sl.name"
          />
          <span v-if="linkedCount(row.item.id) > 0" class="ov__linked">绑 {{ linkedCount(row.item.id) }} 章</span>
          <span class="ov__spacer" />
          <button
            v-if="storylines.length > 0"
            type="button"
            class="ov__mini"
            :class="{ 'is-on': storylinePickerId === row.item.id }"
            title="绑定故事线"
            @click.stop="toggleStorylinePicker(row.item.id)"
          >线</button>
          <button
            v-if="canHaveChildren(row.item.level)"
            type="button"
            class="ov__mini"
            title="新增子节点"
            @click.stop="emit('create-child', row.item.id)"
          >＋子</button>
          <button type="button" class="ov__mini" title="新增同级节点" @click.stop="emit('create-sibling', row.item.id)">＋同级</button>
        </div>
        <div v-if="storylinePickerId === row.item.id" class="ov__sl-picker" @click.stop>
          <button
            v-for="sl in storylines"
            :key="sl.id"
            type="button"
            class="ov__sl-chip"
            :class="{ 'is-bound': isStorylineBound(row.item, sl.id) }"
            :style="{ '--sl-color': sl.color }"
            @click.stop="emit('toggle-storyline', { outlineId: row.item.id, storylineId: sl.id })"
          >{{ sl.name }}</button>
        </div>
      </article>

      <button type="button" class="ov__add-root" @click="emit('create-root')">＋ 新增卷</button>
    </div>
  </div>
</template>

<style scoped>
.ov {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.ov__empty {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  padding: 16px;
}
.ov__empty-card {
  width: 340px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  background: color-mix(in srgb, var(--color-surface) 88%, var(--color-surface-muted) 12%);
  border: 1px dashed color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  border-radius: 16px;
  padding: 18px 16px;
}
.ov__empty-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary-soft) 80%, transparent);
  color: var(--color-primary);
}
.ov__empty-title {
  margin: 0;
  font-size: 1.02rem;
}
.ov__empty-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}
.ov__empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.ov__scroll {
  display: flex;
  flex-direction: column;
  gap: 6px;
  height: 100%;
  overflow-y: auto;
  padding: 4px 6px 16px;
}
.ov__toolbar {
  display: flex;
  gap: 6px;
  padding: 2px 0 4px;
}
.ov__tool-btn {
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.ov__tool-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.ov__guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px dashed color-mix(in srgb, var(--color-border-strong) 45%, transparent);
  pointer-events: none;
}
.ov__row {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  border-left: 3px solid var(--level-color, var(--accent));
  border-radius: 10px;
  padding: 9px 12px;
  background: var(--color-surface);
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}
/* 四级色系：卷=紫 幕=蓝 章=橙 场景=灰，卡片底色与左边框按层级区分 */
.ov__row.is-volume {
  --level-color: #7c3aed;
  background: color-mix(in srgb, #7c3aed 12%, var(--color-surface));
  border-color: color-mix(in srgb, #7c3aed 32%, var(--color-border));
}
.ov__row.is-act {
  --level-color: #2563eb;
  background: color-mix(in srgb, #2563eb 9%, var(--color-surface));
  border-color: color-mix(in srgb, #2563eb 24%, var(--color-border));
}
.ov__row.is-chapter {
  --level-color: #ea580c;
  background: color-mix(in srgb, #ea580c 8%, var(--color-surface));
  border-color: color-mix(in srgb, #ea580c 22%, var(--color-border));
}
.ov__row.is-scene {
  --level-color: #64748b;
  background: color-mix(in srgb, #64748b 7%, var(--color-surface));
  border-color: color-mix(in srgb, #64748b 20%, var(--color-border));
}
.ov__row.is-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 28%, transparent);
}
.ov__row.is-dragging {
  opacity: 0.5;
}
.ov__row.is-dimmed {
  opacity: 0.34;
}
.ov__row.is-drop-before {
  box-shadow: 0 -3px 0 var(--color-primary);
}
.ov__row.is-drop-after {
  box-shadow: 0 3px 0 var(--color-primary);
}
.ov__row.is-drop-child {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}
.ov__main {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.ov__caret {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
  transition: transform 0.15s;
}
.ov__caret.is-collapsed {
  transform: rotate(-90deg);
}
.ov__caret--placeholder {
  cursor: default;
}
.ov__level {
  flex-shrink: 0;
  font-size: 0.66rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}
.ov__level.is-volume {
  background: #7c3aed;
  color: #fff;
}
.ov__level.is-act {
  background: #2563eb;
  color: #fff;
}
.ov__level.is-chapter {
  background: #ea580c;
  color: #fff;
}
.ov__level.is-scene {
  background: #64748b;
  color: #fff;
}
.ov__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.ov__chapter-badge {
  flex-shrink: 0;
  font-size: 0.66rem;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, #059669 16%, var(--color-surface));
  color: #059669;
  cursor: pointer;
  border: 1px solid color-mix(in srgb, #059669 30%, transparent);
}
.ov__chapter-badge:hover {
  background: color-mix(in srgb, #059669 26%, var(--color-surface));
}
.ov__status {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 0.66rem;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
  cursor: pointer;
}
.ov__status.is-todo {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}
.ov__status.is-doing {
  background: color-mix(in srgb, #d97706 18%, var(--color-surface));
  color: #b45309;
}
.ov__status.is-done {
  background: color-mix(in srgb, #059669 18%, var(--color-surface));
  color: #047857;
}
.ov__summary {
  margin: 5px 0 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}
.ov__prose {
  margin: 4px 0 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: color-mix(in srgb, #047857 80%, var(--color-text));
  background: color-mix(in srgb, #059669 8%, transparent);
  border-radius: 6px;
  padding: 4px 8px;
}
.ov__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
}
.ov__tension {
  display: inline-flex;
  gap: 2px;
}
.ov__tension i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-border-strong);
}
.ov__tension i.is-on {
  background: var(--color-primary);
}
.ov__sl-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
.ov__linked {
  font-size: 0.66rem;
  color: var(--color-text-muted);
}
.ov__spacer {
  flex: 1;
}
.ov__mini {
  font-size: 0.66rem;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}
.ov__mini:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.ov__mini.is-on {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.ov__sl-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed color-mix(in srgb, var(--color-border) 60%, transparent);
}
.ov__sl-chip {
  font-size: 0.68rem;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--sl-color, var(--color-border));
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
}
.ov__sl-chip.is-bound {
  background: var(--sl-color);
  color: #fff;
}
.ov__add-root {
  align-self: flex-start;
  margin-top: 4px;
  font-size: 0.78rem;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px dashed color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
}
</style>
