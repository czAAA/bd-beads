import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { channelsOf, relativeLuminance } from '../domain/color'

// Pairs the ContrastAudit card lists for `danger` and `button-line` (ticket 0855): `danger` is text at 4.5:1 on every
// surface it is drawn on and a red of its own in light; a secondary button's border is its only edge in dark, so 3:1.
type Theme = 'light' | 'dark' | 'contrast'
interface ColorToken {
  name: string
  value: Record<Theme, string>
}
const tokens = (JSON.parse(readFileSync(join(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as { color: { tokens: ColorToken[] } }).color.tokens
const color = (name: string, theme: Theme) => tokens.find((token) => token.name === name)!.value[theme]

function ratio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(channelsOf(a)), relativeLuminance(channelsOf(b))].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const THEMES: Theme[] = ['light', 'dark', 'contrast']

describe.each(THEMES)('danger in %s', (theme) => {
  it.each(['canvas', 'surface', 'panel', 'elevated', 'box'])('reads at 4.5:1 or more on %s', (surface) => {
    expect(ratio(color('danger', theme), color(surface, theme))).toBeGreaterThanOrEqual(4.5)
  })

  it('carries its on-danger label at 4.5:1 or more', () => {
    expect(ratio(color('on-danger', theme), color('danger', theme))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('danger in light', () => {
  it('is a red of its own, not the strong accent', () => {
    expect(color('danger', 'light')).not.toBe(color('accent-strong', 'light'))
  })
})

describe('button-line in dark', () => {
  it.each(['box', 'panel', 'elevated', 'canvas'])('shows at 3:1 or more against %s', (surface) => {
    expect(ratio(color('button-line', 'dark'), color(surface, 'dark'))).toBeGreaterThanOrEqual(3)
  })
})
