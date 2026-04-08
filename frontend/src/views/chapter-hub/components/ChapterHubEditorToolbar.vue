<template>
  <div class="chapter-hub__editor-head">
    <div class="chapter-hub__editor-titleblock">
      <h3 class="chapter-hub__editor-heading">第 {{ chapter.chapterNo }} 章</h3>
      <div class="chapter-hub__editor-metrics" aria-label="字数与状态">
        <span class="chapter-hub__stat" title="非空白字数">
          <span class="chapter-hub__stat-value">{{ wordCount }}</span>
          <span class="chapter-hub__stat-label">字</span>
        </span>
        <span class="chapter-hub__status" :data-done="chapter.status === 'done' ? '1' : '0'">
          {{ chapter.status === 'done' ? '已完成' : '草稿' }}
        </span>
      </div>
    </div>
    <div class="chapter-hub__editor-buttons">
      <button
        type="button"
        class="chapter-hub__btn chapter-hub__btn--ghost"
        :title="hideMeta ? '显示标题与笔记' : '隐藏标题与笔记'"
        @click="emit('toggleMeta')"
      >
        {{ hideMeta ? '信息' : '隐藏' }}
      </button>
      <button
        type="button"
        class="chapter-hub__btn chapter-hub__btn--ghost"
        :title="hideOutline ? '显示大纲勾选' : '隐藏大纲'"
        @click="emit('toggleOutline')"
      >
        {{ hideOutline ? '大纲' : '隐藏' }}
      </button>
      <button type="button" class="chapter-hub__btn chapter-hub__btn--ghost" @click="emit('toggleDone')">
        {{ chapter.status === 'done' ? '草稿' : '完成' }}
      </button>
      <button type="button" class="chapter-hub__btn chapter-hub__btn--danger" @click="emit('deleteChapter')">
        删除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Chapter } from '../../../types'

defineProps<{
  chapter: Chapter
  wordCount: number
  hideMeta: boolean
  hideOutline: boolean
}>()

const emit = defineEmits<{
  toggleMeta: []
  toggleOutline: []
  toggleDone: []
  deleteChapter: []
}>()
</script>
