import { readonly, type Ref } from 'vue'
import { browserDevicePreferences, useDevicePreferences, type DevicePreferences } from '../services/devicePreferences'
import { applyTheme, resolveTheme, type ThemePick } from './theme'

/**
 * The user's theme pick (ticket 139), shared by the whole app: the header's theme control sets it, and
 * followDeviceTheme (main.ts) reads it to know whether to keep following the device. Match device is no pick at all,
 * so it clears the remembered one; any other pick is remembered on this device, like the language.
 */
/** The current pick, for followDeviceTheme to read on each device change. */
export function currentThemePick(preferences: DevicePreferences = browserDevicePreferences): ThemePick {
  return preferences.get('theme').value
}

/** A media query's answer, or false where there is no matchMedia to ask (a test's DOM). */
function matches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

export function useThemePick(preferences: DevicePreferences = useDevicePreferences()): { pick: Readonly<Ref<ThemePick>>; setPick: (next: ThemePick) => void } {
  const pick = preferences.get('theme')
  function setPick(next: ThemePick): void {
    pick.value = next
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
