import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'novel-writing.theme'

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark' || attr === 'light') return attr
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export const theme = ref<Theme>(readInitialTheme())

export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t)
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch {
    /* ignore */
  }
}

export function setTheme(t: Theme): void {
  theme.value = t
  applyTheme(t)
}

export function toggleTheme(): void {
  setTheme(theme.value === 'light' ? 'dark' : 'light')
}

watch(theme, (t) => applyTheme(t), { immediate: true })
