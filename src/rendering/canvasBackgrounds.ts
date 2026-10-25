import type { ResolvedTheme } from '../theme/theme'
import { PROJECT_THEMES, type ProjectTheme } from './beadLook'

// The drawing area's background, picked by the person (tickets 252, 554; CanvasBackground card): five in light, five in
// dark. The app stores the choice's number, not its color, so switching theme keeps the position. Colors are tokens
// `canvas-bg-1`..`5` copied (a canvas can't read CSS); canvasBackgrounds.test.ts checks them.
type CanvasBackgroundId = 'studio' | 'linen' | 'stone' | 'fog' | 'pebble' | 'night' | 'ink' | 'midnight' | 'ash' | 'slate'

export interface CanvasBackground {
  id: CanvasBackgroundId
  color: string
  /** The empty bead and the ruler numbers made for this background, where the theme's own would not read; the
   * CanvasBackground card lists them. */
  look?: { emptyBead: string; ruler: string; rulerStrong?: string }
}

const LIGHT: readonly CanvasBackground[] = [
  { id: 'studio', color: '#fafafa' },
  { id: 'linen', color: '#f7f3ec' },
  { id: 'stone', color: '#e6e3de', look: { emptyBead: '#cbc6bf', ruler: '#5c5c5c' } },
  { id: 'fog', color: '#e3e7ec', look: { emptyBead: '#c9ced5', ruler: '#5c5c5c' } },
  { id: 'pebble', color: '#cdcac4', look: { emptyBead: '#b3afa8', ruler: '#444444', rulerStrong: '#262626' } },
]

const DARK: readonly CanvasBackground[] = [
  { id: 'night', color: '#202020' },
  { id: 'ink', color: '#0e0e0e', look: { emptyBead: '#2c2c2c', ruler: '#8c8c8c' } },
  { id: 'midnight', color: '#12161c', look: { emptyBead: '#262c35', ruler: '#8c8c8c' } },
  { id: 'ash', color: '#2c2b29', look: { emptyBead: '#3d3b38', ruler: '#a0a0a0' } },
  { id: 'slate', color: '#3b3e43', look: { emptyBead: '#50545a', ruler: '#b4b4b4' } },
]

/** The backgrounds on offer in a theme, in order; none in high contrast, where the drawing area is white. */
export function canvasBackgrounds(theme: ResolvedTheme): readonly CanvasBackground[] {
  if (theme === 'light') return LIGHT
  return theme === 'dark' ? DARK : []
}

/** How many backgrounds the highest stored number can mean. */
export const CANVAS_BACKGROUND_MAX = 5

/** The 1-based position that shows in a theme: a stored number out of range shows the first. */
export function shownChoice(theme: ResolvedTheme, choice: number): number {
  return choice >= 1 && choice <= canvasBackgrounds(theme).length ? choice : 1
}

/** The background a choice shows in a theme, or undefined in high contrast. */
export function canvasBackgroundOf(theme: ResolvedTheme, choice: number): CanvasBackground | undefined {
  return canvasBackgrounds(theme)[shownChoice(theme, choice) - 1]
}

/** The colors the Project is drawn in on the Canvas: the theme's, on the chosen background. Exports don't use this
 * (they print on PRINT_THEME). */
export function canvasTheme(theme: ResolvedTheme, choice: number): ProjectTheme {
  const base = PROJECT_THEMES[theme]
  const background = canvasBackgroundOf(theme, choice)
  if (!background) return base
  const look: ProjectTheme = { ...base, canvas: background.color, background: background.color }
  if (background.look) {
    look.ruler = background.look.ruler
    look.rulerStrong = background.look.rulerStrong ?? base.rulerStrong
    look.positionMark = background.look.emptyBead
    look.emptyBead = background.look.emptyBead
  }
  return look
}

// The first list had these names in this order (tickets 252, 284); the stored number meant one of them.
const FIRST_LIGHT = ['studio', 'linen', 'sage', 'mist', 'blush']
const FIRST_DARK = ['night', 'ink', 'midnight', 'olive', 'umber', 'ash']

/** The stored number in today's list for a number stored under the first one (ticket 554), moved by name: a dropped
 * background falls back to the theme's default, Mist becomes Fog, and Ash moves up from 6 to 4. */
export function migratedChoice(theme: ResolvedTheme, stored: number): number {
  const dark = theme === 'dark'
  const first = (dark ? FIRST_DARK : FIRST_LIGHT)[stored - 1]
  const renamed = first === 'mist' ? 'fog' : first
  const index = canvasBackgrounds(dark ? 'dark' : 'light').findIndex((background) => background.id === renamed)
  return index + 1 || 1
}
