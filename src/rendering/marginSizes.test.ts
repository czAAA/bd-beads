import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MARGIN_PX } from './marginSizes'

const repo = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(repo, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The custom properties a stylesheet declares, by name. */
const declared = (path: string) => new Map([...read(path).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
const sheets = { 'src/styles/design-values.css': declared('src/styles/design-values.css'), 'docs/design/system/components/bundle.css': declared('docs/design/system/components/bundle.css') }
const tokens = JSON.parse(read('docs/design/system/tokens.json')) as Record<'spacing' | 'radius', { tokens: { name: string; value: string }[] }>
const tokenPx = new Map([...tokens.spacing.tokens, ...tokens.radius.tokens].map(({ name, value }) => [name, value]))

/** Each value of `MARGIN_PX` by its path, and what mirrors it: a design-system token, a CSS custom property of the
 * MarginSheet card, or nothing, with the reason. */
const MIRROR: Record<string, { token: string } | { css: string } | { none: string }> = {
  'band.full': { css: '--margin-band-full' },
  'band.compact': { css: '--margin-band-compact' },
  'band.folded': { css: '--margin-band-folded' },
  'place.full.top': { css: '--margin-band-inset' },
  'place.full.side': { css: '--margin-band-inset' },
  'place.full.border': { css: '--margin-border-inset' },
  'place.compact.top': { css: '--margin-band-top-compact' },
  'place.compact.side': { css: '--margin-band-inset-compact' },
  'place.compact.border': { css: '--margin-border-inset-compact' },
  'sheetRadius.full': { token: 'radius-lg' },
  'sheetRadius.compact': { none: 'only the canvas draws the compact sheet’s corners' },
  borderRadius: { token: 'radius-sm' },
  tool: { css: '--margin-tool' },
  tab: { css: '--margin-tab' },
  moveWidth: { css: '--frame-handle-hit-width' },
  gap: { token: 'space-4' },
  'icon.full': { none: 'an IconButton’s icon size is a prop, not CSS' },
  'icon.compact': { none: 'an IconButton’s icon size is a prop, not CSS' },
}

/** Every number in a nested record, by its dotted path. */
function leaves(record: object, prefix = ''): [string, number][] {
  return Object.entries(record).flatMap(([key, value]) => (typeof value === 'number' ? [[`${prefix}${key}`, value] as [string, number]] : leaves(value as object, `${prefix}${key}.`)))
}

describe('MARGIN_PX', () => {
  it('says for every value what mirrors it', () => {
    expect(leaves(MARGIN_PX).map(([path]) => path).sort()).toEqual(Object.keys(MIRROR).sort())
  })

  it.each(leaves(MARGIN_PX))('%s matches its CSS twin', (path, px) => {
    const mirror = MIRROR[path]
    if ('token' in mirror) expect(tokenPx.get(mirror.token), mirror.token).toBe(`${px}px`)
    if ('css' in mirror) {
      for (const [sheet, values] of Object.entries(sheets)) expect(values.get(mirror.css), `${mirror.css} in ${sheet}`).toBe(`${px}px`)
    }
  })
})
