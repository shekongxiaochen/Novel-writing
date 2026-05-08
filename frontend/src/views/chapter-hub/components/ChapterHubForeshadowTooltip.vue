<template>
  <Teleport to="body">
    <Transition name="entity-tooltip">
      <div
        v-if="open && plant"
        ref="tooltipRef"
        class="chapter-hub__foreshadow-tooltip fsw-tooltip"
        :style="tooltipStyle"
        @mouseenter="emit('tooltipEnter')"
        @mouseleave="emit('tooltipLeave')"
      >
        <div class="fsw-tooltip__head">
          <span class="fsw-tooltip__kind" :class="segment === 'fulfill' ? 'fsw-tooltip__kind--fulfill' : 'fsw-tooltip__kind--plant'">
            {{ segment === 'fulfill' ? '照应' : '伏笔' }}
          </span>
          <button
            v-if="segment === 'plant'"
            type="button"
            class="fsw-tooltip__action"
            @click.stop="handleEditPlant"
          >
            修改伏笔
          </button>
          <button
            v-else
            type="button"
            class="fsw-tooltip__action"
            @click.stop="handleEditFulfill"
          >
            修改照应
          </button>
        </div>

        <template v-if="jumpItems.length">
          <div class="fsw-tooltip__divider" />
          <p class="fsw-tooltip__section-label">{{ segment === 'fulfill' ? '伏笔位置' : '照应位置' }}</p>
          <ul class="fsw-tooltip__fulfill-list">
            <li
              v-for="item in jumpItems"
              :key="item.id"
              class="fsw-tooltip__fulfill-item"
              role="button"
              tabindex="0"
              @click="handleJump(item)"
              @keydown.enter="handleJump(item)"
            >
              <span class="fsw-tooltip__fulfill-ch">第 {{ item.chapterNo }} 章 · {{ item.chapterTitle }}</span>
              <span v-if="item.text" class="fsw-tooltip__fulfill-text">
                「{{ item.text.slice(0, 24) }}{{ item.text.length > 24 ? '…' : '' }}」
              </span>
              <span v-if="item.notes" class="fsw-tooltip__fulfill-notes muted">{{ item.notes }}</span>
              <span class="fsw-tooltip__fulfill-jump">→ 跳转</span>
            </li>
          </ul>
        </template>
        <p v-else class="fsw-tooltip__empty muted">{{ segment === 'fulfill' ? '伏笔位置缺失' : '尚未照应' }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ForeshadowFulfillment, ForeshadowPlant } from '../../../types'

const props = defineProps<{
  open: boolean
  x: number
  anchorTop: number
  anchorBottom: number
  plant: ForeshadowPlant | null
  segment: 'plant' | 'fulfill'
  fulfillmentId?: string
  /** 用于强制触发同目标重复跳转后的闪烁/重新定位（避免 Vue 认为 props 未变化） */
  jumpToken?: string
}>()

const emit = defineEmits<{
  tooltipEnter: []
  tooltipLeave: []
  jumpToFulfill: [fulfillment: ForeshadowFulfillment]
  jumpToPlant: [plant: ForeshadowPlant]
  editPlant: [plant: ForeshadowPlant]
  editFulfill: [plant: ForeshadowPlant, fulfillment: ForeshadowFulfillment]
}>()

const tooltipRef = ref<HTMLElement | null>(null)
const tooltipStyle = ref<Record<string, string>>({ top: `${props.anchorBottom}px`, left: `${props.x}px` })

function recalcTooltipPosition(): void {
  if (!props.open || !props.plant) return
  const el = tooltipRef.value
  if (!el || typeof window === 'undefined') return

  const pad = 12
  const offset = 12
  const ww = window.innerWidth
  const wh = window.innerHeight
  const tw = Math.max(0, el.offsetWidth)
  const th = Math.max(0, el.offsetHeight)
  const anchorX = Number.isFinite(props.x) ? props.x : 0
  const anchorTop = Number.isFinite(props.anchorTop) ? props.anchorTop : 0
  const anchorBottom = Number.isFinite(props.anchorBottom) ? props.anchorBottom : anchorTop

  // 默认右下展开；空间不足时切到左侧/上方，再兜底夹取到视口内。
  const shouldPlaceLeft = anchorX + offset + tw > ww - pad && anchorX - offset - tw >= pad
  const shouldPlaceUp = anchorBottom + offset + th > wh - pad && anchorTop - offset - th >= pad

  const rawLeft = shouldPlaceLeft ? anchorX - tw : anchorX + offset
  // 向左时与整段高亮区域的左侧角对齐；向右时保持常规偏移展开。
  const rawTop = shouldPlaceLeft
    ? shouldPlaceUp
      ? anchorTop - th
      : anchorBottom
    : shouldPlaceUp
      ? anchorTop - offset - th
      : anchorBottom + offset
  const left = Math.min(Math.max(pad, rawLeft), Math.max(pad, ww - tw - pad))
  const top = Math.min(Math.max(pad, rawTop), Math.max(pad, wh - th - pad))

  tooltipStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
  }
}

function queueRecalcTooltipPosition(): void {
  void nextTick(() => {
    requestAnimationFrame(() => {
      recalcTooltipPosition()
    })
  })
}

watch(
  () => [props.open, props.x, props.anchorTop, props.anchorBottom, props.segment, props.fulfillmentId, props.plant?.id],
  () => {
    if (!props.open || !props.plant) return
    queueRecalcTooltipPosition()
  },
  { immediate: true },
)

if (typeof window !== 'undefined') {
  window.addEventListener('resize', recalcTooltipPosition)
}

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', recalcTooltipPosition)
  }
})

type JumpItem =
  | { id: string; kind: 'fulfill'; chapterNo: number; chapterTitle: string; text: string; notes: string; payload: ForeshadowFulfillment }
  | { id: string; kind: 'plant'; chapterNo: number; chapterTitle: string; text: string; notes: string; payload: ForeshadowPlant }

const jumpItems = computed<JumpItem[]>(() => {
  const p = props.plant
  if (!p) return []
  if (props.segment === 'fulfill') {
    return [
      {
        id: `plant-${p.id}`,
        kind: 'plant',
        chapterNo: p.plantChapterNo,
        chapterTitle: p.plantChapterTitle || '未命名章节',
        text: p.plantText ?? '',
        notes: p.description ?? '',
        payload: p,
      },
    ]
  }
  return (p.fulfillments ?? []).map((ff) => ({
    id: ff.id,
    kind: 'fulfill' as const,
    chapterNo: ff.fulfillChapterNo,
    chapterTitle: ff.fulfillChapterTitle || '未命名章节',
    text: ff.fulfillText ?? '',
    notes: ff.notes ?? '',
    payload: ff,
  }))
})

watch(jumpItems, () => {
  if (!props.open || !props.plant) return
  queueRecalcTooltipPosition()
})

function handleJump(item: JumpItem): void {
  if (item.kind === 'plant') emit('jumpToPlant', item.payload)
  else emit('jumpToFulfill', item.payload)
}

function handleEditPlant(): void {
  if (!props.plant) return
  emit('editPlant', props.plant)
}

function handleEditFulfill(): void {
  const p = props.plant
  if (!p) return
  const ffId = String(props.fulfillmentId ?? '').trim()
  const target = (p.fulfillments ?? []).find((ff) => ff.id === ffId) ?? p.fulfillments?.[0]
  if (!target) return
  emit('editFulfill', p, target)
}
</script>

<style scoped>
.chapter-hub__foreshadow-tooltip {
  position: fixed;
  z-index: 4850;
  width: min(292px, calc(100vw - 24px));
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  box-shadow: 0 14px 36px rgba(5, 10, 18, 0.28);
  pointer-events: auto;
  font-size: 0.875rem;
  line-height: 1.45;
}

.fsw-tooltip__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.fsw-tooltip__kind {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  letter-spacing: 0.04em;
}

.fsw-tooltip__kind--plant {
  background: color-mix(in srgb, var(--color-primary-soft) 88%, transparent);
  color: var(--color-primary);
}

.fsw-tooltip__kind--fulfill {
  background: color-mix(in srgb, #34d399 22%, transparent);
  color: color-mix(in srgb, #047857 88%, var(--color-text) 12%);
}

.fsw-tooltip__divider {
  height: 1px;
  margin: 10px 0;
  background: var(--color-border);
}

.fsw-tooltip__section-label {
  margin: 0 0 6px;
  font-size: 0.7rem;
  font-weight: 650;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.fsw-tooltip__fulfill-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.fsw-tooltip__fulfill-item {
  padding: 8px 0;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.12s ease;
}

.fsw-tooltip__fulfill-item:first-child {
  border-top: none;
  padding-top: 0;
}

.fsw-tooltip__fulfill-item:hover {
  background: color-mix(in srgb, var(--color-primary-soft) 35%, transparent);
  border-radius: 6px;
  margin: 0 -6px;
  padding-left: 6px;
  padding-right: 6px;
}

.fsw-tooltip__fulfill-ch {
  display: block;
  font-weight: 600;
  font-size: 0.8125rem;
}

.fsw-tooltip__fulfill-text {
  display: block;
  margin-top: 4px;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.fsw-tooltip__fulfill-notes {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
}

.fsw-tooltip__fulfill-jump {
  display: inline-block;
  margin-top: 6px;
  font-size: 0.72rem;
  font-weight: 650;
  color: var(--color-primary);
}

.fsw-tooltip__empty {
  margin: 0;
  font-size: 0.8125rem;
}

.fsw-tooltip__action {
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 10px;
  cursor: pointer;
}

</style>
