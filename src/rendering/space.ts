import { colorAt } from '../domain/canvas'
import type { GridPosition } from '../domain/grid'
import { frameWeave, projectDimensions, projectFrame } from '../domain/project'
import { type DrawnProject } from './projectRenderer'
import { OPEN_EXTENT, projectExtentPx, type Extent } from './surfaceView'

// Where a Project's positions live (ADR 0018, ADR 0026), shared by the renderer and overlay: on the Canvas from row 0,
// column 0; drawn on its own (export, picture, Overview) the Project is the Frame with its first bead at (0, 0). A
// surface builds it once.
export interface Space {
  open: boolean
  /** The Frame's first row and column in this space's own coordinates, and its size. */
  origin: GridPosition
  columns: number
  rows: number
  hasFrame: boolean
  // What to add to a position in this space to get the bead's address: nothing on the Canvas, the Frame's first on its
  // own.
  toAbsolute: GridPosition
  /** The size of what is drawn, for the transform: nothing on the Canvas, the box round the Frame's beads on its
   * own. */
  extent: Extent
}

export function spaceOf(project: DrawnProject, open: boolean): Space {
  const { columns, rows } = projectDimensions(project)
  const frame = projectFrame(project)
  return {
    open,
    origin: open ? { row: frame.row, column: frame.column } : { row: 0, column: 0 },
    columns,
    rows,
    hasFrame: !open || project.frame !== undefined,
    toAbsolute: open ? { row: 0, column: 0 } : { row: frame.row, column: frame.column },
    extent: open ? OPEN_EXTENT : projectExtentPx(frameWeave(project).technique, columns, rows, frameWeave(project).cell),
  }
}

/** The color of the bead drawn at a position of a space (ADR 0066): the Frame's own beads inside the Frame, which are
 * counted from its first row and column whichever space it is drawn in, else the Canvas's. A hex, or null where
 * nothing is painted. */
export function beadInSpace(project: Pick<DrawnProject, 'beads' | 'frame'>, space: Space, row: number, column: number): string | null {
  const frame = project.frame
  const inside = row >= space.origin.row && row < space.origin.row + space.rows && column >= space.origin.column && column < space.origin.column + space.columns
  return frame && inside
    ? colorAt(frame.beads, row - space.origin.row, column - space.origin.column)
    : colorAt(project.beads, space.toAbsolute.row + row, space.toAbsolute.column + column)
}

/** Whether a position can be drawn on: anywhere on the Canvas, inside the Project otherwise. */
export function inSpace(space: Space, row: number, column: number): boolean {
  return space.open || (row >= 0 && row < space.rows && column >= 0 && column < space.columns)
}

// The Canvas with no Project to measure: every position real, none yet drawn. For the layers that only need its
// geometry (the rulers).
export const OPEN_SPACE: Space = { open: true, origin: { row: 0, column: 0 }, columns: 0, rows: 0, hasFrame: false, toAbsolute: { row: 0, column: 0 }, extent: OPEN_EXTENT }
