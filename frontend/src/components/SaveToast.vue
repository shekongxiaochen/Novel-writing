<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="open" class="save-toast" role="status" aria-live="polite">
        <div class="save-toast__inner">
          <span class="save-toast__icon" aria-hidden="true">✓</span>
          <div class="save-toast__text">
            <strong>{{ title }}</strong>
            <span>{{ message }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean
    title?: string
    message?: string
  }>(),
  {
    title: '保存成功',
    message: '修改已保存。',
  },
)
</script>

<style scoped>
.save-toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 5200;
  pointer-events: none;
}

.save-toast__inner {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 180px;
  max-width: min(320px, calc(100vw - 32px));
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  box-shadow: 0 8px 20px rgba(5, 10, 18, 0.16);
}

.save-toast__icon {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: #16a34a;
  flex: 0 0 18px;
}

.save-toast__text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  color: var(--color-text);
}

.save-toast__text strong {
  font-size: 0.82rem;
}

.save-toast__text span {
  font-size: 0.74rem;
  color: var(--color-text-muted);
}
</style>
