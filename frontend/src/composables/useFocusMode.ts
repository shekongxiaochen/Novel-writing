import { ref, watch } from 'vue'

const STORAGE_KEY = 'novel-writing.focus-mode'

function readInitialFocusMode(): boolean {
  if (typeof document === 'undefined') return false
  const attr = document.documentElement.getAttribute('data-focus-mode')
  if (attr === 'on') return true
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const focusMode = ref(readInitialFocusMode())

function persistAndApply(on: boolean): void {
  if (on) {
    document.documentElement.setAttribute('data-focus-mode', 'on')
  } else {
    document.documentElement.removeAttribute('data-focus-mode')
  }
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function setFocusMode(on: boolean): void {
  focusMode.value = on
}

export function toggleFocusMode(): void {
  focusMode.value = !focusMode.value
}

watch(focusMode, (on) => persistAndApply(on), { immediate: true })
