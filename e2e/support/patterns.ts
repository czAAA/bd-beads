import { CELL_SIZE_PX } from '../../src/domain/grid'
import type { Rotation, Technique } from '../../src/domain/grid'
import { PALETTE } from '../../src/domain/palette'
import { framedGrid, type Cell, type Pattern, type RowProgress } from '../../src/domain/pattern'
import { encodePattern } from '../../src/domain/patternEncoding'
import { gridToDisplayed } from '../../src/rendering/canvasView'
import { rowShiftPx, rowTopPx } from '../../src/rendering/patternRenderer'

/** The localStorage key and stored version the app writes (services/libraryStore.ts): the checks seed a library by writing it directly. */
const STORAGE_KEY = 'bd-beads:patterns'
const STORED_VERSION = 3

export interface FixtureOptions {
  technique: Technique
  columns?: number
  rows?: number
  rotation?: Rotation
  rowProgress?: Partial<RowProgress>
  /** Leave every bead empty rather than painting the busy fixture picture. */
  blank?: boolean
  /** Beads to paint a different color than the picture has them, for proving the visual check notices. */
  override?: { row: number; column: number; color: string | null }[]
}

/**
 * A Pattern with a deterministic busy picture: most of the Palette in diagonal bands, some beads left empty, so every
 * color, the empty-bead tint and the seams between beads all show up in a screenshot. Ids and dates are fixed so the
 * stored library is identical run to run.
 */
export function fixturePattern({
  technique,
  columns = 16,
  rows = 10,
  rotation = 0,
  rowProgress,
  blank = false,
  override = [],
}: FixtureOptions): Pattern {
  const grid: Cell[][] = Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => {
      const slot = (row * 3 + column * 5 + Math.floor(row / 3)) % (PALETTE.length - 3)
      return { color: blank || slot === PALETTE.length - 4 ? null : PALETTE[slot]!.hex }
    }),
  )
  for (const { row, column, color } of override) {
    grid[row]![column] = { color }
  }

  return {
    id: `fixture-${technique}`,
    name: `Fixture ${technique}`,
    technique,
    beadId: 'toho-cube-1.5mm',
    ...framedGrid(grid),
    rowProgress: { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0, ...rowProgress },
    rotation,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
}

/** The stored library for these Patterns, exactly as the app would have written it, ready for localStorage. */
export function storedLibrary(patterns: Pattern[]): string {
  return JSON.stringify({ version: STORED_VERSION, patterns: patterns.map(encodePattern) })
}

export { STORAGE_KEY }

/**
 * Where a bead's centre is on screen, given the surface's bounding box and where the view is scrolled to (the surface's
 * `data-scroll-x` and `data-scroll-y`, which are 0 until the canvas has been moved). The surface is the open canvas
 * itself (ADR 0026): a bead is at its own displayed position, turned and zoomed, less the scroll, from the surface's
 * corner. Worked out from the Technique's geometry (the renderer's, brick stitch's seam pixel included).
 */
export function beadCentre(
  pattern: Pick<Pattern, 'technique' | 'rotation'>,
  box: { x: number; y: number; width: number; height: number },
  zoom: number,
  { row, column }: { row: number; column: number },
  scroll: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const x = rowShiftPx(pattern.technique, row) + column * CELL_SIZE_PX + CELL_SIZE_PX / 2
  const y = rowTopPx(pattern.technique, row) + CELL_SIZE_PX / 2
  const [displayedX, displayedY] = gridToDisplayed(pattern.rotation, x, y, zoom)
  return { x: box.x + displayedX - scroll.x, y: box.y + displayedY - scroll.y }
}
