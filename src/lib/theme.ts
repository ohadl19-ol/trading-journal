export type Theme = 'dark' | 'light'

const KEY = 'tj_theme'

export function getStoredTheme(): Theme {
  const raw = localStorage.getItem(KEY)
  return raw === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(KEY, theme)
}
