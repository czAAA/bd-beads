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

type Theme = 'light' | 'dark' | 'contrast'
interface TokensJson {
  color: { tokens: { name: string; value: Record<Theme, string> }[] }
}
const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as TokensJson
const surface = (theme: Theme) => tokens.color.tokens.find((token) => token.name === 'surface')!.value[theme]

/** The two theme-color metas of index.html (light and dark device setting), and tokens.css's `--surface` per theme, so
 * applyTheme can read the page background the way the browser would. */
function addHead(): () => void {
  const added = [
    Object.assign(document.createElement('meta'), { name: 'theme-color', content: surface('light') }),
    Object.assign(document.createElement('meta'), { name: 'theme-color', content: surface('dark') }),
    Object.assign(document.createElement('style'), {
      textContent: (['light', 'dark', 'contrast'] as const)
        .map((theme) => `:root[data-theme="${theme}"] { --surface: ${surface(theme)}; }`)
        .join('\n'),
    }),
  ]
  added[0].setAttribute('media', '(prefers-color-scheme: light)')
  added[1].setAttribute('media', '(prefers-color-scheme: dark)')
  document.head.append(...added)
  return () => added.forEach((element) => element.remove())
}
const themeColors = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) => meta.content)

let removeHead: () => void
beforeEach(() => {
  localStorage.clear()
  delete root.dataset.theme
  root.style.colorScheme = ''
  removeHead = addHead()
})
afterEach(() => removeHead())

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

  it("sets the browser's bar to the theme's surface, whatever the device says (ticket 0998)", () => {
    applyTheme(root, 'dark')
    expect(themeColors()).toEqual([surface('dark'), surface('dark')])

    applyTheme(root, 'contrast')
    expect(themeColors()).toEqual([surface('contrast'), surface('contrast')])

    applyTheme(root, 'light')
    expect(themeColors()).toEqual([surface('light'), surface('light')])
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

describe.each(['index.html', 'app/index.html'])("%s's pre-paint script", (page) => {
  const html = readFileSync(resolve(__dirname, '../../', page), 'utf8')
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
    localStorage.setItem('openbeads:theme', 'light')
    localStorage.setItem('openbeads:locale', 'en')
    runWith({ dark: true, moreContrast: true })
    expect(root.dataset.theme).toBe('light')
    expect(root.lang).toBe('en')
  })
  it("sets the browser's bar to the picked theme's surface, on a light device (ticket 0998)", () => {
    localStorage.setItem('openbeads:theme', 'dark')
    runWith({ dark: false, moreContrast: false })
    expect(themeColors()).toEqual([surface('dark'), surface('dark')])

    localStorage.setItem('openbeads:theme', 'contrast')
    runWith({ dark: true, moreContrast: false })
    expect(themeColors()).toEqual([surface('contrast'), surface('contrast')])
  })

  it("leaves the browser's bar on the device's surface with no pick", () => {
    runWith({ dark: true, moreContrast: false })
    expect(themeColors()).toEqual([surface('dark'), surface('dark')])
  })
})
