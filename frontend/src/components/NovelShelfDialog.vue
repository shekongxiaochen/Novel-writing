<template>
  <Transition name="confirm">
    <div v-if="open" class="confirm-overlay" @pointerdown.self="emit('close')">
    <div class="confirm-dialog novel-shelf-dialog" role="dialog" aria-modal="true" @pointerdown.stop>
      <div class="confirm-dialog__accent" aria-hidden="true" />
      <div class="confirm-dialog__body novel-shelf-dialog__body">
        <div class="novel-shelf-dialog__head">
          <div>
            <p class="novel-shelf-dialog__eyebrow">Library</p>
            <h2 class="confirm-dialog__title">书籍</h2>
          </div>
          <div class="novel-shelf-dialog__head-actions">
            <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="emit('create')">新建书籍</button>
            <button type="button" class="novel-shelf-dialog__close" aria-label="关闭" @click="emit('close')">×</button>
          </div>
        </div>

        <p v-if="novels.length === 0" class="confirm-dialog__message">还没有书。</p>

        <ul v-else class="novel-shelf-dialog__list">
          <li v-for="novel in novels" :key="novel.id" class="novel-shelf-dialog__item" :class="{ 'is-current': novel.id === currentNovelId }">
            <div class="novel-shelf-dialog__item-main">
              <strong class="novel-shelf-dialog__item-title">{{ novel.title || '未命名书籍' }}</strong>
              <p class="novel-shelf-dialog__item-summary">{{ novel.summary || '暂无简介' }}</p>
            </div>
            <div class="novel-shelf-dialog__item-actions">
              <span v-if="novel.id === currentNovelId" class="novel-shelf-dialog__badge">当前</span>
              <button
                v-else
                type="button"
                class="confirm-dialog__btn confirm-dialog__btn--ghost novel-shelf-dialog__enter"
                @click="emit('select', novel.id)"
              >
                打开
              </button>
              <button
                type="button"
                class="confirm-dialog__btn confirm-dialog__btn--ghost novel-shelf-dialog__delete"
                @click="emit('delete', novel.id)"
              >
                删除
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Novel } from '../types'

defineProps<{
  open: boolean
  novels: Novel[]
  currentNovelId: string
}>()

const emit = defineEmits<{
  close: []
  create: []
  select: [novelId: string]
  delete: [novelId: string]
}>()
</script>

<style scoped>
.novel-shelf-dialog {
  width: min(620px, calc(100vw - 28px));
}

.novel-shelf-dialog__body {
  padding: 0;
}

.novel-shelf-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 22px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 28%, transparent);
}

.novel-shelf-dialog__eyebrow {
  margin: 0 0 6px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
}

.novel-shelf-dialog__head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.novel-shelf-dialog__close {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.35rem;
  line-height: 1;
}

.novel-shelf-dialog__close:hover {
  background: color-mix(in srgb, var(--color-surface-muted) 68%, transparent);
  color: var(--color-text);
}

.novel-shelf-dialog__list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 16px 22px 22px;
  list-style: none;
}

.novel-shelf-dialog__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 14px 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 30%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
}

.novel-shelf-dialog__item.is-current {
  border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border-strong) 68%);
  background: color-mix(in srgb, var(--color-primary-soft) 28%, var(--color-surface) 72%);
}

.novel-shelf-dialog__item-main {
  min-width: 0;
}

.novel-shelf-dialog__item-title {
  display: block;
  margin-bottom: 6px;
}

.novel-shelf-dialog__item-summary {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.novel-shelf-dialog__item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.novel-shelf-dialog__badge {
  padding: 0 10px;
  line-height: 32px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary-soft) 42%, transparent);
  color: var(--color-primary);
  font-size: 0.84rem;
  font-weight: 700;
}

.novel-shelf-dialog__delete {
  color: var(--danger-text);
}

@media (max-width: 640px) {
  .novel-shelf-dialog__item {
    grid-template-columns: 1fr;
  }

  .novel-shelf-dialog__item-actions,
  .novel-shelf-dialog__head-actions {
    flex-wrap: wrap;
  }
}
</style>
