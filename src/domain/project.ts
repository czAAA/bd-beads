import type { Bead } from './beads'
import type { BeadMap, FrameSheet } from './canvas'
import type { BeadShape, Weave } from './weave'
import type { PassDirection } from './weaveGeometry'
import type { PaletteIds, PaletteCodes } from './palette'
import type { SwatchLetters } from './swatchLetters'
import type { PieceName } from './pieceNames'

// The Project record and `touch`, which stamps a change (ticket 0620); it imports types alone. The operations live by
// concern: createProject, storedProject (old files), layerWeave, weaveSwitch, rowProgress, layerBeads, drawing, fill,
// paletteEdits, projectBead, undoSnapshot, projectExtent, projectLibrary, and frame.ts's withFrame.

export interface Cell {
  color: string | null
}

/** A dense rows × columns array of cells: not what a Project stores (it stores `beads`), but what Convert image
 * produces and what older Projects were saved as. */
export type Grid = Cell[][]

/** Which way the weaver's rows run: along the grid's rows or down its columns (ticket 32). Separate from the Canvas's
 * orientation, which only turns the picture; rotating swaps the axis, so the weaver flips this too. */
type RowDirection = PassDirection

/** Which row the weaver is on (see CONTEXT.md's Row progress entry), the Frame's own (ADR 0079); whether the overlay
 * shows is worked out from the Frame (rowProgressOn). */
export interface RowProgress {
  direction: RowDirection
  /** Zero-based index of the row being woven now; every row before it counts as finished. */
  currentRow: number
  /** The same pointer for when rows run down the grid's columns, kept apart so flipping the direction never loses
   * either place. */
  currentColumn: number
  /** Rows run from the Frame's far end (bottom to top, or right to left), with their own two pointers so turning
   * never loses a place (ticket 0589). Missing means false and 0. */
  reversed?: boolean
  currentRowBack?: number
  currentColumnBack?: number
}

/** What every layer holds (ADR 0079, ticket 0664): a sub-canvas, the Canvas or a Frame, with its own id, its Weave (a
 * Technique and its settings), Bead, Bead shape, beads, Letters switch and Piece names. */
export interface LayerFields extends Weave {
  /** Its own id, unique within the Project. */
  id: string
  beadId: string
  /** A full copy of its Bead, saved in the file so the layer opens, draws and is sized the same whatever the catalog
   * later does (ticket 534, ADR 0072). Absent only for an id the catalog never had; a file without one gets it on open. */
  bead?: Bead
  /** Its Bead shape (ADR 0068): how each cell is drawn. Absent means Symmetric. */
  beadShape?: BeadShape
  /** What is painted on it, by its own positions (ADR 0026); see BeadMap. */
  beads: BeadMap
  /** Letters (ticket 0573): print each bead's Swatch letter on the Frame, the PNG and the PDF. Absent means off. */
  letters?: boolean
  /** The names of its Pieces (ticket 406, ADR 0050): a named Piece is an unframed Schema, named by one bead's position
   * (the anchor) since Pieces aren't stored; see domain/pieceNames.ts. Absent when no Piece has a name. */
  pieceNames?: PieceName[]
}

/** The Canvas (layer0, ADR 0079): its name is the Project's, and its orientation is the view's turn. */
export interface CanvasLayer extends LayerFields {
  /** The Project's name, and the file's: one value. */
  name: string
  /** View-only turn (tickets 28, 171, ADR 0079): the Canvas, and every layer on it, shown turned this many degrees
   * clockwise, from 0 up to a whole turn; any angle by a twist on touch (ticket 0672). Never a data transform. */
  orientation: number
}

/** A Frame as a layer (ADR 0066, 0079): its sheet (place, Weave, beads, Folded beads, name, Frame shape and settings,
 * quarter turns, its orientation) with the rest of a layer and its Row progress. */
export interface FrameLayer extends LayerFields, FrameSheet {
  rowProgress: RowProgress
}

/** A Project's layers in order (ADR 0079): the Canvas first, then its Frames; the app makes and shows at most one. */
type Layers = [CanvasLayer, ...FrameLayer[]]

export interface Project {
  id: string
  /** Its layers (ADR 0079, ticket 0664): the Canvas, then its Frame, if any. Read and written through layerRecord.ts. */
  layers: Layers
  /** The Palette (ADR 0002, ticket 0525): the id of every swatch in slot order, the twelve built-in colors and the added
   * ones, so the Project opens with the same Palette on every device. Shared by every layer. */
  palette: PaletteIds
  /** The default colors the maker removed after a change of Bead made them added colors (ticket 0528), as hexes, so a
   * change back does not put them back. Absent when none. */
  removedDefaults?: string[]
  /** The catalog code of each swatch picked from the Color catalog, by the swatch's hex (ticket 0538, ADR 0072). Painted
   * cells keep only their hex. Absent when no swatch has a code. */
  paletteCodes?: PaletteCodes
  /** The Swatch letter of each Palette color, by the swatch's hex (ticket 0573). Every Project has one for every
   * color; it only goes missing in a file from before letters, which opening fills in Palette order. */
  paletteLetters?: SwatchLetters
  /** This Project's maker's name (ADR 0060), printed on exports and the background watermark. Absent: no name
   * printed (domain/makerName.ts). */
  makerName?: string
  createdAt: number
  updatedAt: number
  /** When the Project last reached this device's storage (ticket 145): orders the library, newest first. Absent on
   * older Projects, whose updatedAt stands in (see lastSaved). */
  savedAt?: number
}

/** Applies a change to a Project as a new object, stamping it as just-edited. */
export function touch(project: Project, changes: Partial<Project>): Project {
  return { ...project, ...changes, updatedAt: Date.now() }
}
