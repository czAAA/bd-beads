/**
 * Which theme the app is drawn in (DESIGN.md §4.1). With no pick the theme follows the device, live: dark from
 * `prefers-color-scheme`, high contrast from `prefers-contrast: more`. The resolved theme is written as `data-theme`
 * and `color-scheme` on <html>; index.html's inline script does the same before first paint, so there is no flash of
 * the wrong theme, and this module keeps it right from then on.
 */

export type ResolvedTheme = 'light' | 'dark' | 'contrast'
/** The user's pick from the header's theme control; 'device' is Match device. */
export type ThemePick = 'device' | ResolvedTheme

const DARK_QUERY = '(prefers-color-scheme: dark)'
const CONTRAST_QUERY = '(prefers-contrast: more)'

export interface DeviceTheme {
  dark: boolean
  moreContrast: boolean
}

export function resolveTheme(pick: ThemePick, device: DeviceTheme): ResolvedTheme {
  if (pick !== 'device') return pick
  if (device.moreContrast) return 'contrast'
  return device.dark ? 'dark' : 'light'
}

export function applyTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.dataset.theme = theme
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
}

/**
 * Applies the theme now and again whenever the device's setting changes, for as long as the pick is 'device'.
 * Returns a function that stops listening.
 */
export function followDeviceTheme(
  win: Pick<Window, 'matchMedia'>,
  root: HTMLElement,
  getPick: () => ThemePick,
): () => void {
  const dark = win.matchMedia(DARK_QUERY)
  const contrast = win.matchMedia(CONTRAST_QUERY)
  const update = () => applyTheme(root, resolveTheme(getPick(), { dark: dark.matches, moreContrast: contrast.matches }))
  update()
  dark.addEventListener('change', update)
  contrast.addEventListener('change', update)
  return () => {
    dark.removeEventListener('change', update)
    contrast.removeEventListener('change', update)
  }
}
