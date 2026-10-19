import { findPaletteColor } from './palette'
import { describeWeave, type Weave } from './weave'

// The decorated example on a Template card and in its setup (ticket 494, spec 0488): a small symmetric ornament, made
// the same way every time for the same Weave, size and seed. It is only a picture; Create still gives an empty Frame.

/** The longest side of the sample, in beads: a card's picture slot is small, so the Template's own size is scaled down. */
const SAMPLE_LONG_SIDE = 11
const SAMPLE_MIN_SIDE = 5

/** The sample's size in beads: the Template's shape, held to a few beads a side so they stay big enough to see. */
export function sampleSize(width: number, height: number): { columns: number; rows: number } {
  const scale = SAMPLE_LONG_SIDE / Math.max(width, height, 1)
  const side = (value: number) => Math.max(SAMPLE_MIN_SIDE, Math.min(SAMPLE_LONG_SIDE, Math.round(value * scale)))
  return { columns: side(width), rows: side(height) }
}

/** Which theme's colors the sample takes: high contrast keeps to black, white and two strong hues. */
export type SampleTheme = 'light' | 'dark' | 'contrast'

// Ids of the built-in Palette (palette.ts), the first being the ground. Dark avoids the near-black bead, which would
// vanish on its board.
const SAMPLE_COLOR_IDS: Readonly<Record<SampleTheme, readonly string[]>> = {
  light: ['white', 'red', 'blue', 'yellow'],
  dark: ['white', 'orange', 'teal', 'pink'],
  contrast: ['white', 'black', 'blue', 'yellow'],
}

/** The four colors of a theme's sample, ground first. */
export function sampleColors(theme: SampleTheme): string[] {
  return SAMPLE_COLOR_IDS[theme].map((id) => findPaletteColor(id)!.hex)
}

/** A number from text, so a Template's id always gives the same ornament. */
export function seedOf(text: string): number {
  let seed = 2166136261
  for (const char of text) {
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  }
  return seed >>> 0
}

type Motif = (dx: number, dy: number, reach: number) => number

// Each motif gives a band number from the distance to the center (dx, dy >= 0), so every one is symmetric both ways.
const MOTIFS: readonly Motif[] = [
  (_dx, dy) => Math.floor(dy), // stripes across
  (dx, dy) => Math.floor(dx + dy), // diamonds
  (dx, dy, reach) => (Math.abs(dx - dy) < 0.75 || Math.min(dx, dy) < 0.75 ? 1 : Math.floor(Math.max(dx, dy) / reach * 3) + 2), // star
]

/** The ornament: a grid of hex colors as large as the size takes in the Weave's own positions, mirrored left to right
 * and top to bottom. The seed picks the motif and which color plays which part. */
export function generateOrnament(weave: Weave, size: { columns: number; rows: number }, seed: number, colors: readonly string[]): string[][] {
  const { columns, rows } = describeWeave(weave).positionsOf(size)
  const motif = MOTIFS[seed % MOTIFS.length]!
  const turn = Math.floor(seed / MOTIFS.length) % (colors.length - 1)
  const reach = Math.max(columns, rows) / 2
  const ground = colors[0]!
  const parts = colors.slice(1)
  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_column, column) => {
      const band = motif(Math.abs(column - (columns - 1) / 2), Math.abs(row - (rows - 1) / 2), reach)
      return band % 2 === 0 ? ground : parts[(Math.floor(band / 2) + turn) % parts.length]!
    }),
  )
}
