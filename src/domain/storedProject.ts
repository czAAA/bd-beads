import { frameIdOf } from './layerRecord'
import { landedClear } from './frameLanding'
import { frameMet } from './frameSpacing'
import { extentMmOf } from './sheets'
import { beadCopy, beadLabel, findBead, readBeadCopy, type Bead } from './beads'
import { BACKGROUND_POSITIONS, readBackground } from './background'
import { beadsFromColors, type FrameSheet } from './canvas'
import { isFrameShape, settingsOf, type QuarterTurns, type ShapedSheet } from './frameShape'
import type { Rotation } from './grid'
import { nearestQuarterTurn, normalizedOrientation } from './canvasOrientation'
import { isSettingsMap, type FlatProject, type FlatWeave, type SavedProject } from './flatWeave'
import { canvasWeave, cellWidthMm, weaveOf } from './layerWeave'
import { readStoredPalette } from './palette'
import { lettersOfPalette, withUsedColors } from './paletteEdits'
import { readMirrorArea, readMirrorSetting, withFittedArea } from './mirror'
import { readPieceNames } from './pieceNames'
import { readReferenceImage } from './referenceImage'
import type { CanvasLayer, FrameLayer, Grid, LayerFields, Project, RowProgress } from './project'
import { readRowProgress, seenProgressOf, type OwnRowProgress } from './rowProgress'
import { roundedMm, turnedPoint, type TablePoint } from './table'
import { beadCell, describeWeave, isTechnique, withCell, type Technique, type Weave } from './weave'

// Reading a Project from storage or a file (CONTEXT.md, docs/testing.md's Stored-data compatibility): every shape an
// older app saved becomes today's Project, so nothing else has to know the old ones.

/** A Project as saved before the Canvas (ADR 0026): a fixed `columns` x `rows` grid instead of beads by position and
 * a Frame. Read by normalizeProject only, which gives it a Frame the size of the grid. */
export type GridProject = Omit<FlatProject, 'beads' | 'frame'> & FlatWeave & { columns: number; rows: number; grid: Grid }

/** A layer as a store or file holds it (file version 12, ticket 0664), before normalizeProject reads it, its id and name
 * possibly missing. A Frame of file version 18 holds its quarter turn and its centre in mm from the Canvas's origin
 * (ticket 1237); one of 15 to 17 its angle and centre in the Canvas's bead widths on the table, and its way as seen (ticket
 * 1185); an older one its quarter turns on the Canvas, its Canvas position and its Row progress in its own rows. */
export type StoredLayer = Omit<LayerFields, 'id'> &
  FlatWeave &
  Partial<Omit<FrameSheet, keyof LayerFields>> & {
    id?: string
    name?: string
    orientation?: number
    /** The first form's Mirror Area on a layer (ticket 0710), which the Mirror is read from (ADR 0082); its Canvas Axes
     * (ticket 0704) are dropped. */
    mirrorAxes?: unknown
    mirrorArea?: unknown
    /** The Frame's own angle on the table and its centre there (file version 15, ticket 1185), in the Canvas's bead widths
     * from its origin; with `offGrid`, since 1188, a centre the Canvas's grid does not give. Read, never written. */
    angle?: number
    centre?: TablePoint
    offGrid?: boolean
    /** The Frame's centre in mm from the Canvas's origin (file version 18, ticket 1237). */
    centreMm?: TablePoint
    /** Its first row and column on the Canvas, before file version 15. */
    row?: number
    column?: number
    /** The Table turn the Canvas holds (file version 18). */
    tableTurn?: number
    /** Row progress as seen (file version 15), or in the Frame's own rows before it. */
    rowProgress?: Partial<RowProgress> | Partial<OwnRowProgress>
  }

/** A Project as it is stored since it holds its layers (file version 12, library version 5, ticket 0664). */
export interface LayeredProject extends Omit<Project, 'layers' | 'palette' | 'paletteCodes'> {
  layers: StoredLayer[]
  /** The Palette in its sections (file version 16, ADR 0103), or the flat list of ids an earlier one held. */
  palette: unknown
  /** Each swatch's code by hex, its catalog its section's; an earlier one's that of the Bead it was woven in. */
  paletteCodes?: unknown
  /** The default colors removed before the Palette was the Project's own (ticket 0528), which nothing reads now. */
  removedDefaults?: unknown
  /** How many backgrounds the list its layers' Background positions are in held (ticket 1000): 3 since that ticket;
   * absent on one stored before it, whose positions are in the list of five and move to their nearest kept one. */
  backgroundPositions?: number
  /** Whether each layer's Letters switch is its own (ticket 1092). Absent on one stored before it, whose layers shared
   * the Frame's: its Canvas opens with Letters off, as it never showed any. */
  lettersByLayer?: boolean
}

/** A Project in any shape a store or file has held it in, for normalizeProject to read. */
export type StoredProject = LayeredProject | SavedProject | GridProject

function isGridProject(project: StoredProject): project is GridProject {
  return Array.isArray((project as GridProject).grid)
}

/** Whether a stored Project holds its layers (ticket 0664), rather than the flat fields of an earlier version. */
function isLayered(project: StoredProject): project is LayeredProject {
  return Array.isArray((project as LayeredProject).layers)
}

/** A Project as an older app may have saved it: with the color-to-bead override (ADR 0007/ticket 36), the stored
 * `widthMm`/`heightMm` (ADR 0026), ticket 28's `rotated` boolean instead of ticket 171's `rotation`, and the Bead shape
 * every layer is now drawn without (ADR 0068, ticket 0724). */
type ProjectWithLegacyFields = SavedProject & {
  beadShape?: unknown
  columns?: unknown
  rows?: unknown
  grid?: unknown
  colorBeadOverrides?: unknown
  widthMm?: unknown
  heightMm?: unknown
  rotated?: unknown
}

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270]

/** `rotation` as ticket 171 shipped it, or ticket 28's `rotated` boolean read as its nearest quarter turn, or
 * upright for a Project from before either existed. */
function legacyRotation(project: ProjectWithLegacyFields): Rotation {
  if (typeof project.rotation === 'number' && (ROTATIONS as readonly number[]).includes(project.rotation)) {
    return project.rotation
  }
  return project.rotated ? 90 : 0
}

/** Fills in fields added after a Project was saved, re-clamps the row pointer and drops dead fields (the color-to-bead
 * override, ADR 0007; the millimetre size, ADR 0026), so a Project from storage or a file is safe whatever version
 * wrote it, and never re-saves them. One saved before its layers opens looking as it did (`layeredOf`). */
export function normalizeProject(stored: StoredProject): Project {
  const layered = isLayered(stored) ? stored : layeredOf(stored)
  const { layers: storedLayers, palette: storedPalette, removedDefaults: _removed, paletteCodes: storedCodes, paletteLetters: storedLetters, mirror: storedMirror, referenceImage: storedReference, backgroundPositions, lettersByLayer, ...rest } = layered
  const [storedCanvas, ...storedFrames] = storedLayers as [StoredLayer, ...StoredLayer[]]
  // Positions stored before ticket 1000 are in the list of five: read once, moved to their nearest kept one.
  const earlierBackgrounds = backgroundPositions !== BACKGROUND_POSITIONS
  const canvas = readCanvas(lettersByLayer === true ? storedCanvas : { ...storedCanvas, letters: undefined }, layered.id, earlierBackgrounds)
  // Every Frame the list holds is kept, though the app makes and shows one (ADR 0079).
  const read = storedFrames.map((stored, index) => readFrame(stored, canvas, `${layered.id}:frame${index > 0 ? index + 1 : ''}`, earlierBackgrounds))
  const frames = read.map(({ frame }) => frame)

  // A Palette saved before its sections is sorted into them by the woven layer's Bead (ADR 0103), read with its id as
  // stored, before an alias names it anew (ticket 534). A color its beads show and the Palette lacks joins it, so it has
  // a Swatch letter (ticket 1124: exports printed "?").
  const palettes = readStoredPalette(storedPalette, storedCodes, (storedFrames[0] ?? storedCanvas).beadId)
  const palette = withUsedColors(palettes.ids, { layers: [canvas, ...frames] }, palettes.codes)
  const paletteCodes = palettes.codes

  const mirror = readMirrorSetting(storedMirror, { canvasArea: readMirrorArea(storedCanvas.mirrorArea), framed: frames.length > 0 })
  const referenceImage = readReferenceImage(storedReference)
  const lastEditedFrame = frames.find((frame) => frame.id === rest.lastEditedFrame)?.id
  // An older file's Canvas Area its Mirror does not fit opens grown to a Fitting size (ticket 1029): no Message, no Undo.
  const { lastEditedFrame: _stored, ...kept } = rest
  const opened = withFittedArea({
    ...kept,
    ...(lastEditedFrame ? { lastEditedFrame } : {}),
    layers: [canvas, ...frames],
    palette,
    ...(Object.keys(paletteCodes).length > 0 ? { paletteCodes } : {}),
    paletteLetters: lettersOfPalette(palette, storedLetters),
    // Mirror (tickets 0703, 0750): a file from before it, or an unreadable record, opens with Mirror off.
    ...(mirror ? { mirror } : {}),
    // The reference image (ticket 0790): an unreadable record opens with none.
    ...(referenceImage ? { referenceImage } : {}),
  }).project
  // A Frame that rounding its lean to a quarter turn brought into another's margin is nudged to the nearest free place.
  return read.reduce((project, { frame, rounded }) => (rounded && frameMet(project, frameIdOf(frame)) ? landedClear(project, frameIdOf(frame)) : project), opened)
}

/** A Project saved before its layers (ticket 0664) as its layers: the Canvas from its own fields, its rotation its
 * orientation, the Frame with its Row progress, both with its Bead and Letters. A grid-shaped one gets a Frame the size
 * of its grid that holds its beads, in its Weave. */
function layeredOf(stored: SavedProject | GridProject): LayeredProject {
  const project = (isGridProject(stored)
    ? {
        ...stored,
        beads: {},
        frame: {
          row: 0,
          column: 0,
          columns: stored.columns,
          rows: stored.rows,
          beads: beadsFromColors(stored.grid.map((row) => row.map((cell) => cell.color))),
          technique: stored.technique,
          ...(stored.techniqueSettings ? { techniqueSettings: stored.techniqueSettings } : {}),
        },
      }
    : stored) as ProjectWithLegacyFields
  const {
    colorBeadOverrides: _legacyOverrides,
    widthMm: _legacyWidthMm,
    heightMm: _legacyHeightMm,
    rotated: _legacyRotated,
    columns: _legacyColumns,
    rows: _legacyRows,
    grid: _legacyGrid,
    brickBlock: _brickBlock,
    rotation: _rotation,
    beadShape: _legacyBeadShape,
    name,
    technique,
    techniqueSettings,
    beadId,
    bead,
    beads,
    frame,
    rowProgress,
    letters,
    pieceNames,
    ...rest
  } = project
  const shared = { beadId, bead, letters }
  const canvas: StoredLayer = { name, technique, techniqueSettings, ...shared, beads: beads ?? {}, pieceNames, orientation: legacyRotation(project) }
  return { ...rest, layers: frame ? [canvas, { ...frame, ...shared, beads: frame.beads ?? {}, rowProgress }] : [canvas] }
}

/** The Canvas a store or file holds, each field read as an older app may have left it. Its name falls back on its
 * Bead's label, for a Project saved before it had one. Its angle on screen splits into its nearest quarter turn and the
 * Table turn of the rest, so an older Canvas at 23° shows exactly where it was (spec 1234, ticket 1237). */
function readCanvas(stored: StoredLayer, projectId: string, earlierBackground: boolean): CanvasLayer {
  const layer = readLayer(stored, `${projectId}:canvas`, readWeave(stored.technique, stored), earlierBackground)
  const name = typeof stored.name === 'string' && stored.name ? stored.name : layer.bead ? beadLabel(layer.bead) : layer.beadId
  const [own, table] = [readOrientation(stored.orientation), readOrientation(stored.tableTurn)]
  const turn = normalizedOrientation(own + table - nearestQuarterTurn(own))
  return { ...layer, name, orientation: nearestQuarterTurn(own), ...(turn ? { tableTurn: turn } : {}) }
}

/** The Frame a store or file holds, its Row progress read inside it; one without a Weave this build knows takes the
 * Canvas's (ticket 492). From file version 18 it keeps its quarter turn and its centre in mm. One from version 15 to 17
 * keeps its angle and centre in the Canvas's bead widths, one before 15 its quarter turns and Canvas position (ticket
 * 1185): each opens where it was, its angle relative to the Canvas rounded to the nearest quarter turn about its own
 * centre (`rounded` where that turned it), a Frame saved on the Canvas's grid at the centre that grid gave it. */
function readFrame(stored: StoredLayer, canvas: CanvasLayer, fallbackId: string, earlierBackground: boolean): { frame: FrameLayer; rounded: boolean } {
  const layer = readLayer(stored, fallbackId, isTechnique(stored.technique) ? readWeave(stored.technique, stored) : weaveOf(canvas), earlierBackground)
  const { rows = 0, columns = 0, folded, name } = stored
  const laid = readFrameShape(stored, weaveOf(layer))
  const seenCanvas = normalizedOrientation(canvas.orientation + (canvas.tableTurn ?? 0))
  // Before file version 15 a Frame kept its quarter turns on the Canvas: one, two or three, anything else none.
  const earlierTurns = stored.quarterTurns === 1 || stored.quarterTurns === 2 || stored.quarterTurns === 3 ? stored.quarterTurns : 0
  const current = readCentre(stored.centreMm)
  const seenAngle = readOrientation(typeof stored.angle === 'number' ? stored.angle : seenCanvas + 90 * earlierTurns)
  const off = normalizedOrientation(seenAngle - seenCanvas)
  const angle = current ? nearestQuarterTurn(seenAngle) : normalizedOrientation(canvas.orientation + nearestQuarterTurn(off))
  const turns = (angle / 90) as QuarterTurns
  const sheet = { rows, columns, ...laid, ...(turns ? { quarterTurns: turns } : {}) }
  const probe: Project = { id: '', layers: [canvas, { ...layer, ...sheet, angle, centre: { x: 0, y: 0 }, rowProgress: { way: 'down' } }], palette: [], createdAt: 0, updatedAt: 0 }
  // Kept to a millionth of a mm as a file stores it, so what is opened reads back the same once written.
  const placed = current ? (stored.centreMm as TablePoint) : onTheTable(probe, stored, sheet)
  const centre = { x: roundedMm(placed.x), y: roundedMm(placed.y) }
  const frame: FrameLayer = {
    ...layer,
    rows,
    columns,
    ...(folded ? { folded } : {}),
    ...(typeof name === 'string' && name ? { name } : {}),
    ...laid,
    angle,
    centre,
    rowProgress: { way: 'down' },
  }
  const shaped: ShapedSheet = { ...withCell(weaveOf(layer), beadCell(layer.bead, layer.technique)), ...laid, ...(turns ? { quarterTurns: turns } : {}), rows, columns }
  // One stored since file version 15 keeps its way as seen; one before, in its own rows, turned as it showed.
  const held = stored.rowProgress
  const seen = (held && 'way' in held) || typeof stored.angle === 'number' ? (held as Partial<RowProgress> | undefined) : seenProgressOf(readOwnProgress(held as Partial<OwnRowProgress> | undefined), laid.shape ? 0 : nearestQuarterTurn(canvas.orientation) / 90 + earlierTurns)
  return { frame: { ...frame, rowProgress: readRowProgress(seen, shaped, nearestQuarterTurn(angle)) }, rounded: !current && off % 90 !== 0 }
}

/** Where an older Frame lies on the Table, in mm from the Canvas's origin: its saved centre in the Canvas's bead widths,
 * which the Canvas shows turned by its whole angle, turned back by the Table turn; else the middle of the rectangle it
 * covers from its saved Canvas position, turned by the Canvas's quarter turn. */
function onTheTable(probe: Project, stored: StoredLayer, sheet: Pick<FrameSheet, 'rows' | 'columns' | 'shape' | 'settings' | 'quarterTurns'>): TablePoint {
  const [canvas, frame] = probe.layers as [CanvasLayer, FrameLayer]
  const mm = cellWidthMm(probe, 'canvas')
  if (readCentre(stored.centre)) return turnedPoint({ x: stored.centre.x * mm, y: stored.centre.y * mm }, -(canvas.tableTurn ?? 0))
  const weave = describeWeave(canvasWeave(probe))
  const corner = weave.origin({ row: stored.row ?? 0, column: stored.column ?? 0 }, 1, weave.cellAspect)
  const extent = extentMmOf(probe, frameIdOf(frame), sheet)
  const [across, down] = (canvas.orientation / 90) % 2 === 1 ? [extent.y, extent.x] : [extent.x, extent.y]
  return turnedPoint({ x: corner.x * mm + across / 2, y: corner.y * mm + down / 2 }, canvas.orientation)
}

/** Whether a stored centre is a point: two finite numbers. */
function readCentre(stored: unknown): stored is TablePoint {
  const { x, y } = (stored ?? {}) as { x?: unknown; y?: unknown }
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
}

/** Row progress as an older file held it, in the Frame's own rows (an old file's `enabled` and `decided` are dropped,
 * as Row progress follows the Frame, tickets 426, 434); a pointer that is no number is the first pass. */
function readOwnProgress(held: Partial<OwnRowProgress> | undefined): OwnRowProgress {
  const stored = held as Record<string, unknown> | undefined
  const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
  return {
    direction: stored?.direction === 'columns' ? 'columns' : 'rows',
    ...(stored?.reversed === true ? { reversed: true } : {}),
    currentRow: count(stored?.currentRow),
    currentColumn: count(stored?.currentColumn),
    currentRowBack: count(stored?.currentRowBack),
    currentColumnBack: count(stored?.currentColumnBack),
  }
}

/** What every stored layer holds, read: its id (or `fallbackId` for one saved without), Weave, Bead copy (its own when
 * readable, else the catalog's of that id through the alias map, ticket 534), Background (a position from the list of
 * five where `earlierBackground`, moved, ticket 1000), beads, Letters, Piece names. */
function readLayer(stored: StoredLayer, fallbackId: string, weave: Weave, earlierBackground: boolean): LayerFields {
  const bead = readBeadCopy(stored.bead) ?? catalogCopy(stored.beadId)
  const pieceNames = readPieceNames(stored.pieceNames)
  return {
    id: typeof stored.id === 'string' && stored.id ? stored.id : fallbackId,
    ...weave,
    beadId: bead?.id ?? stored.beadId,
    ...(bead ? { bead } : {}),
    ...withBackgroundRead(stored.background, earlierBackground),
    beads: stored.beads ?? {},
    ...(stored.letters === true ? { letters: true } : {}),
    ...(pieceNames.length > 0 ? { pieceNames } : {}),
  }
}

/** A stored layer's Background (ticket 0666), left out where unreadable or missing: such a layer shows the device's. */
function withBackgroundRead(stored: unknown, earlier: boolean): Pick<LayerFields, 'background'> {
  const background = readBackground(stored, earlier)
  return background === undefined ? {} : { background }
}

/** The Canvas's stored orientation in degrees (ticket 0664): any angle (ticket 0672), or upright for what is no number. */
function readOrientation(stored: unknown): number {
  return typeof stored === 'number' && Number.isFinite(stored) ? normalizedOrientation(stored) : 0
}

/** The stored Projects this build can read (ticket 0644): one whose Canvas is woven in a Technique it doesn't know,
 * such as one since removed, is skipped, so the rest still load. */
export function inKnownTechniques<T>(stored: readonly T[]): T[] {
  return stored.filter((project) => isTechnique(canvasTechnique(project)))
}

/** The Technique of a stored Project's Canvas, whichever version saved it. */
function canvasTechnique(project: unknown): unknown {
  const stored = project as { technique?: unknown; layers?: { technique?: unknown }[] } | null
  return Array.isArray(stored?.layers) ? stored.layers[0]?.technique : stored?.technique
}

/** The copy a file without one gets: the catalog's Bead of that id, if it knows it. */
function catalogCopy(beadId: string): Bead | undefined {
  const bead = findBead(beadId)
  return bead && beadCopy(bead)
}

/** A layer's Weave from the settings map a file stores (ticket 0636), each its Technique holds; an earlier version's
 * reader has already lifted its Brick block into the map as brick stitch's Drop (flatWeave.ts). */
function readWeave(technique: Technique, { techniqueSettings }: FlatWeave): Weave {
  return weaveOf({ technique, ...(isSettingsMap(techniqueSettings) ? { techniqueSettings } : {}) })
}

/** A stored Frame's Frame shape, kept only where it is one this build knows (ticket 0591), else none. A Custom frame
 * keeps its settings, read within its shape's range (ticket 0592); its turn, like any Frame's (tickets 0594, 0667), is
 * its angle's. One turned before 0667 had its beads rewritten, and opens upright. */
function readFrameShape({ shape, settings: stored }: StoredLayer, weave: Weave): Pick<FrameSheet, 'shape' | 'settings'> {
  if (!isFrameShape(shape)) {
    return {}
  }
  const settings = settingsOf({ shape, settings: stored, ...weave })
  return { shape, ...(settings ? { settings } : {}) }
}
