import { clamp } from './clamp'
import type { CropHandle, PixelCrop } from './convertSize'
import type { GridDimensions } from './grid'
import type { ImageSize } from './imageFraming'
import type { Grid } from './project'

/** A part of the converted beads kept with the crop (ConvertImage card DS-1, tickets 0780, 0898): a rectangle of whole
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

/** The fewest beads a kept part has on a side (ConvertImage card DS-1, ticket 0898), as the Width slider's least. */
const MIN_KEPT_BEADS = 8

/** The part with a crop handle's edges moved by whole beads (ConvertImage card DS-1, ticket 0898): the other edges stay
 * put, the part stays on the beads with at least 8 a side (fewer only where the beads are fewer), starting on a cycle. */
export function keptPulled(part: KeptPart, handle: CropHandle, columns: number, rows: number, size: GridDimensions, cycles: StaggerCycles): KeptPart {
  const lower = handle.toLowerCase()
  const axis = (start: number, extent: number, by: number, length: number, cycle: number, low: boolean, high: boolean) => {
    const least = Math.min(MIN_KEPT_BEADS, length)
    let from = start
    let to = start + extent
    if (low) from = onCycle(clamp(from + by, 0, to - least), cycle)
    if (high) to = clamp(to + by, from + least, length)
    return [from, to - from] as const
  }
  const [row, keptRows] = axis(part.row, part.rows, rows, size.rows, cycles.rowCycle, handle.startsWith('top'), handle.startsWith('bottom'))
  const [column, keptColumns] = axis(part.column, part.columns, columns, size.columns, cycles.columnCycle, lower.includes('left'), lower.includes('right'))
  return { row, column, rows: keptRows, columns: keptColumns }
}

/** Where the beads stand on the picture: the part woven, its pixels per bead, and where its Frame sits in the beads. */
export interface WovenPlace {
  part: PixelCrop
  pixelsPerBead: { x: number; y: number }
  frameRow: number
  frameColumn: number
}

/** The picture pixels under a kept part (ticket 0898), in whole pixels on the picture: what is converted again once the
 * Width moves after a crop, or the picture turns or flips with it. */
export function keptCrop(part: KeptPart, { part: woven, pixelsPerBead, frameRow, frameColumn }: WovenPlace, picture: ImageSize): PixelCrop {
  const axis = (start: number, extent: number, origin: number, per: number, length: number) => {
    const from = clamp(Math.round(origin + start * per), 0, length - 1)
    const to = clamp(Math.round(origin + (start + extent) * per), from + 1, length)
    return [from, to - from] as const
  }
  const [x, width] = axis(part.column - frameColumn, part.columns, woven.x, pixelsPerBead.x, picture.width)
  const [y, height] = axis(part.row - frameRow, part.rows, woven.y, pixelsPerBead.y, picture.height)
  return { x, y, width, height }
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
