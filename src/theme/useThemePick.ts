import { readonly, ref, type Ref } from 'vue'
import { browserThemePickStore, type ThemePickStore } from '../services/themeStore'
import { applyTheme, resolveTheme, type ThemePick } from './theme'

/**
 * The user's theme pick (ticket 139), shared by the whole app: the header's theme control sets it, and
 * followDeviceTheme (main.ts) reads it to know whether to keep following the device. Match device is no pick at all,
 * so it clears the remembered one; any other pick is remembered on this device, like the language.
 */
const pick = ref<ThemePick>('device')
let loaded = false

/** Reads the remembered pick once, from whichever store the first caller hands over. */
function ensureLoaded(store: ThemePickStore): void {
  if (!loaded) {
    loaded = true
    pick.value = store.load()
  }
}

/** The current pick, for followDeviceTheme to read on each device change. */
export function currentThemePick(store: ThemePickStore = browserThemePickStore): ThemePick {
  ensureLoaded(store)
  return pick.value
}

/** A media query's answer, or false where there is no matchMedia to ask (a test's DOM). */
function matches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

export function useThemePick(store: ThemePickStore = browserThemePickStore): { pick: Readonly<Ref<ThemePick>>; setPick: (next: ThemePick) => void } {
  ensureLoaded(store)
  function setPick(next: ThemePick): void {
    pick.value = next
    store.save(next)
    // At once, so the whole app changes together; the canvas redraws once from the data-theme change.
    applyTheme(
      document.documentElement,
      resolveTheme(next, {
        dark: matches('(prefers-color-scheme: dark)'),
        moreContrast: matches('(prefers-contrast: more)'),
      }),
    )
  }
  return { pick: readonly(pick), setPick }
}
