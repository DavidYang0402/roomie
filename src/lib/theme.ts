// Light / Dark 主題:以 <html data-theme="dark"> 為單一真實來源,選擇記在 localStorage。
// 首次載入的「無閃爍」套用在 index.html 的 inline script(比 React 早跑);這裡是 App
// 執行後要用的讀 / 寫 / 套用工具。兩邊的 storage key 與 theme-color 值要保持一致。

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'roomie-theme'
const THEME_COLOR = { light: '#fafaf8', dark: '#14161a' } as const

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

// 目前實際套在 <html> 上的主題(有沒有 data-theme="dark")
export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme])
}

// 使用者主動切換:記住選擇並立即套用
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage 不可用(隱私模式等)時,至少當下這次 session 仍會套用
  }
  applyTheme(theme)
}
