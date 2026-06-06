<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const isDesktop = ref(false)
const isMaximized = ref(false)
let appWindow: import('@tauri-apps/api/window').Window | null = null
let unlisten: (() => void) | null = null

onMounted(async () => {
  const tauri = (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  if (!tauri) return
  isDesktop.value = true
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  appWindow = getCurrentWindow()
  isMaximized.value = await appWindow.isMaximized()
  unlisten = await appWindow.onResized(async () => {
    if (appWindow) isMaximized.value = await appWindow.isMaximized()
  })
})

onUnmounted(() => {
  unlisten?.()
  unlisten = null
})

const minimize = () => appWindow?.minimize()
const toggleMaximize = () => appWindow?.toggleMaximize()
const close = () => appWindow?.close()
</script>

<template>
  <div v-if="isDesktop" class="window-controls">
    <button type="button" class="window-controls__btn" aria-label="最小化" @click="minimize">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="0" y="4.5" width="10" height="1" fill="currentColor" /></svg>
    </button>
    <button type="button" class="window-controls__btn" :aria-label="isMaximized ? '还原' : '最大化'" @click="toggleMaximize">
      <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" /></svg>
      <svg v-else width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" /><path d="M2.5 2.5 V0.5 H9.5 V7.5 H7.5" fill="none" stroke="currentColor" /></svg>
    </button>
    <button type="button" class="window-controls__btn window-controls__btn--close" aria-label="关闭" @click="close">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0.5 0.5 L9.5 9.5 M9.5 0.5 L0.5 9.5" stroke="currentColor" /></svg>
    </button>
  </div>
</template>
