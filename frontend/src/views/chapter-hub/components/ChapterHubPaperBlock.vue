<template>
  <div class="chapter-hub__write">
    <div class="chapter-hub__paper-column">
      <div class="paper-desk paper-desk--hub">
        <label class="chapter-hub__paper-label">
          <span class="visually-hidden">正文编辑区</span>
          <div
            class="chapter-hub__textarea-wrap chapter-hub__textarea-wrap--overlay"
            :class="{
              'chapter-hub__textarea-wrap--writing': isChapterTextareaFocused,
              'chapter-hub__textarea-wrap--overlay-show': shouldShowEntityOverlay,
            }"
          >
            <div class="chapter-hub__entity-overlay" v-show="shouldShowEntityOverlay">
              <div ref="overlayInnerRef" class="chapter-hub__entity-overlay-inner">
                <template v-for="(line, lineIdx) in entityPreviewLines" :key="`line-${lineIdx}`">
                  <template v-for="(token, tokenIdx) in line" :key="`tok-${lineIdx}-${tokenIdx}`">
                    <span
                      v-if="token.character"
                      class="chapter-hub__entity-name chapter-hub__entity-name--link"
                      role="link"
                      tabindex="0"
                      @wheel="onEntityWheel"
                      @mousedown.prevent
                      @mouseenter="emit('entityEnter', $event, token.character!)"
                      @mouseleave="emit('entityLeave')"
                      @click.stop.prevent="emit('goCharacter', token.character!)"
                      @keydown.enter.prevent="emit('goCharacter', token.character!)"
                    >
                      {{ token.text }}
                    </span>
                    <span
                      v-else-if="token.faction"
                      class="chapter-hub__entity-name chapter-hub__entity-name--faction"
                      role="link"
                      tabindex="0"
                      @wheel="onEntityWheel"
                      @mousedown.prevent
                      @mouseenter="emit('factionEnter', $event, token.faction!)"
                      @mouseleave="emit('entityLeave')"
                      @click.stop.prevent="emit('goFaction', token.faction!)"
                      @keydown.enter.prevent="emit('goFaction', token.faction!)"
                    >
                      {{ token.text }}
                    </span>
                    <span v-else>{{ token.text }}</span>
                  </template>
                  <br v-if="lineIdx < entityPreviewLines.length - 1" />
                </template>
              </div>
            </div>
            <textarea
              ref="textareaRef"
              class="textarea textarea-paper textarea-paper--hub chapter-hub__textarea"
              :value="content"
              spellcheck="false"
              @scroll="syncEntityOverlayScroll"
              @input="emit('input', $event)"
              @keydown="emit('keydown', $event)"
              @keyup="emit('keyup', $event)"
              @mouseup="emit('mouseup', $event)"
              @select="emit('select')"
              @focus="emit('focus')"
              @blur="emit('blur')"
            />
          </div>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { EntityToken } from '../../../features/chapter-hub/types'
import type { Character, Faction } from '../../../types'

const props = defineProps<{
  content: string
  entityPreviewLines: EntityToken[][]
  shouldShowEntityOverlay: boolean
  isChapterTextareaFocused: boolean
}>()

const emit = defineEmits<{
  input: [event: Event]
  keydown: [event: KeyboardEvent]
  keyup: [event: KeyboardEvent]
  mouseup: [event: MouseEvent]
  select: []
  focus: []
  blur: []
  entityEnter: [event: MouseEvent, character: Character]
  factionEnter: [event: MouseEvent, faction: Faction]
  entityLeave: []
  goCharacter: [character: Character]
  goFaction: [faction: Faction]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const overlayInnerRef = ref<HTMLElement | null>(null)

/** 仅由 textarea 滚动；高亮层用位移对齐，避免与 overlay 双滚动条抢滚轮导致卡死 */
function syncEntityOverlayScroll(): void {
  const ta = textareaRef.value
  const inner = overlayInnerRef.value
  if (!ta || !inner) return
  inner.style.transform = `translateY(${-ta.scrollTop}px)`
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
    void nextTick(() => syncEntityOverlayScroll())
  }
)

let textareaResizeObserver: ResizeObserver | null = null

onMounted(() => {
  const ta = textareaRef.value
  if (ta && typeof ResizeObserver !== 'undefined') {
    textareaResizeObserver = new ResizeObserver(() => syncEntityOverlayScroll())
    textareaResizeObserver.observe(ta)
  }
})

onUnmounted(() => {
  textareaResizeObserver?.disconnect()
  textareaResizeObserver = null
})

defineExpose({ textareaRef })
</script>
