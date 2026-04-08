<template>
  <section class="card chapter-hub__top chapter-hub__composer">
    <h2 class="chapter-hub__composer-title">新建章节</h2>
    <form class="chapter-hub__composer-form" @submit.prevent="emit('submit')">
      <div class="chapter-hub__composer-grid">
        <label class="chapter-hub__field">
          <span class="chapter-hub__field-label">章节标题</span>
          <input v-model="title" class="chapter-hub__input" maxlength="80" />
        </label>
        <label class="chapter-hub__field">
          <span class="chapter-hub__field-label">章节笔记</span>
          <input v-model="notes" class="chapter-hub__input" maxlength="200" />
        </label>
      </div>
      <div class="chapter-hub__composer-actions">
        <button type="submit" class="chapter-hub__btn chapter-hub__btn--primary">添加章节</button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
const title = defineModel<string>('title', { required: true })
const notes = defineModel<string>('notes', { required: true })

const emit = defineEmits<{
  submit: []
}>()
</script>
