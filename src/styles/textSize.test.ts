import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The browser's text size reaches the chrome (ticket 0941, WCAG 1.4.4): the root's size is a share of it, and the
 * chrome's type is in `rem`, never px, so it follows. The canvas, rulers and printed pages draw in px from TypeScript
 * and keep their size; they are not styles. */

const src = resolve(__dirname, '..')
const read = (path: string) => readFileSync(resolve(src, path), 'utf8')

function styleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name)
    return entry.isDirectory() ? styleFiles(path) : /\.(vue|css)$/.test(entry.name) ? [path] : []
  })
}

/** A file's CSS without comments: a `.vue` file's style blocks, a `.css` file whole. */
function stylesOf(path: string): string {
  const text = readFileSync(path, 'utf8')
  const css = path.endsWith('.vue') ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, block]) => block).join('\n') : text
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Type sized in px on purpose: lettering inside SVG artwork, which scales with its drawing. */
const ARTWORK = ['homepage/PlanTiles.vue .plan__stamp text']

/** `font` or `font-size` with a px length. */
const FONT_IN_PX = /(?:^|[;\s])font(?:-size)?\s*:[^;]*?\d+px/
/** A custom property holding a font shorthand with a px size: `--x: 600 12px/16px var(--font-sans)`. */
const FONT_TOKEN_IN_PX = /--[\w-]+\s*:[^;]*?\d+px[^;]*var\(--font-/

describe("the browser's text size (ticket 0941)", () => {
  it('sets the root in percent of it: 112.5%, 18px at the default 16px', () => {
    expect(read('style.css')).toMatch(/--font-size-base:\s*112\.5%;/)
  })

  it('reaches every type size in the styles: none is in px', () => {
    const inPx: string[] = []
    for (const path of styleFiles(src)) {
      const name = path.slice(src.length + 1)
      for (const [, selector, body] of stylesOf(path).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sized = body.match(FONT_IN_PX) ?? body.match(FONT_TOKEN_IN_PX)
        if (sized && !ARTWORK.includes(`${name} ${selector.trim()}`)) inPx.push(`${name} ${selector.trim()}: ${sized[0].trim()}`)
      }
    }
    expect(inPx).toEqual([])
  })

  it('lists as artwork only rules that still exist', () => {
    for (const entry of ARTWORK) {
      const [file, ...selector] = entry.split(' ')
      expect(stylesOf(resolve(src, file)), entry).toContain(`${selector.join(' ')} {`)
    }
  })
})
