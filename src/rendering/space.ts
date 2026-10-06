import type { GridPosition } from '../domain/grid'
import { projectDimensions, projectFrame } from '../domain/project'
import { OPEN_EXTENT, projectExtentPx, type DrawnProject, type Extent } from './projectRenderer'

/**
 * Where a Project's positions live (ADR 0018, ADR 0026), the one thing the Project renderer and the overlay both need
 * to agree on. On the open canvas every position is real, measured from row 0, column 0, and the Frame, when there is
 * one, sits where it is; drawn on its own (an export, a picture, the Overview) the Project is the Frame and its first
 * bead is position (0, 0). A surface builds it once and hands the same value to both layers.
 */
export interface Space {
  open: boolean
  /** The Frame's first row and column in this space's own coordinates, and its size. */
  origin: GridPosition
  columns: number
  rows: number
  hasFrame: boolean
  /** What to add to a position in this space to get the bead's own row and column: nothing on the open canvas, the Frame's first on its own. */
  toAbsolute: GridPosition
  /** The size of what is drawn, for the transform: nothing on the open canvas, the box round the Frame's beads on its own. */
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
    extent: open ? OPEN_EXTENT : projectExtentPx(project.technique, columns, rows),
  }
}

/** Whether a position can be drawn on: anywhere on the open canvas, inside the Project otherwise. */
export function inSpace(space: Space, row: number, column: number): boolean {
  return space.open || (row >= 0 && row < space.rows && column >= 0 && column < space.columns)
}
