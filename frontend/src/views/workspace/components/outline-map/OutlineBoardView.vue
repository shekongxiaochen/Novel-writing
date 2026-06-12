<script setup lang="ts">
import { computed, ref } from 'vue'
import type { OutlineItem, OutlineNodeLevel, OutlineStatus, OutlineStoryline, OutlineTension } from '../../../../types'
import { levelText, childLevelOf, canHaveChildren } from '../../../../lib/outlineHierarchy'

type TreeNode = { item: OutlineItem; depth: number; children: TreeNode[] }
type DropPos = 'before' | 'after'
// 一列 = 一个能有子级的节点，列内只放它的直接子级卡片（单一类型）
type Column = {
  node: OutlineItem
  cards: OutlineItem[]
  total: number
  done: number
  ancestors: string[]
}

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

const storylineColorById = computed(() => {
  const map = new Map<string, string>()
  for (const sl of props.storylines) map.set(sl.id, sl.color)
  return map
})
function accentColor(item: OutlineItem): string {
  const first = (item.storylineIds ?? [])[0]
  return (first && storylineColorById.value.get(first)) || ''
}

// 先序 DFS 遍历整棵树：凡是「能有子级」的节点都生成一列，列内只放它的直接子级卡片。
// 列顺序 = 先序，使某父节点的子级列紧跟其后（卷 → 该卷的幕列 → 每个幕的章列 → 每个章的场景列）。
const columns = computed<Column[]>(() => {
  if (props.tree.length === 0) return []
  const out: Column[] = []
  const walk = (node: TreeNode, ancestors: string[]): void => {
    if (canHaveChildren(node.item.level)) {
      const cards = node.children.map((c) => c.item)
      const done = cards.filter((c) => c.status === 'done').length
      out.push({ node: node.item, cards, total: cards.length, done, ancestors })
    }
    const childAncestors = [...ancestors, node.item.title || '未命名']
    for (const child of node.children) walk(child, childAncestors)
  }
  for (const root of props.tree) walk(root, [])
  return out
})

function childLevelText(level?: OutlineNodeLevel): string {
  return levelText(childLevelOf(level ?? null))
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
  const pos: DropPos = ratio < 0.5 ? 'before' : 'after'
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
</script>

<template>
  <div class="ob">
    <div v-if="columns.length === 0" class="ob__empty">
      <div class="ob__empty-card">
        <span class="ob__empty-badge">卷</span>
        <h3 class="ob__empty-title">还没有情节点</h3>
        <p class="ob__empty-hint">从第一卷开始搭你的故事骨架，或让 AI 帮你生成一份大纲。卷下放幕、幕下放章、章下放场景。</p>
        <div class="ob__empty-actions">
          <button type="button" class="btn-secondary" @click="emit('ai-design')">AI 设计大纲</button>
          <button type="button" class="btn-primary" @click="emit('create-root')">＋ 新增卷</button>
        </div>
      </div>
    </div>
    <div v-else class="ob__scroll">
      <section
        v-for="col in columns"
        :key="col.node.id"
        class="ob__col"
        :class="`is-${col.node.level ?? 'volume'}`"
      >
        <header class="ob__col-head">
          <p v-if="col.ancestors.length > 0" class="ob__col-crumbs" :title="col.ancestors.join(' › ')">
            {{ col.ancestors.join(' › ') }}
          </p>
          <div class="ob__col-head-main">
            <span class="ob__col-badge" :class="`is-${col.node.level ?? 'volume'}`">{{ levelText(col.node.level) }}</span>
            <h3
              class="ob__col-title"
              :class="{ 'is-active': col.node.id === activeId }"
              :title="col.node.title"
              role="button"
              tabindex="0"
              @click="emit('select', col.node.id)"
              @keydown.enter="emit('select', col.node.id)"
            >{{ col.node.title || '未命名' }}</h3>
          </div>
          <div class="ob__col-progress" :title="`${col.done}/${col.total} ${childLevelText(col.node.level)}已完成`">
            <span class="ob__col-progress-bar"><i :style="{ width: col.total ? `${(col.done / col.total) * 100}%` : '0%' }" /></span>
            <span class="ob__col-progress-num">{{ col.done }}/{{ col.total }}</span>
          </div>
        </header>

        <div class="ob__cards">
          <article
            v-for="card in col.cards"
            :key="card.id"
            class="ob__card"
            :class="{
              'is-active': card.id === activeId,
              'is-dragging': card.id === draggedId,
              'is-dimmed': dimmedIds?.has(card.id),
              'is-drop-before': dropTarget?.id === card.id && dropTarget?.pos === 'before',
              'is-drop-after': dropTarget?.id === card.id && dropTarget?.pos === 'after',
            }"
            :style="{ '--accent': accentColor(card) || 'var(--color-border-strong)' }"
            draggable="true"
            @click="emit('select', card.id)"
            @dragstart="onDragStart(card.id, $event)"
            @dragover="onDragOver(card.id, $event)"
            @drop="onDrop(card.id)"
            @dragend="onDragEnd"
          >
            <div class="ob__card-row">
              <span class="ob__level">{{ levelText(card.level) }}</span>
              <span class="ob__name">{{ card.title || '未命名节点' }}</span>
              <span
                class="ob__status"
                :class="`is-${card.status}`"
                role="button"
                tabindex="0"
                @click.stop="emit('cycle-status', card.id)"
                @keydown.enter.stop="emit('cycle-status', card.id)"
              >{{ statusText(card.status) }}</span>
            </div>
            <p v-if="card.summary" class="ob__summary">{{ card.summary }}</p>
            <div class="ob__meta">
              <span class="ob__tension" :title="`张力 ${tensionLevel(card.tension)}/5`">
                <i v-for="n in 5" :key="n" :class="{ 'is-on': n <= tensionLevel(card.tension) }" />
              </span>
              <span
                v-for="sl in boundStorylines(card)"
                :key="sl.id"
                class="ob__sl-dot"
                :style="{ background: sl.color }"
                :title="sl.name"
              />
              <span v-if="linkedCount(card.id) > 0" class="ob__linked">绑 {{ linkedCount(card.id) }} 章</span>
              <span class="ob__spacer" />
              <button
                v-if="storylines.length > 0"
                type="button"
                class="ob__mini"
                :class="{ 'is-on': storylinePickerId === card.id }"
                title="绑定故事线"
                @click.stop="toggleStorylinePicker(card.id)"
              >线</button>
              <button type="button" class="ob__mini" title="新增同级节点" @click.stop="emit('create-sibling', card.id)">＋同级</button>
            </div>
            <div v-if="storylinePickerId === card.id" class="ob__sl-picker" @click.stop>
              <button
                v-for="sl in storylines"
                :key="sl.id"
                type="button"
                class="ob__sl-chip"
                :class="{ 'is-bound': isStorylineBound(card, sl.id) }"
                :style="{ '--sl-color': sl.color }"
                @click.stop="emit('toggle-storyline', { outlineId: card.id, storylineId: sl.id })"
              >{{ sl.name }}</button>
            </div>
          </article>

          <p v-if="col.cards.length === 0" class="ob__col-empty">还没有{{ childLevelText(col.node.level) }}</p>
        </div>

        <button type="button" class="ob__col-add" @click="emit('create-child', col.node.id)">
          ＋ 新增{{ childLevelText(col.node.level) }}
        </button>
      </section>

      <button type="button" class="ob__add-col" @click="emit('create-root')">＋ 新增卷</button>
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
  border-top: 3px solid var(--col-color, var(--color-border-strong));
  border-radius: 16px;
  padding: 12px 10px 10px;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 30%, transparent);
}
/* 列按层级配色：卷=紫 幕=蓝 章=橙（沿用竖排视图配色） */
.ob__col.is-volume { --col-color: #7c3aed; }
.ob__col.is-act { --col-color: #2563eb; }
.ob__col.is-chapter { --col-color: #ea580c; }
.ob__col.is-scene { --col-color: #64748b; }
.ob__col-crumbs {
  margin: 0 4px 6px;
  font-size: 0.68rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  background: var(--col-color, var(--color-primary));
  color: #fff;
}
.ob__col-badge.is-volume { background: #7c3aed; }
.ob__col-badge.is-act { background: #2563eb; }
.ob__col-badge.is-chapter { background: #ea580c; }
.ob__col-badge.is-scene { background: #64748b; }
.ob__col-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.ob__col-title:hover {
  color: var(--color-primary);
}
.ob__col-title.is-active {
  color: var(--color-primary);
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
.ob__card-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
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
.ob__col-empty {
  margin: 4px 2px;
  padding: 12px 8px;
  text-align: center;
  font-size: 0.74rem;
  color: var(--color-text-muted);
  border: 1px dashed color-mix(in srgb, var(--color-border) 70%, transparent);
  border-radius: 8px;
}
.ob__col-add {
  margin-top: 8px;
  padding: 7px 10px;
  width: 100%;
  border: 1px dashed color-mix(in srgb, var(--color-primary) 36%, var(--color-border));
  border-radius: 9px;
  background: transparent;
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.ob__col-add:hover {
  background: color-mix(in srgb, var(--color-primary-soft) 40%, transparent);
  border-color: var(--color-primary);
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







