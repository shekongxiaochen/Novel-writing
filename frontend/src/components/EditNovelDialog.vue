<template>
  <Transition name="confirm">
    <div v-if="open" class="confirm-overlay" @pointerdown.self="emit('close')">
      <div class="confirm-dialog create-novel-dialog" role="dialog" aria-modal="true" @pointerdown.stop>
        <div class="confirm-dialog__accent" aria-hidden="true" />
        <div class="confirm-dialog__body create-novel-dialog__body">
          <div class="create-novel-dialog__head">
            <div>
              <h2 class="confirm-dialog__title">编辑书籍</h2>
            </div>
            <button type="button" class="create-novel-dialog__close" aria-label="关闭" @click="emit('close')">×</button>
          </div>

          <form class="create-novel-dialog__form" @submit.prevent="handleSave">
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
              <button type="submit" class="btn-primary create-novel-dialog__submit" :disabled="!form.title.trim()">
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { updateNovel } from '../lib/storage'
import type { Novel } from '../types'

const props = defineProps<{
  open: boolean
  novel: Novel | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const form = reactive({
  title: '',
  summary: '',
})

watch(
  () => props.open,
  (open) => {
    if (!open || !props.novel) return
    form.title = props.novel.title
    form.summary = props.novel.summary
  },
)

function handleSave(): void {
  if (!props.novel || !form.title.trim()) return
  updateNovel(props.novel.id, {
    title: form.title.trim(),
    summary: form.summary.trim(),
  })
  emit('saved')
  emit('close')
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
.create-novel-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}
.create-novel-dialog__close:hover {
  background: color-mix(in srgb, var(--color-surface-muted) 68%, transparent);
  color: var(--color-text);
}
.create-novel-dialog__form {
  display: grid;
  gap: 18px;
  padding: 22px;
}
.create-novel-dialog__form label {
  display: grid;
  gap: 7px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}
.create-novel-dialog__field {
  animation: edit-novel-field-in 0.42s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: 0.08s;
}
.create-novel-dialog__field--delay {
  animation-delay: 0.15s;
}
@keyframes edit-novel-field-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.create-novel-dialog__input {
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 50%, transparent);
  background: color-mix(in srgb, var(--color-surface) 96%, transparent);
  color: var(--color-text);
  font-size: 0.94rem;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
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
</style>
