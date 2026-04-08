<template>
  <header ref="rootRef" class="header-row chapter-hub__header">
    <h1 class="chapter-hub__title chapter-hub__title--compact">
      <RouterLink :to="workspaceLink" class="chapter-hub__crumb-link">{{ novelTitle }}</RouterLink>
      <span class="chapter-hub__title-sep" aria-hidden="true">·</span>
      <span>章节写作</span>
    </h1>
    <RouterLink class="chapter-hub__back link-back" :to="workspaceLink">工作台</RouterLink>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

defineProps<{
  novelTitle: string
  workspaceLink: string
}>()

const rootRef = ref<HTMLElement | null>(null)
defineExpose({ rootRef })
</script>
