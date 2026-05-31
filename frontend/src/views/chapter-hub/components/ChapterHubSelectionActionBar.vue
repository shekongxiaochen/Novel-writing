<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="chapter-hub__selection-action-bar"
      :style="barStyle"
      @mousedown.prevent
    >
      <button
        type="button"
        class="chapter-hub__selection-action-btn"
        title="添加为角色"
        @click="emit('addCharacter')"
      >
        <svg class="chapter-hub__selection-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>角色</span>
      </button>
      <div class="chapter-hub__selection-action-sep" />
      <button
        type="button"
        class="chapter-hub__selection-action-btn"
        :disabled="!canAddAsFaction"
        :title="!canAddAsFaction ? '该名称已是角色，不能创建为势力' : '添加为势力'"
        @click="emit('addFaction')"
      >
        <svg class="chapter-hub__selection-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>势力</span>
      </button>
      <div class="chapter-hub__selection-action-sep" />
      <button
        type="button"
        class="chapter-hub__selection-action-btn"
        title="添加为伏笔"
        @click="emit('addForeshadow')"
      >
        <svg class="chapter-hub__selection-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span>伏笔</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  open: boolean
  x: number
  y: number
  canAddAsFaction: boolean
}>()

const emit = defineEmits<{
  addCharacter: []
  addFaction: []
  addForeshadow: []
}>()

const barStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}))
</script>
