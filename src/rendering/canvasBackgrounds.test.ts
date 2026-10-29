import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { channelsOf, contrastRatio } from '../domain/color'
import { PROJECT_THEMES, PRINT_THEME } from './beadLook'
import { canvasBackgrounds, canvasBackgroundOf, canvasTheme, marginColorOf, migratedChoice, shownChoice } from './canvasBackgrounds'

const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as {
  color: { tokens: { name: string; value: Record<'light' | 'dark', string> }[] }
}
const token = (n: number, theme: 'light' | 'dark') => tokens.color.tokens.find((entry) => entry.name === `canvas-bg-${n}`)!.value[theme]

const contrast = (a: string, b: string) => contrastRatio(channelsOf(a), channelsOf(b))

describe('Canvas color backgrounds', () => {
  it('offers five in light, five in dark and none in high contrast', () => {
    expect(canvasBackgrounds('light').map((b) => b.id)).toEqual(['studio', 'linen', 'stone', 'fog', 'pebble'])
    expect(canvasBackgrounds('dark').map((b) => b.id)).toEqual(['night', 'ink', 'midnight', 'ash', 'slate'])
    expect(canvasBackgrounds('contrast')).toEqual([])
  })

  it('makes the defaults the canvas the theme has today ', () => {
    expect(canvasTheme('light', 1)).toEqual({ ...PROJECT_THEMES.light, background: PROJECT_THEMES.light.canvas })
    expect(canvasTheme('dark', 1)).toEqual({ ...PROJECT_THEMES.dark, background: PROJECT_THEMES.dark.canvas })
  })

  it.each(['light', 'dark'] as const)('copies canvas-bg-1 to canvas-bg-5 of tokens.json in %s', (theme) => {
    canvasBackgrounds(theme).forEach((background, index) => expect(background.color, background.id).toBe(token(index + 1, theme)))
    expect(canvasBackgrounds(theme)).toHaveLength(5)
  })

  it('has no sixth token any more', () => {
    expect(tokens.color.tokens.some((entry) => entry.name === 'canvas-bg-6')).toBe(false)
  })

  it('keeps the position when the theme changes', () => {
    expect(canvasBackgroundOf('light', 3)?.id).toBe('stone')
    expect(canvasBackgroundOf('dark', 3)?.id).toBe('midnight')
    expect(shownChoice('light', 6)).toBe(1)
  })

  it('draws high contrast white whatever is stored', () => {
    expect(canvasTheme('contrast', 4)).toBe(PROJECT_THEMES.contrast)
  })

  it.each(['light', 'dark'] as const)('draws the theme\'s bead rim on every %s background (ticket 0460)', (theme) => {
    for (let choice = 1; choice <= canvasBackgrounds(theme).length; choice++) {
      expect(canvasTheme(theme, choice).rim, `${theme} ${choice}`).toBe(PROJECT_THEMES[theme].rim)
    }
  })

  it.each([
    ['light', 1, '#d8d2cc', '#6a6a6a'],
    ['light', 2, '#d8d2cc', '#6a6a6a'],
    ['light', 3, '#cbc6bf', '#5c5c5c'],
    ['light', 4, '#c9ced5', '#5c5c5c'],
    ['light', 5, '#b3afa8', '#444444'],
    ['dark', 1, '#3c3c3c', '#8c8c8c'],
    ['dark', 2, '#2c2c2c', '#8c8c8c'],
    ['dark', 3, '#262c35', '#8c8c8c'],
    ['dark', 4, '#3d3b38', '#a0a0a0'],
    ['dark', 5, '#50545a', '#b4b4b4'],
  ] as const)('gives %s background %i its own empty bead %s and ruler %s', (theme, choice, emptyBead, ruler) => {
    expect(canvasTheme(theme, choice)).toMatchObject({ emptyBead, positionMark: emptyBead, ruler })
  })

  it.each([
    ['light', 4],
    ['dark', 10],
  ] as const)('keeps rulers at 4.5:1 and the row marker at 4:1 (light, royal blue, ticket 369) or 10:1 (dark) on all %s backgrounds (Pebble and Slate are the darkest ones, ticket 554)', (theme, marker) => {
    for (let choice = 1; choice <= 5; choice += 1) {
      const look = canvasTheme(theme, choice)
      const id = canvasBackgroundOf(theme, choice)?.id
      expect(contrast(look.ruler, look.canvas), `ruler on ${id}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(look.rulerStrong, look.canvas), `strong ruler on ${id}`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(look.marker, look.canvas), `marker on ${id}`).toBeGreaterThanOrEqual(marker)
    }
  })

  it('shows the Custom color (ticket 0653) in light and dark alike, and the first background while there is none', () => {
    expect(canvasBackgroundOf('light', 'custom', '#7a2e8c')).toMatchObject({ id: 'custom', color: '#7a2e8c' })
    expect(canvasBackgroundOf('dark', 'custom', '#7a2e8c')).toMatchObject({ id: 'custom', color: '#7a2e8c' })
    expect(canvasBackgroundOf('light', 'custom')?.id).toBe('studio')
    expect(shownChoice('dark', 'custom', '#7a2e8c')).toBe('custom')
    expect(shownChoice('dark', 'custom')).toBe(1)
    expect(canvasTheme('contrast', 'custom', '#7a2e8c')).toBe(PROJECT_THEMES.contrast)
  })

  it('draws on a dark Custom color in the dark look and on a light one in the light look, whatever the theme', () => {
    expect(canvasTheme('light', 'custom', '#14213d')).toMatchObject({ canvas: '#14213d', background: '#14213d', marker: PROJECT_THEMES.dark.marker, rim: PROJECT_THEMES.dark.rim })
    expect(canvasTheme('dark', 'custom', '#fde68a')).toMatchObject({ canvas: '#fde68a', marker: PROJECT_THEMES.light.marker, rim: PROJECT_THEMES.light.rim })
  })

  it.each(['#ffffff', '#fde68a', '#9ca3af', '#777777', '#767676', '#e03c3c', '#3b82f6', '#14213d', '#000000'])(
    'keeps rulers at 4.5:1, the row marker at 3:1 and empty beads off the background on the Custom color %s',
    (color) => {
      const look = canvasTheme('light', 'custom', color)
      expect(contrast(look.ruler, color)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(look.rulerStrong, color)).toBeGreaterThanOrEqual(contrast(look.ruler, color))
      expect(contrast(look.marker, color)).toBeGreaterThanOrEqual(3)
      expect(contrast(look.emptyBead, color)).toBeGreaterThan(1.15)
    },
  )

  it('never changes the print board that exports use', () => {
    expect(PRINT_THEME.background).toBe('#f7f3ec')
    expect(PRINT_THEME).toEqual({ ...PROJECT_THEMES.light, background: '#f7f3ec' })
  })

  it.each([
    ['light', 1, 1],
    ['light', 2, 2],
    ['light', 3, 1],
    ['light', 4, 4],
    ['light', 5, 1],
    ['light', 6, 1],
    ['dark', 1, 1],
    ['dark', 3, 3],
    ['dark', 4, 1],
    ['dark', 5, 1],
    ['dark', 6, 4],
  ] as const)('moves a first-list %s choice %i to %i by name', (theme, stored, moved) => {
    expect(migratedChoice(theme, stored)).toBe(moved)
  })
})

describe('the margin color (ticket 0656, MarginSheet card)', () => {
  it.each([
    ['dark', 5, '#45484c'],
    ['dark', 1, '#2b2b2b'],
    ['light', 2, '#ebe7e0'],
    ['light', 1, '#eeeeee'],
  ] as const)('is Auto by default: %s background %i one step off, %s', (theme, choice, margin) => {
    expect(marginColorOf(theme, choice)).toBe(margin)
    expect(canvasTheme(theme, choice).margin.fill).toBe(margin)
  })

  it('steps a Custom Canvas color toward white in the dark look and toward black in the light look', () => {
    // #14213d is drawn in the dark look, #fde68a in the light one, whatever the theme.
    expect(marginColorOf('light', 'custom', '#14213d')).toBe('#202c47')
    expect(marginColorOf('dark', 'custom', '#fde68a')).toBe('#f0db83')
  })

  it('takes a picked one of the theme\'s five, by position, or the person\'s Custom color', () => {
    expect(marginColorOf('light', 1, undefined, { choice: 3 })).toBe('#e6e3de')
    expect(marginColorOf('dark', 1, undefined, { choice: 3 })).toBe('#12161c')
    expect(marginColorOf('dark', 1, undefined, { choice: 'custom', customColor: '#7a2e8c' })).toBe('#7a2e8c')
    expect(marginColorOf('dark', 1, undefined, { choice: 'custom' })).toBe('#2b2b2b')
  })

  it('is white with a 2px black edge in high contrast, whatever is picked', () => {
    expect(marginColorOf('contrast', 1, undefined, { choice: 'custom', customColor: '#7a2e8c' })).toBe('#ffffff')
    expect(PROJECT_THEMES.contrast.margin).toMatchObject({ fill: '#ffffff', line: '#595959', edge: '#000000', edgeWidth: 2 })
  })

  it.each(['light', 'dark'] as const)('draws its lines in the %s margin-line token, its edge 1px', (theme) => {
    const line = tokens.color.tokens.find((entry) => entry.name === 'margin-line')!.value[theme]
    expect(canvasTheme(theme, 1).margin).toMatchObject({ line, edge: line, edgeWidth: 1 })
  })

  it.each(['#ffffff', '#fde68a', '#14213d', '#000000'])('keeps the rulers on it at 4.5:1 and the 5th numbers at 7:1, on the margin color %s', (color) => {
    const { margin } = canvasTheme('light', 1, undefined, { choice: 'custom', customColor: color })
    expect(contrast(margin.ruler, color)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(margin.rulerStrong, color)).toBeGreaterThanOrEqual(7)
  })

  it.each(['#777777', '#e03c3c'])('keeps the rulers at 4.5:1 on the mid-grey margin color %s, where no grey reaches 7:1', (color) => {
    const { margin } = canvasTheme('dark', 1, undefined, { choice: 'custom', customColor: color })
    expect(contrast(margin.ruler, color)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(margin.rulerStrong, color)).toBeGreaterThanOrEqual(contrast(margin.ruler, color))
  })
})
