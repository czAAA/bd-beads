import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, followDeviceTheme, resolveTheme, type ThemePick } from './theme'

/** A stand-in for window.matchMedia whose answers a test can change, firing 'change' like a device setting would. */
function fakeDevice(initial: { dark: boolean; moreContrast: boolean }) {
  const state = { ...initial }
  const listeners = new Map<string, Set<() => void>>()
  const queryState = (query: string) => (query.includes('prefers-contrast') ? state.moreContrast : state.dark)
  const matchMedia = (query: string) => {
    const set = listeners.get(query) ?? new Set()
    listeners.set(query, set)
    return {
      get matches() {
        return queryState(query)
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => set.add(listener),
      removeEventListener: (_: string, listener: () => void) => set.delete(listener),
    } as unknown as MediaQueryList
  }
  function set(next: Partial<typeof state>) {
    Object.assign(state, next)
    for (const group of listeners.values()) for (const listener of group) listener()
  }
  return { matchMedia, set }
}

const root = document.documentElement

beforeEach(() => {
  localStorage.clear()
  delete root.dataset.theme
  root.style.colorScheme = ''
})

describe('resolveTheme', () => {
  it('follows the device while no theme is picked', () => {
    expect(resolveTheme('device', { dark: false, moreContrast: false })).toBe('light')
    expect(resolveTheme('device', { dark: true, moreContrast: false })).toBe('dark')
  })

  it('uses high contrast when the device asks for more contrast and no theme is picked', () => {
    expect(resolveTheme('device', { dark: true, moreContrast: true })).toBe('contrast')
  })

  it('keeps a picked theme whatever the device says', () => {
    const picks: ThemePick[] = ['light', 'dark', 'contrast']
    for (const pick of picks) expect(resolveTheme(pick, { dark: true, moreContrast: true })).toBe(pick)
  })
})

describe('applyTheme', () => {
  it('writes data-theme and color-scheme on the root element', () => {
    applyTheme(root, 'dark')
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')

    applyTheme(root, 'contrast')
    expect(root.dataset.theme).toBe('contrast')
    expect(root.style.colorScheme).toBe('light')
  })
})

describe('followDeviceTheme', () => {
  let stop: (() => void) | undefined
  afterEach(() => stop?.())

  it('applies the device theme at once and follows it live', () => {
    const device = fakeDevice({ dark: false, moreContrast: false })
    stop = followDeviceTheme({ matchMedia: device.matchMedia }, root, () => 'device')
    expect(root.dataset.theme).toBe('light')

    device.set({ dark: true })
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')

    device.set({ moreContrast: true })
    expect(root.dataset.theme).toBe('contrast')

    device.set({ moreContrast: false, dark: false })
    expect(root.dataset.theme).toBe('light')
  })

  it('ignores device changes while a theme is picked', () => {
    const device = fakeDevice({ dark: false, moreContrast: false })
    stop = followDeviceTheme({ matchMedia: device.matchMedia }, root, () => 'light')

    device.set({ dark: true })
    expect(root.dataset.theme).toBe('light')
  })

  it('stops following once stopped', () => {
    const device = fakeDevice({ dark: false, moreContrast: false })
    followDeviceTheme({ matchMedia: device.matchMedia }, root, () => 'device')()

    device.set({ dark: true })
    expect(root.dataset.theme).toBe('light')
  })
})

describe("index.html's pre-paint script", () => {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
  const script = /<script>([\s\S]*?)<\/script\s*>/i.exec(html)?.[1] ?? ''

  function runWith(device: { dark: boolean; moreContrast: boolean }) {
    const original = window.matchMedia
    window.matchMedia = fakeDevice(device).matchMedia
    try {
      new Function(script)()
    } finally {
      window.matchMedia = original
    }
  }

  it('sets the device theme before the app starts', () => {
    runWith({ dark: true, moreContrast: false })
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')

    runWith({ dark: true, moreContrast: true })
    expect(root.dataset.theme).toBe('contrast')
  })

  it('agrees with resolveTheme on a saved pick and sets the language', () => {
    localStorage.setItem('bd-beads:theme', 'light')
    localStorage.setItem('bd-beads:locale', 'en')
    runWith({ dark: true, moreContrast: true })
    expect(root.dataset.theme).toBe('light')
    expect(root.lang).toBe('en')
  })
})
