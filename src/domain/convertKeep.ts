import { clamp } from './clamp'
import type { GridDimensions } from './grid'
import type { Grid } from './project'

/** A part of the converted beads kept with Select (ConvertImage card, Preview pane; ticket 0780): a rectangle of whole
 * beads in the Frame's rows and columns. Only these become the Project; nothing is converted again. */
export interface KeptPart {
  row: number
  column: number
  rows: number
  columns: number
}

/** After how many rows and columns the Weave's stagger repeats (weave's rowCycle and columnCycle): a kept part starts on
 * a whole cycle, so a peyote or brick stitch Project keeps the shifts the preview shows. */
export interface StaggerCycles {
  rowCycle: number
  columnCycle: number
}

const onCycle = (at: number, cycle: number) => Math.floor(at / Math.max(1, cycle)) * Math.max(1, cycle)

/** The part drawn from the bead a drag began on to the one it is on, either way round, kept on the beads. */
export function keptDrawn(
  from: { row: number; column: number },
  to: { row: number; column: number },
  size: GridDimensions,
  cycles: StaggerCycles,
): KeptPart {
  const axis = (a: number, b: number, length: number, cycle: number) => {
    const start = onCycle(clamp(Math.min(a, b), 0, length - 1), cycle)
    const end = clamp(Math.max(a, b), 0, length - 1)
    return [start, end - start + 1] as const
  }
  const [row, rows] = axis(from.row, to.row, size.rows, cycles.rowCycle)
  const [column, columns] = axis(from.column, to.column, size.columns, cycles.columnCycle)
  return { row, column, rows, columns }
}

/** The part moved whole by beads, kept on the beads and on whole cycles of the stagger. */
export function keptMoved(part: KeptPart, columns: number, rows: number, size: GridDimensions, cycles: StaggerCycles): KeptPart {
  const axis = (start: number, by: number, extent: number, length: number, cycle: number) =>
    onCycle(clamp(start + by, 0, Math.max(0, length - extent)), cycle)
  return {
    ...part,
    row: axis(part.row, rows, part.rows, size.rows, cycles.rowCycle),
    column: axis(part.column, columns, part.columns, size.columns, cycles.columnCycle),
  }
}

/** Only the kept beads of a converted grid: the Project Create Project makes from a kept part. */
export function keptGrid(grid: Grid, part: KeptPart): Grid {
  return grid.slice(part.row, part.row + part.rows).map((cells) => cells.slice(part.column, part.column + part.columns))
}
