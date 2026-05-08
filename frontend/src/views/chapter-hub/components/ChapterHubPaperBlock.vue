<template>
  <div class="chapter-hub__write">
    <div class="chapter-hub__paper-column">
      <div class="paper-desk paper-desk--hub">
        <div class="chapter-hub__paper-label">
          <span class="visually-hidden">正文编辑区</span>
          <div
            class="chapter-hub__textarea-wrap chapter-hub__textarea-wrap--overlay"
            :class="{
              'chapter-hub__textarea-wrap--writing': isChapterTextareaFocused,
              'chapter-hub__textarea-wrap--overlay-show': shouldShowEntityOverlay,
              'chapter-hub__textarea-wrap--overlay-ready': shouldShowEntityOverlay && overlayReady,
            }"
          >
            <div
              ref="overlayRef"
              class="chapter-hub__entity-overlay"
              v-show="shouldShowEntityOverlay && !isChapterTextareaFocused"
              @scroll="onOverlayScroll"
              @mousedown="onOverlayTextMouseDown"
            >
              <div ref="overlayInnerRef" class="chapter-hub__entity-overlay-inner">
                <template v-for="(line, lineIdx) in entityPreviewLines" :key="`line-${lineIdx}`">
                  <template v-for="(token, tokenIdx) in line" :key="`tok-${lineIdx}-${tokenIdx}`">
                    <span
                      v-if="token.character"
                      class="chapter-hub__entity-name chapter-hub__entity-name--link"
                      :class="{
                        ...foreshadowAugmentClass(token.foreshadow),
                        'chapter-hub__entity-name--anchor-edit': !!token.characterAnchorEditSite,
                        ...stateZoneClass(token.characterStateZone?.zoneIndex, 'character'),
                      }"
                      :data-range-start="token.range?.start ?? ''"
                      :data-range-end="token.range?.end ?? ''"
                      role="link"
                      tabindex="0"
                      @wheel="onEntityWheel"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @mouseenter="onCharacterMouseEnter($event, token)"
                      @mouseleave="onCharacterMouseLeave(token)"
                      @click.stop.prevent="emit('goCharacter', token.character!, token.range ?? null)"
                      @keydown.enter.prevent="emit('goCharacter', token.character!, token.range ?? null)"
                    >
                      {{ token.text }}
                    </span>
                    <span
                      v-else-if="token.faction"
                      class="chapter-hub__entity-name chapter-hub__entity-name--faction"
                      :class="{
                        ...foreshadowAugmentClass(token.foreshadow),
                        'chapter-hub__entity-name--anchor-edit-faction': !!token.factionAnchorEditSite,
                        ...stateZoneClass(token.factionStateZone?.zoneIndex, 'faction'),
                      }"
                      :data-range-start="token.range?.start ?? ''"
                      :data-range-end="token.range?.end ?? ''"
                      role="link"
                      tabindex="0"
                      @wheel="onEntityWheel"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @mouseenter="onFactionMouseEnter($event, token)"
                      @mouseleave="onFactionMouseLeave(token)"
                      @click.stop.prevent="emit('goFaction', token.faction!, token.range ?? null)"
                      @keydown.enter.prevent="emit('goFaction', token.faction!, token.range ?? null)"
                    >
                      {{ token.text }}
                    </span>
                    <span
                      v-else-if="token.foreshadow"
                      class="chapter-hub__foreshadow-mark"
                      :class="{
                        ...foreshadowAugmentClass(token.foreshadow),
                        ...foreshadowFlashClass(token.foreshadow),
                      }"
                      v-bind="foreshadowDataset(token.foreshadow, token)"
                      tabindex="0"
                      role="button"
                      @wheel="onEntityWheel"
                      @pointerdown.stop.prevent
                      @mousedown.stop.prevent
                      @mouseenter="emit('foreshadowEnter', $event, token.foreshadow!)"
                      @mouseleave="emit('foreshadowLeave')"
                      @click.stop.prevent="emit('foreshadowClick', token.foreshadow!)"
                    >
                      {{ token.text }}
                    </span>
                    <span
                      v-else
                      class="chapter-hub__entity-plain-token"
                      :data-range-start="token.range?.start ?? ''"
                      :data-range-end="token.range?.end ?? ''"
                    >{{ token.text }}</span>
                  </template>
                  <br v-if="lineIdx < entityPreviewLines.length - 1" />
                </template>
              </div>
            </div>
            <textarea
              ref="textareaRef"
              class="textarea textarea-paper textarea-paper--hub chapter-hub__textarea"
              :value="content"
              :readonly="readonly"
              :tabindex="isChapterTextareaFocused ? 0 : -1"
              aria-label="正文编辑区"
              spellcheck="false"
              @scroll="onTextareaScroll"
              @input="onTextareaInput"
              @keydown="emit('keydown', $event)"
              @keyup="onTextareaKeyup"
              @mouseup="onTextareaMouseup"
              @select="onTextareaSelect"
              @focus="onTextareaFocus"
              @blur="onTextareaBlur"
            />
          </div>
          <div class="chapter-hub__legend" aria-label="正文标记图例">
            <span class="chapter-hub__legend-title">标记说明</span>
            <div class="chapter-hub__legend-list">
              <span class="chapter-hub__legend-item">
                <span class="chapter-hub__legend-swatch chapter-hub__entity-name chapter-hub__entity-name--link">角色</span>
                <span class="chapter-hub__legend-copy">角色名</span>
              </span>
              <span class="chapter-hub__legend-item">
                <span class="chapter-hub__legend-swatch chapter-hub__entity-name chapter-hub__entity-name--faction">势力</span>
                <span class="chapter-hub__legend-copy">势力名</span>
              </span>
              <span class="chapter-hub__legend-item">
                <span class="chapter-hub__legend-swatch chapter-hub__entity-name chapter-hub__entity-name--link chapter-hub__entity-name--anchor-edit">角色更改</span>
                <span class="chapter-hub__legend-copy">此处更改角色信息</span>
              </span>
              <span class="chapter-hub__legend-item">
                <span class="chapter-hub__legend-swatch chapter-hub__entity-name chapter-hub__entity-name--faction chapter-hub__entity-name--anchor-edit-faction">势力更改</span>
                <span class="chapter-hub__legend-copy">此处更改势力信息</span>
              </span>
              <span class="chapter-hub__legend-item">
                <span class="chapter-hub__legend-swatch chapter-hub__foreshadow-mark">伏笔</span>
                <span class="chapter-hub__legend-copy">埋下的伏笔</span>
              </span>
              <span class="chapter-hub__legend-item">
                <span class="chapter-hub__legend-swatch chapter-hub__foreshadow-mark chapter-hub__foreshadow-mark--resolved">已回收</span>
                <span class="chapter-hub__legend-copy">已回收的铺垫</span>
              </span>
              <span class="chapter-hub__legend-item">
                <span class="chapter-hub__legend-swatch chapter-hub__foreshadow-mark chapter-hub__foreshadow-mark--fulfill">回收处</span>
                <span class="chapter-hub__legend-copy">回收伏笔的位置</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { EntityToken } from '../../../features/chapter-hub/types'
import type { Character, Faction } from '../../../types'

const props = defineProps<{
  content: string
  entityPreviewLines: EntityToken[][]
  shouldShowEntityOverlay: boolean
  isChapterTextareaFocused: boolean
  activeFlashFsKey?: string
  readonly?: boolean
}>()

const overlayReady = computed(() => {
  const lines = props.entityPreviewLines ?? []
  if (!lines.length) return false
  return lines.some((l) => (l?.length ?? 0) > 0)
})

function foreshadowAugmentClass(fs: EntityToken['foreshadow']): Record<string, boolean> {
  if (!fs) return {}
  return {
    'chapter-hub__foreshadow-mark': true,
    'chapter-hub__foreshadow-mark--resolved': fs.segment === 'plant' && fs.status === 'fulfilled',
    'chapter-hub__foreshadow-mark--fulfill': fs.segment === 'fulfill',
  }
}

function foreshadowFlashClass(fs: EntityToken['foreshadow']): Record<string, boolean> {
  if (!fs) return {}
  const activeKey = String(props.activeFlashFsKey ?? '').trim()
  if (!activeKey) return {}
  const tokenKey = `${fs.segment}:${fs.id}:${fs.fulfillmentId ?? ''}`
  return {
    'chapter-hub__foreshadow-mark--flash': tokenKey === activeKey,
  }
}

function foreshadowDataset(fs: NonNullable<EntityToken['foreshadow']>, token: EntityToken): Record<string, string> {
  return {
    'data-fs-key': `${fs.segment}:${fs.id}:${fs.fulfillmentId ?? ''}`,
    'data-range-start': String(token.range?.start ?? -1),
    'data-range-end': String(token.range?.end ?? -1),
  }
}

function stateZoneClass(
  zoneIndex: number | null | undefined,
  kind: 'character' | 'faction',
): Record<string, boolean> {
  if (typeof zoneIndex !== 'number' || !Number.isFinite(zoneIndex) || zoneIndex <= 0) return {}
  const cycle = ((Math.floor(zoneIndex) - 1) % 4) + 1
  return {
    'chapter-hub__entity-name--state-zone': true,
    'chapter-hub__entity-name--state-zone--character': kind === 'character',
    'chapter-hub__entity-name--state-zone--faction': kind === 'faction',
    [`chapter-hub__entity-name--state-zone-${cycle}`]: true,
  }
}

function onCharacterMouseEnter(e: MouseEvent, token: EntityToken): void {
  if (token.character) {
    const el = e.currentTarget as HTMLElement | null
    const rect = el ? pickAnchorRectFromWrappedInline(el, e.clientX, e.clientY) : null
    emit('entityEnter', e, token.character, rect, token.range ?? null)
  }
}

function onCharacterMouseLeave(token: EntityToken): void {
  if (token.character) emit('entityLeave')
}

function onFactionMouseEnter(e: MouseEvent, token: EntityToken): void {
  if (token.faction) {
    const el = e.currentTarget as HTMLElement | null
    const rect = el ? pickAnchorRectFromWrappedInline(el, e.clientX, e.clientY) : null
    emit('factionEnter', e, token.faction, rect, token.range ?? null)
  }
}

function pickAnchorRectFromWrappedInline(el: HTMLElement, x: number, y: number): DOMRect {
  const rects = Array.from(el.getClientRects())
  const hit = rects.find((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
  return (hit ?? rects[0] ?? el.getBoundingClientRect()) as DOMRect
}

function onFactionMouseLeave(token: EntityToken): void {
  if (token.faction) emit('entityLeave')
}

function focusTextareaAtPosition(pos: number): void {
  const ta = textareaRef.value
  if (!ta) return
  const clamped = Math.min(Math.max(0, pos), ta.value.length)
  const preservedScrollTop = ta.scrollTop
  ta.setSelectionRange(clamped, clamped)
  ta.focus({ preventScroll: true })
  ta.scrollTop = preservedScrollTop
}

function syncTextareaScrollFromOverlay(): void {
  const ta = textareaRef.value
  const overlay = overlayRef.value
  if (!ta || !overlay) return
  ta.scrollTop = overlay.scrollTop
}

function getOverlayClickTextOffset(el: HTMLElement, e: MouseEvent): number | null {
  const textLen = Math.max(0, Number(el.dataset.rangeEnd) - Number(el.dataset.rangeStart))
  if (!textLen) return 0

  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  if (typeof docAny.caretPositionFromPoint === 'function') {
    const caret = docAny.caretPositionFromPoint(e.clientX, e.clientY)
    if (caret && el.contains(caret.offsetNode)) {
      return Math.min(textLen, Math.max(0, caret.offset))
    }
  }

  if (typeof docAny.caretRangeFromPoint === 'function') {
    const range = docAny.caretRangeFromPoint(e.clientX, e.clientY)
    if (range && el.contains(range.startContainer)) {
      return Math.min(textLen, Math.max(0, range.startOffset))
    }
  }

  const rect = el.getBoundingClientRect()
  const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0
  return Math.round(textLen * ratio)
}

function getTokenCaretPositionFromPoint(e: MouseEvent): number | null {
  const overlay = overlayRef.value
  if (!overlay) return null

  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  const resolveFromNode = (node: Node | null, offset: number): number | null => {
    if (!node) return null
    const el =
      node instanceof Element
        ? node.closest<HTMLElement>('[data-range-start][data-range-end]')
        : node.parentElement?.closest<HTMLElement>('[data-range-start][data-range-end]') ?? null
    if (!el) return null
    const start = Number(el.dataset.rangeStart ?? '')
    const end = Number(el.dataset.rangeEnd ?? '')
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
    const len = Math.max(0, end - start)
    const local = Math.min(len, Math.max(0, offset))
    return start + local
  }

  if (typeof docAny.caretPositionFromPoint === 'function') {
    const caret = docAny.caretPositionFromPoint(e.clientX, e.clientY)
    const pos = resolveFromNode(caret?.offsetNode ?? null, caret?.offset ?? 0)
    if (pos != null) return pos
  }

  if (typeof docAny.caretRangeFromPoint === 'function') {
    const range = docAny.caretRangeFromPoint(e.clientX, e.clientY)
    const pos = resolveFromNode(range?.startContainer ?? null, range?.startOffset ?? 0)
    if (pos != null) return pos
  }

  const tokenEls = Array.from(overlay.querySelectorAll<HTMLElement>('[data-range-start][data-range-end]'))
  let bestPos: number | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const el of tokenEls) {
    const start = Number(el.dataset.rangeStart ?? '')
    const end = Number(el.dataset.rangeEnd ?? '')
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
    const rects = Array.from(el.getClientRects())
    for (const rect of rects) {
      const dx = e.clientX < rect.left ? rect.left - e.clientX : e.clientX > rect.right ? e.clientX - rect.right : 0
      const dy = e.clientY < rect.top ? rect.top - e.clientY : e.clientY > rect.bottom ? e.clientY - rect.bottom : 0
      const dist = dx * dx + dy * dy
      if (dist >= bestDist) continue
      const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0
      bestPos = start + Math.round((end - start) * ratio)
      bestDist = dist
    }
  }
  return bestPos
}

function onOverlayTextMouseDown(e: MouseEvent): void {
  if (props.isChapterTextareaFocused) return
  if (e.button !== 0) return
  // 失焦时 overlay 可能被滚动到不同位置；进入聚焦前先同步到 textarea，避免跳回上一次聚焦画面
  syncTextareaScrollFromOverlay()
  const rawTarget = e.target
  const interactiveEl =
    rawTarget instanceof Element
      ? rawTarget.closest<HTMLElement>(
          '.chapter-hub__entity-name--link, .chapter-hub__entity-name--faction, .chapter-hub__foreshadow-mark'
        )
      : rawTarget instanceof Node
        ? rawTarget.parentElement?.closest<HTMLElement>(
            '.chapter-hub__entity-name--link, .chapter-hub__entity-name--faction, .chapter-hub__foreshadow-mark'
          ) ?? null
        : null
  // 角色/势力/伏笔点击保持失焦交互（弹窗/跳转）
  if (interactiveEl) return

  e.preventDefault()

  const pos = getTokenCaretPositionFromPoint(e)
  if (pos == null) return
  focusTextareaAtPosition(pos)
}

function onOverlayScroll(): void {
  if (props.isChapterTextareaFocused) return
  syncTextareaScrollFromOverlay()
}

const emit = defineEmits<{
  input: [event: Event]
  scroll: [event: Event]
  keydown: [event: KeyboardEvent]
  keyup: [event: KeyboardEvent]
  mouseup: [event: MouseEvent]
  select: []
  focus: []
  blur: []
  entityEnter: [
    event: MouseEvent,
    character: Character,
    anchorRect: DOMRect | null,
    textRange: { start: number; end: number } | null,
  ]
  factionEnter: [
    event: MouseEvent,
    faction: Faction,
    anchorRect: DOMRect | null,
    textRange: { start: number; end: number } | null,
  ]
  entityLeave: []
  foreshadowEnter: [event: MouseEvent, meta: NonNullable<EntityToken['foreshadow']>]
  foreshadowLeave: []
  foreshadowClick: [meta: NonNullable<EntityToken['foreshadow']>]
  goCharacter: [character: Character, textRange: { start: number; end: number } | null]
  goFaction: [faction: Faction, textRange: { start: number; end: number } | null]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const overlayInnerRef = ref<HTMLElement | null>(null)

function syncEntityOverlayScroll(): void {
  const ta = textareaRef.value
  const overlay = overlayRef.value
  if (!ta || !overlay) return
  // 用原生 scrollTop 同步，比 translateY 更稳（可自动 clamped 到底部，避免底部空白）
  overlay.scrollTop = ta.scrollTop
}

function onTextareaScroll(e: Event): void {
  syncEntityOverlayScroll()
  emit('scroll', e)
}

function onTextareaInput(e: Event): void {
  emit('input', e)
}

function onTextareaKeyup(e: KeyboardEvent): void {
  emit('keyup', e)
}

function onTextareaMouseup(e: MouseEvent): void {
  emit('mouseup', e)
}

function onTextareaSelect(): void {
  emit('select')
}

function onTextareaFocus(): void {
  emit('focus')
}

function onTextareaBlur(): void {
  emit('blur')
}

function onEntityWheel(e: WheelEvent): void {
  const ta = textareaRef.value
  if (!ta) return
  ta.scrollTop += e.deltaY
  e.preventDefault()
  syncEntityOverlayScroll()
}

watch(
  () => [props.content, props.shouldShowEntityOverlay, props.entityPreviewLines],
  () => {
    void nextTick(() => {
      syncEntityOverlayScroll()
    })
  },
  { deep: true },
)

watch(
  () => props.isChapterTextareaFocused,
  (focused) => {
    if (!focused) {
      // 从聚焦切回失焦时，确保 overlay 与 textarea 的滚动位置一致。
      void nextTick(() => syncEntityOverlayScroll())
    }
  },
)

let textareaResizeObserver: ResizeObserver | null = null

onMounted(() => {
  const ta = textareaRef.value
  if (ta && typeof ResizeObserver !== 'undefined') {
    textareaResizeObserver = new ResizeObserver(() => {
      syncEntityOverlayScroll()
    })
    textareaResizeObserver.observe(ta)
  }
})

onUnmounted(() => {
  textareaResizeObserver?.disconnect()
  textareaResizeObserver = null
})

defineExpose({ textareaRef })
</script>

