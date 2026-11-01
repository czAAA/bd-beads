import type { GridDimensions } from './grid'
import { columnCycle, rowCycle, type Technique, type TechniqueSettings } from './weave'

/** The Convert image preview's lattice (ADR 0010, ticket 0747): the Frame is the part of the picture to weave, drawn
 * as beads, and the rest of the picture is drawn round it in the same beads, dimmed. */

/** A picture's own pixel dimensions, all the sizing math needs of it. */
export interface ImageSize {
  width: number
  height: number
}

/** Most bead cells the preview renders, redrawn on every drag move (ticket 104). The surround shrinks evenly to fit;
 * the frame is always whole.
 * @internal Its test checks the preview stays under it. */
export const PREVIEW_MAX_CELLS = 12000

/** The block of bead cells the preview draws: the frame's grid extended by a margin of cells on each side, so a
 * lattice cell is a Project cell offset by that margin. */
export interface PreviewLattice {
  columns: number
  rows: number
  /** Which lattice column holds the frame's column 0. */
  frameColumn: number
  /** Which lattice row holds the frame's row 0. Always a whole number of the shift's cycles (even, or 2N on
   * brick stitch), so an offset Technique's half-cell stagger runs unbroken across the frame's edge. */
  frameRow: number
}

/** The largest fraction of the wanted margins that keeps the lattice inside the cell budget. */
function marginFit(dimensions: GridDimensions, wantedColumns: number, wantedRows: number): number {
  const { columns, rows } = dimensions
  // (columns + 2 f mc) * (rows + 2 f mr) <= PREVIEW_MAX_CELLS, solved for the largest f in 0..1.
  const a = 4 * wantedColumns * wantedRows
  const b = 2 * (columns * wantedRows + rows * wantedColumns)
  const c = columns * rows - PREVIEW_MAX_CELLS

  if (c >= 0) {
    return 0
  }
  if (a === 0) {
    return b === 0 ? 1 : Math.min(1, -c / b)
  }
  return Math.min(1, (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a))
}

/** What the preview's lattice is worked out from (spec 0645, ticket 0747). */
export interface PartLatticeInput {
  image: ImageSize
  /** The part to weave, in picture pixels. */
  part: { x: number; y: number; width: number; height: number }
  /** Picture pixels each bead stands for along each side (convertSize's Sizing). */
  pixelsPerBead: { x: number; y: number }
  dimensions: GridDimensions
  technique: Technique
  techniqueSettings?: TechniqueSettings
}

/** The rows a lattice's top edge moves by: whole cycles of the stagger, and at least two (see PreviewLattice.frameRow). */
export function latticeRowStep(weave: { technique: Technique; techniqueSettings?: TechniqueSettings }): number {
  return Math.max(2, rowCycle(weave))
}

/** The preview's lattice: the frame (the part's beads) and the rest of the picture round it, in whole beads each
 * side, capped at PREVIEW_MAX_CELLS. The rows above are whole cycles of the shift (see PreviewLattice.frameRow), so
 * the top may reach a row past the picture. */
export function partLattice({ image, part, pixelsPerBead, dimensions, technique, techniqueSettings }: PartLatticeInput): PreviewLattice {
  const left = Math.round(part.x / pixelsPerBead.x)
  const top = Math.round(part.y / pixelsPerBead.y)
  const right = Math.max(0, Math.ceil((image.width - part.x - part.width) / pixelsPerBead.x - 1e-9))
  const bottom = Math.max(0, Math.ceil((image.height - part.y - part.height) / pixelsPerBead.y - 1e-9))

  const fit = marginFit(dimensions, (left + right) / 2, (top + bottom) / 2)
  const cycle = latticeRowStep({ technique, techniqueSettings })
  const across = columnCycle({ technique, techniqueSettings })
  const frameColumn = across * Math.ceil(Math.floor(left * fit) / across)
  const frameRow = cycle * Math.ceil(Math.floor(top * fit) / cycle)

  return {
    columns: frameColumn + dimensions.columns + Math.floor(right * fit),
    rows: frameRow + dimensions.rows + Math.floor(bottom * fit),
    frameColumn,
    frameRow,
  }
}
