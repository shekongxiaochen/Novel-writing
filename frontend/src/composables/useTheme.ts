import { computed, ref, watch } from 'vue'

export type Theme = 'light' | 'mint' | 'dark' | 'codex'

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
    label: '云灰纸白',
    description: '冷静浅底，像精修过的桌面编辑器而不是普通网页',
    preview: {
      bg: '#edf1f5',
      surface: '#fbfcfd',
      text: '#16181d',
      accent: '#0d9488',
    },
  },
  {
    id: 'mint',
    label: '暖阳纸黄',
    description: '暖黄护眼底色，柔和琥珀高亮，像旧书页一样耐看不刺眼',
    preview: {
      bg: '#f4ead3',
      surface: '#fdf8ec',
      text: '#463a26',
      accent: '#c0883a',
    },
  },
  {
    id: 'dark',
    label: '夜墨铜绿',
    description: '近黑底色配铜绿与暖金，高级但不脏不闷',
    preview: {
      bg: '#181818',
      surface: '#202020',
      text: '#ece7dd',
      accent: '#82b09a',
    },
  },
  {
    id: 'codex',
    label: '冷夜蓝墨',
    description: '冷石板灰蓝底色，柔和钢蓝高亮和低眩光层级，适合长时间沉浸写作',
    preview: {
      bg: '#2d313a',
      surface: '#3b414d',
      text: '#e6eaf1',
      accent: '#79a8d8',
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
