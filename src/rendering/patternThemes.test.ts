import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PATTERN_THEMES, PRINT_THEME, type PatternTheme } from './beadLook'

type Theme = 'light' | 'dark' | 'contrast'
const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as {
  color: { tokens: { name: string; value: Record<Theme, string> }[] }
}
const token = (name: string, theme: Theme) => tokens.color.tokens.find((entry) => entry.name === name)!.value[theme]

/** DESIGN.md §4.2: which token each PatternTheme field copies. */
const FIELDS: Record<Exclude<keyof PatternTheme, 'rim' | 'finished' | 'cursorWidth'>, string> = {
  background: 'board',
  emptyBead: 'bead-empty',
  seam: 'bead-seam',
  marker: 'marker',
  outline: 'bead-outline',
  cursor: 'focus-ring',
}

describe('PatternTheme', () => {
  it.each(['light', 'dark', 'contrast'] as const)('copies the %s tokens', (theme) => {
    const values = PATTERN_THEMES[theme]
    for (const [field, name] of Object.entries(FIELDS)) {
      expect(values[field as keyof typeof FIELDS], field).toBe(token(name, theme))
    }
    // A rim drawn in the board's own color is no rim: the renderer skips it.
    const rim = token('bead-rim', theme)
    expect(values.rim).toBe(rim === token('board', theme) ? null : rim)
  })

  it('fades finished rows by the BeadBoard card: light 28% of the color, dark 45% of its grey', () => {
    expect(PATTERN_THEMES.light.finished).toEqual({ grey: false, opacity: 0.28 })
    expect(PATTERN_THEMES.dark.finished).toEqual({ grey: true, opacity: 0.45 })
  })

  it('prints in light on the print board, whatever the app theme', () => {
    expect(PRINT_THEME).toEqual({ ...PATTERN_THEMES.light, background: token('print-board', 'light') })
  })
})
