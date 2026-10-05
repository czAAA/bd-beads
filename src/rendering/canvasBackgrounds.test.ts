import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_THEMES, PRINT_THEME } from './beadLook'
import { canvasBackgrounds, canvasBackgroundOf, canvasTheme, canvasWordColor, shownChoice } from './canvasBackgrounds'

const tokens = JSON.parse(readFileSync(resolve(__dirname, '../../docs/design/system/tokens.json'), 'utf8')) as {
  color: { tokens: { name: string; value: Record<'light' | 'dark', string> }[] }
}
const token = (n: number, theme: 'light' | 'dark') => tokens.color.tokens.find((entry) => entry.name === `canvas-bg-${n}`)!.value[theme]

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('Canvas color backgrounds', () => {
  it('offers five in light, six in dark and none in high contrast', () => {
    expect(canvasBackgrounds('light').map((b) => b.id)).toEqual(['studio', 'linen', 'sage', 'mist', 'blush'])
    expect(canvasBackgrounds('dark').map((b) => b.id)).toEqual(['night', 'ink', 'midnight', 'olive', 'umber', 'ash'])
    expect(canvasBackgrounds('contrast')).toEqual([])
  })

  it('makes the defaults the canvas the theme has today ', () => {
    expect(canvasTheme('light', 1)).toEqual({ ...PROJECT_THEMES.light, background: PROJECT_THEMES.light.canvas })
    expect(canvasTheme('dark', 1)).toEqual({ ...PROJECT_THEMES.dark, background: PROJECT_THEMES.dark.canvas })
  })

  it.each([
    ['light', 5],
    ['dark', 6],
  ] as const)('copies canvas-bg-1 to canvas-bg-6 of tokens.json in %s', (theme, count) => {
    canvasBackgrounds(theme).forEach((background, index) => expect(background.color, background.id).toBe(token(index + 1, theme)))
    expect(canvasBackgrounds(theme)).toHaveLength(count)
    // Light has no sixth choice: its token is Studio, which a stored 6 shows there.
    expect(token(6, 'light')).toBe(token(1, 'light'))
  })

  it('keeps the position when the theme changes, and shows Studio for a stored 6 in light', () => {
    expect(canvasBackgroundOf('light', 3)?.id).toBe('sage')
    expect(canvasBackgroundOf('dark', 3)?.id).toBe('midnight')
    expect(shownChoice('light', 6)).toBe(1)
    expect(canvasBackgroundOf('light', 6)?.id).toBe('studio')
    expect(canvasBackgroundOf('dark', 6)?.id).toBe('ash')
  })

  it('draws high contrast white whatever is stored', () => {
    expect(canvasTheme('contrast', 4)).toBe(PROJECT_THEMES.contrast)
  })

  it('gives Ash its own greys, and no other background', () => {
    const ash = canvasTheme('dark', 6)
    expect(ash).toMatchObject({ canvas: '#2c2b29', ruler: '#a0a0a0', emptyBead: '#3d3b38', dot: '#3d3b38', rim: 'rgba(255,255,255,.16)' })
    expect(canvasWordColor('dark', 6)).toBe('#353432')
    expect(canvasTheme('dark', 5).rim).toBeNull()
    expect(canvasWordColor('dark', 5)).toBeUndefined()
  })

  it.each([
    ['light', 5],
    ['dark', 6],
  ] as const)('keeps rulers at 4.8:1 and the row marker at 13:1 on all %s backgrounds', (theme, count) => {
    for (let choice = 1; choice <= count; choice += 1) {
      const look = canvasTheme(theme, choice)
      expect(contrast(look.ruler, look.canvas), `ruler on ${canvasBackgroundOf(theme, choice)?.id}`).toBeGreaterThanOrEqual(4.8)
      expect(contrast(look.marker, look.canvas), `marker on ${canvasBackgroundOf(theme, choice)?.id}`).toBeGreaterThanOrEqual(13)
    }
  })

  it('never changes the print board that exports use', () => {
    expect(PRINT_THEME.background).toBe('#f7f3ec')
    expect(PRINT_THEME).toEqual({ ...PROJECT_THEMES.light, background: '#f7f3ec' })
  })
})
