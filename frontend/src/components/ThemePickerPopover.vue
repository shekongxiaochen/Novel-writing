<template>
  <Teleport to="body">
    <Transition name="theme-picker-fade">
      <div v-if="open" class="theme-picker-overlay" @pointerdown.self="close">
        <section
          ref="panelRef"
          class="theme-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="theme-picker-title"
          tabindex="-1"
          @keydown="onKeydown"
          @pointerdown.stop
        >
          <header class="theme-picker__head">
            <p class="theme-picker__eyebrow">Color Theme</p>
            <h2 id="theme-picker-title" class="theme-picker__title">选择颜色主题</h2>
          </header>

          <div class="theme-picker__list" role="listbox" aria-label="颜色主题">
            <button
              v-for="(option, index) in themeOptions"
              :key="option.id"
              :ref="(el) => setOptionRef(el, index)"
              type="button"
              class="theme-picker__option"
              :class="{ 'is-active': option.id === activeTheme, 'is-focused': index === focusIndex }"
              role="option"
              :aria-selected="option.id === activeTheme"
              @click="choose(option.id)"
              @focus="focusIndex = index"
            >
              <span class="theme-picker__preview" aria-hidden="true" :style="previewStyle(option)">
                <span class="theme-picker__preview-panel"></span>
                <span class="theme-picker__preview-line theme-picker__preview-line--strong"></span>
                <span class="theme-picker__preview-line"></span>
              </span>
              <span class="theme-picker__option-text">
                <span class="theme-picker__option-title">{{ option.label }}</span>
                <span class="theme-picker__option-desc">{{ option.description }}</span>
              </span>
              <span v-if="option.id === activeTheme" class="theme-picker__check" aria-hidden="true">✓</span>
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { setTheme, theme, themeOptions } from '../composables/useTheme'
import type { Theme, ThemeOption } from '../composables/useTheme'

const props = defineProps<{
  open: boolean
  returnFocusEl?: HTMLElement | null
}>()

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const optionRefs = ref<Array<HTMLButtonElement | null>>([])
const focusIndex = ref(0)
const activeTheme = computed(() => theme.value)

function setOptionRef(el: Element | null, index: number): void {
  optionRefs.value[index] = el instanceof HTMLButtonElement ? el : null
}

function previewStyle(option: ThemeOption): Record<string, string> {
  return {
    '--theme-preview-bg': option.preview.bg,
    '--theme-preview-surface': option.preview.surface,
    '--theme-preview-text': option.preview.text,
    '--theme-preview-accent': option.preview.accent,
  }
}

function focusOption(index: number): void {
  const count = themeOptions.length
  focusIndex.value = (index + count) % count
  optionRefs.value[focusIndex.value]?.focus()
}

function close(): void {
  emit('close')
  nextTick(() => props.returnFocusEl?.focus())
}

function choose(nextTheme: Theme): void {
  setTheme(nextTheme)
  close()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusOption(focusIndex.value + 1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusOption(focusIndex.value - 1)
    return
  }
  if (event.key === 'Home') {
    event.preventDefault()
    focusOption(0)
    return
  }
  if (event.key === 'End') {
    event.preventDefault()
    focusOption(themeOptions.length - 1)
  }
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    const currentIndex = themeOptions.findIndex((option) => option.id === theme.value)
    focusIndex.value = Math.max(0, currentIndex)
    await nextTick()
    optionRefs.value[focusIndex.value]?.focus() ?? panelRef.value?.focus()
  },
)
</script>
