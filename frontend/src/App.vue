<template>
  <main class="app-shell">
    <header v-show="!focusMode" ref="topbarRef" class="topbar">
      <div>
        <h1 class="topbar__brand">小说结构理清助手</h1>
      </div>
      <div class="topbar__actions">
        <button
          type="button"
          class="focus-toggle"
          title="专注写作（隐藏顶栏）"
          @click="toggleFocusMode"
        >
          <span class="focus-toggle__icon" aria-hidden="true">⛶</span>
          <span class="focus-toggle__text">专注</span>
        </button>
        <button type="button" class="theme-toggle" :title="theme === 'dark' ? '切换为浅色' : '切换为暗色'" @click="toggleTheme">
          <span class="theme-toggle__icon" aria-hidden="true">{{ theme === 'dark' ? '☀' : '☽' }}</span>
          <span class="theme-toggle__text">{{ theme === 'dark' ? '浅色' : '暗色' }}</span>
        </button>
      </div>
    </header>
    <Teleport to="body">
      <Transition name="floating-chrome-fade">
        <div
          v-if="showFloatingChrome"
          class="floating-chrome"
          role="toolbar"
          aria-label="快捷操作"
        >
          <RouterLink
            v-if="floatingBack"
            class="floating-chrome__btn floating-chrome__link"
            :title="floatingBack.label"
            :to="floatingBack.to"
          >
            ← {{ floatingBack.label }}
          </RouterLink>
          <button
            v-if="!focusMode"
            type="button"
            class="floating-chrome__btn"
            title="专注模式"
            @click="toggleFocusMode"
          >
            ⛶
          </button>
          <button
            v-else
            type="button"
            class="floating-chrome__btn floating-chrome__btn--primary"
            title="退出专注（Esc）"
            @click="setFocusMode(false)"
          >
            退出
          </button>
          <button
            type="button"
            class="floating-chrome__btn"
            :title="theme === 'dark' ? '切换为浅色' : '切换为暗色'"
            @click="toggleTheme"
          >
            {{ theme === 'dark' ? '☀' : '☽' }}
          </button>
        </div>
      </Transition>
    </Teleport>
    <RouterView />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { focusMode, setFocusMode, toggleFocusMode } from './composables/useFocusMode'
import { showFloatingChrome, useFloatingChromeRegistration } from './composables/useFloatingChrome'
import { theme, toggleTheme } from './composables/useTheme'

const route = useRoute()
const topbarRef = ref<HTMLElement | null>(null)
useFloatingChromeRegistration(topbarRef)

const floatingBack = computed(() => {
  const n = route.name
  if (n === 'novel-workspace') return { to: '/', label: '列表' }
  if (n === 'novel-chapter-writing') {
    const id = String(route.params.novelId ?? '')
    return id ? { to: `/novels/${id}`, label: '工作台' } : null
  }
  return null
})

function onGlobalKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && focusMode.value) {
    e.preventDefault()
    setFocusMode(false)
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>
