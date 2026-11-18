import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// `elevation-float` (ticket 1063) is one shadow in two forms: a `box-shadow` list for the Tool pill and a `filter` for
// the Radial toolbox, which is not a box. CSS cannot make one from the other, so this keeps them the same shadow.
const repo = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

type Theme = 'light' | 'dark' | 'contrast'
const THEMES: Theme[] = ['light', 'dark', 'contrast']

const token = (JSON.parse(readFileSync(resolve(repo, 'docs/design/system/tokens.json'), 'utf8')) as { shadow: { tokens: { name: string; value: Record<Theme, string> }[] } }).shadow.tokens.find(
  ({ name }) => name === 'elevation-float',
)!

/** A `box-shadow` list as the `filter` that casts the same shadows: each shadow in its own `drop-shadow()`. */
function asFilter(shadows: string): string {
  if (shadows === 'none') return 'none'
  // A comma inside `rgba()` is not between two shadows.
  return shadows
    .split(/,\s*(?![^(]*\))/)
    .map((shadow) => `drop-shadow(${shadow})`)
    .join(' ')
}

/** What a stylesheet sets `--elevation-float-filter` to in each theme: light is the rule that names no other theme. */
function filtersIn(css: string): Partial<Record<Theme, string>> {
  const found: Partial<Record<Theme, string>> = {}
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const value = /--elevation-float-filter:\s*([^;]+);/.exec(body!)?.[1]?.trim()
    if (value === undefined) continue
    const theme = selectors!.includes('"dark"') ? 'dark' : selectors!.includes('"contrast"') ? 'contrast' : 'light'
    found[theme] = value
  }
  return found
}

describe('elevation-float', () => {
  it.each(['src/styles/design-values.css', 'docs/design/system/components/bundle.css'])('is the same shadow as a filter in %s, in every theme', (path) => {
    const filters = filtersIn(read(path))
    for (const theme of THEMES) expect(filters[theme], theme).toBe(asFilter(token.value[theme]))
  })
})
