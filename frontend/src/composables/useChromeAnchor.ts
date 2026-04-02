import { shallowRef } from 'vue'

/** 页面顶栏（含返回等），用于与 App 顶栏一起参与「滚动后悬挂工具条」检测 */
export const chromeAnchorRef = shallowRef<HTMLElement | null>(null)

export function setChromeAnchor(el: HTMLElement | null): void {
  chromeAnchorRef.value = el
}
