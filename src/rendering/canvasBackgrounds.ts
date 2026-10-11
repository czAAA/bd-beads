import type { ResolvedTheme } from '../theme/theme'
import { PROJECT_THEMES, type ProjectTheme } from './beadLook'

/**
 * The drawing area's background, which the person picks (ticket 252; CanvasBackground card): five in light, six in dark.
 * The app stores the choice's number, not its color, so switching theme keeps the position. The colors are the design
 * system's `canvas-bg-1` to `canvas-bg-6` tokens, copied here because a canvas can't read CSS; canvasBackgrounds.test.ts
 * keeps them equal to tokens.json. Light has no sixth, so a stored 6 shows Studio there (`canvas-bg-6` light).
 */
type CanvasBackgroundId = 'studio' | 'linen' | 'sage' | 'mist' | 'blush' | 'night' | 'ink' | 'midnight' | 'olive' | 'umber' | 'ash'

export interface CanvasBackground {
  id: CanvasBackgroundId
  color: string
}

const LIGHT: readonly CanvasBackground[] = [
  { id: 'studio', color: '#fafafa' },
  { id: 'linen', color: '#f7f3ec' },
  { id: 'sage', color: '#f1f5ee' },
  { id: 'mist', color: '#eff4f8' },
  { id: 'blush', color: '#fbf0ea' },
]

const DARK: readonly CanvasBackground[] = [
  { id: 'night', color: '#202020' },
  { id: 'ink', color: '#0e0e0e' },
  { id: 'midnight', color: '#12161c' },
  { id: 'olive', color: '#171608' },
  { id: 'umber', color: '#1c1714' },
  { id: 'ash', color: '#2c2b29' },
]

/** The backgrounds on offer in a theme, in order; none in high contrast, where the drawing area is white. */
export function canvasBackgrounds(theme: ResolvedTheme): readonly CanvasBackground[] {
  if (theme === 'light') return LIGHT
  return theme === 'dark' ? DARK : []
}

/** How many backgrounds the highest stored number can mean: 6, the most dark offers. */
export const CANVAS_BACKGROUND_MAX = DARK.length

/** The 1-based position that shows in a theme: a number light has no background for (6) shows its first, and stays stored. */
export function shownChoice(theme: ResolvedTheme, choice: number): number {
  return choice >= 1 && choice <= canvasBackgrounds(theme).length ? choice : 1
}

/** The background a choice shows in a theme, or undefined in high contrast. */
export function canvasBackgroundOf(theme: ResolvedTheme, choice: number): CanvasBackground | undefined {
  return canvasBackgrounds(theme)[shownChoice(theme, choice) - 1]
}

/** Ash, the lightest dark background, needs its own greys to stay legible. */
const ASH = { ruler: '#a0a0a0', emptyBead: '#3d3b38', word: '#353432', rim: 'rgba(255,255,255,.16)' }

function isAsh(theme: ResolvedTheme, choice: number): boolean {
  return canvasBackgroundOf(theme, choice)?.id === 'ash'
}

/** The colors the Project is drawn in on the open canvas: the theme's, on the chosen background. Exports don't use this (they print on PRINT_THEME). */
export function canvasTheme(theme: ResolvedTheme, choice: number): ProjectTheme {
  const base = PROJECT_THEMES[theme]
  const background = canvasBackgroundOf(theme, choice)
  if (!background) return base
  const look: ProjectTheme = { ...base, canvas: background.color, background: background.color }
  if (isAsh(theme, choice)) {
    look.ruler = ASH.ruler
    look.positionMark = ASH.emptyBead
    look.emptyBead = ASH.emptyBead
    look.rim = ASH.rim
  }
  return look
}

/** The technique word's color on the chosen background, where it isn't the theme's own `word` token. */
export function canvasWordColor(theme: ResolvedTheme, choice: number): string | undefined {
  return isAsh(theme, choice) ? ASH.word : undefined
}
