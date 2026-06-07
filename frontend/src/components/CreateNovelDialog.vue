<template>
  <Transition name="confirm">
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
            <label class="create-novel-dialog__field">
              书名
              <input v-model="form.title" class="create-novel-dialog__input" required maxlength="60" placeholder="输入书名" />
            </label>

            <label class="create-novel-dialog__field create-novel-dialog__field--delay">
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
              <button type="submit" class="btn-primary create-novel-dialog__submit" :disabled="isCreating || !form.title.trim()">
                {{ isCreating ? '创建中...' : '创建并进入' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Transition>
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
  gap: 18px;
  padding: 22px 22px 22px;
}

.create-novel-dialog__form label {
  display: grid;
  gap: 7px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.create-novel-dialog__field {
  animation: create-novel-field-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: 0.08s;
}

.create-novel-dialog__field--delay {
  animation-delay: 0.15s;
}

@keyframes create-novel-field-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.create-novel-dialog__input {
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 50%, transparent);
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  color: var(--color-text);
  font-size: 0.94rem;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}

.create-novel-dialog__input:hover {
  border-color: color-mix(in srgb, var(--color-primary) 38%, var(--color-border-strong));
}

.create-novel-dialog__input::placeholder {
  color: color-mix(in srgb, var(--color-text-muted) 70%, transparent);
}

.create-novel-dialog__input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--color-primary) 65%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.create-novel-dialog__textarea {
  min-height: 104px;
  resize: vertical;
  line-height: 1.6;
}

.create-novel-dialog__actions {
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  padding-top: 0;
  border-top: 0;
}

.create-novel-dialog__submit {
  min-width: 132px;
}

@media (max-width: 640px) {
  .create-novel-dialog__actions {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .create-novel-dialog__field {
    animation: none;
  }
}
</style>
