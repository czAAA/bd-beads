import { BLACK_WHITE_BALANCE, fromHex, luma, relativeLuminance, toHex } from '../domain/color'
import { BLACK_TONE } from '../domain/printTones'
import { PRINT_THEME, type ProjectTheme } from './beadLook'
import { PRINT_COLORS } from './printColors'
import type { PrintText } from './printText'

// What a printed page after the Cover page is drawn in (ticket 1096): the color pages' colors, or Black and white's one
// ink (PrintBlackAndWhite card), where every text and line is black and each bead takes its color's tone.

type PrintColors = { readonly [Role in keyof typeof PRINT_COLORS]: string }

export interface PrintInk {
  /** Black and white: one ink, every bead on paper, a light tint or solid black. */
  oneInk: boolean
  /** The roles text and lines take (PRINT_COLORS, or all black on white paper). */
  colors: PrintColors
  /** A chart bead's or a swatch's fill, and its Swatch letter's color on it. */
  fill(hex: string): string
  letter(hex: string): string
  /** Whether a bead prints solid black: its cell lines give way to paper, so two black beads never run together. */
  solid(hex: string): boolean
  /** A bead on the overview, which carries no letter: its color, or its color's own grey; and the theme it is drawn in. */
  overview(hex: string): string
  overviewTheme: ProjectTheme
}

/** The colour of a Swatch letter on a bead of this color on the color pages: `ink` on a light one, white on a dark one,
 * by the same balance as markOn (`--print-letter-balance`); ink on a color it cannot read.
 * @internal Its test checks the switch from ink to white on its own. */
export function letterColor(hex: string): string {
  const rgb = fromHex(hex)
  return !rgb || relativeLuminance(rgb) > BLACK_WHITE_BALANCE ? PRINT_COLORS.ink : PRINT_COLORS.paper
}

/** The color pages. The Cover page is always drawn in it. */
export const COLOR_INK: PrintInk = {
  oneInk: false,
  colors: PRINT_COLORS,
  fill: (hex) => hex,
  letter: letterColor,
  solid: () => false,
  overview: (hex) => hex,
  overviewTheme: PRINT_THEME,
}

const BLACK = '#000000'
/** A neutral grey for what the print theme tints warm: an empty position's mark and bead. */
const NEUTRAL = '#d8d8d8'

/** The overview in one ink: no board under the beads, and nothing warm. */
const ONE_INK_THEME: ProjectTheme = { ...PRINT_THEME, background: PRINT_COLORS.paper, canvas: PRINT_COLORS.paper, positionMark: NEUTRAL, emptyBead: NEUTRAL }

/** Every role black but the paper's; the board is the paper, as the overview has no pale board in one ink. */
const ONE_INK_COLORS: PrintColors = {
  ...(Object.fromEntries(Object.keys(PRINT_COLORS).map((role) => [role, BLACK])) as Record<keyof typeof PRINT_COLORS, string>),
  paper: PRINT_COLORS.paper,
  board: PRINT_COLORS.paper,
}

/** Black at `share` of full, as a fill. */
function toneHex(share: number): string {
  const level = Math.round(255 * (1 - share))
  return toHex({ r: level, g: level, b: level })
}

/** The ink a page after the cover is drawn in: one ink with Black and white's tones, else the color pages'. */
export function printInkOf(words: Pick<PrintText, 'tones'>): PrintInk {
  const { tones } = words
  if (!tones) return COLOR_INK
  const toneOf = (hex: string) => tones[hex] ?? 0
  return {
    oneInk: true,
    colors: ONE_INK_COLORS,
    fill: (hex) => toneHex(toneOf(hex)),
    letter: (hex) => (toneOf(hex) === BLACK_TONE ? PRINT_COLORS.paper : BLACK),
    solid: (hex) => toneOf(hex) === BLACK_TONE,
    overview: (hex) => {
      const rgb = fromHex(hex)
      return rgb ? toneHex(1 - luma(rgb) / 255) : NEUTRAL
    },
    overviewTheme: ONE_INK_THEME,
  }
}
