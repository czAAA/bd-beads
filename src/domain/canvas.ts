import type { GridDimensions, GridPosition } from './grid'

/**
 * The painted beads of an Open canvas (ADR 0026), by position: row, then column, then the color's hex. Only painted
 * positions are stored, so an empty canvas is `{}` and a bead far from the others costs one entry. Rows and columns
 * may be negative: the canvas has no origin the person has to stay below or to the right of.
 *
 * Kept as nested plain objects rather than one flat map so an edit copies only the rows it touched and shares every
 * other row with the version before it (the property Undo's snapshots and the renderer's row comparison rely on, ADR
 * 0019), and so the whole thing is JSON-serialisable as it is.
 */
export type BeadMap = Record<number, Record<number, string>>

/** The rectangle of whole bead positions that marks which beads are the Pattern (CONTEXT.md's Frame). */
export interface Frame {
  /** The top row and left column the Frame covers; the Frame covers `rows` rows and `columns` columns from there. */
  row: number
  column: number
  columns: number
  rows: number
}

/** One bead's color at a position, or null where nothing is painted. */
export function colorAt(beads: BeadMap, row: number, column: number): string | null {
  return beads[row]?.[column] ?? null
}

/** A position and what to paint there: a hex, or null to leave it empty. */
export interface BeadChange extends GridPosition {
  color: string | null
}

/**
 * The beads after painting every change, as a new map that shares each row no change touched; the same map back when
 * nothing would differ. A row emptied by erasing is dropped, so a map never holds an empty row.
 */
export function withColors(beads: BeadMap, changes: Iterable<BeadChange>): BeadMap {
  let next: BeadMap | undefined
  const copiedRows = new Set<number>()

  for (const { row, column, color } of changes) {
    if ((next ?? beads)[row]?.[column] === (color ?? undefined)) {
      continue
    }
    next ??= { ...beads }
    if (!copiedRows.has(row)) {
      next[row] = { ...beads[row] }
      copiedRows.add(row)
    }
    const copy = next[row]!
    if (color === null) {
      delete copy[column]
    } else {
      copy[column] = color
    }
  }

  if (!next) {
    return beads
  }
  for (const row of copiedRows) {
    if (Object.keys(next[row]!).length === 0) {
      delete next[row]
    }
  }
  return next
}

/** Calls `visit` for every painted bead, row by row and left to right within a row. */
export function forEachBead(beads: BeadMap, visit: (row: number, column: number, color: string) => void): void {
  for (const row of sortedKeys(beads)) {
    const cells = beads[row]!
    for (const column of sortedKeys(cells)) {
      visit(row, column, cells[column]!)
    }
  }
}

function sortedKeys(record: Record<number, unknown>): number[] {
  return Object.keys(record)
    .map(Number)
    .sort((a, b) => a - b)
}

/** How many beads are painted. */
export function beadCount(beads: BeadMap): number {
  let count = 0
  for (const row of Object.values(beads)) {
    count += Object.keys(row).length
  }
  return count
}

/** The smallest rectangle round every painted bead, or undefined for an empty canvas. */
export function beadBounds(beads: BeadMap): Frame | undefined {
  let top = Infinity
  let bottom = -Infinity
  let left = Infinity
  let right = -Infinity
  forEachBead(beads, (row, column) => {
    top = Math.min(top, row)
    bottom = Math.max(bottom, row)
    left = Math.min(left, column)
    right = Math.max(right, column)
  })
  return top === Infinity ? undefined : { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** Whether a position lies inside a Frame. */
export function frameContains(frame: Frame, { row, column }: GridPosition): boolean {
  return row >= frame.row && row < frame.row + frame.rows && column >= frame.column && column < frame.column + frame.columns
}

/** Something with a size in beads: plain dimensions, or a Pattern (a canvas with or without a Frame). */
export type Sized = GridDimensions | { frame?: Frame; beads: BeadMap }

/** A Frame's size, or — with no Frame — the size of the box round the beads, or 0 × 0 for an empty canvas. */
export function sizeOf(sized: Sized): GridDimensions {
  if ('columns' in sized) {
    return { columns: sized.columns, rows: sized.rows }
  }
  const box = sized.frame ?? beadBounds(sized.beads)
  return box ? { columns: box.columns, rows: box.rows } : { columns: 0, rows: 0 }
}

/** A Frame's size, as the dimensions the grid-shaped helpers (mirror strips, adjacency, fit zoom) take. */
export function frameDimensions(frame: Frame): GridDimensions {
  return { columns: frame.columns, rows: frame.rows }
}

/** The painted colors inside a Frame as a dense rows × columns array of hex-or-null, top-left first. */
export function colorsInFrame(beads: BeadMap, frame: Frame): (string | null)[][] {
  return Array.from({ length: frame.rows }, (_row, rowOffset) =>
    Array.from({ length: frame.columns }, (_column, columnOffset) =>
      colorAt(beads, frame.row + rowOffset, frame.column + columnOffset),
    ),
  )
}

/** Beads from a dense rows × columns array of hex-or-null whose top-left sits at `origin` (0, 0 by default). */
export function beadsFromColors(colors: readonly (readonly (string | null)[])[], origin: GridPosition = { row: 0, column: 0 }): BeadMap {
  const beads: BeadMap = {}
  colors.forEach((cells, rowOffset) => {
    cells.forEach((color, columnOffset) => {
      if (color !== null) {
        const row = origin.row + rowOffset
        beads[row] ??= {}
        beads[row][origin.column + columnOffset] = color
      }
    })
  })
  return beads
}

/** The beads inside a Frame, and only those, as a new map. */
export function beadsInFrame(beads: BeadMap, frame: Frame): BeadMap {
  const inside: BeadMap = {}
  forEachBead(beads, (row, column, color) => {
    if (frameContains(frame, { row, column })) {
      inside[row] ??= {}
      inside[row][column] = color
    }
  })
  return inside
}
