import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_THEMES, PRINT_THEME, type ProjectTheme } from './beadLook'

type Theme = 'light' | 'dark' | 'contrast'
const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as {
  color: { tokens: { name: string; value: Record<Theme, string> }[] }
}
const token = (name: string, theme: Theme) => tokens.color.tokens.find((entry) => entry.name === name)!.value[theme]

/** DESIGN.md §4.2: which token each ProjectTheme field copies. */
const FIELDS: Record<Exclude<keyof ProjectTheme, 'rim' | 'rimOnBlack' | 'ownColorRim' | 'finished' | 'margin' | 'chip'>, string> = {
  background: 'board',
  canvas: 'box',
  positionMark: 'position-mark',
  pieceLine: 'line-strong',
  frameLine: 'ink',
  ruler: 'ruler',
  rulerStrong: 'body',
  emptyBead: 'bead-empty',
  marker: 'marker',
  mirror: 'mirror',
  accent: 'accent',
  outline: 'bead-outline',
}

describe('ProjectTheme', () => {
  it.each(['light', 'dark', 'contrast'] as const)('copies the %s tokens', (theme) => {
    const values = PROJECT_THEMES[theme]
    for (const [field, name] of Object.entries(FIELDS)) {
      expect(values[field as keyof typeof FIELDS], field).toBe(token(name, theme))
    }
    expect(values.rim).toBe(token('bead-rim', theme))
    expect(values.margin.line, 'margin line').toBe(token('margin-line', theme))
  })

  it.each(['light', 'dark', 'contrast'] as const)('draws the Mirror\'s Area in a colour of its own in %s, never the Selection\'s (ticket 0806)', (theme) => {
    expect(PROJECT_THEMES[theme].mirror).not.toBe(PROJECT_THEMES[theme].marker)
  })

  it('rims a near-black bead in the dark rim token (white) in light and dark, in its own rim in high contrast', () => {
    expect(PROJECT_THEMES.light.rimOnBlack).toBe(token('bead-rim', 'dark'))
    expect(PROJECT_THEMES.dark.rimOnBlack).toBe(token('bead-rim', 'dark'))
    expect(PROJECT_THEMES.contrast.rimOnBlack).toBe(token('bead-rim', 'contrast'))
  })

  it('fades finished rows by the BeadBoard card: light 28% of the color, dark 45% of its grey', () => {
    expect(PROJECT_THEMES.light.finished).toEqual({ grey: false, opacity: 0.5 })
    expect(PROJECT_THEMES.dark.finished).toEqual({ grey: false, opacity: 0.5 })
  })

  it('prints in light on the print board, whatever the app theme, in the flat bead with its rim', () => {
    expect(PRINT_THEME).toEqual({ ...PROJECT_THEMES.light, background: token('print-board', 'light'), ownColorRim: false })
  })

  it('draws beads in their own-color rim on screen in light and dark, the flat bead in high contrast (ticket 1003)', () => {
    expect([PROJECT_THEMES.light.ownColorRim, PROJECT_THEMES.dark.ownColorRim, PROJECT_THEMES.contrast.ownColorRim]).toEqual([true, true, false])
  })
})
