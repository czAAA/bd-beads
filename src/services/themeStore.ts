import type { ThemePick } from '../theme/theme'

export const THEME_STORAGE_KEY = 'bd-beads:theme'

/** Where the person's theme pick is kept on this device (ADR 0020). Match device is no pick at all, so it is not kept. */
export interface ThemePickStore {
  load: () => ThemePick
  save: (pick: ThemePick) => void
}

export function createThemePickStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): ThemePickStore {
  return {
    load() {
      let raw: string | null = null
      try {
        raw = storage.getItem(THEME_STORAGE_KEY)
      } catch {
        // Storage can be blocked (private mode, site data off): fall back to the device.
      }
      return raw === 'light' || raw === 'dark' || raw === 'contrast' ? raw : 'device'
    },
    save(pick) {
      try {
        if (pick === 'device') storage.removeItem(THEME_STORAGE_KEY)
        else storage.setItem(THEME_STORAGE_KEY, pick)
      } catch {
        // Storage can be blocked; the pick still holds for this visit.
      }
    },
  }
}

/** The theme pick in this browser's localStorage. */
export const browserThemePickStore: ThemePickStore = {
  load: () => createThemePickStore(localStorage).load(),
  save: (pick) => createThemePickStore(localStorage).save(pick),
}
