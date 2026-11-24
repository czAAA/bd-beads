import { beadCopy, type Bead } from './beads'
import { nearestQuarterTurn, normalizedOrientation, quarterTurnsOff } from './canvasOrientation'
import type { BeadMap, FrameSheet } from './canvas'
import type { FrameId, FrameRef, Layer, Rotation } from './grid'
import type { PieceName } from './pieceNames'
import { type Background, type CanvasLayer, type FrameLayer, type LayerFields, type Project, type RowProgress } from './project'
import { startingRowProgress } from './rowWays'
import { beadCell, heldSettings, withCell, type Weave } from './weave'

// The one way to read and write a layer, the Canvas or a Frame (ADR 0079, tickets 0661, 0664, 1216): a Project holds its
// layers in order, the Canvas first, then its Frames, each named by its id; only this file knows where in that list each
// one is.

/** A layer, the Canvas or the Frame, as one record (ADR 0079): what a canvas has, wherever the Project keeps it. */
export interface LayerRecord {
  /** Its Technique and settings as held, with the cell its Bead draws it in. */
  weave: Weave
  beadId: string
  /** Its Bead's saved copy (ADR 0072); absent only for an id the catalog never had. */
  bead?: Bead
  /** Its own beads, by its own positions: a Frame's counted from its first row and column. */
  beads: BeadMap
  /** The Canvas's is the Project's name; a Frame's is its own, absent when unnamed. */
  name?: string
}

/** What a layer's record is written with: each field given replaces the layer's, the rest stay. */
export interface LayerChange {
  /** Its Technique and settings; a cell given is not stored, the Bead decides it. */
  weave?: Weave
  bead?: Bead
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

/** Where in the layer list the Frame a reference names is: -1 for the Canvas, or a Frame the Project lacks. */
function frameIndex(project: Layered | undefined, frame: Layer): number {
  if (!project || frame === 'canvas') return -1
  return project.layers.findIndex((layer, index) => index > 0 && layer.id === frame)
}

/** A Frame layer as the Project holds it: its own angle on the table, no `quarterTurns`. */
function heldFrame(project: Layered | undefined, frame: Layer): FrameLayer | undefined {
  const index = frameIndex(project, frame)
  return index > 0 ? (project!.layers[index] as FrameLayer) : undefined
}

/** A Frame as the Project holds it (ticket 1216): its own angle on the table and no `quarterTurns` (see frameById), for
 * what lays it on the table itself. */
export function heldFrameById(project: Layered, frame: Layer): FrameLayer | undefined {
  return heldFrame(project, frame)
}

/** Each layer list's Frames as read (see frameById), so a Frame read twice from one Project is the same object. */
const readFrames = new WeakMap<Layered['layers'], Map<FrameLayer, FrameLayer>>()

/** A Frame by its reference (ADR 0066, 0079, ticket 1216), with `quarterTurns` read from its own angle on the table and
 * the Canvas's (spec 1182): how it lies on the Canvas's grid, what its laying, sizes and handles go by. None for the
 * Canvas, a Frame the Project lacks, or no Project open. */
export function frameById(project: Layered | undefined, frame: Layer): FrameLayer | undefined {
  const held = heldFrame(project, frame)
  if (!held) return undefined
  let known = readFrames.get(project!.layers)
  if (!known) {
    known = new Map()
    readFrames.set(project!.layers, known)
  }
  const found = known.get(held)
  if (found) return found
  // Off the Canvas's grid a Frame without a shape lies on none (ticket 1188): no quarter turns, its own rows upright on
  // its own drawing. A Custom frame's layout is still built turned by them.
  const turns = held.centre && !held.shape ? 0 : quarterTurnsOff(held.angle, canvasOf(project!).orientation)
  const { quarterTurns: _stale, ...rest } = held
  const read = turns === (held.quarterTurns ?? 0) ? held : turns ? { ...rest, quarterTurns: turns } : rest
  known.set(held, read)
  return read
}

/** The first Frame in the list (see frameById), for what the app shows one Frame of until it shows several (ticket
 * 1222): the one place that reads a Frame by its place in the list, and whose id every other call then names. */
export function frameOf(project: Layered | undefined): FrameLayer | undefined {
  const first = project && framesOf(project)[0]
  return first ? frameById(project, frameIdOf(first)) : undefined
}

/** A reference no Frame answers to: what `firstFrameId` names in a Project with none, so a read of it finds nothing. */
export const NO_FRAME = '' as FrameId

/** The first Frame's reference, or `NO_FRAME`: for what shows one Frame of the Project until it shows several (tickets
 * 1219, 1222); every other call names the Frame it acts on. */
export function firstFrameId(project: Layered | undefined): FrameId {
  const first = project && framesOf(project)[0]
  return first ? frameIdOf(first) : NO_FRAME
}

/** The reference a Frame about to be laid goes under (ticket 1217): the first Frame's, where one is laid in place, else
 * a new one's. */
export function frameToLay(project: Layered): FrameId {
  const first = framesOf(project)[0]
  return first ? frameIdOf(first) : (newLayerId() as FrameId)
}

/** The Frames after the Canvas, in order (ADR 0079), as the Project holds them: the app makes and shows at most one. */
export function framesOf(project: Layered): FrameLayer[] {
  return project.layers.slice(1) as FrameLayer[]
}

/** The woven layer (ADR 0072, tickets 0665, 1216): the first Frame, or the Canvas without one. Whose Bead the Project
 * is made in, and the Palette's built-in colors and Swatch letters are read from, until the Palette is the Project's
 * own (ticket 1225). */
export function wovenLayerOf(project: Layered): Layer {
  const first = framesOf(project)[0]
  return first ? frameIdOf(first) : 'canvas'
}

/** A view of the Project with the Canvas and the one Frame named (ticket 1218, spec 1214): what Export, Beads needed and
 * the thumbnail are given, so each works on one Frame as it always has. The Project itself where that is all it holds;
 * the Canvas alone for a Frame it lacks. */
export function soloFrame<T extends Layered>(project: T, frame: Layer): T {
  const frames = framesOf(project)
  if (frames.length === 0 || (frames.length === 1 && frameIdOf(frames[0]!) === frame)) return project
  const kept = frames.filter((each) => frameIdOf(each) === frame)
  return { ...project, layers: [canvasOf(project), ...kept] }
}

/** A Frame's reference (ticket 1216): its id. */
export function frameIdOf(frame: Pick<FrameLayer, 'id'>): FrameId {
  return frame.id as FrameId
}

/** The Project with the Frame a reference names held anew (ticket 1216), every other layer as it was. The same Project
 * for a Frame it lacks. Not stamped. */
export function withFrameById(project: Project, frame: Layer, change: (held: FrameLayer) => FrameLayer): Project {
  const index = frameIndex(project, frame)
  if (index < 1) return project
  const layers = [...project.layers] as Project['layers']
  layers[index] = change(project.layers[index] as FrameLayer)
  return { ...project, layers }
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
  return layer === 'canvas' ? canvasOf(project) : heldFrame(project, layer)
}

/** A layer's Weave, with the cell its Bead draws it in (ADR 0068); none for a Frame the Project lacks.
 * The Weave of `layerOf`. */
export function weaveOfLayer(project: Layered, layer: 'canvas'): Weave
export function weaveOfLayer(project: Layered, layer: Layer): Weave | undefined
export function weaveOfLayer(project: Layered, layer: Layer): Weave | undefined {
  const held = heldLayer(project, layer)
  return held && withCell(weaveOf(held), beadCell(held.bead, held.technique))
}

/** A layer as one record (ADR 0079): its Weave, Bead, beads and name. None for a Frame the Project lacks. */
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

/** The Project with a layer written (ADR 0079, tickets 0665, 0670): its Weave, Bead, beads and name. Not
 * stamped as a change: the caller does that, as a change of view is not. The same Project without a Frame. */
export function withLayer(project: Project, layer: Layer, change: LayerChange): Project {
  const held = heldLayer(project, layer)
  if (!held) {
    return project
  }
  const { weave, bead, beads, name } = change
  const rewoven = withBead({ ...(weave ? { ...unwoven(held), ...weaveOf(weave) } : held), ...(beads ? { beads } : {}) }, bead)
  if (layer === 'canvas') {
    return { ...project, layers: [{ ...(rewoven as CanvasLayer), ...(name !== undefined ? { name } : {}) }, ...framesOf(project)] }
  }
  const { name: previous, ...frame } = rewoven as FrameLayer
  const kept = name ?? previous
  return withFrameById(project, layer, () => ({ ...frame, ...(kept ? { name: kept } : {}) }))
}

/** Every layer changed alike, the Canvas still first. */
function mapLayers(layers: Project['layers'], change: <T extends LayerFields>(layer: T) => T): Project['layers'] {
  return [change(layers[0]), ...framesOf({ layers }).map(change)]
}

/** A layer with its Bead replaced where given. */
function withBead<T extends LayerFields>(layer: T, bead: Bead | undefined): T {
  return bead ? { ...layer, beadId: bead.id, bead: beadCopy(bead) } : layer
}

/** The Project with its Canvas's own fields changed where given (its orientation, Piece names). Not stamped. */
export function withCanvas(project: Project, change: Partial<CanvasLayer>): Project {
  return { ...project, layers: [{ ...canvasOf(project), ...change }, ...framesOf(project)] }
}

/** The Project with a Frame laid as a sheet as `withFrameSheet` (frameSheet.ts) lays it, before a Frame off the
 * Canvas's grid is carried to its place on the table (ticket 1188): what only that module calls. The Frame named is
 * laid anew in its place, or removed without a sheet; one the Project lacks is added after the others. */
export function laidFrameSheet(project: Project, sheet: (FrameSheet & Partial<FrameLayer>) | undefined, { anew = false, frame }: { anew?: boolean; frame: FrameRef }): Project {
  const canvas = canvasOf(project)
  const index = frameIndex(project, frame)
  if (!sheet) {
    return index > 0 ? { ...project, layers: project.layers.filter((_layer, at) => at !== index) as Project['layers'] } : project
  }
  const held = heldFrame(project, frame)
  const placed = anew ? undefined : held
  // A Frame named by an id the Project lacks is made with that id.
  const id = frame
  const kept = held ? frameIdentity(held) : { ...frameIdentity({ ...canvas, rowProgress: startingRowProgressOf(sheet) }), id }
  const { cell: _cell, quarterTurns, angle: _angle, centre: _centre, ...laid } = sheet
  const turned = 90 * ((quarterTurns ?? 0) - (placed ? (frameById(project, frame)!.quarterTurns ?? 0) : 0))
  const angle = normalizedOrientation((placed ? placed.angle : canvas.orientation) + turned)
  const made = { ...kept, ...laid, angle }
  return index > 0 ? withFrameById(project, frame, () => made) : { ...project, layers: [...project.layers, made] }
}

/** The Project with a Frame layer's own fields set as given (its angle, its Row progress), as the Project holds them:
 * no sheet is laid. The same Project without that Frame. Not stamped. */
export function withFrameFields(project: Project, change: Partial<Pick<FrameLayer, 'angle' | 'rowProgress'>>, frame: FrameRef): Project {
  return withFrameById(project, frame, (held) => ({ ...held, ...change }))
}

/** What makes a Frame the same layer whatever its sheet (ADR 0079): its id, Bead, Background, Letters
 * switch and Row progress. A Frame made anew in place of another keeps them. */
export function frameIdentity({ id, beadId, bead, background, letters, rowProgress }: Omit<FrameLayer, keyof FrameSheet | 'angle'> & LayerFields): Omit<FrameLayer, keyof FrameSheet | 'angle'> {
  return {
    id,
    beadId,
    ...(bead ? { bead } : {}),
    ...(background !== undefined ? { background } : {}),
    ...(letters ? { letters: true } : {}),
    rowProgress,
  }
}

/** The starting way (spec 1182): Row progress afresh, the rows running the Frame Technique's own way as seen, whatever
 * the Canvas or its turn; every fresh start asks it. */
export function startingRowProgressOf({ technique, shape }: Pick<FrameSheet, 'technique' | 'shape'>): RowProgress {
  return startingRowProgress(technique, !!shape)
}

/** The Project with its Frame's Row progress started afresh (see startingRowProgressOf); the same Project without a
 * Frame. Not stamped as a change. */
export function withStartingRowProgress(project: Project, frame: FrameRef): Project {
  return withFrameById(project, frame, (held) => ({ ...held, rowProgress: startingRowProgressOf(held) }))
}

/** The Canvas's orientation (ADR 0079): its angle on the table, in degrees, any angle (ticket 0672); none with no
 * Project open. */
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

/** Whether a layer's Letters switch is on (tickets 0573, 1092): the Canvas's letters its beads and the Palette's
 * swatches, the Frame's its own beads. Off for a Frame the Project lacks. */
export function lettersOn(project: Layered, layer: Layer): boolean {
  return heldLayer(project, layer)?.letters === true
}

/** The Project with a layer's Letters switch set (ticket 1092): each layer has its own. The same Project for a Frame
 * it lacks. Not stamped. */
export function withLetters(project: Project, layer: Layer, on: boolean): Project {
  const held = heldLayer(project, layer)
  if (!held || (held.letters === true) === on) return project
  const set = <T extends LayerFields>(own: T): T => {
    if (own !== held) return own
    const { letters: _letters, ...rest } = own
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

/** A layer's Bead copy (ADR 0072, 0079); a Frame the Project lacks reads the Canvas's, so the Frame's is the woven
 * layer's. That of `layerOf`. */
export function beadOfLayer(project: Layered, layer: Layer): Pick<LayerRecord, 'bead'> {
  const held = heldLayer(project, layer) ?? canvasOf(project)
  return held.bead ? { bead: held.bead } : {}
}

/** The id of a layer's Bead (ADR 0072, 0079). A Frame the Project lacks reads the Canvas's, so the Frame's is the woven
 * layer's: what the Palette's built-in colors and Swatch letters are read from (ticket 0665). That of `layerOf`. */
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

/** A layer's Background (ADR 0079, ticket 0666); none for one saved before it had one, which shows the device's last
 * pick, or for a Frame the Project lacks. */
export function backgroundOf(project: Layered, layer: Layer): Background | undefined {
  return heldLayer(project, layer)?.background
}

/** The Project with a layer's Background replaced (ticket 0666): a view, so not stamped and no Undo step. The same
 * Project without a Frame. */
export function withBackground(project: Project, layer: Layer, background: Background): Project {
  if (!heldLayer(project, layer)) return project
  const set = <T extends LayerFields>(held: T): T => ({ ...held, background })
  return layer === 'canvas' ? { ...project, layers: [set(canvasOf(project)), ...framesOf(project)] } : withFrameById(project, layer, set)
}

/** The Project with every layer that has no Background given `start` (ticket 0666): a new Project starts on the
 * device's last pick, and keeps it on every device. The same Project where every layer has one. Not stamped. */
export function withStartBackground(project: Project, start: Background): Project {
  if (project.layers.every((layer) => layer.background !== undefined)) return project
  const fill = <T extends LayerFields>(layer: T): T => (layer.background === undefined ? { ...layer, background: start } : layer)
  return { ...project, layers: mapLayers(project.layers, fill) }
}
