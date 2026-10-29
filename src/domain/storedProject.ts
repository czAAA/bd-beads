import { beadCopy, beadLabel, findBead, readBeadCopy, type Bead } from './beads'
import { beadsFromColors, type FrameSheet } from './canvas'
import { normalizeHex } from './color'
import { isFrameShape, settingsOf, type ShapedSheet } from './frameShape'
import type { Rotation } from './grid'
import { isSettingsMap, type FlatProject, type FlatWeave, type SavedProject } from './flatWeave'
import { weaveOf } from './layerWeave'
import { codesInPalette, defaultPalette, normalizePaletteCodes, normalizePaletteIds } from './palette'
import { lettersOfPalette } from './paletteEdits'
import { readPieceNames } from './pieceNames'
import type { CanvasLayer, FrameLayer, Grid, LayerFields, Project, RowProgress } from './project'
import { readRowProgress } from './rowProgress'
import { isVersionThree, liftVersionThree, type VersionThreeProject } from './versionThree'
import { beadCell, DEFAULT_BEAD_SHAPE, isTechnique, withCell, type Technique, type Weave } from './weave'

// Reading a Project from storage or a file (CONTEXT.md, docs/testing.md's Stored-data compatibility): every shape an
// older app saved becomes today's Project, so nothing else has to know the old ones.

/** A Project as saved before the Canvas (ADR 0026): a fixed `columns` x `rows` grid instead of beads by position and
 * a Frame. Read by normalizeProject only, which gives it a Frame the size of the grid. */
export type GridProject = Omit<FlatProject, 'beads' | 'frame'> & FlatWeave & { columns: number; rows: number; grid: Grid }

/** A layer as a store or file holds it (file version 12, ticket 0664), before normalizeProject reads it: what a Canvas
 * or a Frame holds, its id and name possibly missing. A Frame's orientation is held as its quarter turns. */
export type StoredLayer = Omit<LayerFields, 'id'> &
  FlatWeave &
  Partial<Omit<FrameSheet, keyof LayerFields>> & {
    id?: string
    name?: string
    orientation?: number
    rowProgress?: Partial<RowProgress> & { currentRow: number }
  }

/** A Project as it is stored since it holds its layers (file version 12, library version 5, ticket 0664). */
export interface LayeredProject extends Omit<Project, 'layers'> {
  layers: StoredLayer[]
}

/** A Project in any shape a store or file has held it in, for normalizeProject to read. */
export type StoredProject = LayeredProject | SavedProject | GridProject | VersionThreeProject

function isGridProject(project: StoredProject): project is GridProject {
  return Array.isArray((project as GridProject).grid)
}

/** Whether a stored Project holds its layers (ticket 0664), rather than the flat fields of an earlier version. */
function isLayered(project: StoredProject): project is LayeredProject {
  return Array.isArray((project as LayeredProject).layers)
}

/** A Project as an older app may have saved it: with the color-to-bead override (ADR 0007/ticket 36), the stored
 * `widthMm`/`heightMm` (ADR 0026) and ticket 28's `rotated` boolean instead of ticket 171's `rotation`. */
type ProjectWithLegacyFields = SavedProject & {
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
  const { layers: storedLayers, palette: storedPalette, removedDefaults: storedRemoved, paletteCodes: storedCodes, paletteLetters: storedLetters, ...rest } = layered
  const [storedCanvas, storedFrame] = storedLayers as [StoredLayer, StoredLayer | undefined]
  const canvas = readCanvas(storedCanvas, layered.id)
  const frame = storedFrame && readFrame(storedFrame, canvas, layered.id)

  // The Palette's built-in colors are read with the Bead id as stored, before an alias names it anew (ticket 534).
  const builtIns = defaultPalette(storedCanvas.beadId)
  const removedDefaults = readRemovedDefaults(storedRemoved)
  // A Project saved before the Palette belonged to it (or with an unreadable one) starts from its Bead's built-in colors.
  const palette = normalizePaletteIds(storedPalette, builtIns)
  const paletteCodes = codesInPalette(normalizePaletteCodes(storedCodes), palette, builtIns)

  return {
    ...rest,
    layers: frame ? [canvas, frame] : [canvas],
    palette,
    ...(removedDefaults.length > 0 ? { removedDefaults } : {}),
    ...(Object.keys(paletteCodes).length > 0 ? { paletteCodes } : {}),
    paletteLetters: lettersOfPalette(palette, storedCanvas.beadId, storedLetters),
  }
}

/** A Project saved before its layers (ticket 0664) as its layers: the Canvas from its own fields, its rotation its
 * orientation, the Frame with its Row progress, both with its Bead, Bead shape and Letters. A grid-shaped one gets a
 * Frame the size of its grid, a version 3 one its Frame's beads lifted into it (versionThree.ts, temporary). */
function layeredOf(stored: SavedProject | GridProject | VersionThreeProject): LayeredProject {
  const upright: SavedProject | VersionThreeProject = isGridProject(stored)
    ? {
        ...stored,
        beads: beadsFromColors(stored.grid.map((row) => row.map((cell) => cell.color))),
        frame: { row: 0, column: 0, columns: stored.columns, rows: stored.rows },
      }
    : stored
  const project = (isVersionThree(upright) ? liftVersionThree(upright) : upright) as ProjectWithLegacyFields
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
    name,
    technique,
    techniqueSettings,
    beadId,
    bead,
    beadShape,
    beads,
    frame,
    rowProgress,
    letters,
    pieceNames,
    ...rest
  } = project
  const shared = { beadId, bead, beadShape, letters }
  const canvas: StoredLayer = { name, technique, techniqueSettings, ...shared, beads: beads ?? {}, pieceNames, orientation: legacyRotation(project) }
  return { ...rest, layers: frame ? [canvas, { ...frame, ...shared, beads: frame.beads ?? {}, rowProgress }] : [canvas] }
}

/** The Canvas a store or file holds, each field read as an older app may have left it. Its name falls back on its
 * Bead's label, for a Project saved before it had one. */
function readCanvas(stored: StoredLayer, projectId: string): CanvasLayer {
  const layer = readLayer(stored, `${projectId}:canvas`, readWeave(stored.technique, stored))
  const pieceNames = readPieceNames(stored.pieceNames)
  const name = typeof stored.name === 'string' && stored.name ? stored.name : layer.bead ? beadLabel(layer.bead) : layer.beadId
  return { ...layer, name, ...(pieceNames.length > 0 ? { pieceNames } : {}), orientation: readOrientation(stored.orientation) }
}

/** The Frame a store or file holds, its Row progress read inside it. One stored before it had a Weave of its own
 * (ticket 492), or with one this build does not know, takes the Canvas's. */
function readFrame(stored: StoredLayer, canvas: CanvasLayer, projectId: string): FrameLayer {
  const layer = readLayer(stored, `${projectId}:frame`, isTechnique(stored.technique) ? readWeave(stored.technique, stored) : weaveOf(canvas))
  const { row = 0, column = 0, rows = 0, columns = 0, folded, name } = stored
  const laid = readFrameShape(stored)
  const shaped: ShapedSheet = { ...withCell(weaveOf(layer), beadCell(layer.bead, layer.beadShape ?? DEFAULT_BEAD_SHAPE)), ...laid, rows, columns }
  return {
    ...layer,
    row,
    column,
    rows,
    columns,
    ...(folded ? { folded } : {}),
    ...(typeof name === 'string' && name ? { name } : {}),
    ...laid,
    rowProgress: readRowProgress(stored.rowProgress, shaped),
  }
}

/** What every stored layer holds, read: its id (or `fallbackId` for one saved without), Weave, Bead copy (its own when
 * readable, otherwise the catalog's of that id, through the alias map, ticket 534), Bead shape, beads and Letters. */
function readLayer(stored: StoredLayer, fallbackId: string, weave: Weave): LayerFields {
  const bead = readBeadCopy(stored.bead) ?? catalogCopy(stored.beadId)
  return {
    id: typeof stored.id === 'string' && stored.id ? stored.id : fallbackId,
    ...weave,
    beadId: bead?.id ?? stored.beadId,
    ...(bead ? { bead } : {}),
    // An unreadable or missing Bead shape reads as Symmetric, which is left unsaved.
    ...(stored.beadShape === 'real' ? { beadShape: stored.beadShape } : {}),
    beads: stored.beads ?? {},
    ...(stored.letters === true ? { letters: true } : {}),
  }
}

/** The Canvas's stored orientation in degrees (ticket 0664): a quarter turn, or upright for anything else. */
function readOrientation(stored: unknown): Rotation {
  return (ROTATIONS as readonly unknown[]).includes(stored) ? (stored as Rotation) : 0
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

/** The removed default colors a stored Project holds: the valid hexes, each once; none for anything else. */
function readRemovedDefaults(stored: unknown): string[] {
  if (!Array.isArray(stored)) return []
  const hexes = stored.flatMap((hex) => (typeof hex === 'string' ? (normalizeHex(hex) ?? []) : []))
  return [...new Set(hexes)]
}

/** A layer's Weave from the settings map a file stores (ticket 0636), each its Technique holds; an earlier version's
 * reader has already lifted its flat Brick block into the map (flatWeave.ts). */
function readWeave(technique: Technique, { techniqueSettings }: FlatWeave): Weave {
  return weaveOf({ technique, ...(isSettingsMap(techniqueSettings) ? { techniqueSettings } : {}) })
}

/** A stored Frame's Frame shape, kept only where it is one this build knows (ticket 0591), else none. A Custom frame
 * keeps its settings, read within its shape's range (ticket 0592), and any Frame its orientation (tickets 0594, 0667);
 * one turned before 0667 had its beads rewritten, and opens upright. */
function readFrameShape({ shape, settings: stored, quarterTurns }: StoredLayer): Pick<FrameSheet, 'shape' | 'settings' | 'quarterTurns'> {
  // Rotate Frame's turn: one, two or three quarters; anything else reads as none.
  const turned = quarterTurns === 1 || quarterTurns === 2 || quarterTurns === 3 ? { quarterTurns } : {}
  if (!isFrameShape(shape)) {
    return turned
  }
  const settings = settingsOf({ shape, settings: stored })
  return { shape, ...(settings ? { settings } : {}), ...turned }
}
