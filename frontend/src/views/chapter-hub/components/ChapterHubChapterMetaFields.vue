<template>
  <div v-show="visible" class="chapter-hub__meta">
    <label class="chapter-hub__field">
      <span class="chapter-hub__field-label">章节标题</span>
      <input
        type="text"
        class="chapter-hub__input"
        :value="chapter.title"
        maxlength="80"
        @change="emit('titleChange', $event)"
      />
    </label>
    <label class="chapter-hub__field">
      <span class="chapter-hub__field-label">章节笔记</span>
      <input
        class="chapter-hub__input"
        :value="chapter.notes"
        maxlength="200"
        @change="emit('notesChange', $event)"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import type { Chapter } from '../../../types'

defineProps<{
  chapter: Chapter
  visible: boolean
}>()

const emit = defineEmits<{
  titleChange: [event: Event]
  notesChange: [event: Event]
}>()
</script>
