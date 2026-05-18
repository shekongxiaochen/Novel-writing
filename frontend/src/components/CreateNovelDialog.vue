<template>
  <div v-if="open" class="confirm-overlay" @pointerdown.self="emit('close')">
    <div class="confirm-dialog create-novel-dialog" role="dialog" aria-modal="true" @pointerdown.stop>
      <div class="confirm-dialog__accent" aria-hidden="true" />
      <div class="confirm-dialog__body create-novel-dialog__body">
        <div class="create-novel-dialog__head">
          <div>
            <p class="create-novel-dialog__eyebrow">New Book</p>
            <h2 class="confirm-dialog__title">新建书籍</h2>
          </div>
          <button type="button" class="create-novel-dialog__close" aria-label="关闭" @click="emit('close')">×</button>
        </div>

        <form class="create-novel-dialog__form" @submit.prevent="handleCreate">
          <label>
            书名
            <input v-model="form.title" class="create-novel-dialog__input" required maxlength="60" placeholder="输入书名" />
          </label>

          <label>
            简介
            <textarea
              v-model="form.summary"
              class="create-novel-dialog__input create-novel-dialog__textarea"
              rows="4"
              maxlength="500"
              placeholder="一句话简介"
            />
          </label>

          <div class="confirm-dialog__actions create-novel-dialog__actions">
            <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="emit('close')">取消</button>
            <button type="submit" class="confirm-dialog__btn confirm-dialog__btn--danger" :disabled="isCreating">
              {{ isCreating ? '创建中...' : '创建并进入' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { createNovel } from '../lib/storage'
import type { NewNovelInput } from '../types'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  close: []
  created: [novelId: string]
}>()

const isCreating = ref(false)
const form = reactive<Pick<NewNovelInput, 'title' | 'summary'>>({
  title: '',
  summary: '',
})

watch(
  () => props.open,
  (open) => {
    if (open) return
    resetForm()
    isCreating.value = false
  },
)

function resetForm(): void {
  form.title = ''
  form.summary = ''
}

function handleCreate(): void {
  if (isCreating.value || !form.title.trim()) return
  isCreating.value = true
  try {
    const novel = createNovel({
      title: form.title,
      summary: form.summary,
      genre: '',
      perspective: '',
      tone: '',
      isMultiLineNarrative: false,
    })
    resetForm()
    emit('created', novel.id)
  } finally {
    isCreating.value = false
  }
}
</script>

<style scoped>
.create-novel-dialog {
  width: min(560px, calc(100vw - 28px));
}

.create-novel-dialog__body {
  padding: 0;
}

.create-novel-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 22px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 28%, transparent);
}

.create-novel-dialog__eyebrow {
  margin: 0 0 6px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.create-novel-dialog__close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.35rem;
  line-height: 1;
}

.create-novel-dialog__close:hover {
  background: color-mix(in srgb, var(--color-surface-muted) 68%, transparent);
  color: var(--color-text);
}

.create-novel-dialog__form {
  display: grid;
  gap: 14px;
  padding: 20px 22px 22px;
}

.create-novel-dialog__input {
  min-height: 44px;
}

.create-novel-dialog__textarea {
  min-height: 96px;
  resize: vertical;
}

.create-novel-dialog__actions {
  justify-content: flex-end;
  margin-top: 6px;
}

@media (max-width: 640px) {
  .create-novel-dialog__actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
