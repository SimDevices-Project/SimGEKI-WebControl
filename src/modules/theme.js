export const THEME_IDS = ['blue']

export const createThemeController = ({
  root = document.body,
  storage,
} = {}) => {
  const defaultTheme = THEME_IDS[0]
  const persistence = storage || (() => {
    try {
      return window.localStorage
    } catch (_) {
      return null
    }
  })()

  const normalizeTheme = (theme) =>
    THEME_IDS.includes(theme) ? theme : defaultTheme

  const setTheme = (theme, { persist = true } = {}) => {
    const nextTheme = normalizeTheme(theme)
    root.dataset.theme = nextTheme

    if (persist) {
      try {
        persistence?.setItem('simgeki-theme', nextTheme)
      } catch (_) {
        // Theme persistence is optional when storage is unavailable.
      }
    }

    return nextTheme
  }

  const getStoredTheme = () => {
    try {
      return persistence?.getItem('simgeki-theme')
    } catch (_) {
      return null
    }
  }

  const initialize = () =>
    setTheme(getStoredTheme() || root.dataset.theme || defaultTheme, {
      persist: false,
    })

  initialize()

  return {
    getTheme: () => root.dataset.theme || defaultTheme,
    getAvailableThemes: () => [...THEME_IDS],
    setTheme,
  }
}
