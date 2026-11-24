import { frameIdIn } from '../../src/testUtils/frameId'
import type { Rotation } from '../../src/domain/grid'
import type { Technique } from '../../src/domain/weave'
import { BUILT_IN_COLORS, defaultPaletteIds } from '../../src/domain/palette'
import { framedGrid } from '../../src/domain/layerBeads'
import type { Cell, Project } from '../../src/domain/project'
import { seenProgressOf, type OwnRowProgress } from '../../src/domain/rowProgress'
import { encodeProject } from '../../src/domain/projectEncoding'
import { OPEN_SPACE } from '../../src/rendering/space'
import { surfaceView } from '../../src/rendering/surfaceView'
import { canvasOf, frameOf, type Layered, quarterTurnOf } from '../../src/domain/layerRecord'
import { frameCentreOnCanvas, framePlacement, laidTurnOf, withFrameAt, withLaidTurn } from '../../src/domain/framePlacement'
import { CELL_SIZE_PX } from '../../src/rendering/cellSize'
import { placedFrame } from '../../src/domain/layerWeave'

/** The localStorage key and stored version the app writes (services/libraryStore.ts): the checks seed a library by
 * writing it directly. */
const STORAGE_KEY = 'openbeads:patterns'
const STORED_VERSION = 5

export interface FixtureOptions {
  technique: Technique
  columns?: number
  rows?: number
  /** The Canvas's turn. */
  rotation?: Rotation
  /** The Frame's own angle on the table (ticket 1188): upright unless given, whatever the Canvas's turn. */
  frameTurn?: Rotation
  /** Row progress in the Frame's own rows (along them top to bottom unless given), as the Frame lies: saved as the way
   * it shows (ticket 1185). */
  rowProgress?: Partial<OwnRowProgress>
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
  frameTurn = 0,
  rowProgress,
  blank = false,
  override = [],
}: FixtureOptions): Project {
  const grid: Cell[][] = Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column) => {
      const slot = (row * 3 + column * 5 + Math.floor(row / 3)) % (BUILT_IN_COLORS.length - 3)
      return { color: blank || slot === BUILT_IN_COLORS.length - 4 ? null : BUILT_IN_COLORS[slot]!.hex }
    }),
  )
  for (const { row, column, color } of override) {
    grid[row]![column] = { color }
  }

  const [canvas, frame] = framedGrid(grid, { technique, beadId: 'toho-cube-1.5mm' }).layers
  const project: Project = {
    id: `fixture-${technique}`,
    layers: [
      { ...canvas, id: 'fixture-canvas', name: `Fixture ${technique}`, orientation: rotation },
      { ...frame!, id: 'fixture-frame', angle: frameTurn, rowProgress: seenProgressOf({ direction: 'rows', currentRow: 0, currentColumn: 0, ...rowProgress }, frameTurn / 90) },
    ],
    palette: defaultPaletteIds(),
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
  // The Canvas turned under an upright Frame, as Rotate canvas leaves them (ticket 1188): off the Canvas's grid, a little
  // off its positions (its row and column, which address its cells, still the first), so it lies only by its own rows.
  if (rotation === frameTurn || rotation === 0) return project
  const { x, y } = framePlacement(project, frameIdIn(project))!.at
  return withFrameAt(project, { x: x + 0.3, y: y + 0.2 }, frameIdIn(project))
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
  project: Layered | { technique: Technique; rotation: Rotation },
  box: { x: number; y: number; width: number; height: number },
  zoom: number,
  { row, column }: { row: number; column: number },
  scroll: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const { technique, rotation } = 'layers' in project ? { technique: canvasOf(project).technique, rotation: quarterTurnOf(project) } : project
  const shift = 'layers' in project ? frameShift(project, zoom) : undefined
  if (shift) {
    // The Frame's own bead, on its own surface: laid at its row and column, which only address its cells.
    const laid = withLaidTurn(project as Project, undefined, frameIdIn(project as Project))
    const frame = frameOf(laid)!
    const view = surfaceView({ space: OPEN_SPACE, technique, rotation: shift.rotation, zoom, scroll, frame: placedFrame(laid, frameIdIn(laid)) })
    const at = view.beadToPoint({ row: row + frame.row, column: column + frame.column }, frameIdIn(laid))
    return { x: box.x + at.x + shift.x, y: box.y + at.y + shift.y }
  }
  const at = surfaceView({ space: OPEN_SPACE, technique, rotation, zoom, scroll }).beadToPoint({ row, column })
  return { x: box.x + at.x, y: box.y + at.y }
}

/** Where a Frame drawn otherwise than its Canvas shows (ticket 1188; ProjectSurface's `frameDrawn` pin, worked out again): its own surface is pinned at its centre where the
 * Canvas lays it, so a bead of it lies where an upright Frame at its own quarter turn would, moved by `x` and `y`
 * displayed px. None where the Frame lies as the Canvas is drawn. The Frame starts at the Canvas's first position. */
export function frameShift(project: Layered, zoom: number): { rotation: Rotation; x: number; y: number } | undefined {
  if (!frameOf(project)) return undefined
  const laid = withLaidTurn(project as Project, undefined, frameIdIn(project as Project))
  const rotation = laidTurnOf(laid, frameIdIn(laid))
  if (rotation === quarterTurnOf(project)) return undefined
  const { technique } = canvasOf(project)
  const at = (shown: Layered, turn: Rotation) => {
    const centre = frameCentreOnCanvas(shown, frameIdIn(shown))!
    return surfaceView({ space: OPEN_SPACE, technique, rotation: turn, zoom }).gridToPoint(centre.x * CELL_SIZE_PX, centre.y * CELL_SIZE_PX)
  }
  const [pinned, own] = [at(project, quarterTurnOf(project)), at(laid, rotation)]
  return { rotation, x: pinned.x - own.x, y: pinned.y - own.y }
}

/** A small piece in a Bead, laid out in rows of `#` (heart, red), `o` (white) and `y` (yellow), for the round Bead's
 * checks (ticket 1010): on the Canvas, or in a Frame over an empty one. */
export function pieceProject({ technique, beadId, picture, inFrame = false }: { technique: Technique; beadId: string; picture: readonly string[]; inFrame?: boolean }): Project {
  const colors: Record<string, string> = { '#': '#e63746', o: '#ffffff', y: '#f2c94c' }
  const grid: Cell[][] = picture.map((line) => [...line].map((mark) => ({ color: colors[mark] ?? null })))
  const [canvas, frame] = framedGrid(grid, { technique, beadId }).layers
  return {
    id: `piece-${technique}`,
    layers: inFrame ? [{ ...canvas!, id: 'piece-canvas', name: 'Piece' }, { ...frame!, id: 'piece-frame' }] : [{ ...canvas!, id: 'piece-canvas', name: 'Piece', beads: frame!.beads }],
    palette: defaultPaletteIds(),
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  }
}
