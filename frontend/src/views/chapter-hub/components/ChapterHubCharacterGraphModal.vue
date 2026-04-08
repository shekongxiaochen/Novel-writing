<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="open && selectedGraphCharacter"
        class="confirm-overlay chapter-hub__char-graph-overlay"
        role="presentation"
        @click.self="emitClose"
      >
        <div
          class="confirm-dialog chapter-hub__char-graph-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chapter-hub-char-graph-title"
        >
          <div class="confirm-dialog__body chapter-hub__char-graph-body scrollbar-paper">
            <div class="chapter-hub__char-graph-head">
              <div class="chapter-hub__char-graph-head-text">
                <h2 id="chapter-hub-char-graph-title" class="chapter-hub__char-graph-title">
                  {{ selectedGraphCharacter.name }} · 关系
                </h2>
                <p class="chapter-hub__char-graph-sub muted">
                  左侧为工作台「角色」页下方的同款聚焦 3D 关系图；可拖拽旋转查看。
                </p>
              </div>
              <div class="chapter-hub__char-graph-head-actions">
                <button
                  type="button"
                  class="confirm-dialog__btn confirm-dialog__btn--ghost"
                  @click="hangCurrentGraph"
                >
                  悬挂3D图
                </button>
                <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="emitClose">
                  关闭
                </button>
              </div>
            </div>

            <div class="characters-graph-ui chapter-hub__char-graph-ui">
              <div class="characters-graph-ui__left chapter-hub__char-graph-col-3d">
                <div class="characters-graph-ui__viz chapter-hub__char-graph-viz-outer">
                  <div class="characters-graph-ui__viz-main chapter-hub__char-graph-viz-main">
                    <CharacterRelationFocusSphere
                      v-if="visibleCharacters.length > 0"
                      selectable
                      :render-scale="1"
                      :panel-height="520"
                      :characters="visibleCharacters"
                      :relations="relatedRelations"
                      :focus-character-id="focusCharacterId"
                      @select="onFocusSphereNodeSelect"
                    />
                    <p v-else class="muted">暂无关系数据。</p>
                  </div>
                </div>
              </div>

              <div class="characters-graph-ui__right">
                <section class="characters-graph-ui__section characters-graph-ui__toolbar">
                  <CharacterGraphRelationToolbar
                    v-model:link-mode="graph3dLinkMode"
                    :novel-id="novelId"
                    :focus-character-id="focusCharacterId"
                    :pair-character-id="focusSpherePairCharacterId"
                    :characters="characters"
                    :relations="characterRelations"
                    @relations-changed="reloadRelations"
                  />
                </section>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Transition>
    <div
      v-for="win in hungGraphWindows"
      :key="win.id"
      class="chapter-hub__char-graph-float"
      :style="hungGraphFloatStyle(win)"
      role="dialog"
      aria-label="悬挂3D关系图"
    >
      <div class="chapter-hub__char-graph-float-bar" @pointerdown="onFloatBarPointerDown(win.id, $event)">
        <span>{{ characterNameById(win.focusCharacterId) }} · 悬挂 3D 图</span>
        <button
          type="button"
          class="chapter-hub__char-graph-float-close"
          aria-label="关闭悬挂3D图"
          @click="removeHungGraph(win.id)"
        >
          收回
        </button>
      </div>
      <div class="chapter-hub__char-graph-float-body">
        <CharacterRelationFocusSphere
          v-if="visibleCharactersByFocus(win.focusCharacterId).length > 0"
          selectable
          :render-scale="win.renderScale"
          :panel-height="Math.max(120, win.height - 40)"
          :characters="visibleCharactersByFocus(win.focusCharacterId)"
          :relations="relatedRelationsByFocus(win.focusCharacterId)"
          :focus-character-id="win.focusCharacterId"
        />
        <p v-else class="muted">暂无关系数据。</p>
      </div>
      <div class="chapter-hub__char-graph-float-resizer" @pointerdown="onFloatResizerPointerDown(win.id, $event)" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import CharacterGraphRelationToolbar from '../../../components/CharacterGraphRelationToolbar.vue'
import CharacterRelationFocusSphere from '../../../components/CharacterRelationFocusSphere.vue'
import { getCharacterRelationsByNovelId } from '../../../lib/storage'
import type { Character, CharacterRelation } from '../../../types'

const props = defineProps<{
  open: boolean
  novelId: string
  characters: Character[]
  focusCharacterId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const characterRelations = ref<CharacterRelation[]>([])
const graph3dLinkMode = ref(false)
const focusSpherePairCharacterId = ref('')
type HungGraphWindow = {
  id: string
  focusCharacterId: string
  x: number
  y: number
  width: number
  height: number
  renderScale: number
}
const hungGraphWindows = ref<HungGraphWindow[]>([])
const draggingWindowId = ref('')
const resizingWindowId = ref('')
const floatDragOffsetX = ref(0)
const floatDragOffsetY = ref(0)
const resizeStartX = ref(0)
const resizeStartY = ref(0)
const resizeStartWidth = ref(0)
const resizeStartHeight = ref(0)

function onFocusSphereNodeSelect(id: string): void {
  if (id === props.focusCharacterId) {
    focusSpherePairCharacterId.value = ''
    return
  }
  focusSpherePairCharacterId.value = id
}

const selectedGraphCharacter = computed(
  () => props.characters.find((c) => c.id === props.focusCharacterId) ?? null
)

const relatedRelations = computed(() => {
  const id = props.focusCharacterId
  return characterRelations.value.filter((r) => r.fromCharacterId === id || r.toCharacterId === id)
})

const visibleGraphCharacterIds = computed(() => {
  const ids = new Set<string>()
  if (props.focusCharacterId) ids.add(props.focusCharacterId)
  relatedRelations.value.forEach((r) => {
    ids.add(r.fromCharacterId)
    ids.add(r.toCharacterId)
  })
  return ids
})

const visibleCharacters = computed(() => props.characters.filter((c) => visibleGraphCharacterIds.value.has(c.id)))

function emitClose(): void {
  emit('close')
}

function relatedRelationsByFocus(focusCharacterId: string): CharacterRelation[] {
  return characterRelations.value.filter((r) => r.fromCharacterId === focusCharacterId || r.toCharacterId === focusCharacterId)
}

function visibleCharactersByFocus(focusCharacterId: string): Character[] {
  const ids = new Set<string>()
  if (focusCharacterId) ids.add(focusCharacterId)
  relatedRelationsByFocus(focusCharacterId).forEach((r) => {
    ids.add(r.fromCharacterId)
    ids.add(r.toCharacterId)
  })
  return props.characters.filter((c) => ids.has(c.id))
}

function characterNameById(id: string): string {
  return props.characters.find((c) => c.id === id)?.name ?? '角色'
}

function hangCurrentGraph(): void {
  if (!props.focusCharacterId) return
  reloadRelations()
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const idx = hungGraphWindows.value.length
  const baseX = 20 + (idx % 4) * 26
  const baseY = 80 + (idx % 4) * 22
  const width = 380
  const height = 300
  const next: HungGraphWindow = {
    id,
    focusCharacterId: props.focusCharacterId,
    x: baseX,
    y: baseY,
    width: width * 2,
    height: height * 2,
    renderScale: 1,
  }
  if (typeof window !== 'undefined') {
    next.x = Math.min(Math.max(8, next.x), Math.max(8, window.innerWidth - next.width - 8))
    next.y = Math.min(Math.max(8, next.y), Math.max(8, window.innerHeight - next.height - 8))
  }
  hungGraphWindows.value.push(next)
  emitClose()
}

function removeHungGraph(id: string): void {
  const i = hungGraphWindows.value.findIndex((x) => x.id === id)
  if (i >= 0) hungGraphWindows.value.splice(i, 1)
  if (draggingWindowId.value === id) stopFloatDragging()
  if (resizingWindowId.value === id) stopFloatResizing()
}

function hungGraphFloatStyle(win: HungGraphWindow): Record<string, string> {
  return {
    left: `${Math.round(win.x)}px`,
    top: `${Math.round(win.y)}px`,
    width: `${Math.round(win.width)}px`,
    height: `${Math.round(win.height)}px`,
  }
}

function onFloatBarPointerDown(id: string, event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('button')) return
  const win = hungGraphWindows.value.find((x) => x.id === id)
  if (!win) return
  event.preventDefault()
  draggingWindowId.value = id
  floatDragOffsetX.value = event.clientX - win.x
  floatDragOffsetY.value = event.clientY - win.y
  window.addEventListener('pointermove', onFloatPointerMove)
  window.addEventListener('pointerup', onFloatPointerUp, { once: true })
  window.addEventListener('pointercancel', onFloatPointerUp, { once: true })
}

function onFloatResizerPointerDown(id: string, event: PointerEvent): void {
  const win = hungGraphWindows.value.find((x) => x.id === id)
  if (!win) return
  event.preventDefault()
  event.stopPropagation()
  resizingWindowId.value = id
  resizeStartX.value = event.clientX
  resizeStartY.value = event.clientY
  resizeStartWidth.value = win.width
  resizeStartHeight.value = win.height
  window.addEventListener('pointermove', onFloatResizePointerMove)
  window.addEventListener('pointerup', onFloatResizePointerUp, { once: true })
  window.addEventListener('pointercancel', onFloatResizePointerUp, { once: true })
}

function onFloatPointerMove(event: PointerEvent): void {
  if (!draggingWindowId.value || typeof window === 'undefined') return
  if ((event.buttons & 1) !== 1) {
    stopFloatDragging()
    return
  }
  const win = hungGraphWindows.value.find((x) => x.id === draggingWindowId.value)
  if (!win) return
  const nextX = event.clientX - floatDragOffsetX.value
  const nextY = event.clientY - floatDragOffsetY.value
  const maxX = Math.max(8, window.innerWidth - win.width - 8)
  const maxY = Math.max(8, window.innerHeight - win.height - 8)
  win.x = Math.min(Math.max(8, nextX), maxX)
  win.y = Math.min(Math.max(8, nextY), maxY)
}

function onFloatResizePointerMove(event: PointerEvent): void {
  if (!resizingWindowId.value || typeof window === 'undefined') return
  if ((event.buttons & 1) !== 1) {
    stopFloatResizing()
    return
  }
  const win = hungGraphWindows.value.find((x) => x.id === resizingWindowId.value)
  if (!win) return
  const dx = event.clientX - resizeStartX.value
  const dy = event.clientY - resizeStartY.value
  const nextWidth = Math.min(980, Math.max(280, Math.round(resizeStartWidth.value + dx)))
  const nextHeight = Math.min(820, Math.max(220, Math.round(resizeStartHeight.value + dy)))
  win.width = nextWidth
  win.height = nextHeight
  const wRatio = nextWidth / 760
  const hRatio = nextHeight / 600
  win.renderScale = Math.min(1.8, Math.max(0.7, Number(Math.min(wRatio, hRatio).toFixed(2))))
}

function onFloatPointerUp(): void {
  stopFloatDragging()
}

function onFloatResizePointerUp(): void {
  stopFloatResizing()
}

function stopFloatDragging(): void {
  draggingWindowId.value = ''
  window.removeEventListener('pointermove', onFloatPointerMove)
  window.removeEventListener('pointercancel', onFloatPointerUp)
}

function stopFloatResizing(): void {
  resizingWindowId.value = ''
  window.removeEventListener('pointermove', onFloatResizePointerMove)
  window.removeEventListener('pointercancel', onFloatResizePointerUp)
}

function reloadRelations(): void {
  characterRelations.value = getCharacterRelationsByNovelId(props.novelId)
}

watch(
  () => props.open,
  (v) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = v ? 'hidden' : ''
    }
    if (v) {
      reloadRelations()
      graph3dLinkMode.value = false
      focusSpherePairCharacterId.value = ''
    }
  },
  { flush: 'post' }
)

watch(
  () => props.focusCharacterId,
  () => {
    focusSpherePairCharacterId.value = ''
  }
)

onUnmounted(() => {
  stopFloatDragging()
  stopFloatResizing()
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>
