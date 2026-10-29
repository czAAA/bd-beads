import { BLACK, BLACK_WHITE_BALANCE, channelsOf, contrastRatio, mix, relativeLuminance, toHex, WHITE } from '../domain/color'

// The Frame's margin drawn as a sheet of drafting paper (MarginSheet card, ticket 0656): its fill, its lines and the
// rulers that sit on it. Colors are the `margin-line` token copied (a canvas can't read CSS); canvasBackgrounds.test.ts
// checks them.

/** How the margin's sheet is drawn on the Canvas. */
export interface MarginLook {
  /** The margin color: Auto (the Canvas color one step off) or the one picked. */
  fill: string
  /** Its inner border (`margin-line`). */
  line: string
  /** The hairline round its outside, and how many px wide: `margin-line` 1px, black 2px in high contrast. */
  edge: string
  edgeWidth: number
  /** The ruler numbers on it, regular and every 5th, readable on `fill`. */
  ruler: string
  rulerStrong: string
}

/** How far Auto steps the Canvas color: toward white in the dark look, toward black in the light one, hue kept. */
const AUTO_STEP = 0.05
/** The contrast the rulers keep on a background (WCAG AA for text), and a strong one (AAA): on the margin and on a
 * Custom Canvas color alike. */
export const RULER_CONTRAST = 4.5
export const STRONG_RULER_CONTRAST = 7

/** The `margin-line` token in light and dark: a dark tint on a light sheet, a light tint on a dark one. */
const MARGIN_LINE = { light: 'rgba(20,20,19,.16)', dark: 'rgba(255,255,255,.18)' } as const

/** The Auto margin color: `canvas` one step off, in the look the Project is drawn in on it. */
export function autoMarginColor(canvas: string, look: 'light' | 'dark'): string {
  return toHex(mix(channelsOf(canvas), look === 'dark' ? WHITE : BLACK, AUTO_STEP))
}

/** The grey nearest `start` that reads at `ratio` on `background`, moving toward white on a dark background and black
 * on a light one; that ink itself when no grey does. */
export function readableGrey(start: string, ratio: number, background: string): string {
  const behind = channelsOf(background)
  const dark = relativeLuminance(behind) < BLACK_WHITE_BALANCE
  for (let level = channelsOf(start).r; level >= 0 && level <= 255; level += dark ? 1 : -1) {
    const grey = { r: level, g: level, b: level }
    if (contrastRatio(grey, behind) >= ratio) return toHex(grey)
  }
  return toHex(dark ? WHITE : BLACK)
}

/** The sheet in `fill`, its lines the `margin-line` tint that reads on it and its rulers the nearest greys to the
 * look's own that read on it (MarginSheet card). */
export function marginLookOn(fill: string, look: { ruler: string; rulerStrong: string }): MarginLook {
  const line = MARGIN_LINE[relativeLuminance(channelsOf(fill)) < BLACK_WHITE_BALANCE ? 'dark' : 'light']
  return {
    fill,
    line,
    edge: line,
    edgeWidth: 1,
    ruler: readableGrey(look.ruler, RULER_CONTRAST, fill),
    rulerStrong: readableGrey(look.rulerStrong, STRONG_RULER_CONTRAST, fill),
  }
}
