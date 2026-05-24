<template>
  <div v-if="open" class="confirm-overlay card-redeem-overlay" @pointerdown.self="emitClose">
    <div class="confirm-dialog card-redeem-dialog" role="dialog" aria-modal="true" aria-labelledby="card-redeem-title" @pointerdown.stop>
      <div class="confirm-dialog__accent card-redeem-dialog__accent" aria-hidden="true" />
      <div class="confirm-dialog__body card-redeem-dialog__body">
        <div class="card-redeem-dialog__head">
          <div>
            <p class="card-redeem-dialog__eyebrow">账户余额</p>
            <h2 id="card-redeem-title" class="confirm-dialog__title card-redeem-dialog__title">卡密兑换</h2>
          </div>
          <button type="button" class="card-redeem-dialog__close" aria-label="关闭" @click="emitClose">×</button>
        </div>

        <p class="card-redeem-dialog__hint">输入卡密后即时入账，余额可用于 AI 整理与对话。</p>

        <form class="card-redeem-dialog__form" @submit.prevent="onSubmit">
          <label class="card-redeem-dialog__field">
            <span>卡密</span>
            <input
              v-model="code"
              class="card-redeem-dialog__input"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="NW01XXXXXXXXXXXX"
              maxlength="64"
              required
            />
          </label>

          <p v-if="error" class="card-redeem-dialog__error">{{ error }}</p>
          <p v-if="success" class="card-redeem-dialog__success">{{ success }}</p>

          <div class="confirm-dialog__actions card-redeem-dialog__actions">
            <button
              type="submit"
              class="confirm-dialog__btn confirm-dialog__btn--danger card-redeem-dialog__submit"
              :disabled="submitting || !code.trim()"
            >
              {{ submitting ? '兑换中…' : '兑换' }}
            </button>
            <button type="button" class="confirm-dialog__btn confirm-dialog__btn--ghost" :disabled="submitting" @click="emitClose">
              关闭
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatBalanceYuan } from '../lib/balanceFormat'
import { redeemCardKey } from '../lib/billing'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  redeemed: [balanceYuan: number]
}>()

const code = ref('')
const error = ref('')
const success = ref('')
const submitting = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    code.value = ''
    error.value = ''
    success.value = ''
    submitting.value = false
  },
)

function emitClose(): void {
  emit('close')
}

async function onSubmit(): Promise<void> {
  const raw = code.value.trim()
  if (!raw || submitting.value) return
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    const result = await redeemCardKey(raw)
    success.value = `兑换成功：${result.amountYuan} 元面额，入账 ${formatBalanceYuan(result.creditedYuan)}，当前余额 ${formatBalanceYuan(result.balanceYuan)}。`
    emit('redeemed', result.balanceYuan)
    code.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '兑换失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

</script>

<style scoped>
.card-redeem-overlay {
  z-index: 1200;
}

.card-redeem-dialog {
  width: min(420px, calc(100vw - 32px));
}

.card-redeem-dialog__body {
  display: grid;
  gap: 14px;
}

.card-redeem-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-redeem-dialog__eyebrow {
  margin: 0 0 4px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.card-redeem-dialog__title {
  margin: 0;
}

.card-redeem-dialog__close {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.card-redeem-dialog__hint {
  margin: 0;
  font-size: 0.68rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.card-redeem-dialog__form {
  display: grid;
  gap: 10px;
}

.card-redeem-dialog__field {
  display: grid;
  gap: 6px;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.card-redeem-dialog__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 80%, transparent);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
}

.card-redeem-dialog__input:focus {
  outline: 2px solid color-mix(in srgb, var(--color-primary) 40%, transparent);
  outline-offset: 1px;
}

.card-redeem-dialog__error {
  margin: 0;
  font-size: 0.66rem;
  color: #b42318;
}

.card-redeem-dialog__success {
  margin: 0;
  font-size: 0.66rem;
  line-height: 1.5;
  color: color-mix(in srgb, #15803d 88%, var(--color-text) 12%);
}

.card-redeem-dialog__actions {
  margin-top: 4px;
}
</style>
