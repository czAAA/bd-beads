import type { Rotation } from '../../src/domain/grid'
import { describeWeave, type Technique } from '../../src/domain/weave'
import { PALETTE } from '../../src/domain/palette'
import { framedGrid, type Cell, type Project, type RowProgress } from '../../src/domain/project'
import { encodeProject } from '../../src/domain/projectEncoding'
import { OPEN_SPACE } from '../../src/rendering/space'
import { surfaceView } from '../../src/rendering/surfaceView'

/** The localStorage key and stored version the app writes (services/libraryStore.ts): the checks seed a library by
 * writing it directly. */
const STORAGE_KEY = 'openbeads:patterns'
const STORED_VERSION = 4

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

/** A deterministic busy Project: most of the Palette in diagonal bands, some beads empty, fixed ids and dates (a
 * stable library). */
export function fixtureProject({
  technique,
  columns = 16,
  rows = 10,
  rotation = 0,
  rowProgress,
  blank = false,
  override = [],
}: FixtureOptions): Project {
  const grid: Cell[][] = Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => {
      const slot = (row * 3 + column * 5 + Math.floor(row / 3)) % (PALETTE.length - 3)
      return { color: blank || slot === PALETTE.length - 4 ? null : PALETTE[slot]!.hex }
    }),
  )
  for (const { row, column, color } of override) {
    grid[row]![column] = { color }
  }
  // A line of horizontal beads in Right-angle weave stops a column short: no bead is painted where there is none.
  const weave = describeWeave({ technique })
  const frame = { row: 0, column: 0, rows, columns }
  grid.forEach((cells, row) => cells.forEach((_cell, column) => {
    if (!weave.hasPosition({ row, column }, frame)) grid[row]![column] = { color: null }
  }))

  return {
    id: `fixture-${technique}`,
    name: `Fixture ${technique}`,
    technique,
    beadId: 'toho-cube-1.5mm',
    ...framedGrid(grid),
    rowProgress: { direction: 'rows', currentRow: 0, currentColumn: 0, ...rowProgress },
    rotation,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
}

/** The stored library for these Projects, exactly as the app would have written it, ready for localStorage. */
export function storedLibrary(projects: Project[]): string {
  return JSON.stringify({ version: STORED_VERSION, patterns: projects.map(encodeProject) })
}

export { STORAGE_KEY }

// Where a bead's centre is on screen, from the surface's bounding box and scroll (`data-scroll-x`/`-y`, 0 until the
// canvas is moved). The surface is the Canvas itself (ADR 0026): a bead sits at its displayed position, turned and
// zoomed, less the scroll. Worked out from the Technique's geometry (the renderer's).
export function beadCentre(
  project: Pick<Project, 'technique' | 'rotation'>,
  box: { x: number; y: number; width: number; height: number },
  zoom: number,
  { row, column }: { row: number; column: number },
  scroll: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const at = surfaceView({ space: OPEN_SPACE, technique: project.technique, rotation: project.rotation, zoom, scroll }).beadToPoint({ row, column })
  return { x: box.x + at.x, y: box.y + at.y }
}
