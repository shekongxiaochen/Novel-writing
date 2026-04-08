<template>
  <Teleport to="body">
    <div
      v-if="open && list.length > 0"
      class="chapter-hub__name-suggest"
      :class="{ 'chapter-hub__name-suggest--up': direction === 'up' }"
      :style="panelStyle"
    >
      <button
        v-for="(item, idx) in list"
        :key="item.id"
        type="button"
        class="chapter-hub__name-suggest-item"
        :class="{ active: idx === activeIndex }"
        @mouseenter="emit('update:activeIndex', idx)"
        @mousedown.prevent="emit('apply', item.name)"
      >
        <span class="chapter-hub__name-suggest-name">{{ item.name }}</span>
        <span v-if="item.kind === 'faction'" class="chapter-hub__name-suggest-kind">势力</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  list: Array<{ id: string; name: string; kind: 'character' | 'faction' }>
  activeIndex: number
  direction: 'down' | 'up'
  panelStyle: Record<string, string>
}>()

const emit = defineEmits<{
  'update:activeIndex': [index: number]
  apply: [name: string]
}>()
</script>
