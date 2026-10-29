import { beadsFromColors, colorsInFrame } from '../domain/canvas'
import { projectFrame } from '../domain/projectExtent'
import type { Grid, Project } from '../domain/project'
import { beadsOfLayer, frameOf, type Layered, withLayer } from '../domain/layerRecord'

// A Project's beads as a dense grid of rows and columns, the shape a test writes its expectation in, and back (ticket
// 0609: the app itself no longer thinks in a grid).

/** The Frame's beads as a dense grid of cells; with no Frame, the box round the Canvas's beads; empty with none. */
export function frameGrid(project: Layered): Grid {
  const frame = frameOf(project)
  const beads = frame ? frame.beads : beadsOfLayer(project, 'canvas')
  const area = frame ? { row: 0, column: 0, rows: frame.rows, columns: frame.columns } : projectFrame(project)
  return colorsInFrame(beads, area).map((row) => row.map((color) => ({ color })))
}

/** The Project with its Frame's beads replaced by a dense grid of cells; a Project with no Frame takes them on the
 * Canvas from its origin, as the beads of a Canvas whose box round them is nothing. */
export function withFrameGrid(project: Project, grid: Grid): Project {
  const beads = beadsFromColors(grid.map((row) => row.map((cell) => cell.color)))
  return withLayer(project, frameOf(project) ? 'frame' : 'canvas', { beads })
}
