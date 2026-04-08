<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div
        v-if="modelValue"
        class="confirm-overlay"
        role="presentation"
        @click.self="emitCancel"
      >
        <div
          ref="panelRef"
          class="confirm-dialog"
          :class="{ 'confirm-dialog--danger': danger }"
          role="alertdialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="descId"
          tabindex="-1"
          @keydown.escape.prevent="emitCancel"
        >
          <div class="confirm-dialog__accent" aria-hidden="true" />
          <div class="confirm-dialog__body">
            <div class="confirm-dialog__head">
              <span class="confirm-dialog__icon" aria-hidden="true">{{ danger ? '!' : '?' }}</span>
              <div class="confirm-dialog__head-text">
                <h2 :id="titleId" class="confirm-dialog__title">{{ title }}</h2>
                <p v-if="danger" class="confirm-dialog__hint">此操作不可撤销</p>
              </div>
            </div>
            <p :id="descId" class="confirm-dialog__message">{{ message }}</p>
            <div class="confirm-dialog__actions">
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" @click="emitCancel">
                {{ cancelLabel }}
              </button>
              <button type="button" class="confirm-dialog__btn confirm-dialog__btn--danger" @click="emitConfirm">
                {{ confirmLabel }}
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

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  {
    confirmLabel: '删除',
    cancelLabel: '取消',
    danger: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const idBase = useId()
const titleId = `${idBase}-title`
const descId = `${idBase}-desc`

function emitCancel(): void {
  emit('cancel')
  emit('update:modelValue', false)
}

function emitConfirm(): void {
  emit('confirm')
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  async (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
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
