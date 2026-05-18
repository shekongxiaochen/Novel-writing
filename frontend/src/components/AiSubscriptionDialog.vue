<template>
  <Teleport to="body">
    <div v-if="open" class="ai-subscription" @pointerdown.self="$emit('close')">
      <div class="ai-subscription__card" @pointerdown.stop>
        <div class="ai-subscription__head">
          <div>
            <p class="ai-subscription__eyebrow">AI Monthly Access</p>
            <h3>开通 AI 侧边栏</h3>
            <p class="ai-subscription__sub">
              AI 阅读台、章节侧边智能操作和相关快捷入口会统一走月付订阅。
            </p>
          </div>
          <button type="button" class="ai-subscription__close" aria-label="关闭" @click="$emit('close')">×</button>
        </div>

        <div class="ai-subscription__grid">
          <section class="ai-subscription__panel ai-subscription__panel--plan">
            <div class="ai-subscription__status-row">
              <span class="ai-subscription__status" :class="`is-${subscription.status}`">
                {{ statusLabel }}
              </span>
              <span class="ai-subscription__source">来源：{{ sourceLabel }}</span>
            </div>

            <div class="ai-subscription__price">{{ priceLabel }}</div>
            <ul class="ai-subscription__points">
              <li>按账号维度开通，后续可接正式商户收款。</li>
              <li>本期先完成付费壳子、扫码弹窗、状态拦截和续费位。</li>
              <li>真实收款、回调验单、自动续期等功能后续接入。</li>
            </ul>

            <div v-if="subscription.status === 'active' && subscription.currentPeriodEnd" class="ai-subscription__meta">
              当前周期至 {{ formatDate(subscription.currentPeriodEnd) }}
            </div>
            <div v-else-if="subscription.pendingOrderId" class="ai-subscription__meta">
              订单号 {{ subscription.pendingOrderId }}
            </div>
          </section>

          <section class="ai-subscription__panel ai-subscription__panel--checkout">
            <div class="ai-subscription__qr-shell">
              <div class="ai-subscription__qr" aria-hidden="true">
                <span
                  v-for="n in 49"
                  :key="n"
                  class="ai-subscription__qr-cell"
                  :class="{ 'is-filled': qrSeed(n) }"
                ></span>
              </div>
            </div>
            <div class="ai-subscription__checkout-copy">
              <div class="ai-subscription__checkout-title">扫码开通月付</div>
              <div class="ai-subscription__checkout-sub">当前为演示壳子，暂未接入真实收款渠道。</div>
            </div>
            <div class="ai-subscription__actions">
              <button type="button" class="ai-subscription__btn" @click="$emit('refresh-order')">刷新收款码</button>
              <button type="button" class="ai-subscription__btn ai-subscription__btn--primary" @click="$emit('activate-mock')">
                模拟支付成功
              </button>
            </div>
            <button type="button" class="ai-subscription__text-btn" @click="$emit('reset')">重置订阅状态</button>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AiSubscriptionSource, AiSubscriptionState } from '../composables/useAiSubscription'

const props = defineProps<{
  open: boolean
  subscription: AiSubscriptionState
  source: AiSubscriptionSource
  priceLabel: string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'refresh-order'): void
  (e: 'activate-mock'): void
  (e: 'reset'): void
}>()

const statusLabel = computed(() => {
  if (props.subscription.status === 'active') return '已开通'
  if (props.subscription.status === 'pending') return '待支付'
  return '未开通'
})

const sourceLabel = computed(() => {
  if (props.source === 'header') return '顶栏入口'
  if (props.source === 'chapter-hub') return '写作页'
  if (props.source === 'selection-quote') return '选中片段'
  return 'AI 入口'
})

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function qrSeed(index: number): boolean {
  const seed = `${props.subscription.pendingOrderId || 'AI-SUB'}-${index}`
  let total = 0
  for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i) * (i + 3)
  return total % 3 !== 0
}
</script>

<style scoped>
.ai-subscription {
  position: fixed;
  inset: 0;
  z-index: 220;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, #08111f 42%, transparent);
  backdrop-filter: blur(10px);
}

.ai-subscription__card {
  width: min(820px, 100%);
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 60%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-surface) 96%, #fff 4%);
  box-shadow: 0 24px 80px color-mix(in srgb, #000 20%, transparent);
  padding: 20px;
}

.ai-subscription__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.ai-subscription__eyebrow {
  margin: 0 0 6px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.ai-subscription__head h3 {
  margin: 0;
  font-size: 1.15rem;
}

.ai-subscription__sub {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.ai-subscription__close {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.ai-subscription__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
  gap: 16px;
}

.ai-subscription__panel {
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  border-radius: 10px;
  padding: 16px;
  background: color-mix(in srgb, var(--color-surface-muted) 35%, transparent);
}

.ai-subscription__status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 18px;
}

.ai-subscription__status {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
  color: var(--color-text-muted);
}

.ai-subscription__status.is-active {
  background: color-mix(in srgb, #d1fae5 85%, transparent);
  color: #047857;
}

.ai-subscription__status.is-pending {
  background: color-mix(in srgb, #fef3c7 88%, transparent);
  color: #b45309;
}

.ai-subscription__source {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.ai-subscription__price {
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 14px;
}

.ai-subscription__points {
  margin: 0;
  padding-left: 18px;
  color: var(--color-text-muted);
  display: grid;
  gap: 8px;
}

.ai-subscription__meta {
  margin-top: 16px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.ai-subscription__panel--checkout {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.ai-subscription__qr-shell {
  width: 196px;
  height: 196px;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.ai-subscription__qr {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  width: 100%;
  height: 100%;
}

.ai-subscription__qr-cell {
  border-radius: 2px;
  background: #f3f4f6;
}

.ai-subscription__qr-cell.is-filled {
  background: #111827;
}

.ai-subscription__checkout-copy {
  margin-top: 16px;
}

.ai-subscription__checkout-title {
  font-weight: 600;
}

.ai-subscription__checkout-sub {
  margin-top: 6px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.ai-subscription__actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.ai-subscription__btn,
.ai-subscription__text-btn {
  min-height: 34px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-border-strong) 65%, transparent);
  background: color-mix(in srgb, var(--color-surface) 94%, transparent);
  color: var(--color-text);
  padding: 0 12px;
  cursor: pointer;
}

.ai-subscription__btn--primary {
  background: color-mix(in srgb, var(--color-primary-soft) 62%, transparent);
  color: var(--color-primary);
}

.ai-subscription__text-btn {
  margin-top: 10px;
  background: transparent;
  color: var(--color-text-muted);
}

@media (max-width: 760px) {
  .ai-subscription__grid {
    grid-template-columns: 1fr;
  }
}
</style>
