import { computed, ref } from 'vue'
import { getCurrentUser } from '../lib/auth'

export type AiSubscriptionStatus = 'inactive' | 'pending' | 'active'
export type AiSubscriptionSource = 'header' | 'chapter-hub' | 'selection-quote' | 'unknown'

export type AiSubscriptionState = {
  status: AiSubscriptionStatus
  plan: 'monthly'
  monthlyPriceCny: number
  currentPeriodStart: string
  currentPeriodEnd: string
  pendingOrderId: string
  pendingCreatedAt: string
  pendingExpiresAt: string
  updatedAt: string
}

const STORAGE_KEY_PREFIX = 'novel-writing.ai-subscription'
const DEFAULT_MONTHLY_PRICE_CNY = 29

const paywallOpen = ref(false)
const paywallSource = ref<AiSubscriptionSource>('unknown')
const subscriptionState = ref<AiSubscriptionState>(readState())

function nowIso(): string {
  return new Date().toISOString()
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function addMonths(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

function userScopedKey(): string {
  const userId = String(getCurrentUser()?.id ?? '').trim()
  return `${STORAGE_KEY_PREFIX}.${userId || 'guest'}`
}

function baseState(): AiSubscriptionState {
  return {
    status: 'inactive',
    plan: 'monthly',
    monthlyPriceCny: DEFAULT_MONTHLY_PRICE_CNY,
    currentPeriodStart: '',
    currentPeriodEnd: '',
    pendingOrderId: '',
    pendingCreatedAt: '',
    pendingExpiresAt: '',
    updatedAt: nowIso(),
  }
}

function normalizeState(raw: Partial<AiSubscriptionState> | null | undefined): AiSubscriptionState {
  const base = baseState()
  const next: AiSubscriptionState = {
    ...base,
    ...raw,
    plan: 'monthly',
    monthlyPriceCny:
      typeof raw?.monthlyPriceCny === 'number' && Number.isFinite(raw.monthlyPriceCny)
        ? raw.monthlyPriceCny
        : DEFAULT_MONTHLY_PRICE_CNY,
    currentPeriodStart: String(raw?.currentPeriodStart ?? ''),
    currentPeriodEnd: String(raw?.currentPeriodEnd ?? ''),
    pendingOrderId: String(raw?.pendingOrderId ?? ''),
    pendingCreatedAt: String(raw?.pendingCreatedAt ?? ''),
    pendingExpiresAt: String(raw?.pendingExpiresAt ?? ''),
    updatedAt: String(raw?.updatedAt ?? base.updatedAt),
  }

  if (next.status === 'active' && next.currentPeriodEnd) {
    const activeUntil = new Date(next.currentPeriodEnd).getTime()
    if (!Number.isFinite(activeUntil) || activeUntil <= Date.now()) {
      return {
        ...base,
        monthlyPriceCny: next.monthlyPriceCny,
      }
    }
  }

  if (next.status === 'pending' && next.pendingExpiresAt) {
    const expiresAt = new Date(next.pendingExpiresAt).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return {
        ...base,
        monthlyPriceCny: next.monthlyPriceCny,
      }
    }
  }

  return next
}

function readState(): AiSubscriptionState {
  if (typeof window === 'undefined') return baseState()
  try {
    const raw = localStorage.getItem(userScopedKey())
    if (!raw) return baseState()
    return normalizeState(JSON.parse(raw) as Partial<AiSubscriptionState>)
  } catch {
    return baseState()
  }
}

function persistState(next: AiSubscriptionState): void {
  subscriptionState.value = normalizeState(next)
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(userScopedKey(), JSON.stringify(subscriptionState.value))
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('novel-writing:ai-subscription-changed'))
}

function refreshAiSubscriptionState(): void {
  subscriptionState.value = readState()
}

function createPendingOrder(): void {
  const current = readState()
  const stillValidPending =
    current.status === 'pending' &&
    current.pendingOrderId &&
    current.pendingExpiresAt &&
    new Date(current.pendingExpiresAt).getTime() > Date.now()
  if (stillValidPending) {
    subscriptionState.value = current
    return
  }
  persistState({
    ...baseState(),
    status: 'pending',
    monthlyPriceCny: current.monthlyPriceCny || DEFAULT_MONTHLY_PRICE_CNY,
    pendingOrderId: `AI${Date.now().toString().slice(-8)}${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
    pendingCreatedAt: nowIso(),
    pendingExpiresAt: addDays(1),
    updatedAt: nowIso(),
  })
}

function closeAiPaywall(): void {
  paywallOpen.value = false
}

function openAiPaywall(source: AiSubscriptionSource = 'unknown'): void {
  refreshAiSubscriptionState()
  paywallSource.value = source
  paywallOpen.value = true
  if (!isAiSubscriptionActive.value) createPendingOrder()
}

const isAiSubscriptionActive = computed(() => {
  const state = normalizeState(subscriptionState.value)
  return state.status === 'active' && !!state.currentPeriodEnd && new Date(state.currentPeriodEnd).getTime() > Date.now()
})

function requestAiSidebarAccess(source: AiSubscriptionSource = 'unknown'): boolean {
  refreshAiSubscriptionState()
  if (isAiSubscriptionActive.value) return true
  openAiPaywall(source)
  return false
}

function activateMockSubscription(): void {
  const current = readState()
  persistState({
    ...current,
    status: 'active',
    currentPeriodStart: nowIso(),
    currentPeriodEnd: addMonths(1),
    pendingOrderId: '',
    pendingCreatedAt: '',
    pendingExpiresAt: '',
    updatedAt: nowIso(),
  })
  paywallOpen.value = false
}

function resetAiSubscription(): void {
  persistState(baseState())
}

const aiSubscriptionPriceLabel = computed(() => `￥${subscriptionState.value.monthlyPriceCny} / 月`)

export function useAiSubscription() {
  return {
    paywallOpen,
    paywallSource,
    subscriptionState,
    isAiSubscriptionActive,
    aiSubscriptionPriceLabel,
    refreshAiSubscriptionState,
    openAiPaywall,
    closeAiPaywall,
    createPendingOrder,
    requestAiSidebarAccess,
    activateMockSubscription,
    resetAiSubscription,
  }
}
