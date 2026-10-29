import { beadCopy, type Bead } from './beads'
import { nearestQuarterTurn } from './canvasOrientation'
import type { BeadMap, FrameSheet } from './canvas'
import type { Layer, Rotation } from './grid'
import type { PieceName } from './pieceNames'
import type { CanvasLayer, FrameLayer, LayerFields, Project, RowProgress } from './project'
import { beadCell, DEFAULT_BEAD_SHAPE, heldSettings, withCell, type BeadShape, type Weave } from './weave'

// The one way to read and write a layer, the Canvas or the Frame (ADR 0079, tickets 0661, 0664): a Project holds its
// layers in order, the Canvas first, then its Frame; only this file knows where in that list each one is.

/** A layer, the Canvas or the Frame, as one record (ADR 0079): what a canvas has, wherever the Project keeps it. */
export interface LayerRecord {
  /** Its Technique and settings as held, with the cell its Bead and Bead shape draw it in. */
  weave: Weave
  beadId: string
  /** Its Bead's saved copy (ADR 0072); absent only for an id the catalog never had. */
  bead?: Bead
  beadShape: BeadShape
  /** Its own beads, by its own positions: a Frame's counted from its first row and column. */
  beads: BeadMap
  /** The Canvas's is the Project's name; a Frame's is its own, absent when unnamed. */
  name?: string
}

/** What a layer's record is written with: each field given replaces the layer's, the rest stay. */
export interface LayerChange {
  /** Its Technique and settings; a cell given is not stored, the Bead and Bead shape decide it. */
  weave?: Weave
  bead?: Bead
  beadShape?: BeadShape
  beads?: BeadMap
  /** The Canvas's renames the Project; an empty one clears a Frame's. */
  name?: string
}

/** What a layer is read from: the Project's layer list. */
export type Layered = Pick<Project, 'layers'>

/** The Canvas, layer0 (ADR 0079): the Project's name, its orientation and its Piece names are its own. */
export function canvasOf(project: Layered): CanvasLayer {
  return project.layers[0]
}

/** The Frame (ADR 0066, 0079), the layer after the Canvas; none on a Canvas without one, or with no Project open. */
export function frameOf(project: Layered | undefined): FrameLayer | undefined {
  return project?.layers[1]
}

/** The Frames after the Canvas (ADR 0079): the app makes and shows at most one. */
function framesOf(project: Layered): FrameLayer[] {
  return project.layers.slice(1) as FrameLayer[]
}

/** The layer the Letters switch follows (ADR 0079): the Frame when there is one, else the Canvas. */
function wovenLayer(project: Layered): LayerFields {
  return frameOf(project) ?? canvasOf(project)
}

/** A new id for a layer (ADR 0079): unique within its Project. */
export function newLayerId(): string {
  return crypto.randomUUID()
}

/** A layer's Weave as its record holds it (ticket 0625): its Technique and its settings map, read from that map alone
 * and left out where it holds none. A Frame's other fields are left out. */
export function weaveOf({ technique, techniqueSettings }: Weave): Weave {
  const settings = heldSettings(technique, techniqueSettings)
  return Object.keys(settings).length > 0 ? { technique, techniqueSettings: settings } : { technique }
}

/** A layer's record without its Weave's settings: what a new Weave is written over. */
export function unwoven<T extends Partial<Weave>>(record: T): Omit<T, 'techniqueSettings'> {
  const { techniqueSettings: _settings, ...rest } = record
  return rest
}

/** The layer itself, as the Project holds it; none for a Frame the Project lacks. */
function heldLayer(project: Layered, layer: Layer): LayerFields | undefined {
  return layer === 'frame' ? frameOf(project) : canvasOf(project)
}

/** A layer's Weave, with the cell its Bead and Bead shape draw it in (ADR 0068); none for a Frame the Project lacks.
 * The Weave of `layerOf`. */
export function weaveOfLayer(project: Layered, layer: 'canvas'): Weave
export function weaveOfLayer(project: Layered, layer: Layer): Weave | undefined
export function weaveOfLayer(project: Layered, layer: Layer): Weave | undefined {
  const held = heldLayer(project, layer)
  return held && withCell(weaveOf(held), beadCell(held.bead, held.beadShape ?? DEFAULT_BEAD_SHAPE))
}

/** A layer as one record (ADR 0079): its Weave, Bead, Bead shape, beads and name. None for a Frame the Project lacks. */
export function layerOf(project: Layered, layer: 'canvas'): LayerRecord
export function layerOf(project: Layered, layer: Layer): LayerRecord | undefined
export function layerOf(project: Layered, layer: Layer): LayerRecord | undefined {
  const held = heldLayer(project, layer)
  if (!held) {
    return undefined
  }
  const { name } = held as LayerFields & { name?: string }
  return { weave: weaveOfLayer(project, layer)!, beadId: held.beadId, ...beadOfLayer(project, layer), beads: held.beads, ...(name ? { name } : {}) }
}

/** The Project with a layer written (ADR 0079): its Weave, beads and name into that layer, and a Bead or Bead shape into
 * every layer, which share them until ticket 0665. Not stamped as a change: the caller does that, as a change of view
 * is not. The same Project without a Frame. */
export function withLayer(project: Project, layer: Layer, change: LayerChange): Project {
  const held = heldLayer(project, layer)
  if (!held) {
    return project
  }
  const { weave, bead, beadShape, beads, name } = change
  const rewoven = { ...(weave ? { ...unwoven(held), ...weaveOf(weave) } : held), ...(beads ? { beads } : {}) }
  let layers: Project['layers']
  if (layer === 'canvas') {
    layers = [{ ...(rewoven as CanvasLayer), ...(name !== undefined ? { name } : {}) }, ...framesOf(project)]
  } else {
    const { name: previous, ...frame } = rewoven as FrameLayer
    const kept = name ?? previous
    layers = [canvasOf(project), { ...frame, ...(kept ? { name: kept } : {}) }, ...framesOf(project).slice(1)]
  }
  return { ...project, layers: bead || beadShape ? mapLayers(layers, (each) => withBead(each, bead, beadShape)) : layers }
}

/** Every layer changed alike, the Canvas still first. */
function mapLayers(layers: Project['layers'], change: <T extends LayerFields>(layer: T) => T): Project['layers'] {
  return [change(layers[0]), ...framesOf({ layers }).map(change)]
}

/** A layer with its Bead and Bead shape replaced where given: Symmetric is the default and is left unsaved. */
function withBead<T extends LayerFields>(layer: T, bead: Bead | undefined, beadShape: BeadShape | undefined): T {
  let next: T = bead ? { ...layer, beadId: bead.id, bead: beadCopy(bead) } : layer
  if (beadShape) {
    const { beadShape: _old, ...rest } = next
    next = (beadShape === DEFAULT_BEAD_SHAPE ? rest : { ...rest, beadShape }) as T
  }
  return next
}

/** The Project with its Canvas's own fields changed where given (its orientation, Piece names). Not stamped. */
export function withCanvas(project: Project, change: Partial<CanvasLayer>): Project {
  return { ...project, layers: [{ ...canvasOf(project), ...change }, ...framesOf(project)] }
}

/** The Project with its Frame laid as a sheet (ADR 0066, 0079), or removed with none: a field the sheet leaves out is
 * gone. The Frame keeps its id, Bead, Letters switch and Row progress, the sheet's own winning; one laid anew copies the
 * Canvas's and starts at the first row. Not stamped as a change. */
export function withFrameSheet(project: Project, sheet: (FrameSheet & Partial<FrameLayer>) | undefined): Project {
  const canvas = canvasOf(project)
  if (!sheet) {
    return { ...project, layers: [canvas] }
  }
  const kept = frameOf(project) ? frameIdentity(frameOf(project)!) : { ...frameIdentity({ ...canvas, rowProgress: { ...FIRST_ROW } }), id: newLayerId() }
  const { cell: _cell, ...laid } = sheet
  return { ...project, layers: [canvas, { ...kept, ...laid }, ...framesOf(project).slice(1)] }
}

/** What makes a Frame the same layer whatever its sheet (ADR 0079): its id, Bead, Bead shape, Letters switch and Row
 * progress. A Frame made anew in place of another keeps them. */
export function frameIdentity({ id, beadId, bead, beadShape, letters, rowProgress }: Omit<FrameLayer, keyof FrameSheet> & LayerFields): Omit<FrameLayer, keyof FrameSheet> {
  return { id, beadId, ...(bead ? { bead } : {}), ...(beadShape ? { beadShape } : {}), ...(letters ? { letters: true } : {}), rowProgress }
}

/** Where a Frame laid anew starts its Row progress: the first row, along its rows. */
const FIRST_ROW: RowProgress = { direction: 'rows', currentRow: 0, currentColumn: 0 }

/** The Canvas's orientation (ADR 0079): the turn the whole picture is shown at, in degrees, any angle (ticket 0672);
 * none with no Project open. */
export function orientationOf(project: Layered): number
export function orientationOf(project: Layered | undefined): number | undefined
export function orientationOf(project: Layered | undefined): number | undefined {
  return project && canvasOf(project).orientation
}

/** The quarter turn the Canvas's orientation is nearest (ticket 0672): what it is drawn, exported and measured as seen
 * at; only the view on screen leans off it. */
export function quarterTurnOf(project: Layered): Rotation {
  return nearestQuarterTurn(canvasOf(project).orientation)
}

/** The Project's name: the Canvas's (ADR 0079), and its file's. */
export function projectNameOf(project: Layered): string {
  return canvasOf(project).name
}

/** The names of the Canvas's Pieces (ticket 406, ADR 0050); none when no Piece is named. */
export function pieceNamesOf(project: Layered): PieceName[] | undefined {
  return canvasOf(project).pieceNames
}

/** The Project with its Canvas's Piece names replaced; an empty list is left unsaved. Not stamped. */
export function withPieceNames(project: Project, names: readonly PieceName[] | undefined): Project {
  const { pieceNames: _previous, ...canvas } = canvasOf(project)
  return { ...project, layers: [{ ...canvas, ...(names?.length ? { pieceNames: [...names] } : {}) }, ...framesOf(project)] }
}

/** Whether the Letters switch is on (ticket 0573): the Frame's when there is one, else the Canvas's. */
export function lettersOn(project: Layered): boolean {
  return wovenLayer(project).letters === true
}

/** The Project with the Letters switch set on every layer, which share one until a layer is given its own. Not stamped. */
export function withLetters(project: Project, on: boolean): Project {
  const set = <T extends LayerFields>(layer: T): T => {
    const { letters: _letters, ...rest } = layer
    return (on ? { ...rest, letters: true } : rest) as T
  }
  return { ...project, layers: mapLayers(project.layers, set) }
}

/** A layer's own beads (ADR 0079), the Frame's counted from its first row and column; none for a Frame the Project
 * lacks. The beads of `layerOf`. */
export function beadsOfLayer(project: Layered, layer: 'canvas'): BeadMap
export function beadsOfLayer(project: Layered, layer: Layer): BeadMap | undefined
export function beadsOfLayer(project: Layered, layer: Layer): BeadMap | undefined {
  return heldLayer(project, layer)?.beads
}

/** A layer's Bead copy and Bead shape (ADR 0068, 0072), which every layer shares until ticket 0665; a Frame the Project
 * lacks reads the Canvas's. Those of `layerOf`. */
export function beadOfLayer(project: Layered, layer: Layer): Pick<LayerRecord, 'bead' | 'beadShape'> {
  const held = heldLayer(project, layer) ?? canvasOf(project)
  return { ...(held.bead ? { bead: held.bead } : {}), beadShape: held.beadShape ?? DEFAULT_BEAD_SHAPE }
}

/** The id of a layer's Bead (ADR 0072), every layer's the same until ticket 0665: what its built-in colors and Swatch
 * letters are read from. A Frame the Project lacks reads the Canvas's. That of `layerOf`. */
export function beadIdOfLayer(project: Layered, layer: Layer): string {
  return (heldLayer(project, layer) ?? canvasOf(project)).beadId
}

/** A layer's Weave as held (ticket 0625): its Technique and settings, without the cell its Bead draws it in, for a
 * reader that counts positions as the bare Weave does (ticket 0662). None for a Frame the Project lacks. */
export function heldWeave(project: Layered, layer: 'canvas'): Weave
export function heldWeave(project: Layered, layer: Layer): Weave | undefined
export function heldWeave(project: Layered, layer: Layer): Weave | undefined {
  const held = heldLayer(project, layer)
  return held && weaveOf(held)
}
