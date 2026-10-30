import { frameContains, type Rect } from './canvas'
import { laidFrame } from './frameOrientation'
import type { GridPosition } from './grid'
import { beadOfLayer, beadsOfLayer, heldWeave, type Layered } from './layerRecord'
import { projectPalette } from './palette'
import { namedPieces, type NamedPiece } from './pieceNames'
import { pieceBeadsAt } from './pieces'
import type { Project } from './project'
import { estimatedSizeMm, type EstimatedSizeMm } from './projectSize'

/** Whether the laid Frame hides the whole of `piece`'s rectangle. */
function hiddenBy(frame: Rect | undefined, piece: Rect): boolean {
  return frame !== undefined && frameContains(frame, piece) && frameContains(frame, { row: piece.row + piece.rows - 1, column: piece.column + piece.columns - 1 })
}

/** The unframed Schemas that carry a tag (tickets 0721, 0733): the named Pieces of the Canvas, less any the Frame wholly
 * hides. `named` is passed by a caller that holds its Pieces through a stroke (`ruledPieces`, ticket 0674). */
export function unframedSchemas(project: Layered, named: readonly NamedPiece[] = namedPieces(project)): NamedPiece[] {
  const frame = laidFrame(project)
  return named.filter((piece) => !hiddenBy(frame, piece))
}

/** What the opened paper tag says about a Schema: its rectangle in beads, its Estimated size with the Canvas's Bead
 * (none for a Bead the catalog lacks), how many beads it holds and its colors in the Palette's order. */
export interface SchemaDetails {
  columns: number
  rows: number
  sizeMm: EstimatedSizeMm | undefined
  beads: number
  colors: string[]
}

/** The details of the Schema holding the bead at `anchor`, counted as Beads needed counts (every bead once, by its
 * color); a color the Palette lacks comes last. Undefined where no bead stands. */
export function schemaDetails(project: Project, anchor: GridPosition): SchemaDetails | undefined {
  const beads = beadsOfLayer(project, 'canvas')
  const members = pieceBeadsAt(beads, heldWeave(project, 'canvas'), anchor)
  if (members.length === 0) return undefined
  const rows = members.map((at) => at.row)
  const columns = members.map((at) => at.column)
  const size = { columns: Math.max(...columns) - Math.min(...columns) + 1, rows: Math.max(...rows) - Math.min(...rows) + 1 }
  const order = new Map(projectPalette(project).colors.map((color, index) => [color.hex, index]))
  const rank = (hex: string) => order.get(hex) ?? order.size
  const colors = [...new Set(members.map((at) => beads[at.row]![at.column]!))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  const { bead } = beadOfLayer(project, 'canvas')
  return { ...size, sizeMm: bead ? estimatedSizeMm(size, bead) : undefined, beads: members.length, colors }
}
