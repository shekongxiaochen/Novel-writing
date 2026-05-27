<template>
  <section class="outline-map-canvas" :class="`outline-map-canvas--${mode}`" @wheel="onWheel">
    <div class="outline-map-canvas__toolbar">
      <button type="button" class="outline-map-canvas__tool-btn" aria-label="放大导图" title="放大导图" @click="zoomIn">＋</button>
      <button type="button" class="outline-map-canvas__tool-btn" aria-label="缩小导图" title="缩小导图" @click="zoomOut">－</button>
      <button type="button" class="outline-map-canvas__tool-btn" aria-label="重置导图视图" title="重置导图视图" @click="resetView">重置</button>
      <span class="outline-map-canvas__zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <span v-if="mode === 'workspace'" class="outline-map-canvas__hint">拖动画布 · 滚轮缩放 · Tab 子节点 · Enter 同级</span>
    </div>

    <div
      ref="viewportRef"
      class="outline-map-canvas__viewport"
      tabindex="0"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endPointer"
      @pointercancel="cancelPointer"
      @pointerleave="cancelPointer"
      @keydown="onViewportKeydown"
    >
      <div class="outline-map-canvas__stage" :style="sceneStageStyle">
        <div class="outline-map-canvas__scene" :style="sceneStyle">
          <svg class="outline-map-canvas__edges" :width="sceneWidth" :height="sceneHeight" :viewBox="`0 0 ${sceneWidth} ${sceneHeight}`" aria-hidden="true">
            <path
              v-for="edge in edges"
              :key="edge.id"
              class="outline-map-canvas__edge"
              :class="{
                'is-active': edge.toId === activeOutlineId || edge.fromId === activeOutlineId,
                'is-linked': linkedOutlineIdSet.has(edge.toId),
              }"
              :d="edge.path"
            />
          </svg>

          <div
            v-for="node in nodes"
            :key="node.id"
            class="outline-map-canvas__node"
            :style="{ transform: `translate(${node.x}px, ${node.y}px)` }"
          >
            <OutlineMindMapNode
              :node="node"
              :active="node.id === activeOutlineId"
              :dimmed="node.isDimmed"
              :linked-to-active-chapter="linkedOutlineIdSet.has(node.id)"
              :mode="mode"
              @select="onSelectNode"
              @create-child="onCreateChild"
              @toggle-link="onToggleLink"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import OutlineMindMapNode from './OutlineMindMapNode.vue'
import type { OutlineMindMapEdgeView, OutlineMindMapNodeView } from '../../../../features/outline-map/composables/useOutlineMindMapLayout'

const props = withDefaults(defineProps<{
  nodes: OutlineMindMapNodeView[]
  edges: OutlineMindMapEdgeView[]
  activeOutlineId?: string
  linkedOutlineIds?: string[]
  sceneWidth?: number
  sceneHeight?: number
  mode?: 'workspace' | 'chapter'
}>(), {
  activeOutlineId: '',
  linkedOutlineIds: () => [],
  sceneWidth: 960,
  sceneHeight: 560,
  mode: 'workspace',
})

const emit = defineEmits<{
  selectNode: [outlineId: string]
  toggleLink: [outlineId: string]
  createChild: [outlineId: string]
  createSibling: [outlineId: string]
  createRoot: []
}>()

const viewportRef = ref<HTMLElement | null>(null)
const zoom = ref(1)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragOriginScrollLeft = ref(0)
const dragOriginScrollTop = ref(0)
const isDragging = ref(false)

const linkedOutlineIdSet = computed(() => new Set(props.linkedOutlineIds))

const sceneStageStyle = computed(() => ({
  width: `${props.sceneWidth * zoom.value}px`,
  height: `${props.sceneHeight * zoom.value}px`,
}))

const sceneStyle = computed(() => ({
  width: `${props.sceneWidth}px`,
  height: `${props.sceneHeight}px`,
  transform: `scale(${zoom.value})`,
}))

function clampZoom(next: number): number {
  return Math.max(0.45, Math.min(1.9, Number(next.toFixed(2))))
}

function zoomIn(): void {
  zoomViewportAtCenter(0.1)
}

function zoomOut(): void {
  zoomViewportAtCenter(-0.1)
}

function resetView(): void {
  zoom.value = 1
  const viewport = viewportRef.value
  if (!viewport) return
  viewport.scrollLeft = 0
  viewport.scrollTop = 0
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const delta = event.deltaY < 0 ? 0.08 : -0.08
  void zoomAtClientPoint(delta, event.clientX, event.clientY)
}

async function zoomAtClientPoint(delta: number, clientX: number, clientY: number): Promise<void> {
  const viewport = viewportRef.value
  const previousZoom = zoom.value
  const nextZoom = clampZoom(previousZoom + delta)
  if (!viewport || nextZoom === previousZoom) return

  const rect = viewport.getBoundingClientRect()
  const offsetX = clientX - rect.left
  const offsetY = clientY - rect.top
  const worldX = (viewport.scrollLeft + offsetX) / previousZoom
  const worldY = (viewport.scrollTop + offsetY) / previousZoom

  zoom.value = nextZoom
  await nextTick()
  viewport.scrollLeft = worldX * nextZoom - offsetX
  viewport.scrollTop = worldY * nextZoom - offsetY
}

function zoomViewportAtCenter(delta: number): void {
  const viewport = viewportRef.value
  if (!viewport) {
    zoom.value = clampZoom(zoom.value + delta)
    return
  }

  const rect = viewport.getBoundingClientRect()
  void zoomAtClientPoint(
    delta,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  )
}

function onSelectNode(outlineId: string): void {
  viewportRef.value?.focus()
  emit('selectNode', outlineId)
}

function onCreateChild(outlineId: string): void {
  viewportRef.value?.focus()
  emit('createChild', outlineId)
}

function onToggleLink(outlineId: string): void {
  viewportRef.value?.focus()
  emit('toggleLink', outlineId)
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('.outline-map-node')) return
  const viewport = viewportRef.value
  if (!viewport) return
  viewport.focus()
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragOriginScrollLeft.value = viewport.scrollLeft
  dragOriginScrollTop.value = viewport.scrollTop
  viewport.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!isDragging.value) return
  const viewport = viewportRef.value
  if (!viewport) return
  const dx = event.clientX - dragStartX.value
  const dy = event.clientY - dragStartY.value
  viewport.scrollLeft = dragOriginScrollLeft.value - dx
  viewport.scrollTop = dragOriginScrollTop.value - dy
}

function endPointer(): void {
  isDragging.value = false
}

function cancelPointer(): void {
  isDragging.value = false
}

function onViewportKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (
    target?.closest('input, textarea, select, [contenteditable="true"]')
  ) {
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    if (props.activeOutlineId) emit('createChild', props.activeOutlineId)
    else emit('createRoot')
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    if (props.activeOutlineId) emit('createSibling', props.activeOutlineId)
    else emit('createRoot')
  }
}
</script>
