import type { PaletteColor } from '../domain/palette'

// The Overview's drawn layer (ticket 221; Overview card, "The drawn layer"): bead drawings and X1 marks behind each
// section, placed as the design system's preview gives. Drawings are character maps: a letter is a Palette colour,
// `A` is `accent`, `M` is `muted`, `.` is empty.

export type DrawingName = 'flower' | 'heart' | 'spool' | 'spark' | 'rhomb' | 'leaf' | 'bee'
export type SectionName = 'hero' | 'inside' | 'coffee' | 'plans'

export const DRAWINGS: Record<DrawingName, readonly string[]> = {
  flower: ['..R.R..', '.RRRRR.', 'RRRYRRR', '.RRRRR.', '..R.R..', '...G...', '..GG...', '...G...'],
  heart: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
  spool: ['DDDDDD', '.OOOO.', '.OOOO.', '.OOOO.', '.OOOO.', 'DDDDDD'],
  spark: ['..A..', '.....', 'A.A.A', '.....', '..A..'],
  rhomb: ['..YY..', '.YKKY.', 'YKYYKY', 'YKYYKY', '.YKKY.', '..YY..'],
  leaf: ['....GG', '...GGG', '..GGG.', '.GGG..', 'GG....', 'G.....'],
  bee: ['.M.M..', '..M...', 'YKYKY.', 'YKYKYK', 'YKYKY.'],
}

/** Which Palette colour each letter stands for. */
export const LETTER_COLORS: Record<string, PaletteColor['id'] | 'accent' | 'muted'> = {
  R: 'red',
  Y: 'yellow',
  K: 'black',
  O: 'orange',
  G: 'green',
  D: 'brown',
  A: 'accent',
  M: 'muted',
}

/** The screen-size bands the placements are made for: under 744, from 744, from 1024, from 1440, from 1920. */
export const TIERS = ['sm', 'md', 'lg', 'xl', 'xxl'] as const
/** @internal Its test names each tier. */
export type Tier = (typeof TIERS)[number]

// Where a drawing sits (tickets 290, 540, 549): `left`/`right`: `gap` px outside the column's edge (negative: inside);
// `center`: `gap` px right of the section's middle. `top` px down the section, or `bottom` px up from the layer's foot
// (under the Plan tiles). Fitted at several widths per band: only `big` ones (16% opacity) may sit behind text.
export type Placement = {
  side: 'left' | 'right' | 'center'
  gap: number
} & ({ top: number; bottom?: never } | { bottom: number; top?: never })
export type Doodle = Placement & {
  drawing: DrawingName
  /** The bead's size in px. */
  bead: number
  big?: boolean
}
type Mark = Placement & {
  /** The X1 mark's size in px. */
  size: number
}
export interface SectionLayer {
  marks: Record<Tier, readonly Mark[]>
  doodles: Record<Tier, readonly Doodle[]>
}

export const LAYERS: Record<SectionName, SectionLayer> = {
  hero: {
    marks: {
      sm: [{ size: 56, side: 'left', gap: 0, top: 89 }],
      md: [
        { size: 120, side: 'right', gap: -16, top: 108 },
        { size: 56, side: 'left', gap: 8, top: 113 },
      ],
      lg: [
        { size: 120, side: 'right', gap: 0, top: 24 },
        { size: 56, side: 'left', gap: 16, top: 93 },
      ],
      xl: [
        { size: 56, side: 'left', gap: 48, top: 9 },
        { size: 120, side: 'right', gap: 48, top: 24 },
        { size: 240, side: 'left', gap: 48, top: 72 },
        { size: 180, side: 'right', gap: -136, top: 112 },
        { size: 34, side: 'right', gap: 48, top: 213 },
      ],
      xxl: [
        { size: 56, side: 'left', gap: 48, top: 21 },
        { size: 120, side: 'right', gap: 48, top: 24 },
        { size: 240, side: 'left', gap: 48, top: 84 },
        { size: 180, side: 'right', gap: -136, top: 124 },
        { size: 34, side: 'right', gap: 48, top: 221 },
      ],
    },
    doodles: {
      sm: [
        { drawing: 'spark', bead: 3, side: 'left', gap: -8, top: 112 },
        { drawing: 'spark', bead: 4, side: 'center', gap: 140, top: 0 },
        { drawing: 'bee', bead: 4, side: 'left', gap: -40, top: 200 },
        { drawing: 'flower', bead: 4, side: 'right', gap: -40, top: 190 },
      ],
      md: [
        { drawing: 'spark', bead: 4, side: 'left', gap: 0, top: 76 },
        { drawing: 'flower', bead: 5, side: 'left', gap: -16, top: 112 },
        { drawing: 'heart', bead: 5, side: 'right', gap: -16, top: 112 },
        { drawing: 'bee', bead: 5, side: 'right', gap: -16, top: 160 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: -16, top: 196 },
        { drawing: 'heart', bead: 4, side: 'center', gap: 231, top: 176 },
        { drawing: 'rhomb', bead: 4, side: 'center', gap: -270, top: 140 },
        { drawing: 'spark', bead: 3, side: 'center', gap: 215, top: 40 },
      ],
      lg: [
        { drawing: 'flower', bead: 5, side: 'left', gap: -8, top: 24 },
        { drawing: 'heart', bead: 5, side: 'right', gap: -8, top: 24 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 0, top: 72 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: 0, top: 108 },
        { drawing: 'rhomb', bead: 3, side: 'center', gap: 363, top: 20 },
        { drawing: 'spark', bead: 4, side: 'center', gap: -330, top: 130 },
        { drawing: 'spark', bead: 3, side: 'center', gap: 225, top: 12 },
      ],
      xl: [
        { drawing: 'flower', bead: 5, side: 'left', gap: 48, top: 24 },
        { drawing: 'heart', bead: 5, side: 'right', gap: 48, top: 24 },
        { drawing: 'heart', bead: 11, big: true, side: 'left', gap: -48, top: 60 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 48, top: 72 },
        { drawing: 'rhomb', bead: 9, big: true, side: 'right', gap: 48, top: 152 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: 48, top: 160 },
        { drawing: 'bee', bead: 4, side: 'center', gap: 322, top: 80 },
        { drawing: 'rhomb', bead: 4, side: 'center', gap: -400, top: 130 },
        { drawing: 'spark', bead: 3, side: 'center', gap: 225, top: 12 },
      ],
      xxl: [
        { drawing: 'flower', bead: 5, side: 'left', gap: 48, top: 24 },
        { drawing: 'heart', bead: 5, side: 'right', gap: 48, top: 24 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 48, top: 72 },
        { drawing: 'heart', bead: 11, big: true, side: 'left', gap: 48, top: 84 },
        { drawing: 'rhomb', bead: 9, big: true, side: 'right', gap: 48, top: 152 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: 48, top: 168 },
        { drawing: 'leaf', bead: 3, side: 'center', gap: 218, top: 156 },
        { drawing: 'rhomb', bead: 4, side: 'center', gap: -420, top: 140 },
        { drawing: 'spark', bead: 3, side: 'center', gap: 260, top: 10 },
      ],
    },
  },
  inside: {
    marks: {
      sm: [],
      md: [{ size: 150, side: 'left', gap: -24, top: 314 }],
      lg: [{ size: 90, side: 'left', gap: 8, top: 314 }],
      xl: [{ size: 150, side: 'left', gap: 48, top: 314 }],
      xxl: [{ size: 150, side: 'left', gap: 48, top: 314 }],
    },
    doodles: {
      sm: [{ drawing: 'spark', bead: 4, side: 'left', gap: -226, top: 27 }],
      md: [
        { drawing: 'rhomb', bead: 5, side: 'right', gap: -16, top: 40 },
        { drawing: 'spark', bead: 4, side: 'left', gap: -226, top: 27 },
        { drawing: 'leaf', bead: 5, side: 'right', gap: -16, top: 472 },
        { drawing: 'rhomb', bead: 5, side: 'center', gap: -79, top: 144 },
        { drawing: 'rhomb', bead: 5, side: 'center', gap: -235, top: 92 },
        { drawing: 'heart', bead: 4, side: 'center', gap: -229, top: 252 },
        { drawing: 'bee', bead: 4, side: 'center', gap: 81, top: 64 },
      ],
      lg: [
        { drawing: 'leaf', bead: 5, side: 'right', gap: 0, top: 28 },
        { drawing: 'rhomb', bead: 5, side: 'right', gap: -48, top: 28 },
        { drawing: 'spark', bead: 4, side: 'left', gap: -264, top: 36 },
        { drawing: 'heart', bead: 3, side: 'center', gap: -36, top: 224 },
        { drawing: 'bee', bead: 3, side: 'center', gap: -50, top: 136 },
        { drawing: 'rhomb', bead: 9, big: true, side: 'center', gap: 200, top: 8 },
      ],
      xl: [
        { drawing: 'rhomb', bead: 5, side: 'right', gap: 48, top: 40 },
        { drawing: 'spark', bead: 4, side: 'left', gap: 48, top: 56 },
        { drawing: 'leaf', bead: 5, side: 'right', gap: 48, top: 472 },
        { drawing: 'leaf', bead: 3, side: 'center', gap: 465, top: 392 },
        { drawing: 'rhomb', bead: 5, side: 'center', gap: 665, top: 244 },
        { drawing: 'heart', bead: 4, side: 'center', gap: 243, top: 204 },
        { drawing: 'spark', bead: 4, side: 'center', gap: -370, top: 27 },
        { drawing: 'flower', bead: 8, big: true, side: 'center', gap: 250, top: 2 },
        { drawing: 'heart', bead: 10, big: true, side: 'center', gap: -320, top: 375 },
      ],
      xxl: [
        { drawing: 'rhomb', bead: 5, side: 'right', gap: 48, top: 40 },
        { drawing: 'spark', bead: 4, side: 'left', gap: 48, top: 56 },
        { drawing: 'leaf', bead: 5, side: 'right', gap: 48, top: 472 },
        { drawing: 'flower', bead: 3, side: 'center', gap: -58, top: 192 },
        { drawing: 'spool', bead: 4, side: 'center', gap: 319, top: 412 },
        { drawing: 'spark', bead: 4, side: 'center', gap: -156, top: 460 },
        { drawing: 'spark', bead: 4, side: 'center', gap: -430, top: 27 },
        { drawing: 'flower', bead: 8, big: true, side: 'center', gap: 300, top: 2 },
        { drawing: 'heart', bead: 10, big: true, side: 'center', gap: -335, top: 375 },
      ],
    },
  },
  coffee: {
    marks: {
      sm: [],
      md: [],
      lg: [],
      xl: [],
      xxl: [],
    },
    doodles: {
      sm: [],
      md: [
        { drawing: 'spark', bead: 3, side: 'right', gap: 0, top: 88 },
      ],
      lg: [{ drawing: 'spark', bead: 3, side: 'right', gap: 16, top: 88 }],
      xl: [
        { drawing: 'flower', bead: 6, side: 'left', gap: 48, top: 16 },
        { drawing: 'spark', bead: 3, side: 'right', gap: 48, top: 88 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 48, top: 224 },
        { drawing: 'heart', bead: 5, side: 'left', gap: 48, top: 150 },
      ],
      xxl: [
        { drawing: 'flower', bead: 6, side: 'left', gap: 48, top: 16 },
        { drawing: 'spark', bead: 3, side: 'right', gap: 48, top: 88 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 48, top: 224 },
        { drawing: 'rhomb', bead: 4, side: 'left', gap: 48, top: 150 },
      ],
    },
  },
  plans: {
    marks: {
      sm: [
        { size: 48, side: 'left', gap: -72, top: 0 },
        { size: 90, side: 'left', gap: -16, top: 18 },
      ],
      md: [
        { size: 150, side: 'right', gap: -24, top: 22 },
        { size: 48, side: 'left', gap: 8, top: 628 },
        { size: 90, side: 'center', gap: -275, top: 30 },
      ],
      lg: [
        { size: 150, side: 'right', gap: -16, top: 22 },
        { size: 48, side: 'left', gap: 16, top: 628 },
        { size: 90, side: 'center', gap: -290, top: 30 },
      ],
      xl: [
        { size: 90, side: 'left', gap: 48, top: 34 },
        { size: 300, side: 'right', gap: 48, top: 168 },
        { size: 48, side: 'left', gap: 48, top: 600 },
        { size: 90, side: 'center', gap: -290, top: 30 },
      ],
      xxl: [
        { size: 300, side: 'right', gap: 48, top: 168 },
        { size: 48, side: 'left', gap: 48, top: 600 },
        { size: 90, side: 'center', gap: -290, top: 30 },
      ],
    },
    doodles: {
      sm: [
        { drawing: 'spark', bead: 4, side: 'right', gap: -8, top: 32 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: -16, top: 68 },
        { drawing: 'heart', bead: 5, side: 'center', gap: -60, bottom: 18 },
        { drawing: 'leaf', bead: 5, side: 'center', gap: 20, bottom: 18 },
      ],
      md: [
        { drawing: 'spool', bead: 5, side: 'right', gap: -16, top: 52 },
        { drawing: 'rhomb', bead: 5, side: 'left', gap: -64, top: 84 },
        { drawing: 'spark', bead: 4, side: 'right', gap: 0, top: 100 },
        { drawing: 'rhomb', bead: 3, side: 'right', gap: 0, top: 440 },
        { drawing: 'heart', bead: 5, side: 'center', gap: -280, bottom: 18 },
        { drawing: 'leaf', bead: 5, side: 'center', gap: 40, bottom: 18 },
        { drawing: 'rhomb', bead: 5, side: 'center', gap: 250, bottom: 18 },
        { drawing: 'heart', bead: 4, side: 'center', gap: -146, top: 146 },
        { drawing: 'bee', bead: 4, side: 'center', gap: 244, top: 150 },
        { drawing: 'flower', bead: 9, big: true, side: 'center', gap: -162, top: 268 },
      ],
      lg: [
        { drawing: 'spool', bead: 5, side: 'right', gap: 0, top: 52 },
        { drawing: 'spark', bead: 4, side: 'right', gap: 8, top: 100 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: 0, top: 440 },
        { drawing: 'spark', bead: 4, side: 'center', gap: 302, top: 224 },
        { drawing: 'heart', bead: 5, side: 'center', gap: -300, bottom: 18 },
        { drawing: 'leaf', bead: 5, side: 'center', gap: 40, bottom: 18 },
        { drawing: 'leaf', bead: 3, side: 'center', gap: 330, bottom: 24 },
        { drawing: 'rhomb', bead: 3, side: 'center', gap: 391, top: 184 },
        { drawing: 'heart', bead: 10, big: true, side: 'center', gap: -409, top: 524 },
      ],
      xl: [
        { drawing: 'spool', bead: 5, side: 'right', gap: 48, top: 112 },
        { drawing: 'flower', bead: 11, big: true, side: 'left', gap: 48, top: 424 },
        { drawing: 'rhomb', bead: 10, big: true, side: 'right', gap: 48, top: 548 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: 16, top: 440 },
        { drawing: 'spark', bead: 4, side: 'right', gap: 48, top: 664 },
        { drawing: 'bee', bead: 5, side: 'center', gap: 316, top: 44 },
        { drawing: 'flower', bead: 5, side: 'center', gap: -297, top: 264 },
        { drawing: 'spool', bead: 5, side: 'center', gap: 450, top: 72 },
        { drawing: 'spark', bead: 9, big: true, side: 'center', gap: -658, top: 320 },
        { drawing: 'heart', bead: 5, side: 'center', gap: -300, bottom: 18 },
        { drawing: 'leaf', bead: 5, side: 'center', gap: 40, bottom: 18 },
      ],
      xxl: [
        { drawing: 'spool', bead: 5, side: 'right', gap: 48, top: 112 },
        { drawing: 'flower', bead: 11, big: true, side: 'left', gap: 48, top: 424 },
        { drawing: 'rhomb', bead: 10, big: true, side: 'right', gap: 48, top: 548 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: 16, top: 440 },
        { drawing: 'spark', bead: 4, side: 'right', gap: 48, top: 664 },
        { drawing: 'leaf', bead: 3, side: 'center', gap: 476, top: 628 },
        { drawing: 'rhomb', bead: 3, side: 'center', gap: -861, top: 280 },
        { drawing: 'heart', bead: 5, side: 'center', gap: 441, top: 228 },
        { drawing: 'heart', bead: 5, side: 'center', gap: -300, bottom: 18 },
        { drawing: 'leaf', bead: 5, side: 'center', gap: 40, bottom: 18 },
      ],
    },
  },
}

export interface Bead {
  x: number
  y: number
  letter: string
}

/** The drawing's beads, one per non-empty cell. */
export function beadsOf(drawing: DrawingName): Bead[] {
  const beads: Bead[] = []
  DRAWINGS[drawing].forEach((row, y) => {
    ;[...row].forEach((letter, x) => {
      if (letter !== '.') beads.push({ x, y, letter })
    })
  })
  return beads
}
