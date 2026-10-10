import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8')

type Theme = 'light' | 'dark' | 'contrast'
interface TokensJson {
  color: { tokens: { name: string; value: Record<Theme, string> }[] }
}
const tokens = JSON.parse(read('docs/design/system/tokens.json')) as TokensJson
const color = (name: string, theme: Theme) => tokens.color.tokens.find((token) => token.name === name)!.value[theme]

const html = read('index.html')
const splashStyle = /<style>([\s\S]*?)<\/style>/.exec(html)![1]

/** The value of `property` in the first rule for `selector`. */
function declared(selector: string, property: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(splashStyle)
  const value = new RegExp(`${property}:\\s*([^;]+);`).exec(rule?.[1] ?? '')
  if (!value) throw new Error(`no ${property} in ${selector}`)
  return value[1].trim()
}

describe('the splash in index.html (ticket 69)', () => {
  it('is three beads, hidden from assistive technology', () => {
    expect(html).toMatch(/<div id="splash" aria-hidden="true"><i><\/i><i><\/i><i><\/i><\/div>/)
  })

  it.each<[Theme, string]>([
    ['light', '#splash'],
    ['dark', "[data-theme='dark'] #splash"],
    ['contrast', "[data-theme='contrast'] #splash"],
  ])('sits on the %s theme\'s page background, with accent beads', (theme, selector) => {
    expect(declared(selector, 'background')).toBe(color('surface', theme))
    expect(declared(selector.replace('#splash', '#splash i'), 'background')).toBe(color('accent', theme))
  })

  it('draws the beads at the Loading card\'s size and gap', () => {
    const swatchDot = /--swatch-dot:\s*([^;]+);/.exec(read('src/styles/controls.css'))![1]
    expect(declared('#splash i', 'width')).toBe(swatchDot)
    expect(declared('#splash i', 'height')).toBe(swatchDot)
    expect(declared('#splash', 'gap')).toBe(/--space-8:\s*([^;]+);/.exec(read('src/styles/tokens.css'))![1])
  })

  it('appears only after the loading delay', () => {
    expect(declared('#splash', 'animation')).toMatch(/ 300ms /)
    expect(read('src/styles/tokens.css')).toMatch(/--loading-delay:\s*300ms;/)
  })

  it('has the beads stand still with reduced motion', () => {
    expect(splashStyle).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*#splash i\s*\{[^}]*animation: none/)
  })

  it('needs no request', () => {
    expect(splashStyle).not.toMatch(/url\(|@import/)
  })
})

describe('manifest.webmanifest (ticket 69)', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest')) as Record<string, string>

  it('is the light theme\'s page background, as the installed window frame', () => {
    expect(manifest.background_color).toBe(color('surface', 'light'))
    expect(manifest.theme_color).toBe(color('surface', 'light'))
    expect(html).toContain(`<meta name="theme-color" content="${color('surface', 'light')}" media="(prefers-color-scheme: light)" />`)
    expect(html).toContain(`<meta name="theme-color" content="${color('surface', 'dark')}" media="(prefers-color-scheme: dark)" />`)
  })

  it('opens the app wherever it is served from', () => {
    expect(manifest.start_url).toBe('./')
    expect(manifest.scope).toBe('./')
  })
})
