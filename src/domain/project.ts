import type { Bead } from './beads'
import type { BeadMap, FrameSheet } from './canvas'
import type { Rotation } from './grid'
import type { BeadShape, Technique, TechniqueSettings } from './weave'
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

/** Which way the weaver's rows run: along the grid's rows or down its columns (ticket 32). Separate from
 * Project.rotation, which only turns the picture; rotating swaps the axis, so the weaver flips this too. */
type RowDirection = PassDirection

/** Which row the weaver is on (see CONTEXT.md's Row progress entry); whether the overlay shows is worked out from
 * the Frame (rowProgressOn). */
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

export interface Project {
  id: string
  name: string
  technique: Technique
  /** The Canvas's Technique settings (tickets 0624, 0625): each its Technique describes (brick stitch's Brick block,
   * ticket 477), and a Brick block kept off brick stitch for a switch back. */
  techniqueSettings?: TechniqueSettings
  beadId: string
  /** A full copy of the Bead, saved in the file so the Project opens, draws and is sized the same whatever the catalog
   * later does (ticket 534, ADR 0072). Absent only for an id the catalog never had; a file without one gets it on open. */
  bead?: Bead
  /** The Bead shape (ADR 0068): how the Canvas draws each cell, for both layers. Absent means Symmetric. */
  beadShape?: BeadShape
  /** What is painted on the Canvas, by position (ADR 0026); see BeadMap. No real-world size is stored: the
   * Estimated size is worked out from the Frame (estimatedSizeMm). */
  beads: BeadMap
  /** The Frame (CONTEXT.md, ADR 0066): a sheet of its own beads laid over the Canvas, opaque to what lies under it. Its
   * beads are the Project: Row progress, Export and Beads needed read them alone. Absent on a Canvas with none; an old
   * Project gets one holding the beads inside its old Frame (see normalizeProject). */
  frame?: FrameSheet
  rowProgress: RowProgress
  /** The Palette (ADR 0002, ticket 0525): the id of every swatch in slot order, the twelve built-in colors and the added
   * ones, so the Project opens with the same Palette on every device. */
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
  /** Letters (ticket 0573): print each bead's Swatch letter on the Frame, the PNG and the PDF. Absent means off. */
  letters?: boolean
  /** View-only turn (tickets 28, 171): the Project shown turned this many degrees clockwise. Never a data transform:
   * for Peyote/Brick the stagger is tied to weave direction, so transposing the grid would give an unweavable
   * schema. */
  rotation: Rotation
  /** This Project's maker's name (ADR 0060), printed on exports and the background watermark. Absent: no name
   * printed (domain/makerName.ts). */
  makerName?: string
  /** The names of Pieces (ticket 406, ADR 0050): a named Piece is an unframed Schema, named by one bead's position
   * (the anchor) since Pieces aren't stored; see domain/pieceNames.ts. Absent when no Piece has a name. */
  pieceNames?: PieceName[]
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
