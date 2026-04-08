<template>
  <div v-show="visible" class="chapter-hub__outline">
    <p class="chapter-hub__outline-title">大纲</p>
    <div class="checklist chapter-hub__checklist" v-if="outlineItems.length > 0">
      <label v-for="o in outlineItems" :key="o.id" class="check-item">
        <input
          type="checkbox"
          :checked="chapter.outlineItemIds.includes(o.id)"
          @change="emit('toggleOutlineItem', o.id)"
        />
        <span>#{{ o.order }} · {{ o.title }}</span>
      </label>
    </div>
    <p v-else class="chapter-hub__outline-empty muted">暂无节点，请在工作台大纲中添加。</p>
  </div>
</template>

<script setup lang="ts">
import type { Chapter, OutlineItem } from '../../../types'

defineProps<{
  chapter: Chapter
  outlineItems: OutlineItem[]
  visible: boolean
}>()

const emit = defineEmits<{
  toggleOutlineItem: [outlineId: string]
}>()
</script>
