import type { PaletteColor } from '../domain/palette'

/**
 * The Overview's drawn layer (ticket 221; Overview card, "The drawn layer"): bead drawings beside the main column and X1
 * marks behind each section, with the placements the design system's preview gives. The drawings are small
 * character maps: a letter is a Palette colour, `A` is `accent`, `M` is `muted`, `.` is empty.
 */

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
export type Tier = (typeof TIERS)[number]

/**
 * Where a drawing sits (ticket 290): `gap` px outside the main column's edge (the layer is centred on the column; a
 * negative gap is inside it) and `top` px down from the section's top. Wide screens have room beside the column, so
 * there each drawing sits a fixed gap of 24-48px out; where the gutter is too narrow (phone, tablet, the low end of
 * laptop) the small ones tuck into it or into blank space beside the hero's text. The placements were fitted to this
 * page's own layout at several widths of each band (English and Russian) so nothing touches text or a control, and an
 * item that finds no clear spot in a band is left out there. The bands thin out: `xl`/`xxl` carry the full set, `md`
 * and `lg` about two thirds of it, `sm` about a third. A drawing is small (3-6px beads) or large (`big`: 9-11px beads
 * at 16% opacity); the phone band keeps only small ones.
 */
export interface Placement {
  side: 'left' | 'right'
  gap: number
  top: number
}
export interface Doodle extends Placement {
  drawing: DrawingName
  /** The bead's size in px. */
  bead: number
  big?: boolean
}
export interface Mark extends Placement {
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
        { drawing: 'spark', bead: 4, side: 'right', gap: -8, top: 96 },
        { drawing: 'spark', bead: 3, side: 'left', gap: -8, top: 112 },
      ],
      md: [
        { drawing: 'spark', bead: 4, side: 'left', gap: 0, top: 76 },
        { drawing: 'flower', bead: 5, side: 'left', gap: -16, top: 112 },
        { drawing: 'heart', bead: 5, side: 'right', gap: -16, top: 112 },
        { drawing: 'rhomb', bead: 4, side: 'left', gap: -56, top: 112 },
        { drawing: 'bee', bead: 5, side: 'right', gap: -16, top: 160 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: -16, top: 196 },
        { drawing: 'spark', bead: 3, side: 'right', gap: 0, top: 208 },
      ],
      lg: [
        { drawing: 'flower', bead: 5, side: 'left', gap: -8, top: 24 },
        { drawing: 'heart', bead: 5, side: 'right', gap: -8, top: 24 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 0, top: 72 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: 0, top: 108 },
        { drawing: 'spark', bead: 4, side: 'left', gap: -40, top: 116 },
        { drawing: 'spark', bead: 3, side: 'right', gap: 16, top: 120 },
        { drawing: 'rhomb', bead: 9, big: true, side: 'right', gap: -24, top: 152 },
      ],
      xl: [
        { drawing: 'flower', bead: 5, side: 'left', gap: 48, top: 24 },
        { drawing: 'heart', bead: 5, side: 'right', gap: 48, top: 24 },
        { drawing: 'heart', bead: 11, big: true, side: 'left', gap: -48, top: 60 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 48, top: 72 },
        { drawing: 'rhomb', bead: 4, side: 'left', gap: 48, top: 84 },
        { drawing: 'spark', bead: 3, side: 'right', gap: 48, top: 120 },
        { drawing: 'rhomb', bead: 9, big: true, side: 'right', gap: 48, top: 152 },
        { drawing: 'flower', bead: 9, big: true, side: 'right', gap: -32, top: 152 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: 48, top: 160 },
        { drawing: 'spark', bead: 4, side: 'left', gap: 48, top: 208 },
      ],
      xxl: [
        { drawing: 'flower', bead: 5, side: 'left', gap: 48, top: 24 },
        { drawing: 'heart', bead: 5, side: 'right', gap: 48, top: 24 },
        { drawing: 'rhomb', bead: 4, side: 'left', gap: 8, top: 32 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 48, top: 72 },
        { drawing: 'heart', bead: 11, big: true, side: 'left', gap: 48, top: 84 },
        { drawing: 'rhomb', bead: 9, big: true, side: 'right', gap: 48, top: 152 },
        { drawing: 'flower', bead: 9, big: true, side: 'right', gap: -32, top: 164 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: 48, top: 168 },
        { drawing: 'spark', bead: 4, side: 'left', gap: 48, top: 216 },
        { drawing: 'spark', bead: 3, side: 'right', gap: 48, top: 224 },
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
      sm: [{ drawing: 'spark', bead: 4, side: 'left', gap: -8, top: 80 }],
      md: [
        { drawing: 'rhomb', bead: 5, side: 'right', gap: -16, top: 40 },
        { drawing: 'spark', bead: 4, side: 'left', gap: 0, top: 80 },
        { drawing: 'leaf', bead: 5, side: 'right', gap: -16, top: 472 },
      ],
      lg: [
        { drawing: 'leaf', bead: 5, side: 'right', gap: 0, top: 28 },
        { drawing: 'rhomb', bead: 5, side: 'right', gap: -48, top: 28 },
        { drawing: 'spark', bead: 4, side: 'left', gap: -264, top: 36 },
      ],
      xl: [
        { drawing: 'rhomb', bead: 5, side: 'right', gap: 48, top: 40 },
        { drawing: 'spark', bead: 4, side: 'left', gap: 48, top: 56 },
        { drawing: 'leaf', bead: 5, side: 'right', gap: 48, top: 472 },
        { drawing: 'heart', bead: 10, big: true, side: 'left', gap: 48, top: 480 },
      ],
      xxl: [
        { drawing: 'rhomb', bead: 5, side: 'right', gap: 48, top: 40 },
        { drawing: 'spark', bead: 4, side: 'left', gap: 48, top: 56 },
        { drawing: 'leaf', bead: 5, side: 'right', gap: 48, top: 472 },
        { drawing: 'heart', bead: 10, big: true, side: 'left', gap: 48, top: 480 },
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
      md: [],
      lg: [{ drawing: 'spark', bead: 3, side: 'right', gap: 16, top: 248 }],
      xl: [
        { drawing: 'flower', bead: 6, side: 'left', gap: 48, top: 16 },
        { drawing: 'spark', bead: 3, side: 'right', gap: 48, top: 192 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 48, top: 224 },
      ],
      xxl: [
        { drawing: 'flower', bead: 6, side: 'left', gap: 48, top: 16 },
        { drawing: 'spark', bead: 3, side: 'right', gap: 48, top: 192 },
        { drawing: 'bee', bead: 5, side: 'right', gap: 48, top: 224 },
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
        { size: 90, side: 'left', gap: -8, top: 26 },
        { size: 48, side: 'left', gap: 8, top: 628 },
      ],
      lg: [
        { size: 150, side: 'right', gap: -16, top: 22 },
        { size: 90, side: 'left', gap: 8, top: 26 },
        { size: 48, side: 'left', gap: 16, top: 628 },
      ],
      xl: [
        { size: 90, side: 'left', gap: 48, top: 34 },
        { size: 300, side: 'right', gap: 48, top: 168 },
        { size: 48, side: 'left', gap: 48, top: 600 },
      ],
      xxl: [
        { size: 90, side: 'left', gap: 48, top: 34 },
        { size: 300, side: 'right', gap: 48, top: 168 },
        { size: 48, side: 'left', gap: 48, top: 600 },
      ],
    },
    doodles: {
      sm: [
        { drawing: 'heart', bead: 5, side: 'left', gap: -24, top: 4 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: -72, top: 4 },
        { drawing: 'spark', bead: 4, side: 'right', gap: -8, top: 32 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: -16, top: 68 },
      ],
      md: [
        { drawing: 'leaf', bead: 5, side: 'left', gap: -16, top: 36 },
        { drawing: 'spool', bead: 5, side: 'right', gap: -16, top: 52 },
        { drawing: 'heart', bead: 5, side: 'left', gap: -16, top: 84 },
        { drawing: 'rhomb', bead: 5, side: 'left', gap: -64, top: 84 },
        { drawing: 'spark', bead: 4, side: 'right', gap: 0, top: 100 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: -8, top: 136 },
      ],
      lg: [
        { drawing: 'leaf', bead: 5, side: 'left', gap: 0, top: 36 },
        { drawing: 'spool', bead: 5, side: 'right', gap: 0, top: 52 },
        { drawing: 'heart', bead: 5, side: 'left', gap: -8, top: 84 },
        { drawing: 'spark', bead: 4, side: 'right', gap: 8, top: 100 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: 0, top: 136 },
      ],
      xl: [
        { drawing: 'spool', bead: 5, side: 'right', gap: 48, top: 112 },
        { drawing: 'flower', bead: 11, big: true, side: 'left', gap: 48, top: 424 },
        { drawing: 'rhomb', bead: 10, big: true, side: 'right', gap: 48, top: 548 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: 48, top: 568 },
        { drawing: 'heart', bead: 5, side: 'left', gap: 48, top: 624 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: 48, top: 624 },
        { drawing: 'spark', bead: 4, side: 'right', gap: 48, top: 664 },
      ],
      xxl: [
        { drawing: 'spool', bead: 5, side: 'right', gap: 48, top: 112 },
        { drawing: 'flower', bead: 11, big: true, side: 'left', gap: 48, top: 424 },
        { drawing: 'rhomb', bead: 10, big: true, side: 'right', gap: 48, top: 548 },
        { drawing: 'leaf', bead: 5, side: 'left', gap: 48, top: 568 },
        { drawing: 'heart', bead: 5, side: 'left', gap: 48, top: 624 },
        { drawing: 'rhomb', bead: 4, side: 'right', gap: 48, top: 624 },
        { drawing: 'spark', bead: 4, side: 'right', gap: 48, top: 664 },
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
