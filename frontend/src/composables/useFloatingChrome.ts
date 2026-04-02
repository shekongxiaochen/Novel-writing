import { computed, nextTick, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { chromeAnchorRef } from './useChromeAnchor'
import { focusMode } from './useFocusMode'

const topbarVisible = ref(true)
const anchorVisible = ref(true)

let ioTop: IntersectionObserver | null = null
let ioAnchor: IntersectionObserver | null = null

const topbarElRef = shallowRef<HTMLElement | null>(null)

function disconnectAll(): void {
  ioTop?.disconnect()
  ioTop = null
  ioAnchor?.disconnect()
  ioAnchor = null
}

function observeTopbar(el: HTMLElement): void {
  ioTop?.disconnect()
  topbarVisible.value = true
  ioTop = new IntersectionObserver(
    ([e]) => {
      topbarVisible.value = e.isIntersecting
    },
    { root: null, threshold: 0, rootMargin: '0px 0px 0px 0px' }
  )
  ioTop.observe(el)
}

function observeAnchor(el: HTMLElement): void {
  ioAnchor?.disconnect()
  anchorVisible.value = true
  ioAnchor = new IntersectionObserver(
    ([e]) => {
      anchorVisible.value = e.isIntersecting
    },
    { root: null, threshold: 0, rootMargin: '0px 0px 0px 0px' }
  )
  ioAnchor.observe(el)
}

function setupObservers(): void {
  disconnectAll()
  if (!focusMode.value && topbarElRef.value) {
    observeTopbar(topbarElRef.value)
  }
  if (chromeAnchorRef.value) {
    observeAnchor(chromeAnchorRef.value)
  }
}

export function useFloatingChromeRegistration(topbarRef: Ref<HTMLElement | null>) {
  watch(
    topbarRef,
    (el) => {
      topbarElRef.value = el
      void nextTick(setupObservers)
    },
    { immediate: true }
  )

  watch(
    () => [focusMode.value, chromeAnchorRef.value] as const,
    () => void nextTick(setupObservers),
    { flush: 'post' }
  )

  onUnmounted(disconnectAll)
}

export const showFloatingChrome = computed(() => {
  if (focusMode.value) {
    if (!chromeAnchorRef.value) return true
    return !anchorVisible.value
  }
  // 非专注模式下：避免与 App 顶栏重复显示
  // 只有「顶栏不可见」且「页面右上角锚点不可见」时才悬挂。
  if (topbarVisible.value) return false
  if (chromeAnchorRef.value) return !anchorVisible.value
  return true
})
