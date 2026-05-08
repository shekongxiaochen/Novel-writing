<template>
  <aside class="chapter-hub__sidebar chapter-hub__toc" :class="{ 'chapter-hub__sidebar--collapsed': sidebarCollapsed }">
    <div class="chapter-hub__toc-head">
      <h3 class="chapter-hub__sidebar-title">目录</h3>
      <button
        type="button"
        class="chapter-hub__toc-collapse-btn"
        :title="sidebarCollapsed ? '展开目录' : '折叠目录'"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <span class="chapter-hub__toc-collapse-icon" :class="{ 'is-collapsed': sidebarCollapsed }" aria-hidden="true"></span>
      </button>
    </div>
    <div
      class="chapter-hub__list"
      :class="{ 'is-collapsed': sidebarCollapsed }"
      :aria-hidden="sidebarCollapsed ? 'true' : 'false'"
    >
      <button
        v-for="c in chapters"
        :key="c.id"
        type="button"
        class="chapter-link chapter-hub__toc-item"
        :class="{ active: selectedChapterId === c.id }"
        :title="`第 ${c.chapterNo} 章：${c.title}`"
        @click="selectedChapterId = c.id"
      >
        <span class="chapter-hub__toc-no">第 {{ c.chapterNo }} 章</span>
        <span class="chapter-hub__toc-name">{{ c.title }}</span>
        <span class="chapter-hub__toc-words">{{ chapterWordCount(c.content) }} 字</span>
      </button>
    </div>
    <div
      class="chapter-hub__mini-list"
      :class="{ 'is-active': sidebarCollapsed }"
      :aria-hidden="sidebarCollapsed ? 'false' : 'true'"
    >
      <button
        v-for="c in chapters"
        :key="`mini-${c.id}`"
        type="button"
        class="chapter-hub__toc-mini-item"
        :class="{ active: selectedChapterId === c.id }"
        :title="`第 ${c.chapterNo} 章：${c.title}`"
        @click="selectedChapterId = c.id"
      >
        {{ c.chapterNo }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Chapter } from '../../../types'

defineProps<{
  chapters: Chapter[]
}>()

const selectedChapterId = defineModel<string>('selectedChapterId', { required: true })
const sidebarCollapsed = defineModel<boolean>('sidebarCollapsed', { required: true })

function chapterWordCount(content?: string | null): number {
  return String(content ?? '').replace(/\s/g, '').length
}
</script>
