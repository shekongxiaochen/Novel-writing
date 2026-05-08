import { onUnmounted, ref, type ComputedRef } from 'vue'
import type { ForeshadowPlant } from '../../../types'
import type { EntityToken } from '../types'

export type ForeshadowHoverMeta = NonNullable<EntityToken['foreshadow']>

export function useChapterHubForeshadowTooltip(deps: {
  foreshadows: ComputedRef<ForeshadowPlant[]>
}) {
  const { foreshadows } = deps

  const foreshadowTooltipOpen = ref(false)
  const foreshadowTooltipX = ref(0)
  const foreshadowTooltipTop = ref(0)
  const foreshadowTooltipBottom = ref(0)
  const foreshadowTooltipPlant = ref<ForeshadowPlant | null>(null)
  const foreshadowTooltipSegment = ref<'plant' | 'fulfill'>('plant')
  const foreshadowTooltipFulfillmentId = ref('')
  const foreshadowTooltipContextDescription = ref('')
  const foreshadowTooltipJumpToken = ref('')
  const foreshadowTooltipMarkText = ref('')

  let showTimer: number | null = null
  let hideTimer: number | null = null

  function clearShowTimer(): void {
    if (showTimer != null) {
      window.clearTimeout(showTimer)
      showTimer = null
    }
  }

  function clearHideTimer(): void {
    if (hideTimer != null) {
      window.clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function closeForeshadowTooltipImmediate(): void {
    clearShowTimer()
    clearHideTimer()
    foreshadowTooltipOpen.value = false
    foreshadowTooltipPlant.value = null
    foreshadowTooltipFulfillmentId.value = ''
    foreshadowTooltipContextDescription.value = ''
    foreshadowTooltipJumpToken.value = ''
    foreshadowTooltipMarkText.value = ''
  }

  function createDomRect(left: number, top: number, right: number, bottom: number): DOMRect {
    return {
      x: left,
      y: top,
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      toJSON: () => ({ left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }),
    } as DOMRect
  }

  function pickForeshadowRegionRect(el: HTMLElement): DOMRect {
    const key = el.dataset.fsKey ?? ''
    const start = Number(el.dataset.rangeStart ?? '-1')
    const end = Number(el.dataset.rangeEnd ?? '-1')
    if (!key || start < 0 || end <= start) return el.getBoundingClientRect()

    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity

    const absorb = (node: Element | null): void => {
      const h = node as HTMLElement | null
      if (!h) return
      if ((h.dataset.fsKey ?? '') !== key) return
      const s = Number(h.dataset.rangeStart ?? '-1')
      const e = Number(h.dataset.rangeEnd ?? '-1')
      if (s < 0 || e <= s) return
      const r = h.getBoundingClientRect()
      left = Math.min(left, r.left)
      top = Math.min(top, r.top)
      right = Math.max(right, r.right)
      bottom = Math.max(bottom, r.bottom)
    }

    absorb(el)

    let prev = el.previousElementSibling
    let expectedStart = start
    while (prev) {
      const h = prev as HTMLElement
      if ((h.dataset.fsKey ?? '') !== key) break
      const s = Number(h.dataset.rangeStart ?? '-1')
      const e = Number(h.dataset.rangeEnd ?? '-1')
      if (s < 0 || e <= s || e !== expectedStart) break
      absorb(h)
      expectedStart = s
      prev = h.previousElementSibling
    }

    let next = el.nextElementSibling
    let expectedEnd = end
    while (next) {
      const h = next as HTMLElement
      if ((h.dataset.fsKey ?? '') !== key) break
      const s = Number(h.dataset.rangeStart ?? '-1')
      const e = Number(h.dataset.rangeEnd ?? '-1')
      if (s < 0 || e <= s || s !== expectedEnd) break
      absorb(h)
      expectedEnd = e
      next = h.nextElementSibling
    }

    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
      return el.getBoundingClientRect()
    }
    return createDomRect(left, top, right, bottom)
  }

  function onForeshadowMarkEnter(e: MouseEvent, meta: ForeshadowHoverMeta): void {
    clearShowTimer()
    clearHideTimer()
    showTimer = window.setTimeout(() => {
      showTimer = null
      const p = foreshadows.value.find((f) => f.id === meta.id)
      if (!p) return
      foreshadowTooltipPlant.value = p
      foreshadowTooltipSegment.value = meta.segment
      foreshadowTooltipFulfillmentId.value = meta.fulfillmentId?.trim() ?? ''
      foreshadowTooltipContextDescription.value = meta.description?.trim() ?? ''
      foreshadowTooltipJumpToken.value = meta.jumpToken?.trim() ?? ''
      foreshadowTooltipMarkText.value = meta.text?.trim() ?? ''
      const el = e.currentTarget as HTMLElement | null
      if (el) {
        const rect = pickForeshadowRegionRect(el)
        foreshadowTooltipX.value = rect.left
        foreshadowTooltipTop.value = rect.top
        foreshadowTooltipBottom.value = rect.bottom
      } else {
        foreshadowTooltipX.value = e.clientX
        foreshadowTooltipTop.value = e.clientY
        foreshadowTooltipBottom.value = e.clientY
      }
      foreshadowTooltipOpen.value = true
    }, 280)
  }

  function onForeshadowMarkLeave(): void {
    clearShowTimer()
    hideTimer = window.setTimeout(() => {
      hideTimer = null
      foreshadowTooltipOpen.value = false
      foreshadowTooltipPlant.value = null
      foreshadowTooltipFulfillmentId.value = ''
      foreshadowTooltipContextDescription.value = ''
      foreshadowTooltipJumpToken.value = ''
      foreshadowTooltipMarkText.value = ''
    }, 140)
  }

  function onForeshadowTooltipEnter(): void {
    clearHideTimer()
  }

  function onForeshadowTooltipLeave(): void {
    clearHideTimer()
    hideTimer = window.setTimeout(() => {
      hideTimer = null
      foreshadowTooltipOpen.value = false
      foreshadowTooltipPlant.value = null
      foreshadowTooltipFulfillmentId.value = ''
      foreshadowTooltipContextDescription.value = ''
      foreshadowTooltipJumpToken.value = ''
      foreshadowTooltipMarkText.value = ''
    }, 80)
  }

  onUnmounted(() => {
    clearShowTimer()
    clearHideTimer()
  })

  return {
    foreshadowTooltipOpen,
    foreshadowTooltipX,
    foreshadowTooltipTop,
    foreshadowTooltipBottom,
    foreshadowTooltipPlant,
    foreshadowTooltipSegment,
    foreshadowTooltipFulfillmentId,
    foreshadowTooltipContextDescription,
    foreshadowTooltipJumpToken,
    foreshadowTooltipMarkText,
    onForeshadowMarkEnter,
    onForeshadowMarkLeave,
    onForeshadowTooltipEnter,
    onForeshadowTooltipLeave,
    closeForeshadowTooltipImmediate,
  }
}
