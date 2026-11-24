import type { Bead } from './beads'
import type { BeadMap, FrameSheet } from './canvas'
import type { Weave } from './weave'
import type { PaletteIds, PaletteCodes } from './palette'
import type { SwatchLetters } from './swatchLetters'
import type { PieceName } from './pieceNames'
import type { MirrorSetting } from './mirror'
import type { ReferenceImage } from './referenceImage'

// The Project record and `touch`, which stamps a change (ticket 0620); it imports types alone. The operations live by
// concern: createProject, storedProject (old files), layerWeave, weaveSwitch, rowProgress, layerBeads, drawing, fill,
// paletteEdits, projectBead, undoSnapshot, projectExtent, projectLibrary, and frame.ts's withFrame.

export interface Cell {
  color: string | null
}

/** A dense rows × columns array of cells: not what a Project stores (it stores `beads`), but what Convert image
 * produces and what older Projects were saved as. */
export type Grid = Cell[][]

/** A way the weaver's rows run as seen, as an arrow points (spec 1182): down is top to bottom, right left to right. */
export type SeenWay = 'down' | 'right' | 'up' | 'left'

/** Which pass the weaver is on (CONTEXT.md's Row progress), the Frame's own (ADR 0079): the way its rows run as seen on
 * its nearest quarter turn (spec 1182), and a pointer per way as seen (ticket 0589), the zero-based pass woven now,
 * absent at the first. Whether the overlay shows is worked out from the Frame (rowProgressOn). */
export type RowProgress = { way: SeenWay } & Partial<Record<SeenWay, number>>

/** A layer's Background (ADR 0079, ticket 0666): a numbered position in the theme's list, 1 to 3, kept across light
 * and dark, or a Custom color as `#rrggbb`, one for both themes. */
export type Background = number | string

/** What every layer holds (ADR 0079, ticket 0664): a sub-canvas, the Canvas or a Frame, with its own id, its Weave (a
 * Technique and its settings), Bead, beads, Letters switch and Piece names. */
export interface LayerFields extends Weave {
  /** Its own id, unique within the Project. */
  id: string
  beadId: string
  /** A full copy of its Bead, saved in the file so the layer opens, draws and is sized the same whatever the catalog
   * later does (ticket 534, ADR 0072). Absent only for an id the catalog never had; a file without one gets it on open. */
  bead?: Bead
  /** The color it is drawn on (ADR 0079, ticket 0666), a view saved with it. Absent on a layer saved before it had one,
   * which shows the device's last pick. */
  background?: Background
  /** What is painted on it, by its own positions (ADR 0026); see BeadMap. */
  beads: BeadMap
  /** Letters (ticket 0573): print each bead's Swatch letter on the Frame, the PNG and the PDF. Absent means off. */
  letters?: boolean
  /** The names of its Pieces (ticket 406, ADR 0050): a named Piece is an unframed Schema, named by one bead's position
   * (the anchor) since Pieces aren't stored; see domain/pieceNames.ts. Absent when no Piece has a name. */
  pieceNames?: PieceName[]
}

/** The Canvas (layer0, ADR 0079): its name is the Project's, and its orientation its angle on the table. */
export interface CanvasLayer extends LayerFields {
  /** The Project's name, and the file's: one value. */
  name: string
  /** View-only turn (tickets 28, 171, ADR 0079): the Canvas, and every layer on it, shown turned this many degrees
   * clockwise, from 0 up to a whole turn; any angle by a twist on touch (ticket 0672). Never a data transform. */
  orientation: number
  /** Where its origin lies on the table (spec 1182, ticket 1188), in its bead widths: a turn about a pivot moves it. A
   * view of this session, never saved: a file's table has its origin at the Canvas's. Absent, at the table's origin. */
  origin?: { x: number; y: number }
}

/** A Frame as a layer (ADR 0066, 0079): its sheet (place, Weave, beads, Folded beads, name, Frame shape and settings)
 * with the rest of a layer, its own angle on the table and its Row progress. */
export interface FrameLayer extends LayerFields, FrameSheet {
  /** Its own angle on the table (spec 1182), degrees clockwise from 0 up to a whole turn: no longer quarter turns on the
   * Canvas. `quarterTurns`, how it lies on the Canvas's grid, is read from it and the Canvas's (layerRecord's frameOf). */
  angle: number
  /** Its centre on the table, in the Canvas's bead widths, where it lies off the Canvas's grid (ticket 1188): turned
   * other than by whole quarters from the Canvas, or off its whole positions. Its row and column then only address its
   * cells, and it has no quarter turns. Absent, it lies on the grid where its row and column put it. */
  centre?: { x: number; y: number }
  rowProgress: RowProgress
}

/** A Project's layers in order (ADR 0079): the Canvas first, then its Frames; the app makes and shows at most one. */
type Layers = [CanvasLayer, ...FrameLayer[]]

export interface Project {
  id: string
  /** Its layers (ADR 0079, ticket 0664): the Canvas, then its Frame, if any. Read and written through layerRecord.ts. */
  layers: Layers
  /** The Palette (ADR 0002, 0103, ticket 0525): the id of every swatch in slot order, its default colors and the added
   * ones, each section's together, so the Project opens with the same Palette on every device. The Project's own: shared
   * by every layer and following none of their Beads. */
  palette: PaletteIds
  /** The catalog code of each swatch picked from a Color catalog, with that catalog, by the swatch's hex (ticket 0538,
   * ADR 0072, 0103): what puts it in that catalog's section. Painted cells keep only their hex. Absent when no swatch has
   * a code. */
  paletteCodes?: PaletteCodes
  /** The Swatch letter of each Palette color, by the swatch's hex (ticket 0573). Every Project has one for every
   * color; it only goes missing in a file from before letters, which opening fills in Palette order. */
  paletteLetters?: SwatchLetters
  /** This Project's maker's name (ADR 0060), printed on exports and the background watermark. Absent: no name
   * printed (domain/makerName.ts). */
  makerName?: string
  /** The Mirror (ADR 0082, ticket 0750): one per Project, its place (a Canvas Area or the whole Frame), Mode, Axes and
   * counts. Absent on a Project saved before Mirror, which reads as off (domain/mirror.ts). */
  mirror?: MirrorSetting
  /** The reference image (ticket 0790, ADR 0089): the settings of the one picture laid on the Canvas, a view saved with
   * the Project; its bytes are kept beside the library. Absent when it has none (domain/referenceImage.ts). */
  referenceImage?: ReferenceImage
  /** The Last edited Frame's id (spec 1214, ticket 1220): the Frame most recently painted on or changed, kept with the
   * Project (file version 17). Absent until a Frame is edited, or once that Frame is gone: read it through
   * `lastEditedFrameId`. */
  lastEditedFrame?: string
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
