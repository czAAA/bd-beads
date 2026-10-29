import { BLACK, BLACK_WHITE_BALANCE, channelsOf, contrastRatio, mix, relativeLuminance, toHex, WHITE } from '../domain/color'
import type { ResolvedTheme } from '../theme/theme'
import { PROJECT_THEMES, type ProjectTheme } from './beadLook'
import { autoMarginColor, marginLookOn, readableGrey, RULER_CONTRAST, STRONG_RULER_CONTRAST } from './marginLook'

// The drawing area's background, picked by the person (tickets 252, 554; CanvasBackground card): five in light, five in
// dark. The app stores the choice's number, not its color, so switching theme keeps the position. Colors are tokens
// `canvas-bg-1`..`5` copied (a canvas can't read CSS); canvasBackgrounds.test.ts checks them.
type ListedBackgroundId = 'studio' | 'linen' | 'stone' | 'fog' | 'pebble' | 'night' | 'ink' | 'midnight' | 'ash' | 'slate'

/** What is stored: a position in the theme's list, or `custom` for the person's own Custom color (ticket 0653). */
export type CanvasChoice = number | 'custom'

export interface CanvasBackground {
  id: ListedBackgroundId | 'custom'
  color: string
  /** The look a Custom color is drawn in, whatever the theme: dark on a dark color, light on a light one. */
  base?: 'light' | 'dark'
  /** The empty bead and the ruler numbers made for this background, where the theme's own would not read; the
   * CanvasBackground card lists them. A Custom color's marker too, where the look's would not. */
  look?: { emptyBead: string; ruler: string; rulerStrong?: string; marker?: string }
}

/** One of a theme's list, each with its own name. */
type ListedBackground = CanvasBackground & { id: ListedBackgroundId }

const LIGHT: readonly ListedBackground[] = [
  { id: 'studio', color: '#fafafa' },
  { id: 'linen', color: '#f7f3ec' },
  { id: 'stone', color: '#e6e3de', look: { emptyBead: '#cbc6bf', ruler: '#5c5c5c' } },
  { id: 'fog', color: '#e3e7ec', look: { emptyBead: '#c9ced5', ruler: '#5c5c5c' } },
  { id: 'pebble', color: '#cdcac4', look: { emptyBead: '#b3afa8', ruler: '#444444', rulerStrong: '#262626' } },
]

const DARK: readonly ListedBackground[] = [
  { id: 'night', color: '#202020' },
  { id: 'ink', color: '#0e0e0e', look: { emptyBead: '#2c2c2c', ruler: '#8c8c8c' } },
  { id: 'midnight', color: '#12161c', look: { emptyBead: '#262c35', ruler: '#8c8c8c' } },
  { id: 'ash', color: '#2c2b29', look: { emptyBead: '#3d3b38', ruler: '#a0a0a0' } },
  { id: 'slate', color: '#3b3e43', look: { emptyBead: '#50545a', ruler: '#b4b4b4' } },
]

/** The backgrounds on offer in a theme, in order; none in high contrast, where the drawing area is white. */
export function canvasBackgrounds(theme: ResolvedTheme): readonly ListedBackground[] {
  if (theme === 'light') return LIGHT
  return theme === 'dark' ? DARK : []
}

/** How many backgrounds the highest stored number can mean. */
export const CANVAS_BACKGROUND_MAX = 5

/** The choice that shows in a theme: a stored number out of range, or Custom with no Custom color, shows the first. */
export function shownChoice(theme: ResolvedTheme, choice: CanvasChoice, customColor?: string): CanvasChoice {
  if (choice === 'custom') return customColor ? 'custom' : 1
  return choice >= 1 && choice <= canvasBackgrounds(theme).length ? choice : 1
}

/** The background a choice shows in a theme, or undefined in high contrast, which stays white even for Custom. */
export function canvasBackgroundOf(theme: ResolvedTheme, choice: CanvasChoice, customColor?: string): CanvasBackground | undefined {
  const list = canvasBackgrounds(theme)
  if (!list.length) return undefined
  const shown = shownChoice(theme, choice, customColor)
  return shown === 'custom' ? customBackground(customColor!) : list[shown - 1]
}

/** How far an empty bead steps from a Custom color toward ink: Night's own step to its `#3c3c3c`. */
const EMPTY_BEAD_STEP = 0.125
/** The least a row marker keeps on a Custom color (WCAG for a graphic) before it takes the look's ink instead. */
const MARKER_CONTRAST = 3

/** A Custom color with its own empty bead, rulers and marker (ticket 0653), in the look it reads best in. */
function customBackground(color: string): CanvasBackground {
  const background = channelsOf(color)
  const dark = relativeLuminance(background) < BLACK_WHITE_BALANCE
  const base = PROJECT_THEMES[dark ? 'dark' : 'light']
  const ink = dark ? WHITE : BLACK
  return {
    id: 'custom',
    color,
    base: dark ? 'dark' : 'light',
    look: {
      emptyBead: toHex(mix(background, ink, EMPTY_BEAD_STEP)),
      ruler: readableGrey(base.ruler, RULER_CONTRAST, color),
      rulerStrong: readableGrey(base.rulerStrong, STRONG_RULER_CONTRAST, color),
      marker: contrastRatio(channelsOf(base.marker), background) >= MARKER_CONTRAST ? base.marker : base.outline,
    },
  }
}

/** The margin color as stored (ticket 0656, MarginSheet card): Auto, a position in the theme's list as for the Canvas
 * color, or `custom` for the person's own. */
export type MarginChoice = 'auto' | CanvasChoice

/** The margin color picked, and the last Custom color taken for it. */
export interface MarginPick {
  choice: MarginChoice
  customColor?: string
}

const AUTO_MARGIN: MarginPick = { choice: 'auto' }

/** The margin color shown with a Canvas color: Auto (the Canvas color one step off, in the look it is drawn in), a
 * picked one, or white in high contrast. A number out of range, or Custom with no color, is Auto. */
export function marginColorOf(theme: ResolvedTheme, choice: CanvasChoice, customColor?: string, margin: MarginPick = AUTO_MARGIN): string {
  const background = canvasBackgroundOf(theme, choice, customColor)
  if (!background) return PROJECT_THEMES.contrast.margin.fill
  const picked = margin.choice === 'auto' ? undefined : margin.choice === 'custom' ? margin.customColor : canvasBackgrounds(theme)[margin.choice - 1]?.color
  return picked ?? autoMarginColor(background.color, background.base ?? (theme === 'dark' ? 'dark' : 'light'))
}

/** The colors the Project is drawn in on the Canvas: the theme's, on the chosen background, with its margin sheet.
 * Exports don't use this (they print on PRINT_THEME). */
export function canvasTheme(theme: ResolvedTheme, choice: CanvasChoice, customColor?: string, margin: MarginPick = AUTO_MARGIN): ProjectTheme {
  const background = canvasBackgroundOf(theme, choice, customColor)
  const base = PROJECT_THEMES[background?.base ?? theme]
  if (!background) return base
  const look: ProjectTheme = { ...base, canvas: background.color, background: background.color }
  if (background.look) {
    look.ruler = background.look.ruler
    look.rulerStrong = background.look.rulerStrong ?? base.rulerStrong
    look.marker = background.look.marker ?? base.marker
    look.positionMark = background.look.emptyBead
    look.emptyBead = background.look.emptyBead
  }
  look.margin = marginLookOn(marginColorOf(theme, choice, customColor, margin), look)
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
