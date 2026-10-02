import type { PaletteColor } from '../domain/palette'

/**
 * The Overview's drawn layer (ticket 221; Overview card, "The drawn layer"): bead drawings at the page edges and X1
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
 * Where a drawing sits: `edge` px in from the page's left or right edge (the layer is as wide as the page) and `top`
 * px down from the section's top. The design system's preview places everything for one wide layout; the placements
 * here were fitted to this page's own layout at each band's narrowest size (375, 744, 1024, 1440, 1920 px, English and
 * Russian) so nothing touches text or a control, and an item that finds no clear spot at a size is left out there. A
 * drawing is small (3-6px beads) or large (`big`: 9-11px beads at 16% opacity); the phone band keeps only small ones.
 */
export interface Placement {
  side: 'left' | 'right'
  edge: number
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
      sm: [
        { size: 56, side: 'left', edge: -22, top: 90 },
        { size: 34, side: 'right', edge: 34, top: 234 },
      ],
      md: [
        { size: 120, side: 'right', edge: -12, top: 112 },
        { size: 56, side: 'left', edge: 50, top: 114 },
        { size: 34, side: 'right', edge: -8, top: 250 },
      ],
      lg: [
        { size: 240, side: 'left', edge: -78, top: -80 },
        { size: 120, side: 'right', edge: 30, top: 24 },
        { size: 56, side: 'left', edge: -22, top: 258 },
        { size: 34, side: 'right', edge: 88, top: 202 },
      ],
      xl: [
        { size: 240, side: 'left', edge: -102, top: 168 },
        { size: 120, side: 'right', edge: 30, top: 24 },
        { size: 56, side: 'left', edge: 50, top: 98 },
        { size: 180, side: 'right', edge: -48, top: 296 },
        { size: 34, side: 'right', edge: 88, top: 250 },
      ],
      xxl: [
        { size: 240, side: 'left', edge: -78, top: 168 },
        { size: 120, side: 'right', edge: 30, top: 24 },
        { size: 56, side: 'left', edge: 50, top: 98 },
        { size: 180, side: 'right', edge: -48, top: 296 },
        { size: 34, side: 'right', edge: 88, top: 250 },
      ],
    },
    doodles: {
      sm: [{ drawing: 'flower', bead: 5, side: 'left', edge: 18, top: 200 }],
      md: [
        { drawing: 'flower', bead: 5, side: 'left', edge: 120, top: 112 },
        { drawing: 'heart', bead: 5, side: 'right', edge: 120, top: 112 },
        { drawing: 'spark', bead: 4, side: 'left', edge: 60, top: 216 },
        { drawing: 'bee', bead: 5, side: 'right', edge: 6, top: 24 },
        { drawing: 'leaf', bead: 5, side: 'left', edge: 12, top: 200 },
        { drawing: 'spark', bead: 3, side: 'right', edge: 120, top: 208 },
        { drawing: 'rhomb', bead: 4, side: 'left', edge: 6, top: 40 },
      ],
      lg: [
        { drawing: 'flower', bead: 5, side: 'left', edge: 174, top: 112 },
        { drawing: 'heart', bead: 5, side: 'right', edge: 18, top: 152 },
        { drawing: 'spark', bead: 4, side: 'left', edge: 12, top: 328 },
        { drawing: 'bee', bead: 5, side: 'right', edge: 72, top: 152 },
        { drawing: 'leaf', bead: 5, side: 'left', edge: 252, top: 136 },
        {
          drawing: 'rhomb',
          bead: 9,
          big: true,
          side: 'right',
          edge: 132,
          top: 152,
        },
        { drawing: 'spark', bead: 3, side: 'right', edge: 48, top: 208 },
        { drawing: 'rhomb', bead: 4, side: 'left', edge: 72, top: 168 },
      ],
      xl: [
        { drawing: 'flower', bead: 5, side: 'left', edge: 18, top: 24 },
        { drawing: 'heart', bead: 5, side: 'right', edge: 162, top: 24 },
        { drawing: 'spark', bead: 4, side: 'left', edge: 150, top: 328 },
        { drawing: 'bee', bead: 5, side: 'right', edge: 162, top: 72 },
        { drawing: 'leaf', bead: 5, side: 'left', edge: 150, top: 280 },
        {
          drawing: 'heart',
          bead: 11,
          big: true,
          side: 'left',
          edge: 120,
          top: 72,
        },
        {
          drawing: 'rhomb',
          bead: 9,
          big: true,
          side: 'right',
          edge: 12,
          top: 152,
        },
        {
          drawing: 'flower',
          bead: 9,
          big: true,
          side: 'right',
          edge: 144,
          top: 296,
        },
        { drawing: 'spark', bead: 3, side: 'right', edge: 48, top: 224 },
        { drawing: 'rhomb', bead: 4, side: 'left', edge: 102, top: 32 },
      ],
      xxl: [
        { drawing: 'flower', bead: 5, side: 'left', edge: 18, top: 24 },
        { drawing: 'heart', bead: 5, side: 'right', edge: 162, top: 24 },
        { drawing: 'spark', bead: 4, side: 'left', edge: 174, top: 328 },
        { drawing: 'bee', bead: 5, side: 'right', edge: 216, top: 24 },
        { drawing: 'leaf', bead: 5, side: 'left', edge: 12, top: 416 },
        {
          drawing: 'heart',
          bead: 11,
          big: true,
          side: 'left',
          edge: 120,
          top: 88,
        },
        {
          drawing: 'rhomb',
          bead: 9,
          big: true,
          side: 'right',
          edge: 12,
          top: 152,
        },
        {
          drawing: 'flower',
          bead: 9,
          big: true,
          side: 'right',
          edge: 144,
          top: 296,
        },
        { drawing: 'spark', bead: 3, side: 'right', edge: 48, top: 224 },
        { drawing: 'rhomb', bead: 4, side: 'left', edge: 102, top: 40 },
      ],
    },
  },
  inside: {
    marks: {
      sm: [],
      md: [{ size: 150, side: 'left', edge: -60, top: 372 }],
      lg: [{ size: 150, side: 'left', edge: 390, top: 44 }],
      xl: [{ size: 150, side: 'left', edge: -60, top: 316 }],
      xxl: [{ size: 150, side: 'left', edge: -60, top: 412 }],
    },
    doodles: {
      sm: [],
      md: [
        {
          drawing: 'heart',
          bead: 10,
          big: true,
          side: 'left',
          edge: 102,
          top: 464,
        },
        { drawing: 'spark', bead: 4, side: 'left', edge: 12, top: 80 },
        { drawing: 'leaf', bead: 5, side: 'right', edge: 12, top: 608 },
        { drawing: 'rhomb', bead: 5, side: 'right', edge: 12, top: 40 },
      ],
      lg: [
        {
          drawing: 'heart',
          bead: 10,
          big: true,
          side: 'left',
          edge: 390,
          top: 336,
        },
        { drawing: 'spark', bead: 4, side: 'left', edge: 270, top: 40 },
        { drawing: 'leaf', bead: 5, side: 'right', edge: 12, top: 472 },
        { drawing: 'rhomb', bead: 5, side: 'right', edge: 12, top: 40 },
      ],
      xl: [
        {
          drawing: 'heart',
          bead: 10,
          big: true,
          side: 'left',
          edge: 12,
          top: 480,
        },
        { drawing: 'spark', bead: 4, side: 'left', edge: 12, top: 56 },
        { drawing: 'leaf', bead: 5, side: 'right', edge: 12, top: 472 },
        { drawing: 'rhomb', bead: 5, side: 'right', edge: 12, top: 40 },
      ],
      xxl: [
        {
          drawing: 'heart',
          bead: 10,
          big: true,
          side: 'left',
          edge: 102,
          top: 496,
        },
        { drawing: 'spark', bead: 4, side: 'left', edge: 12, top: 56 },
        { drawing: 'leaf', bead: 5, side: 'right', edge: 12, top: 560 },
        { drawing: 'rhomb', bead: 5, side: 'right', edge: 12, top: 40 },
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
        { drawing: 'flower', bead: 6, side: 'left', edge: 60, top: 16 },
        { drawing: 'bee', bead: 5, side: 'right', edge: 60, top: 224 },
        { drawing: 'spark', bead: 3, side: 'right', edge: 30, top: 264 },
      ],
      lg: [
        { drawing: 'flower', bead: 6, side: 'left', edge: 60, top: 16 },
        { drawing: 'bee', bead: 5, side: 'right', edge: 60, top: 224 },
        { drawing: 'spark', bead: 3, side: 'right', edge: 30, top: 264 },
      ],
      xl: [
        { drawing: 'flower', bead: 6, side: 'left', edge: 60, top: 16 },
        { drawing: 'bee', bead: 5, side: 'right', edge: 60, top: 224 },
        { drawing: 'spark', bead: 3, side: 'right', edge: 30, top: 264 },
      ],
      xxl: [
        { drawing: 'flower', bead: 6, side: 'left', edge: 60, top: 16 },
        { drawing: 'bee', bead: 5, side: 'right', edge: 60, top: 224 },
        { drawing: 'spark', bead: 3, side: 'right', edge: 30, top: 264 },
      ],
    },
  },
  plans: {
    marks: {
      sm: [
        { size: 90, side: 'left', edge: -42, top: 20 },
        { size: 48, side: 'left', edge: -23, top: 1533 },
      ],
      md: [
        { size: 90, side: 'left', edge: 18, top: 28 },
        { size: 48, side: 'left', edge: 235, top: 725 },
      ],
      lg: [
        { size: 300, side: 'right', edge: -108, top: -16 },
        { size: 90, side: 'left', edge: 60, top: 28 },
        { size: 48, side: 'left', edge: 319, top: 629 },
      ],
      xl: [
        { size: 300, side: 'right', edge: -138, top: 168 },
        { size: 90, side: 'left', edge: 60, top: 36 },
        { size: 48, side: 'left', edge: 115, top: 613 },
      ],
      xxl: [
        { size: 300, side: 'right', edge: -108, top: 144 },
        { size: 90, side: 'left', edge: 60, top: 36 },
        { size: 48, side: 'left', edge: 181, top: 589 },
      ],
    },
    doodles: {
      sm: [
        { drawing: 'heart', bead: 5, side: 'left', edge: 186, top: 224 },
        { drawing: 'rhomb', bead: 4, side: 'right', edge: 18, top: 1552 },
      ],
      md: [
        { drawing: 'heart', bead: 5, side: 'left', edge: 228, top: 672 },
        { drawing: 'rhomb', bead: 4, side: 'right', edge: 18, top: 704 },
        {
          drawing: 'rhomb',
          bead: 10,
          big: true,
          side: 'right',
          edge: 102,
          top: 720,
        },
        { drawing: 'leaf', bead: 5, side: 'left', edge: 228, top: 624 },
        { drawing: 'spark', bead: 4, side: 'right', edge: 180, top: 720 },
        { drawing: 'spool', bead: 5, side: 'right', edge: 12, top: 112 },
      ],
      lg: [
        { drawing: 'heart', bead: 5, side: 'left', edge: 6, top: 640 },
        { drawing: 'rhomb', bead: 4, side: 'right', edge: 18, top: 648 },
        {
          drawing: 'flower',
          bead: 11,
          big: true,
          side: 'left',
          edge: 162,
          top: 136,
        },
        {
          drawing: 'rhomb',
          bead: 10,
          big: true,
          side: 'right',
          edge: 102,
          top: 656,
        },
        { drawing: 'leaf', bead: 5, side: 'left', edge: 12, top: 592 },
        { drawing: 'spark', bead: 4, side: 'right', edge: 180, top: 656 },
        { drawing: 'spool', bead: 5, side: 'right', edge: 204, top: 112 },
      ],
      xl: [
        { drawing: 'heart', bead: 5, side: 'left', edge: 18, top: 624 },
        { drawing: 'rhomb', bead: 4, side: 'right', edge: 18, top: 624 },
        {
          drawing: 'flower',
          bead: 11,
          big: true,
          side: 'left',
          edge: 12,
          top: 424,
        },
        {
          drawing: 'rhomb',
          bead: 10,
          big: true,
          side: 'right',
          edge: 102,
          top: 552,
        },
        { drawing: 'leaf', bead: 5, side: 'left', edge: 102, top: 568 },
        { drawing: 'spark', bead: 4, side: 'right', edge: 162, top: 632 },
        { drawing: 'spool', bead: 5, side: 'right', edge: 12, top: 112 },
      ],
      xxl: [
        { drawing: 'heart', bead: 5, side: 'left', edge: 18, top: 600 },
        { drawing: 'rhomb', bead: 4, side: 'right', edge: 18, top: 608 },
        {
          drawing: 'flower',
          bead: 11,
          big: true,
          side: 'left',
          edge: 12,
          top: 400,
        },
        {
          drawing: 'rhomb',
          bead: 10,
          big: true,
          side: 'right',
          edge: 102,
          top: 528,
        },
        { drawing: 'leaf', bead: 5, side: 'left', edge: 102, top: 560 },
        { drawing: 'spark', bead: 4, side: 'right', edge: 162, top: 608 },
        { drawing: 'spool', bead: 5, side: 'right', edge: 12, top: 96 },
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
