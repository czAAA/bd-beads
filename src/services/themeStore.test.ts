import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY, browserThemePickStore, createThemePickStore } from './themeStore'

beforeEach(() => localStorage.clear())

describe('the theme pick store', () => {
  it('is Match device when nothing is saved or the saved value is unknown', () => {
    expect(browserThemePickStore.load()).toBe('device')
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')
    expect(browserThemePickStore.load()).toBe('device')
  })

  it('reads a saved pick, and forgets it for Match device', () => {
    browserThemePickStore.save('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(browserThemePickStore.load()).toBe('dark')

    browserThemePickStore.save('device')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('falls back to the device when storage is blocked', () => {
    const blocked = createThemePickStore({
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    expect(blocked.load()).toBe('device')
    expect(() => blocked.save('dark')).not.toThrow()
  })
})
