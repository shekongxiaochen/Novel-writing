import { computed, ref, watch } from 'vue'

export type Theme = 'light' | 'mint' | 'dark' | 'blueprint'

export type ThemeOption = {
  id: Theme
  label: string
  description: string
  preview: {
    bg: string
    surface: string
    text: string
    accent: string
  }
}

const STORAGE_KEY = 'novel-writing.theme'

export const themeOptions: ThemeOption[] = [
  {
    id: 'light',
    label: '浅色主题',
    description: '高级杂志感的清透浅色界面',
    preview: {
      bg: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
      accent: '#1d4ed8',
    },
  },
  {
    id: 'mint',
    label: '薄荷晨光',
    description: '中性浅底，薄荷绿用于标记和图谱',
    preview: {
      bg: '#f7faf8',
      surface: '#ffffff',
      text: '#10251f',
      accent: '#00a884',
    },
  },
  {
    id: 'dark',
    label: '深色主题',
    description: '低眩光夜读暖墨界面',
    preview: {
      bg: '#0d0b0a',
      surface: '#221c18',
      text: '#efe7da',
      accent: '#93a88b',
    },
  },
  {
    id: 'blueprint',
    label: '深海蓝图',
    description: '深色中性底，蓝图色用于标记和图谱',
    preview: {
      bg: '#0f172a',
      surface: '#111827',
      text: '#dbeafe',
      accent: '#38bdf8',
    },
  },
]

const themeIds = new Set<Theme>(themeOptions.map((option) => option.id))

function isTheme(value: string | null): value is Theme {
  return !!value && themeIds.has(value as Theme)
}

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  if (isTheme(attr)) return attr
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isTheme(saved)) return saved
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export const theme = ref<Theme>(readInitialTheme())

export const currentThemeOption = computed(() => themeOptions.find((option) => option.id === theme.value) ?? themeOptions[0])

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
