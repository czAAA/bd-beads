import { channelsOf, toOklab } from './color'
import type { PreviewColors } from './framingPreview'
import type { GridDimensions } from './grid'
import { latticeRowStep, type PreviewLattice } from './imageFraming'
import type { Cell, Grid } from './project'
import { columnCycle, describeWeave, rowCycle, type Weave } from './weave'

// The Subject outline, "Outline" on screen (ticket 0766, spec 0761): a ring of beads one bead thick, in one color, on
// every empty bead touching the subject, by the Technique's own neighbours. The Schema grows to hold it.

/** How many rows and columns the Schema grows by on each side for the Outline: one bead, except that the top and left
 * grow by a whole stagger cycle (brick stitch's rows, peyote's columns), so every bead keeps its offset. */
export interface OutlinePad {
  top: number
  left: number
  bottom: number
  right: number
}

/** The Outline's growth for a Weave: one each way on loom, the cycle at the top on brick stitch, at the left on peyote. */
export function outlinePad(weave: Weave): OutlinePad {
  return { top: rowCycle(weave), left: columnCycle(weave), bottom: 1, right: 1 }
}

/** Whether a grid has empty beads round its subject for an Outline to go on: some bead empty and some not, as Cut out,
 * a transparent picture or a found color set to empty leave. */
export function hasEmptyRound(grid: Grid): boolean {
  let empty = false
  let bead = false
  for (const row of grid) {
    for (const cell of row) {
      if (cell.color) bead = true
      else empty = true
      if (bead && empty) return true
    }
  }
  return false
}

/** The darkest of some colors by OKLab lightness, the Outline's color until the maker picks one; none of none. */
export function darkestColor<T extends { hex: string }>(colors: readonly T[]): T | undefined {
  let darkest: T | undefined
  let lightness = Infinity
  for (const color of colors) {
    const { l } = toOklab(channelsOf(color.hex))
    if (l < lightness) {
      darkest = color
      lightness = l
    }
  }
  return darkest
}

/** The grid grown by the Outline's pad (outlinePad), every empty bead that touches a bead (the Weave's neighbours) in
 * `color`: the ring round the subject, and round any hole in it, one bead thick. */
export function outlinedGrid(grid: Grid, weave: Weave, color: string): Grid {
  const pad = outlinePad(weave)
  const rows = grid.length + pad.top + pad.bottom
  const columns = (grid[0]?.length ?? 0) + pad.left + pad.right
  const colorAt = (row: number, column: number) => grid[row - pad.top]?.[column - pad.left]?.color ?? null
  const geometry = describeWeave(weave)
  const bounds = { row: 0, column: 0, rows, columns }
  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_cell, column): Cell => {
      const own = colorAt(row, column)
      if (own) return { color: own }
      const touches = geometry.neighbors(bounds, { row, column }).some((at) => colorAt(at.row, at.column))
      return { color: touches ? color : null }
    }),
  )
}

/** The preview's beads with room for the Outline: the lattice grown where it has too few beads round the Frame, and
 * where it maps back to the lattice it was made from (none in the Outline's room, beside the Frame). */
export interface OutlinedPreview {
  lattice: PreviewLattice
  colors: PreviewColors
  sourceIndex: (index: number) => number | undefined
}

/** The preview (a lattice and its colors round a Frame of `dimensions`) with the Outline's room round the Frame: the
 * outlined grid's beads there, or none while it is not worked out (a handle moving). Rows and columns added above and
 * to the left are whole cycles of the stagger, as partLattice keeps them. */
export function outlinedPreview(
  base: { lattice: PreviewLattice; colors: PreviewColors },
  dimensions: GridDimensions,
  weave: Weave,
  outlined: Grid | undefined,
): OutlinedPreview {
  const { lattice } = base
  const pad = outlinePad(weave)
  const rowStep = latticeRowStep(weave)
  const columnStep = columnCycle(weave)
  const addTop = rowStep * Math.ceil(Math.max(0, pad.top - lattice.frameRow) / rowStep)
  const addLeft = columnStep * Math.ceil(Math.max(0, pad.left - lattice.frameColumn) / columnStep)
  const frameRow = lattice.frameRow + addTop
  const frameColumn = lattice.frameColumn + addLeft
  const grown: PreviewLattice = {
    rows: Math.max(lattice.rows + addTop, frameRow + dimensions.rows + pad.bottom),
    columns: Math.max(lattice.columns + addLeft, frameColumn + dimensions.columns + pad.right),
    frameRow,
    frameColumn,
  }
  const top = frameRow - pad.top
  const left = frameColumn - pad.left
  const inRoom = (row: number, column: number) =>
    row >= top && row < frameRow + dimensions.rows + pad.bottom && column >= left && column < frameColumn + dimensions.columns + pad.right
  const inFrame = (row: number, column: number) =>
    row >= frameRow && row < frameRow + dimensions.rows && column >= frameColumn && column < frameColumn + dimensions.columns
  const sourceAt = (row: number, column: number) => {
    const fromRow = row - addTop
    const fromColumn = column - addLeft
    return fromRow >= 0 && fromRow < lattice.rows && fromColumn >= 0 && fromColumn < lattice.columns ? fromRow * lattice.columns + fromColumn : undefined
  }

  const colors: PreviewColors = new Array(grown.rows * grown.columns)
  for (let row = 0; row < grown.rows; row += 1) {
    for (let column = 0; column < grown.columns; column += 1) {
      const at = row * grown.columns + column
      if (inRoom(row, column) && (outlined || !inFrame(row, column))) colors[at] = outlined?.[row - top]?.[column - left]?.color ?? undefined
      else {
        const source = sourceAt(row, column)
        colors[at] = source === undefined ? undefined : base.colors[source]
      }
    }
  }
  const sourceIndex = (index: number) => {
    const row = Math.floor(index / grown.columns)
    const column = index % grown.columns
    return inRoom(row, column) && !inFrame(row, column) ? undefined : sourceAt(row, column)
  }
  return { lattice: grown, colors, sourceIndex }
}
