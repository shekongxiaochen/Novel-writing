<template>
  <div
    class="relation-overview"
    :class="{
      'relation-overview--dragging': isDragging,
      'relation-overview--zoomed': isZoomed,
    }"
    :style="{ minHeight: `${panelHeight}px` }"
  >
    <div class="relation-overview__legend" aria-hidden="true">
      <span class="relation-overview__legend-title">关系角色数</span>
      <span v-for="item in heatLegendItems" :key="item.label" class="relation-overview__legend-item">
        <span class="relation-overview__legend-swatch" :class="`relation-overview__legend-swatch--heat-${item.level}`"></span>
        <span class="relation-overview__legend-label">{{ item.label }}</span>
      </span>
    </div>

    <svg
      class="relation-overview__svg"
      viewBox="0 0 1200 840"
      role="img"
      aria-label="角色总览图"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @pointerleave="onPointerLeave"
      @wheel.prevent="onWheel"
    >
      <defs>
        <pattern id="overview-map-grid" width="54" height="54" patternUnits="userSpaceOnUse">
          <path d="M 54 0 L 0 0 0 54" fill="none" stroke="color-mix(in srgb, var(--color-border) 34%, transparent)" stroke-width="1" />
        </pattern>
      </defs>

      <rect class="relation-overview__backdrop" x="18" y="18" width="1164" height="804" rx="34" />
      <rect class="relation-overview__grid" x="18" y="18" width="1164" height="804" rx="34" />

      <g class="relation-overview__content" :transform="contentTransform">
        <g v-for="ring in ringGuides" :key="`ring-${ring}`">
          <circle class="relation-overview__ring" cx="600" cy="420" :r="ring" />
        </g>

        <g v-if="positionedNodes.length === 0" class="relation-overview__empty" transform="translate(600 428)">
          <circle class="relation-overview__empty-orb" r="72" />
          <text class="relation-overview__empty-title" x="0" y="10">暂无角色</text>
          <text class="relation-overview__empty-sub" x="0" y="42">创建角色后，这里会自动生成地图</text>
        </g>

        <g v-for="node in positionedNodes" :key="node.id" class="relation-overview__node-group" @pointerdown.stop>
          <g :transform="`translate(${node.x} ${node.y})`">
            <circle v-if="node.isFocus" class="relation-overview__node-halo" :r="Math.max(72, node.width * 0.56)" />
            <rect
              class="relation-overview__node-card"
              :class="[`relation-overview__node-card--heat-${node.heatLevel}`, { 'relation-overview__node-card--focus': node.isFocus }]"
              :x="-node.width / 2"
              y="-36"
              :width="node.width"
              height="72"
              rx="22"
              tabindex="0"
              role="button"
              @click="emit('select', node.id)"
              @keydown.enter.prevent="emit('select', node.id)"
              @keydown.space.prevent="emit('select', node.id)"
            />

            <rect
              class="relation-overview__badge"
              :class="`relation-overview__badge--heat-${node.heatLevel}`"
              :x="node.badgeX"
              y="-34"
              :width="node.badgeWidth"
              height="28"
              rx="14"
            />
            <text
              class="relation-overview__badge-text"
              :class="`relation-overview__badge-text--heat-${node.heatLevel}`"
              :x="node.badgeX + node.badgeWidth / 2"
              y="-16"
            >
              {{ node.badgeText }}
            </text>

            <text class="relation-overview__label" x="0" :y="node.isFocus ? -4 : 6">{{ node.shortName }}</text>
            <text v-if="node.isFocus" class="relation-overview__meta" x="0" y="22">当前焦点</text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Character, CharacterRelation } from '../types'

const props = withDefaults(
  defineProps<{
    characters: Character[]
    relations: CharacterRelation[]
    focusCharacterId: string
    renderScale?: number
    panelHeight?: number
  }>(),
  { renderScale: 1, panelHeight: 560 },
)

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

type OverviewNode = {
  id: string
  name: string
  shortName: string
  relationCount: number
  heatLevel: number
  isFocus: boolean
  width: number
  badgeText: string
  badgeWidth: number
  badgeX: number
  x: number
  y: number
}

type HeatLegendItem = {
  label: string
  level: number
}

type DragState = {
  active: boolean
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

const viewWidth = 1200
const viewHeight = 840
const centerX = 600
const centerY = 420
const minZoom = 0.58
const maxZoom = 1.9
const zoomStep = 0.12

const panX = ref(0)
const panY = ref(0)
const zoom = ref(1)
const isDragging = ref(false)
const dragState = ref<DragState | null>(null)

const pinyinCollator = new Intl.Collator('zh-Hans-u-co-pinyin')
const heatLegendItems: HeatLegendItem[] = [
  { label: '0', level: 0 },
  { label: '1', level: 1 },
  { label: '2-3', level: 2 },
  { label: '4-6', level: 3 },
  { label: '7+', level: 4 },
]

const isZoomed = computed(() => Math.abs(zoom.value - 1) > 0.01)

function truncateName(name: string): string {
  const text = String(name ?? '').trim()
  if (text.length <= 7) return text
  return `${text.slice(0, 7)}…`
}

function labelWidth(name: string, focused: boolean): number {
  const len = Math.max(2, truncateName(name).length)
  const min = focused ? 182 : 154
  const max = focused ? 260 : 228
  return Math.min(max, Math.max(min, 66 + len * 23))
}

function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count)
}

function badgeWidth(count: number): number {
  const text = badgeText(count)
  return Math.max(28, 16 + text.length * 10)
}

function heatLevelForCount(count: number): number {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

function ringRadius(index: number): number {
  const radii = [0, 228, 372, 530, 688, 842, 988]
  return radii[index] ?? radii[radii.length - 1] + (index - radii.length + 1) * 120
}

function ringCapacity(index: number): number {
  const capacities = [1, 8, 12, 16, 22, 28, 36]
  return capacities[index] ?? capacities[capacities.length - 1] + (index - capacities.length + 1) * 12
}

const relationCountById = computed(() => {
  const relatedIdsByCharacterId = new Map<string, Set<string>>()
  for (const c of props.characters) relatedIdsByCharacterId.set(c.id, new Set())
  for (const r of props.relations) {
    if (!r.fromCharacterId || !r.toCharacterId || r.fromCharacterId === r.toCharacterId) continue
    if (!relatedIdsByCharacterId.has(r.fromCharacterId)) relatedIdsByCharacterId.set(r.fromCharacterId, new Set())
    if (!relatedIdsByCharacterId.has(r.toCharacterId)) relatedIdsByCharacterId.set(r.toCharacterId, new Set())
    relatedIdsByCharacterId.get(r.fromCharacterId)?.add(r.toCharacterId)
    relatedIdsByCharacterId.get(r.toCharacterId)?.add(r.fromCharacterId)
  }

  const map = new Map<string, number>()
  relatedIdsByCharacterId.forEach((relatedIds, id) => map.set(id, relatedIds.size))
  return map
})

const sortedCharacters = computed(() => {
  return [...props.characters].sort((a, b) => {
    const cmp = pinyinCollator.compare(a.name ?? '', b.name ?? '')
    if (cmp !== 0) return cmp
    return (a.name ?? '').localeCompare(b.name ?? '', 'zh-Hans')
  })
})

const positionedNodes = computed<OverviewNode[]>(() => {
  const total = sortedCharacters.value.length
  if (total === 0) return []

  const result: OverviewNode[] = []
  let cursor = 0

  for (let ringIndex = 0; cursor < total; ringIndex++) {
    const take = Math.min(ringCapacity(ringIndex), total - cursor)
    const radius = ringRadius(ringIndex)
    const angleOffset = ringIndex % 2 === 0 ? 0 : Math.PI / Math.max(1, take)

    for (let i = 0; i < take; i++) {
      const item = sortedCharacters.value[cursor + i]
      if (!item) continue
      const angle = take === 1 ? -Math.PI / 2 : -Math.PI / 2 + angleOffset + (i / take) * Math.PI * 2
      const isFocus = item.id === props.focusCharacterId
      const relationCount = relationCountById.value.get(item.id) ?? 0
      const heatLevel = heatLevelForCount(relationCount)
      const width = labelWidth(item.name, isFocus)
      const currentBadgeWidth = badgeWidth(relationCount)
      result.push({
        id: item.id,
        name: item.name,
        shortName: truncateName(item.name),
        relationCount,
        heatLevel,
        isFocus,
        width,
        badgeText: badgeText(relationCount),
        badgeWidth: currentBadgeWidth,
        badgeX: width / 2 - currentBadgeWidth - 10,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    }

    cursor += take
  }

  return result
})

const ringGuides = computed(() => {
  const radii = new Set<number>()
  for (const node of positionedNodes.value) {
    const dx = node.x - centerX
    const dy = node.y - centerY
    const r = Math.round(Math.sqrt(dx * dx + dy * dy))
    if (r > 0) radii.add(r)
  }
  return Array.from(radii).sort((a, b) => a - b)
})

const contentTransform = computed(() => `translate(${panX.value} ${panY.value}) scale(${zoom.value})`)

function svgUnitsPerClientPixel(target: EventTarget | null): { x: number; y: number } {
  if (!(target instanceof SVGSVGElement)) {
    return { x: 1, y: 1 }
  }
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 1, y: 1 }
  }
  return {
    x: viewWidth / rect.width,
    y: viewHeight / rect.height,
  }
}

function clampZoom(value: number): number {
  return Math.min(maxZoom, Math.max(minZoom, value))
}

function panBoundsForZoom(scale: number): { x: number; y: number } {
  const overflowX = Math.max(0, (viewWidth * scale - viewWidth) / 2)
  const overflowY = Math.max(0, (viewHeight * scale - viewHeight) / 2)
  return {
    x: overflowX + 280,
    y: overflowY + 220,
  }
}

function clampPanToCurrentZoom(): void {
  const bounds = panBoundsForZoom(zoom.value)
  panX.value = Math.min(bounds.x, Math.max(-bounds.x, panX.value))
  panY.value = Math.min(bounds.y, Math.max(-bounds.y, panY.value))
}

function setPointerCaptureTarget(e: PointerEvent): void {
  const target = e.currentTarget
  if (target instanceof SVGSVGElement && target.hasPointerCapture(e.pointerId)) return
  if (target instanceof SVGSVGElement) target.setPointerCapture(e.pointerId)
}

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  const target = e.target as Element | null
  if (target?.closest('.relation-overview__node-group')) return
  if (target?.closest('.relation-overview__empty')) return
  e.preventDefault()
  setPointerCaptureTarget(e)
  isDragging.value = true
  dragState.value = {
    active: true,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    originX: panX.value,
    originY: panY.value,
  }
}

function onPointerMove(e: PointerEvent): void {
  const drag = dragState.value
  if (!drag?.active || drag.pointerId !== e.pointerId) return
  const units = svgUnitsPerClientPixel(e.currentTarget)
  const dx = (e.clientX - drag.startX) * units.x
  const dy = (e.clientY - drag.startY) * units.y
  panX.value = drag.originX + dx
  panY.value = drag.originY + dy
  clampPanToCurrentZoom()
}

function onWheel(e: WheelEvent): void {
  const target = e.currentTarget
  if (!(target instanceof SVGSVGElement)) return
  const nextZoom = clampZoom(zoom.value + (e.deltaY < 0 ? zoomStep : -zoomStep))
  if (nextZoom === zoom.value) return

  const rect = target.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    zoom.value = nextZoom
    clampPanToCurrentZoom()
    return
  }

  const cursorX = ((e.clientX - rect.left) / rect.width) * viewWidth
  const cursorY = ((e.clientY - rect.top) / rect.height) * viewHeight
  const worldX = (cursorX - panX.value) / zoom.value
  const worldY = (cursorY - panY.value) / zoom.value

  zoom.value = nextZoom
  panX.value = cursorX - worldX * zoom.value
  panY.value = cursorY - worldY * zoom.value
  clampPanToCurrentZoom()
}

function endDrag(e: PointerEvent): void {
  const drag = dragState.value
  if (!drag || drag.pointerId !== e.pointerId) return
  dragState.value = null
  isDragging.value = false
}

function onPointerLeave(e: PointerEvent): void {
  if (dragState.value?.pointerId === e.pointerId) return
  if (!dragState.value) isDragging.value = false
}
</script>

<style scoped>
.relation-overview {
  width: 100%;
  height: clamp(560px, 60vh, 760px);
  border-radius: 26px;
  overflow: hidden;
  margin: 0 auto;
  max-width: 860px;
  background: color-mix(in srgb, var(--color-surface-muted) 88%, #1f1914 12%);
  border: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 60%, transparent),
    0 10px 28px color-mix(in srgb, #0f172a 4%, transparent);
  transition:
    box-shadow 220ms ease,
    border-color 220ms ease,
    transform 220ms ease,
    background 220ms ease;
  will-change: transform, box-shadow;
  position: relative;
}

.relation-overview__legend {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  max-width: min(72%, 520px);
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 52%, transparent);
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 22px color-mix(in srgb, #0f172a 10%, transparent);
}

.relation-overview__legend-title {
  color: var(--color-text);
  font-size: 0.78rem;
  font-weight: 800;
  margin-right: 4px;
}

.relation-overview__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.relation-overview__legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 52%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
}

.relation-overview__legend-swatch--heat-0 {
  background: color-mix(in srgb, var(--color-surface-muted) 92%, var(--color-surface));
}

.relation-overview__legend-swatch--heat-1 {
  background: color-mix(in srgb, #8fbf8f 36%, var(--color-surface));
}

.relation-overview__legend-swatch--heat-2 {
  background: color-mix(in srgb, #f0d48a 54%, var(--color-surface));
}

.relation-overview__legend-swatch--heat-3 {
  background: color-mix(in srgb, #f1a55f 66%, var(--color-surface));
}

.relation-overview__legend-swatch--heat-4 {
  background: color-mix(in srgb, #d96b5f 74%, var(--color-surface));
}

.relation-overview__legend-label {
  color: var(--color-text-muted);
}

.relation-overview--dragging {
  cursor: grabbing;
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 66%, transparent),
    0 22px 48px color-mix(in srgb, var(--color-primary) 10%, transparent),
    0 10px 24px color-mix(in srgb, #0f172a 6%, transparent);
  transform: translateY(-2px) scale(1.003);
  background: color-mix(in srgb, var(--color-surface-muted) 84%, #1b1512 16%);
}

.relation-overview--zoomed:not(.relation-overview--dragging) {
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 62%, transparent),
    0 14px 34px color-mix(in srgb, var(--color-primary) 5%, transparent);
}

.relation-overview__svg {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  cursor: grab;
}

.relation-overview--dragging .relation-overview__svg {
  cursor: grabbing;
}

.relation-overview__backdrop {
  fill: transparent;
  stroke: color-mix(in srgb, var(--color-border) 46%, transparent);
  transition: stroke 220ms ease;
}

.relation-overview--dragging .relation-overview__backdrop {
  stroke: color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
}

.relation-overview__grid {
  fill: url(#overview-map-grid);
  opacity: 0.28;
  pointer-events: none;
  transition: opacity 220ms ease;
}

.relation-overview--dragging .relation-overview__grid {
  opacity: 0.36;
}

.relation-overview__content {
  transition: filter 220ms ease;
  transform-origin: center;
}

.relation-overview--dragging .relation-overview__content {
  filter: saturate(1.03);
}

.relation-overview__ring {
  fill: none;
  stroke: color-mix(in srgb, var(--color-border) 34%, transparent);
  stroke-width: 1.35;
  opacity: 0.72;
}

.relation-overview__label,
.relation-overview__meta,
.relation-overview__badge-text,
.relation-overview__empty-title,
.relation-overview__empty-sub {
  pointer-events: none;
}

.relation-overview__node-group {
  cursor: pointer;
}

.relation-overview__node-halo {
  fill: color-mix(in srgb, var(--color-primary-soft) 68%, transparent);
  opacity: 0.28;
  transition: opacity 180ms ease, transform 180ms ease;
}

.relation-overview__node-card {
  fill: url(#overview-map-card);
  stroke: color-mix(in srgb, var(--color-border-strong) 46%, transparent);
  stroke-width: 1.25;
  transition: fill 180ms ease, stroke 180ms ease, filter 180ms ease, transform 180ms ease;
}

.relation-overview__node-card--heat-0 {
  fill: color-mix(in srgb, var(--color-surface) 96%, white 4%);
  stroke: color-mix(in srgb, var(--color-border-strong) 44%, transparent);
}

.relation-overview__node-card--heat-1 {
  fill: color-mix(in srgb, #8fbf8f 18%, var(--color-surface));
  stroke: color-mix(in srgb, #78a878 34%, var(--color-border-strong));
}

.relation-overview__node-card--heat-2 {
  fill: color-mix(in srgb, #f0d48a 26%, var(--color-surface));
  stroke: color-mix(in srgb, #d3b256 40%, var(--color-border-strong));
}

.relation-overview__node-card--heat-3 {
  fill: color-mix(in srgb, #f1a55f 34%, var(--color-surface));
  stroke: color-mix(in srgb, #dc8b43 48%, var(--color-border-strong));
}

.relation-overview__node-card--heat-4 {
  fill: color-mix(in srgb, #d96b5f 38%, var(--color-surface));
  stroke: color-mix(in srgb, #bf5146 54%, var(--color-border-strong));
}

.relation-overview__node-card:hover,
.relation-overview__node-card:focus-visible {
  fill: color-mix(in srgb, var(--color-primary-soft) 24%, var(--color-surface));
  stroke: color-mix(in srgb, var(--color-primary) 42%, var(--color-border-strong));
  filter: drop-shadow(0 10px 16px color-mix(in srgb, var(--color-primary) 10%, transparent));
  outline: none;
}

.relation-overview__node-card--focus {
  fill: url(#overview-map-card-focus);
  stroke: color-mix(in srgb, var(--color-primary) 54%, var(--color-border-strong));
  stroke-width: 1.65;
}

.relation-overview__label {
  fill: var(--color-text);
  font-size: 18px;
  font-weight: 900;
  text-anchor: middle;
}

.relation-overview__meta {
  fill: var(--color-text-muted);
  font-size: 13px;
  font-weight: 700;
  text-anchor: middle;
}

.relation-overview__badge {
  fill: color-mix(in srgb, var(--color-primary) 84%, var(--color-surface) 16%);
  stroke: color-mix(in srgb, var(--color-surface) 98%, transparent);
  stroke-width: 2.2;
}

.relation-overview__badge--heat-0 {
  fill: color-mix(in srgb, var(--color-surface-muted) 88%, var(--color-surface));
  stroke: color-mix(in srgb, var(--color-border-strong) 56%, transparent);
}

.relation-overview__badge--heat-1 {
  fill: color-mix(in srgb, #78a878 82%, var(--color-surface) 18%);
}

.relation-overview__badge--heat-2 {
  fill: color-mix(in srgb, #d8b54b 88%, var(--color-surface) 12%);
}

.relation-overview__badge--heat-3 {
  fill: color-mix(in srgb, #dc8b43 92%, var(--color-surface) 8%);
}

.relation-overview__badge--heat-4 {
  fill: color-mix(in srgb, #bf5146 94%, var(--color-surface) 6%);
}

.relation-overview__badge-text {
  fill: var(--btn-on-primary, #fff);
  font-size: 13px;
  font-weight: 900;
  text-anchor: middle;
}

[data-theme='blueprint'] .relation-overview {
  background:
    radial-gradient(circle at 18% 18%, rgba(56, 189, 248, 0.13), transparent 34%),
    radial-gradient(circle at 78% 86%, rgba(129, 140, 248, 0.1), transparent 42%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(8, 13, 26, 0.96));
  border-color: rgba(125, 211, 252, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(186, 230, 253, 0.08),
    0 22px 48px rgba(2, 8, 23, 0.34);
}

[data-theme='blueprint'] .relation-overview__legend {
  border-color: rgba(125, 211, 252, 0.18);
  background: rgba(15, 23, 42, 0.74);
  box-shadow: 0 12px 28px rgba(2, 8, 23, 0.28);
}

[data-theme='blueprint'] .relation-overview__ring {
  stroke: rgba(125, 211, 252, 0.16);
}

[data-theme='blueprint'] .relation-overview__node-card--heat-0 {
  fill: color-mix(in srgb, #1e293b 78%, #0ea5e9 22%);
  stroke: rgba(125, 211, 252, 0.26);
}

[data-theme='blueprint'] .relation-overview__node-card--heat-1 {
  fill: color-mix(in srgb, #0ea5e9 20%, var(--color-surface));
  stroke: rgba(56, 189, 248, 0.38);
}

[data-theme='blueprint'] .relation-overview__node-card--heat-2 {
  fill: color-mix(in srgb, #38bdf8 26%, var(--color-surface));
  stroke: rgba(125, 211, 252, 0.48);
}

[data-theme='blueprint'] .relation-overview__node-card--heat-3 {
  fill: color-mix(in srgb, #818cf8 32%, var(--color-surface));
  stroke: rgba(129, 140, 248, 0.58);
}

[data-theme='blueprint'] .relation-overview__node-card--heat-4 {
  fill: color-mix(in srgb, #22d3ee 38%, var(--color-surface));
  stroke: rgba(34, 211, 238, 0.66);
}

[data-theme='blueprint'] .relation-overview__node-card--focus {
  stroke: rgba(186, 230, 253, 0.86);
  filter: drop-shadow(0 0 18px rgba(56, 189, 248, 0.24));
}

[data-theme='blueprint'] .relation-overview__badge {
  fill: color-mix(in srgb, #38bdf8 88%, #020617 12%);
  stroke: rgba(224, 242, 254, 0.42);
}

.relation-overview__badge-text--heat-0 {
  fill: var(--color-text);
}

.relation-overview__empty-orb {
  fill: color-mix(in srgb, var(--color-primary-soft) 52%, var(--color-surface));
  stroke: color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  stroke-width: 1.4;
}

.relation-overview__empty-title {
  fill: var(--color-text);
  font-size: 18px;
  font-weight: 800;
  text-anchor: middle;
}

.relation-overview__empty-sub {
  fill: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  text-anchor: middle;
}

[data-theme='dark'] .relation-overview {
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-surface-elevated) 92%, transparent), color-mix(in srgb, var(--color-surface-muted) 86%, transparent));
  border-color: color-mix(in srgb, var(--color-border-strong) 82%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 18px 46px rgba(0, 0, 0, 0.34);
}

[data-theme='dark'] .relation-overview__legend {
  background: color-mix(in srgb, var(--color-surface-elevated) 90%, transparent);
  border-color: color-mix(in srgb, var(--color-border-strong) 82%, transparent);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
}

[data-theme='dark'] .relation-overview__legend-swatch--heat-0 {
  background: color-mix(in srgb, var(--color-surface-muted) 90%, var(--color-bg));
}

[data-theme='dark'] .relation-overview__legend-swatch--heat-1 {
  background: color-mix(in srgb, #93a88b 32%, var(--color-surface));
}

[data-theme='dark'] .relation-overview__legend-swatch--heat-2 {
  background: color-mix(in srgb, #c08a5c 48%, var(--color-surface));
}

[data-theme='dark'] .relation-overview__legend-swatch--heat-3 {
  background: color-mix(in srgb, #d08f61 56%, var(--color-surface));
}

[data-theme='dark'] .relation-overview__legend-swatch--heat-4 {
  background: color-mix(in srgb, #c86f62 60%, var(--color-surface));
}

[data-theme='dark'] .relation-overview__badge-text {
  fill: var(--btn-on-primary);
}

:root:not([data-theme='dark']) .relation-overview {
  background: linear-gradient(180deg, color-mix(in srgb, #ffffff 96%, transparent), color-mix(in srgb, #f5f7fb 94%, transparent));
  border-color: rgba(15, 23, 42, 0.08);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
}

:root:not([data-theme='dark']) .relation-overview__legend {
  background: color-mix(in srgb, #ffffff 90%, transparent);
  border-color: rgba(15, 23, 42, 0.1);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

:root:not([data-theme='dark']) .relation-overview--dragging,
:root:not([data-theme='dark']) .relation-overview--zoomed:not(.relation-overview--dragging) {
  box-shadow: 0 20px 48px rgba(47, 111, 237, 0.1);
}

@media (max-width: 900px) {
  .relation-overview__legend {
    top: 14px;
    right: 14px;
    left: 14px;
    max-width: none;
    justify-content: flex-start;
  }
}
</style>
