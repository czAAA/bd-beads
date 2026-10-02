import type { Grid } from '../../domain/pattern'
import { tourFinishedGrid } from '../../domain/tour'

/**
 * The small bead drawings the Overview carousel's examples are made of (ticket 218; Overview card): a heart, a poppy, a
 * landscape, stripes and checks, written as letters so the picture can be read in the source. They are artwork, not
 * Patterns the app keeps, and use the colors the design system's preview gives them.
 */
export const ART_COLORS: Readonly<Record<string, string>> = {
  Y: '#f2c94c',
  K: '#1a1a1a',
  R: '#b3382b',
  I: '#f3efe6',
  G: '#27ae60',
  B: '#2f6fe0',
  S: '#9aa0a6',
  O: '#f0963c',
  L: '#8fb3ee',
}

/** A grid from rows of letters; `.` is an empty bead. */
export function gridFromRows(rows: readonly string[]): Grid {
  return rows.map((row) => [...row].map((letter) => ({ color: ART_COLORS[letter] ?? null })))
}

function gridFrom(columns: number, rows: number, letterAt: (column: number, row: number) => string): Grid {
  return gridFromRows(Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => letterAt(column, row)).join('')))
}

const HEART_MASK = [
  '...........',
  '..RR...RR..',
  '.RRRR.RRRR.',
  '.RIRRRRRRR.',
  '.RRRRRRRRR.',
  '..RRRRRRR..',
  '...RRRRR...',
  '....RRR....',
  '.....R.....',
  '...........',
]

/** A red heart on ivory, 11 × 10. */
export const HEART: Grid = gridFromRows(HEART_MASK.map((row) => row.replaceAll('.', 'I')))

const POPPY_ROWS = [
  'IIIIIIIIIIIII',
  'IIIIRRIRRIIII',
  'IIIRRRRRRRIII',
  'IIRRRRRRRRRII',
  'IIRRRKKKRRRII',
  'IIRRKKYKKRRII',
  'IIRRRKKKRRRII',
  'IIIRRRRRRRIII',
  'IIIIRRIRRIIII',
  'IIIIIIGIIIIII',
  'IIIGGIGIIIIII',
  'IIIIGGGIGGIII',
  'IIIIIIGGGIIII',
]

/** A poppy on its stem, on ivory, 13 × 13. */
export const POPPY: Grid = gridFromRows(POPPY_ROWS)

/** The poppy as it is being painted: the last two rows of its stem still to do. */
export const POPPY_PAINTING: Grid = gridFromRows(POPPY_ROWS.map((row, y) => (y > 10 ? row.replace(/[RG]/g, 'I') : row)))

const HILLS_COLUMNS = 24
const HILLS_ROWS = 18

function hillsAt(column: number, row: number): string {
  const u = (column + 0.5) / HILLS_COLUMNS
  const v = (row + 0.5) / HILLS_ROWS
  if ((u - 0.72) ** 2 + (v - 0.3) ** 2 < 0.012) return 'Y'
  if (v > 0.62 + 0.08 * Math.sin(u * 5 + 1)) return v > 0.8 + 0.05 * Math.sin(u * 7) ? 'K' : 'G'
  if (v > 0.5 + 0.1 * Math.sin(u * 3.2 + 2)) return 'S'
  return v < 0.3 ? 'B' : 'O'
}

/** The picture's six-colour beaded version: sun, hills and sky, 24 × 18. */
export const HILLS: Grid = gridFrom(HILLS_COLUMNS, HILLS_ROWS, hillsAt)

export const STRIPES: Grid = gridFrom(12, 12, (column, row) => ((column + row) % 6 < 3 ? 'B' : 'I'))

export const CHECKS: Grid = gridFrom(12, 12, (column, row) => ((Math.floor(column / 2) + Math.floor(row / 2)) % 2 ? 'K' : 'I'))

/** The first 30 rows of the Tour Pattern: the Gold strip's thumbnail. */
export const GOLD_STRIP: Grid = tourFinishedGrid().slice(0, 30)
