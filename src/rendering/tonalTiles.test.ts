import { describe, expect, it } from 'vitest'
import { channelsOf, toCielab } from '../domain/color'
import { PRINT_THEME, PROJECT_THEMES } from './beadLook'
import { canvasTheme } from './canvasBackgrounds'
import { gapColorOf, markLookAt, markLookOf, TILE_STEP_L, tileColorOf } from './tonalTiles'

describe('the tile color', () => {
  it.each([
    ['dark', 1, '#202020', '#2e2e2e'],
    ['dark', 2, '#0e0e0e', '#1c1c1c'],
    ['dark', 3, '#3b3e43', '#4a4d52'],
    ['light', 1, '#fafafa', '#e7e7e7'],
    ['light', 2, '#e6e3de', '#d4d1cc'],
    ['light', 3, '#cdcac4', '#bbb8b2'],
  ] as const)('gives the BeadBoard card\'s tile on %s background %i (%s → %s)', (theme, choice, background, tile) => {
    const look = canvasTheme(theme, choice)
    expect(look.canvas).toBe(background)
    expect(markLookOf(look)).toEqual({ color: tile, tiles: true })
  })

  it('steps a Custom color by the same rule, toward ink in the look it is drawn in, its hue kept', () => {
    for (const [custom, toward] of [['#2a3b5c', 1], ['#f0d8c0', -1]] as const) {
      const look = canvasTheme('light', 'custom', custom)
      const [from, to] = [toCielab(channelsOf(custom)), toCielab(channelsOf(markLookOf(look).color))]
      expect(to.l - from.l).toBeCloseTo(toward * TILE_STEP_L, 0)
      expect(Math.abs(to.a - from.a) + Math.abs(to.b - from.b)).toBeLessThan(1.5)
    }
  })
})

describe('markLookOf', () => {
  it('keeps the Position mark outline in high contrast and exports', () => {
    expect(markLookOf(PROJECT_THEMES.contrast)).toEqual({ color: PROJECT_THEMES.contrast.positionMark, tiles: false })
    expect(markLookOf(PRINT_THEME)).toEqual({ color: PRINT_THEME.positionMark, tiles: false })
  })

  it('keeps the outline in its own color where tiles are not shown: the draft look, a reference image', () => {
    const look = canvasTheme('light', 2)
    expect(markLookOf(look, false)).toEqual({ color: look.positionMark, tiles: false })
  })

  it('gives a page laid beside the drawing the marks the renderer draws at its scale', () => {
    const look = PROJECT_THEMES.dark
    expect(markLookAt(look, 2).tiles).toBe(true)
    expect(markLookAt(look, 2, true).tiles).toBe(false)
    // Under 5 device px a bead, the draft look.
    expect(markLookAt(look, 0.2).tiles).toBe(false)
  })
})

describe('the calm gap', () => {
  it('lies between the Background and its tile, never on either, so the grid shows everywhere', () => {
    expect(gapColorOf('#202020')).toBe('#262626')
    expect(gapColorOf('#fafafa')).toBe('#f2f2f2')
    for (const background of ['#202020', '#fafafa', '#3a5f8c']) {
      expect(gapColorOf(background)).not.toBe(background)
      expect(gapColorOf(background)).not.toBe(tileColorOf(background))
    }
  })
})
