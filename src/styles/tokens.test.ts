import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8')

interface Token<V = string> {
  name: string
  value: V
}
interface TokensJson {
  color: { tokens: Token<Record<Theme, string>>[] }
  shadow: { tokens: Token<Record<Theme, string>>[] }
  spacing: { tokens: Token[] }
  radius: { tokens: Token[] }
  layout: { tokens: Token[] }
  zIndex: { tokens: Token[] }
  print: { tokens: Token[] }
  type: { families: Record<'sans' | 'mono' | 'serif', string> }
}
type Theme = 'light' | 'dark' | 'contrast'

const tokens = JSON.parse(read('docs/design/system/tokens.json')) as TokensJson
const css = read('src/styles/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '')

/** The custom properties declared in the first rule whose selector list contains `selector`. */
function declarations(selector: string): Map<string, string> {
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selectors]) =>
    selectors.split(',').some((s) => s.trim() === selector),
  )
  if (!rule) throw new Error(`no rule for ${selector}`)
  return new Map([...rule[2].matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}

/** tokens.json sizes are px; the app's are rem (accessibility.md, Text and zoom). */
const rem = (px: string) => (px === '0px' ? '0' : px.endsWith('px') ? `${parseFloat(px) / 16}rem` : px)

describe('tokens.css', () => {
  const themeSelectors: Record<Theme, string> = {
    light: ':root[data-theme="light"]',
    dark: ':root[data-theme="dark"]',
    contrast: ':root[data-theme="contrast"]',
  }

  it.each(Object.entries(themeSelectors) as [Theme, string][])(
    'has every color and elevation token of the %s theme, as in tokens.json',
    (theme, selector) => {
      const declared = declarations(selector)
      for (const token of [...tokens.color.tokens, ...tokens.shadow.tokens]) {
        expect(declared.get(`--${token.name}`), token.name).toBe(token.value[theme])
      }
    },
  )

  it('makes light the default before any theme is set', () => {
    expect(declarations(':root').get('--canvas')).toBe(declarations(':root[data-theme="light"]').get('--canvas'))
  })

  it('has every spacing, radius, layout, z-index and print token, sizes in rem', () => {
    const declared = new Map([...css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(([, n, v]) => [n, v.trim()]))
    for (const token of [...tokens.spacing.tokens, ...tokens.radius.tokens, ...tokens.layout.tokens]) {
      const keepsPx = token.name.startsWith('bp-') || token.name === 'radius-full'
      expect(declared.get(`--${token.name}`), token.name).toBe(keepsPx ? token.value : rem(token.value))
    }
    for (const token of [...tokens.zIndex.tokens, ...tokens.print.tokens]) {
      expect(declared.get(`--${token.name}`), token.name).toBe(String(token.value))
    }
    for (const [family, stack] of Object.entries(tokens.type.families)) {
      expect(declared.get(`--font-${family}`), family).toBe(stack)
    }
  })

  it('has the motion tokens', () => {
    for (const name of ['--duration-instant', '--duration-fast', '--duration-base', '--duration-slow', '--ease-out', '--ease-in', '--ease-standard']) {
      expect(css).toContain(`${name}:`)
    }
  })
})

describe('the ticket-02 tokens (ticket 152)', () => {
  it('are gone now that every component has moved onto the design system', () => {
    const style = read('src/style.css')
    for (const name of ['--color-ink', '--color-paper', '--color-wedgewood', '--color-amaranth', '--legacy-font-sans', '--legacy-radius-md', '--legacy-radius-lg', '--border-width', '--radius-pill']) {
      expect(style).not.toContain(`${name}:`)
    }
    expect(style).not.toContain('Segoe UI')
  })
})

describe('fonts.css', () => {
  const fonts = read('src/styles/fonts.css')
  const urls = [...fonts.matchAll(/url\('([^']+)'\)/g)].map(([, url]) => url)

  it('loads every font from the app itself, never a font CDN', () => {
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url).toMatch(/^\/fonts\/[a-z0-9-]+\.woff2$/)
      expect(existsSync(resolve(repo, 'public', url.slice(1))), url).toBe(true)
    }
  })

  it('has the three families plus the two Cyrillic fallbacks', () => {
    for (const family of ['Inter', 'DM Mono', 'Instrument Serif', 'JetBrains Mono', 'Source Serif 4']) {
      expect(fonts).toContain(`font-family: '${family}';`)
    }
  })
})
