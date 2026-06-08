<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="modelValue" class="confirm-overlay announcement-overlay" role="presentation">
        <div
          ref="panelRef"
          class="confirm-dialog announcement-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @keydown.escape.prevent="close"
        >
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body">
            <div class="confirm-dialog__head">
              <span class="confirm-dialog__icon" aria-hidden="true">公告</span>
              <div class="confirm-dialog__head-text">
                <h2 :id="titleId" class="confirm-dialog__title">{{ title || '公告' }}</h2>
              </div>
            </div>
            <div v-if="body" class="announcement-dialog__message">{{ body }}</div>
            <div v-if="image" class="announcement-dialog__image-wrap">
              <img :src="image" alt="公告图片" class="announcement-dialog__image" />
            </div>
            <div class="confirm-dialog__actions announcement-dialog__actions">
              <label class="announcement-dialog__check">
                <input type="checkbox" v-model="dontShowAgain" />
                <span>不再提示</span>
              </label>
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="close">
                知道了
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, ref, useId, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  body: string
  image?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: [dontShowAgain: boolean]
}>()

const panelRef = ref<HTMLElement | null>(null)
const dontShowAgain = ref(false)
const idBase = useId()
const titleId = `${idBase}-ann-title`

function close(): void {
  emit('close', dontShowAgain.value)
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  async (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      dontShowAgain.value = false
      await nextTick()
      panelRef.value?.focus()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<style scoped>
.announcement-dialog {
  max-width: 460px;
  display: flex;
  flex-direction: column;
}

.announcement-dialog :deep(.confirm-dialog__body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.announcement-dialog__message {
  margin: 16px 0 4px;
  max-height: min(52vh, 460px);
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9375rem;
  line-height: 1.75;
  color: var(--color-text);
  /* 自定义滚动条，贴合主题 */
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-border-strong) 80%, transparent) transparent;
}

.announcement-dialog__message::-webkit-scrollbar {
  width: 8px;
}

.announcement-dialog__message::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-border-strong) 70%, transparent);
  border-radius: 999px;
}

.announcement-dialog__image-wrap {
  margin: 14px 0 4px;
  display: flex;
  justify-content: center;
}

.announcement-dialog__image {
  max-width: 100%;
  max-height: min(40vh, 360px);
  border-radius: 10px;
  border: 1px solid var(--color-border);
  object-fit: contain;
}

.announcement-dialog__actions {
  align-items: center;
  justify-content: space-between;
}

.announcement-dialog__check {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}

.announcement-dialog__check input {
  width: 15px;
  height: 15px;
  accent-color: var(--color-primary);
  cursor: pointer;
}
</style>
