import { BLACK_WHITE_BALANCE, fromHex, luma, relativeLuminance } from './color'

// Black and white's tones (ticket 1096; PrintBlackAndWhite card): a 600 dpi office printer keeps a small letter sharp only
// on paper, a light tint or solid black, so each color of the piece prints on one of those, in the order of its grey.

/** `print-tone-step` and `print-tone-max`, the tints a bead with a black letter gets as a share of black, and
 * `print-black-share`, the most of the beads the darkest colors may cover and still print solid black.
 * @internal printPages.test.ts keeps them equal to the tokens. */
export const PRINT_TONE = { step: 0.1, max: 0.3, blackShare: 0.25 } as const
/** Solid black, under a white letter. */
export const BLACK_TONE = 1

/** Paper and the tints, lightest first. */
const TINTS = Array.from({ length: Math.round(PRINT_TONE.max / PRINT_TONE.step) + 1 }, (_, index) => Math.round(index * PRINT_TONE.step * 10) / 10)

interface CountedColor {
  hex: string
  count: number
}

/** The colors cut into at most `groups` runs of neighbours in grey order, at the widest gaps between them. */
function groupedByGrey(colors: readonly (CountedColor & { grey: number })[], groups: number): (typeof colors)[number][][] {
  if (colors.length <= groups) return colors.map((color) => [color])
  const gaps = colors.slice(1).map((color, index) => ({ at: index + 1, width: colors[index]!.grey - color.grey }))
  const cuts = [...gaps].sort((a, b) => b.width - a.width || a.at - b.at).slice(0, groups - 1).map((gap) => gap.at).sort((a, b) => a - b)
  return [0, ...cuts].map((from, index) => colors.slice(from, cuts[index] ?? colors.length))
}

/** Which tone each group takes: each its own, spread evenly from paper to the darkest when there are fewer groups. */
function tonesFor(groups: number, tones: readonly number[]): number[] {
  if (groups === 1) return [tones[0]!]
  return Array.from({ length: groups }, (_, index) => tones[Math.round((index * (tones.length - 1)) / (groups - 1))]!)
}

/** Whether a color is dark: its Swatch letter is white on the color pages. */
function isDark(hex: string): boolean {
  const rgb = fromHex(hex)
  return !!rgb && relativeLuminance(rgb) <= BLACK_WHITE_BALANCE
}

/** Each color's tone, as a share of black: 0 (paper), 0.1, 0.2, 0.3 or `BLACK_TONE`. A lighter color never prints darker
 * than a darker one; the darkest print solid black only when they are dark and cover at most a quarter of the beads. */
export function printTones(colors: readonly CountedColor[]): Record<string, number> {
  const byGrey = colors.map((color) => ({ ...color, grey: luma(fromHex(color.hex) ?? { r: 0, g: 0, b: 0 }) })).sort((a, b) => b.grey - a.grey)
  const total = colors.reduce((sum, color) => sum + color.count, 0)
  const withBlack = [...TINTS, BLACK_TONE]
  const darkest = groupedByGrey(byGrey, withBlack.length).at(-1) ?? []
  const blackFits = darkest.every((color) => isDark(color.hex)) && darkest.reduce((sum, color) => sum + color.count, 0) <= total * PRINT_TONE.blackShare
  const tones = blackFits ? withBlack : TINTS
  const groups = groupedByGrey(byGrey, tones.length)
  const toneOf = tonesFor(groups.length, tones)
  return Object.fromEntries(groups.flatMap((group, index) => group.map((color) => [color.hex, toneOf[index]!])))
}
