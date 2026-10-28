import { beadCopy, beadLabel, findBead, readBeadCopy, type Bead } from './beads'
import {
  beadBounds,
  beadsFromColors,
  changedPositions,
  colorAt,
  forEachBead,
  frameContains,
  frameDimensions,
  hasBeads,
  shiftedBeads,
  withColors,
  type BeadChange,
  type BeadMap,
  type Frame,
  type FrameSheet,
} from './canvas'
import { normalizeHex } from './color'
import { sameFrame } from './frame'
import { frameLayer } from './layers'
import { isVersionThree, liftVersionThree, type VersionThreeProject } from './versionThree'
import { positionKey, rotationSwapsAxes, type GridDimensions, type GridPosition, type Layer, type Rotation } from './grid'
import { beadCell, clampNetSize, DEFAULT_BEAD_SHAPE, DEFAULT_TECHNIQUE, describeWeave, isTechnique, MAX_BRICK_BLOCK, neighborsOf, positionStep, withCell, type BeadCell, type BeadShape, type PassDirection, type Technique, type Weave } from './weave'
import { DEFAULT_FRAME_KIND, frameLayoutOf, isFrameKind, rowOrderOf, settingsOf, type KindedSheet } from './frameKind'
import { layoutNeighbors, layoutPosition } from './frameLayout'
import type { RowOrder, RowWay } from './rowOrder'
import { codesForBead, codesInPalette, defaultPalette, defaultPaletteIds, normalizePaletteCodes, normalizePaletteIds, paletteColors, paletteForBead, removedDefaultsAfter, type PaletteCodes, type PaletteIds } from './palette'
import { lettersFor, type SwatchLetters } from './swatchLetters'
import type { ColorCatalog } from './colorCatalog'
import { normalizeMakerName } from './makerName'
import { readPieceNames, type PieceName } from './pieceNames'
import { gridFromSize, type StatedSize } from './projectSize'


export type { Technique } from './weave'

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
  /** The Brick block (ticket 477): how many rows brick stitch weaves straight on top of each other before the next
   * rows shift half a bead. Absent means 1, every other row. Kept when the Technique is switched away from brick
   * stitch, and used by no other Technique. */
  brickBlock?: number
  /** The Net size (ticket 485): the beads in a Netting loop, odd from 3 to 9. Present on a Netting Project and no
   * other; fixed once it is created (ADR 0038). */
  netSize?: number
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

export interface CreateProjectInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
  technique: Technique
  /** The Brick block of a new brick stitch Project (ticket 477); left out or 1 shifts every other row. */
  brickBlock?: number
  /** The Net size of a new Netting Project (ticket 485); left out is the default. */
  netSize?: number
  /** The Bead shape of a new Project; left out is Symmetric. */
  beadShape?: BeadShape
  beadId: string
  /** How big the Frame is, in beads or mm/cm (converted once to a grid, not remembered; ADR 0026). Left out: a Canvas
   * with no Frame. */
  size?: StatedSize
  /** This Project's own maker's name (ticket 182); blank or omitted keeps the device-wide one instead. */
  makerName?: string
}

/** Row progress exactly as a freshly created Project starts out — also what Delete all (ticket 42) resets it back
 * to. */
const INITIAL_ROW_PROGRESS: RowProgress = { direction: 'rows', currentRow: 0, currentColumn: 0 }

/** Whether Row progress is on: exactly when there is a Frame to count rows on (ticket 434, ADR 0055), of any kind (a
 * Custom frame's Row order, ticket 0594). Derived, never stored, so setting a Frame needn't remember it; an old file's
 * saved flag is ignored. */
export const rowProgressOn = (project: Pick<Project, 'frame'>): boolean => project.frame !== undefined

/** The Weave of a layer given as its Technique, Brick block and Net size: those and nothing else (a Frame carries more). */
export function weaveOf({ technique, brickBlock, netSize }: Weave): Weave {
  return { technique, ...(brickBlock ? { brickBlock } : {}), ...(netSize ? { netSize } : {}) }
}

/** The Canvas's Weave: the Project's own Technique, Brick block and Net size (ticket 492). */
export function canvasWeave(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize'> & ShapedBead): Weave {
  return withCell(weaveOf(project), projectCell(project))
}

/** The Project with another Bead shape (ADR 0068): Symmetric is the default and is left unsaved. */
export function withBeadShape(project: Project, shape: BeadShape): Project {
  const { beadShape: _old, ...rest } = project
  return shape === DEFAULT_BEAD_SHAPE ? rest : { ...rest, beadShape: shape }
}

/** What decides a Project's cell: its Bead and Bead shape (both optional, so a bare layout reads as Symmetric). */
type ShapedBead = Partial<Pick<Project, 'bead' | 'beadShape'>>

/** How the Project's Bead is drawn, from its own copy: none in Symmetric, or for a Bead nobody knows. */
export function projectCell(project: ShapedBead): BeadCell | undefined {
  return beadCell(project.bead, project.beadShape ?? DEFAULT_BEAD_SHAPE)
}

/** The Frame's Weave (ticket 492), which may differ from the Canvas's; a Canvas with no Frame counts its rows in its
 * own. The one place that says which Weave a Frame's rows, rulers, passes and exports are counted in. */
export function frameWeave(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize' | 'frame'> & ShapedBead): Weave {
  return withCell(weaveOf(project.frame ?? project), projectCell(project))
}

/** What a new Project's stated size and Bead work out to: the Bead, and the grid that implies. */
export interface ProjectGeometry extends GridDimensions {
  bead: Bead
}

/** The grid a New Project form state implies, or undefined when the Bead isn't in the catalog. Shared with Convert
 * image (ticket 58) so its frame is exactly the grid the Project will be created at. */
export function projectGeometry(input: CreateProjectInput & { size: StatedSize }): ProjectGeometry | undefined {
  // findBead looks the id up in the fixed built-in catalog (ADR 0007 / ticket 38).
  const bead = findBead(input.beadId)
  if (!bead) {
    return undefined
  }

  return { bead, ...gridFromSize(input.size, bead, { technique: input.technique, brickBlock: input.brickBlock, netSize: input.netSize }) }
}

export function createProject(input: CreateProjectInput): Project {
  const bead = findBead(input.beadId)
  if (!bead) {
    throw new Error(`Unknown bead id: ${input.beadId}`)
  }

  const dimensions = input.size ? gridFromSize(input.size, bead, { technique: input.technique, brickBlock: input.brickBlock, netSize: input.netSize }) : undefined
  const now = Date.now()
  const name = input.name?.trim() || beadLabel(bead)
  const makerName = normalizeMakerName(input.makerName ?? '')

  const created = weaveOf({
    technique: input.technique,
    ...(input.brickBlock && input.brickBlock > 1 ? { brickBlock: clampBrickBlock(input.brickBlock) } : {}),
    ...(describeWeave({ technique: input.technique }).hasNetSize ? { netSize: clampNetSize(input.netSize) } : {}),
  })

  const palette = defaultPaletteIds(defaultPalette(bead.id))
  return {
    id: crypto.randomUUID(),
    name,
    ...created,
    beadId: bead.id,
    bead: beadCopy(bead),
    ...(input.beadShape && input.beadShape !== DEFAULT_BEAD_SHAPE ? { beadShape: input.beadShape } : {}),
    beads: {},
    ...(dimensions ? { frame: { row: 0, column: 0, columns: dimensions.columns, rows: dimensions.rows, beads: {}, ...weaveOf(created) } } : {}),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
    palette,
    paletteLetters: lettersOfPalette(palette, bead.id, undefined),
    rotation: 0,
    ...(makerName ? { makerName } : {}),
    createdAt: now,
    updatedAt: now,
  }
}

/** A new Project made from a picture (CONTEXT.md's Convert image): the same fields as any other, plus what the
 * conversion produced. */
export interface CreateProjectFromImageInput extends CreateProjectInput {
  /** A picture needs a Frame to land in: the Frame's size, which is also the grid it was sampled at. */
  size: StatedSize
  /** The converted cells, sampled at the Project's own Frame size (see domain/imageConversion.ts). */
  grid: Grid
}

/** Creates a Project from a picture (ticket 58): an ordinary new Project with its cells painted. Conversion only
 * creates, never edits an open Project (ADR 0010). The grid is fitted to the stated dimensions (missing cells empty,
 * surplus dropped), so they never disagree. */
export function createProjectFromImage(input: CreateProjectFromImageInput): Project {
  const project = createProject(input)
  const frame = project.frame!
  const weave = describeWeave(frameWeave(project))

  return {
    ...project,
    frame: {
      ...frame,
      beads: beadsFromColors(
        Array.from({ length: frame.rows }, (_row, rowIndex) =>
          Array.from({ length: frame.columns }, (_cell, columnIndex) =>
            weave.hasPosition({ row: rowIndex, column: columnIndex }, { ...frame, row: 0, column: 0 }) ? input.grid[rowIndex]?.[columnIndex]?.color ?? null : null,
          ),
        ),
      ),
    },
  }
}

/** Applies a change to a Project as a new object, stamping it as just-edited. */
function touch(project: Project, changes: Partial<Project>): Project {
  return { ...project, ...changes, updatedAt: Date.now() }
}

type PointerKey = 'currentRow' | 'currentColumn' | 'currentRowBack' | 'currentColumnBack'

/** Which of the four pointers the weaver's current way (axis and end) counts on. */
function pointerKey({ direction, reversed }: Pick<RowProgress, 'direction' | 'reversed'>): PointerKey {
  if (direction === 'rows') return reversed ? 'currentRowBack' : 'currentRow'
  return reversed ? 'currentColumnBack' : 'currentColumn'
}

/** The pass the weaver is on, in the current way; every pass before it is finished. */
export function currentPass(rowProgress: RowProgress): number {
  return rowProgress[pointerKey(rowProgress)] ?? 0
}

/** Row progress with every pointer back at the first pass, the way the weaver runs unchanged. */
export function firstPasses(rowProgress: RowProgress): RowProgress {
  const { currentRowBack: _row, currentColumnBack: _column, ...rest } = rowProgress
  return { ...rest, currentRow: 0, currentColumn: 0 }
}

/** Keeps a pointer inside 0..passes: one past the last pass means every pass is done (ticket 411), which fills the
 * track. */
function clampRow(row: number, passes: number): number {
  return Math.max(0, Math.min(passes, row))
}

/** How many passes the Frame's Row order takes, worked one way (spec 0590). */
function passesOf(sheet: KindedSheet, way: RowWay): number {
  return rowOrderOf(sheet, way).count
}

/** The bottom to top and right to left pointers inside the Frame; absent while neither has moved. */
function clampedBack(rowProgress: Partial<RowProgress>, sheet: KindedSheet): Partial<RowProgress> {
  const { currentRowBack, currentColumnBack } = rowProgress
  return {
    ...(currentRowBack ? { currentRowBack: clampRow(currentRowBack, passesOf(sheet, { direction: 'rows', reversed: true })) } : {}),
    ...(currentColumnBack ? { currentColumnBack: clampRow(currentColumnBack, passesOf(sheet, { direction: 'columns', reversed: true })) } : {}),
  }
}

/** Row progress with both pointers (the row and the column being woven) inside the Frame; the one clamp a Frame
 * change uses. */
function clampPointer(rowProgress: Project['rowProgress'], sheet: KindedSheet): Project['rowProgress'] {
  return {
    ...rowProgress,
    currentRow: clampRow(rowProgress.currentRow, passesOf(sheet, { direction: 'rows' })),
    currentColumn: clampRow(rowProgress.currentColumn, passesOf(sheet, { direction: 'columns' })),
    ...clampedBack(rowProgress, sheet),
  }
}

/** The Project's Frame, or for a Canvas without one the smallest box round its beads (nothing for an empty one). For
 * the parts of the app that still think in a Project's extent. */
export function projectFrame(project: Pick<Project, 'frame' | 'beads'>): Frame {
  return project.frame ?? beadBounds(project.beads) ?? { row: 0, column: 0, columns: 0, rows: 0 }
}

/** What the open Project's Frame measures in beads, for the grid-shaped helpers (adjacency, fit
 * zoom). */
export function projectDimensions(project: Pick<Project, 'frame' | 'beads'>): GridDimensions {
  return frameDimensions(projectFrame(project))
}

/** What the Frame measures in what the Technique counts (ticket 482): beads, or Units where it counts them. What the
 * person is told the size is, and what the rulers and the printed pages number. */
export function countedDimensions(project: Pick<Project, 'frame' | 'beads' | 'technique' | 'brickBlock' | 'netSize'>): GridDimensions {
  return describeWeave(frameWeave(project)).unitsOf(projectDimensions(project))
}

/** A dense grid of cells as a Frame the size of the grid holding them: what the Convert image preview, the Overview's
 * pictures and a test's hand-made block of beads are drawn from. */
export function framedGrid(grid: Grid, weave: Weave = { technique: DEFAULT_TECHNIQUE }): Pick<Project, 'beads' | 'frame'> {
  return {
    beads: {},
    frame: { row: 0, column: 0, columns: grid[0]?.length ?? 0, rows: grid.length, beads: beadsFromColors(grid.map((row) => row.map((cell) => cell.color))), ...weaveOf(weave) },
  }
}

/** The color of the bead you see at a Canvas position: the Frame's own where the Frame lies over it, else the Canvas's
 * (ADR 0066). A hex, or null where nothing is painted. */
export function beadColorAt(project: Pick<Project, 'beads' | 'frame'>, row: number, column: number, layer?: Layer): string | null {
  const frame = project.frame
  return frame && (layer ? layer === 'frame' : frameContains(frame, { row, column })) ? colorAt(frame.beads, row - frame.row, column - frame.column) : colorAt(project.beads, row, column)
}

/** A Project as saved before the Canvas (ADR 0026): a fixed `columns` x `rows` grid instead of beads by position and
 * a Frame. Read by normalizeProject only, which gives it a Frame the size of the grid. */
export type GridProject = Omit<Project, 'beads' | 'frame'> & { columns: number; rows: number; grid: Grid }

/** A Project in any shape a store or file has held it in, for normalizeProject to read. */
export type StoredProject = Project | GridProject | VersionThreeProject

function isGridProject(project: StoredProject): project is GridProject {
  return Array.isArray((project as GridProject).grid)
}

/** A Project as an older app may have saved it: with the color-to-bead override (ADR 0007/ticket 36), the stored
 * `widthMm`/`heightMm` (ADR 0026) and ticket 28's `rotated` boolean instead of ticket 171's `rotation`. */
type ProjectWithLegacyFields = Project & {
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
function normalizeRotation(project: ProjectWithLegacyFields): Rotation {
  if (typeof project.rotation === 'number' && (ROTATIONS as readonly number[]).includes(project.rotation)) {
    return project.rotation
  }
  return project.rotated ? 90 : 0
}

/** Fills in fields added after a Project was saved, re-clamps the row pointer and drops dead fields (the color-to-bead
 * override, ADR 0007; the millimetre size, ADR 0026), so a Project from storage or a file is safe whatever version
 * wrote it, and never re-saves them. */
export function normalizeProject(stored: StoredProject): Project {
  // A Project from before the Canvas becomes beads by position with a Frame the size of its old grid; a Project from
  // before the Frame was a sheet of its own has its Frame's beads lifted into it (versionThree.ts, temporary).
  const upright: Project | VersionThreeProject = isGridProject(stored)
    ? {
        ...stored,
        beads: beadsFromColors(stored.grid.map((row) => row.map((cell) => cell.color))),
        frame: { row: 0, column: 0, columns: stored.columns, rows: stored.rows },
      }
    : stored
  const project: Project = isVersionThree(upright) ? liftVersionThree(upright) : upright
  const rowProgress: Partial<RowProgress> & { currentRow: number } = project.rowProgress ?? { currentRow: 0 }
  const legacy = project as ProjectWithLegacyFields
  const {
    colorBeadOverrides: _legacyOverrides,
    widthMm: _legacyWidthMm,
    heightMm: _legacyHeightMm,
    rotated: _legacyRotated,
    columns: _legacyColumns,
    rows: _legacyRows,
    grid: _legacyGrid,
    ...rest
  } = legacy

  const technique = project.technique
  // Its own copy when it holds a readable one, otherwise the catalog's Bead of that id, through the alias map (ticket 534).
  const bead = readBeadCopy(legacy.bead) ?? catalogCopy(project.beadId)
  const removedDefaults = readRemovedDefaults(legacy.removedDefaults)
  const palette = normalizePaletteIds(legacy.palette, defaultPalette(project.beadId))
  const paletteCodes = codesInPalette(normalizePaletteCodes(legacy.paletteCodes), palette, defaultPalette(project.beadId))

  const paletteLetters = lettersOfPalette(palette, project.beadId, legacy.paletteLetters)

  const { removedDefaults: _removed, paletteCodes: _codes, paletteLetters: _letters, letters: storedLetters, bead: _storedBead, pieceNames: _stored, brickBlock: storedBlock, netSize: storedNet, beadShape: storedShape, ...withoutNames } = rest
  // An unreadable Brick block reads as the default; a valid one is kept even off brick stitch.
  const brickBlock = readBrickBlock(storedBlock)
  const pieceNames = readPieceNames(legacy.pieceNames)
  const netSize = describeWeave({ technique }).hasNetSize ? clampNetSize(typeof storedNet === 'number' ? storedNet : undefined) : undefined
  const canvas = weaveOf({ technique, brickBlock, netSize })
  // A Frame stored before it had a Weave of its own (ticket 492) takes the Project's.
  const placed = { beads: project.beads ?? {}, ...(project.frame ? { frame: { ...readFrameKind(project.frame), beads: project.frame.beads ?? {}, ...readFrameWeave(project.frame, canvas) } } : {}) }
  const { rows, columns } = projectFrame(placed)
  const sheet: KindedSheet = { ...frameWeave({ ...canvas, ...placed }), ...laidOf(placed.frame), rows, columns }
  const turns = rowOrderOf(sheet, { direction: 'rows' }).turns

  return {
    ...withoutNames,
    ...placed,
    ...(brickBlock ? { brickBlock } : {}),
    ...(netSize ? { netSize } : {}),
    // An unreadable or missing Bead shape reads as Symmetric, which is left unsaved.
    ...(storedShape === 'real' ? { beadShape: storedShape } : {}),
    ...(pieceNames.length > 0 ? { pieceNames } : {}),
    rowProgress: {
      // Turn row direction isn't offered where the Row order is worked one way only (Netting, ticket 487).
      direction: turns ? (rowProgress.direction ?? 'rows') : 'rows',
      // An old file's `enabled` and `decided` are read and dropped: Row progress follows the Frame (ticket 426, 434).
      currentRow: clampRow(rowProgress.currentRow, passesOf(sheet, { direction: 'rows' })),
      currentColumn: clampRow(rowProgress.currentColumn ?? 0, passesOf(sheet, { direction: 'columns' })),
      ...(turns && rowProgress.reversed === true ? { reversed: true } : {}),
      ...clampedBack(rowProgress, sheet),
    },
    // A Project saved before the Palette belonged to it (or with an unreadable one) starts from its Bead's built-in colors.
    palette,
    ...(removedDefaults.length > 0 ? { removedDefaults } : {}),
    ...(Object.keys(paletteCodes).length > 0 ? { paletteCodes } : {}),
    paletteLetters,
    ...(storedLetters === true ? { letters: true } : {}),
    rotation: normalizeRotation(legacy),
    ...(bead ? { beadId: bead.id, bead } : {}),
  }
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

/** A distance counted in the Frame's own rows and columns, as Canvas positions (ticket 492): the nearest whole ones,
 * exactly the same where Frame and Canvas are woven alike. */
export function canvasDistance(project: Pick<Project, 'technique' | 'brickBlock' | 'netSize'>, frame: Weave, rows: number, columns: number): GridPosition {
  const canvas = canvasWeave(project)
  if (sameWeave(canvas, frame)) {
    return { row: rows, column: columns }
  }
  const own = positionStep(frame)
  const target = positionStep(canvas)
  return { row: Math.round((rows * own.down) / target.down), column: Math.round((columns * own.across) / target.across) }
}

/** Where a resized Frame's first row and column go, as Canvas positions. The rectangle is in the Frame's own rows and
 * columns, so an edge moved by some of them moves the Frame's corner by as far on the Canvas. */
function resizedOrigin(project: Project, current: FrameSheet, rectangle: Frame): GridPosition {
  const moved = canvasDistance(project, current, rectangle.row - current.row, rectangle.column - current.column)
  return { row: current.row + moved.row, column: current.column + moved.column }
}

/** Whether two Weaves lay positions out alike. */
export function sameWeave(a: Weave, b: Weave): boolean {
  return a.technique === b.technique && (a.brickBlock ?? 1) === (b.brickBlock ?? 1) && (a.netSize ?? 0) === (b.netSize ?? 0)
}

/** A stored Frame's Weave, or the Project's where it has none or an unreadable one. */
function readFrameWeave(stored: Partial<Weave>, fallback: Weave): Weave {
  const technique = isTechnique(stored.technique) ? stored.technique : undefined
  if (!technique) {
    return fallback
  }
  const brickBlock = readBrickBlock(stored.brickBlock)
  const netSize = describeWeave({ technique }).hasNetSize ? clampNetSize(typeof stored.netSize === 'number' ? stored.netSize : undefined) : undefined
  return weaveOf({ technique, brickBlock, netSize })
}

/** A stored Frame with its kind kept only where it is one this build knows and not Rectangular, the default left
 * unsaved (ticket 0591): one without, or with one it does not know, reads as Rectangular. A Custom frame keeps its
 * settings, read within its kind's range (ticket 0592); a Rectangular one has none. */
function readFrameKind({ kind, settings: stored, quarterTurns, ...frame }: FrameSheet): FrameSheet {
  if (!isFrameKind(kind) || kind === DEFAULT_FRAME_KIND) {
    return frame
  }
  const settings = settingsOf({ kind, settings: stored })
  // Rotate Frame's turn (ticket 0594): one, two or three quarters; anything else reads as none.
  const turned = quarterTurns === 1 || quarterTurns === 2 || quarterTurns === 3 ? { quarterTurns } : {}
  return { ...frame, kind, ...(settings ? { settings } : {}), ...turned }
}

/** What a Frame's Row order is built from beside its rectangle and Weave: its kind, a Custom frame's settings and turn. */
function laidOf(frame: FrameSheet | undefined): Pick<KindedSheet, 'kind' | 'settings' | 'quarterTurns'> {
  return { kind: frame?.kind, settings: frame?.settings, quarterTurns: frame?.quarterTurns }
}

/** The Project with its Frame set to a rectangle of the Canvas, or removed (ADR 0026, 0066): its beads keep their
 * place on the Canvas, those outside a smaller Frame are dropped, the Canvas is never touched, and a Frame set anew is
 * empty. Row progress's pointers stay inside it; an unchanged Frame is the same Project (no change). */
export function withFrame(project: Project, rectangle: Frame | undefined): Project {
  if (sameFrame(project.frame, rectangle)) {
    return project
  }
  const { frame: current, ...rest } = project
  // With the Frame gone the passes are gone too (ticket 426).
  if (!rectangle) {
    return { ...rest, rowProgress: firstPasses(project.rowProgress), updatedAt: Date.now() }
  }
  const { rows, columns } = rectangle
  const { row, column } = current ? resizedOrigin(project, current, rectangle) : rectangle
  const frame: FrameSheet = {
    row,
    column,
    rows,
    columns,
    beads: current ? shiftedBeads(current.beads, current.row - rectangle.row, current.column - rectangle.column, { rows, columns }) : {},
    // A Frame made anew is woven as the Canvas is (ticket 492); one resized keeps its own.
    ...weaveOf(current ?? project),
    ...(current?.name ? { name: current.name } : {}),
    ...(current?.kind ? { kind: current.kind } : {}),
    ...(current?.settings ? { settings: current.settings } : {}),
    ...(current?.quarterTurns ? { quarterTurns: current.quarterTurns } : {}),
  }
  return { ...rest, frame, rowProgress: clampPointer(project.rowProgress, frame), updatedAt: Date.now() }
}

/** The layer's Weave switched to another Technique (ADR 0038): the Brick block stays, the Net size is the one given, the
 * layer's own if it has one, or the default, and only a Technique with a Net size keeps one. A Brick block given (ticket 568)
 * replaces the layer's. */
export function switchedWeave(current: Weave, technique: Technique, netSize?: number, brickBlock?: number): Weave {
  return weaveOf({
    technique,
    brickBlock: brickBlock === undefined ? current.brickBlock : clampBrickBlock(brickBlock),
    netSize: describeWeave({ technique }).hasNetSize ? clampNetSize(netSize ?? current.netSize) : undefined,
  })
}

/** The beads of a layer that keep a place in `weave` (a Frame's counted from its own corner, `shape`), and how many are
 * left without one: a hole of Netting, the empty last column of a Right-angle weave line. */
function beadsInWeave(beads: BeadMap, weave: Weave, shape?: Pick<Frame, 'rows' | 'columns'>): { kept: BeadMap; lost: number } {
  const { hasPosition } = describeWeave(weave)
  const kept: BeadMap = {}
  let lost = 0
  forEachBead(beads, (row, column, color) => {
    if (hasPosition({ row, column }, shape && { row: 0, column: 0, ...shape })) {
      kept[row] ??= {}
      kept[row]![column] = color
    } else {
      lost++
    }
  })
  return { kept, lost }
}

/** How many beads of the Canvas, or of the Frame, a switch to `weave` would drop. */
export function switchLoss(project: Project, layer: 'canvas' | 'frame', technique: Technique, netSize?: number): number {
  if (layer === 'frame') {
    return project.frame ? beadsInWeave(project.frame.beads, switchedWeave(frameWeave(project), technique, netSize), project.frame).lost : 0
  }
  return beadsInWeave(project.beads, switchedWeave(canvasWeave(project), technique, netSize)).lost
}

/** The Canvas woven in another Technique (ticket 351, 492, ADR 0038): its beads keep their row and column where the
 * Technique has a position there and the rest are dropped. The Frame is another layer and stays as it is. */
export function withTechnique(project: Project, technique: Technique, netSize?: number, brickBlock?: number): Project {
  const weave = switchedWeave(canvasWeave(project), technique, netSize, brickBlock)
  const { netSize: _netSize, brickBlock: _brickBlock, ...rest } = project
  return touch({ ...rest, ...(weave.netSize ? { netSize: weave.netSize } : {}), ...(weave.brickBlock ? { brickBlock: weave.brickBlock } : {}) }, { technique: weave.technique, beads: beadsInWeave(project.beads, weave).kept })
}

/** The Project with the Canvas's Brick block changed (ticket 477): the same cells, only the shift's rhythm changes. */
export function withBrickBlock(project: Project, brickBlock: number): Project {
  return touch(project, { brickBlock: clampBrickBlock(brickBlock) })
}

/** The Frame woven in another Technique (ticket 492, ADR 0038): its beads keep their row and column where the Technique
 * has a position there and the rest are dropped. Its local row 0 is always an unshifted one, so nothing else moves. A
 * Project with no Frame is unchanged. */
export function withFrameTechnique(project: Project, technique: Technique, netSize?: number, brickBlock?: number): Project {
  if (!project.frame) {
    return project
  }
  const weave = switchedWeave(frameWeave(project), technique, netSize, brickBlock)
  const { netSize: _netSize, brickBlock: _brickBlock, ...frame } = project.frame
  return touch(project, { frame: { ...frame, ...(weave.netSize ? { netSize: weave.netSize } : {}), ...(weave.brickBlock ? { brickBlock: weave.brickBlock } : {}), technique: weave.technique, beads: beadsInWeave(project.frame.beads, weave, project.frame).kept } })
}

/** The Frame with its Brick block changed (ticket 492). */
export function withFrameBrickBlock(project: Project, brickBlock: number): Project {
  return project.frame ? touch(project, { frame: { ...project.frame, brickBlock: clampBrickBlock(brickBlock) } }) : project
}

/** A stored Brick block if it is a whole number from 1 to MAX_BRICK_BLOCK, otherwise nothing (read as 1). */
function readBrickBlock(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_BRICK_BLOCK ? value : undefined
}

/** A Brick block as a whole number from 1 to MAX_BRICK_BLOCK. */
export function clampBrickBlock(value: number): number {
  return Math.min(MAX_BRICK_BLOCK, Math.max(1, Math.round(value) || 1))
}

/** Whether Row progress is on and a pass is done: the Frame is then held still, since the passes belong to it
 * (ticket 411). */
export function rowProgressStarted(project: Pick<Project, 'rowProgress' | 'frame'>): boolean {
  const { currentRow, currentColumn, currentRowBack, currentColumnBack } = project.rowProgress
  return rowProgressOn(project) && (currentRow > 0 || currentColumn > 0 || !!currentRowBack || !!currentColumnBack)
}

/** The next quarter turn clockwise: 0, 90, 180, 270 and round again. */
const NEXT_ROTATION: Readonly<Record<Rotation, Rotation>> = { 0: 90, 90: 180, 180: 270, 270: 0 }

/** Rotate canvas (ticket 471): the picture a quarter turn clockwise further; only the view turns, no data changes. */
export function rotateCanvas(project: Project): Project {
  return touch(project, { rotation: NEXT_ROTATION[project.rotation] })
}

/** Takes Row progress back to the first row in both directions, keeping the direction (ticket 455); the grid is
 * untouched. */
export function resetRowProgress(project: Project): Project {
  return touch(project, { rowProgress: firstPasses(project.rowProgress) })
}

/** Flips which way the weaver's rows run across the grid (see RowDirection), leaving the grid and the rotated view
 * alone. */
export function toggleRowDirection(project: Project): Project {
  if (!frameRowOrder(project).turns) {
    return project
  }
  const { direction, reversed } = project.rowProgress
  // The four ways in turn: top to bottom, left to right, bottom to top, right to left (ticket 0589).
  const next = direction === 'rows'
    ? { direction: 'columns' as const, reversed }
    : { direction: 'rows' as const, reversed: reversed ? undefined : true }
  return touch(project, { rowProgress: { ...project.rowProgress, ...next } })
}

/** Where the weaving has got to, counted in whichever direction its rows run: the row being woven now, and how many
 * rows the Frame has. */
export function rowProgressPosition(project: RowProgressed): { current: number; total: number } {
  return { current: currentPass(project.rowProgress), total: frameRowOrder(project).count }
}

/** What a Project's Row progress is read from: its pointers, its Frame and the Weave a Canvas with none counts in. */
type RowProgressed = Pick<Project, 'rowProgress' | 'frame' | 'technique' | 'brickBlock' | 'netSize'>

/** The Frame's Row order (spec 0590), worked the way the weaver's rows run now: the one thing Row progress asks how
 * passes go. A Canvas with no Frame has no passes, counted in its own Weave. */
export function frameRowOrder(project: RowProgressed): RowOrder {
  const { rows = 0, columns = 0 } = project.frame ?? {}
  return rowOrderOf({ ...frameWeave(project), ...laidOf(project.frame), rows, columns }, project.rowProgress)
}

/** The pass that weaves a bead of the Frame, or undefined for a position outside it or on the Canvas. */
function framePassAt(project: RowProgressed, position: GridPosition): number | undefined {
  const frame = project.frame
  // Row progress covers the Frame only: beads outside it stay editable whatever row the weaver is on.
  if (!frame || position.layer === 'canvas') {
    return undefined
  }
  const own = { row: position.row - frame.row, column: position.column - frame.column }
  // A Custom frame's positions are its layout's, named by round and place, not its rectangle's (ticket 0594).
  const layout = frameLayoutOf(frame)
  if (layout ? !layoutPosition(layout, own) : !frameContains(frame, position)) {
    return undefined
  }
  return frameRowOrder(project).passAt(own)
}

/** Whether a bead sits in a row the weaver has already finished: its pass (a whole line, or half of one on peyote)
 * is before the pointer, lines counted the way rows run from the Frame's first. Only while the overlay is on and a
 * Frame is set. */
export function isInFinishedRow(project: RowProgressed, position: GridPosition): boolean {
  const pass = framePassAt(project, position)
  return pass !== undefined && pass < currentPass(project.rowProgress)
}

/** Whether a bead sits in the pass the weaver is on now (ticket 352): the same pass the pointer points at, so the
 * current row is drawn brighter. Only while the overlay is on and a Frame is set. */
export function isInCurrentRow(project: RowProgressed, position: GridPosition): boolean {
  const pass = framePassAt(project, position)
  return pass !== undefined && pass === currentPass(project.rowProgress)
}

/** Whether the Project has a bead on either layer. */
export function hasProjectBeads(project: Pick<Project, 'beads' | 'frame'>): boolean {
  return hasBeads(project.beads) || (project.frame !== undefined && hasBeads(project.frame.beads))
}

/** Every color on either layer, each once, in the order the layers hold them. */
export function projectColors(project: Pick<Project, 'beads' | 'frame'>): string[] {
  const colors = new Set<string>()
  for (const beads of [project.beads, project.frame?.beads ?? {}]) {
    forEachBead(beads, (_row, _column, color) => colors.add(color))
  }
  return [...colors]
}

/** Whether two states of a Project hold the same beads on both layers (ADR 0066). A layer neither touched costs
 * nothing: its maps are the same object. */
export function sameBeads(a: Pick<Project, 'beads' | 'frame'>, b: Pick<Project, 'beads' | 'frame'>): boolean {
  const same = (x: BeadMap | undefined, y: BeadMap | undefined) => x === y || changedPositions(x ?? {}, y ?? {}).length === 0
  return same(a.beads, b.beads) && same(a.frame?.beads, b.frame?.beads)
}

/** Takes back what a drawing command did to finished rows (ticket 33): those beads are already woven, and they are the
 * Frame's, since the Canvas has no rows to finish (ADR 0066). Nothing left to change returns `before` itself, the
 * drawing commands' "unchanged" signal, so no undo step is recorded. */
export function keepFinishedRows(before: Project, after: Project): Project {
  const frame = before.frame
  if (!frame || !after.frame || after.frame.beads === frame.beads) {
    return sameBeads(before, after) ? before : after
  }
  const own = frameLayer(before)
  const reverts: BeadChange[] = changedPositions(frame.beads, after.frame.beads)
    .filter((position) => isInFinishedRow(own, position))
    .map(({ row, column }) => ({ row, column, color: colorAt(frame.beads, row, column) }))
  const kept = reverts.length === 0 ? after : { ...after, frame: { ...after.frame, beads: withColors(after.frame.beads, reverts) } }
  return sameBeads(before, kept) ? before : kept
}

/** Points row progress at the given row in its current direction, clamped to the Project — used to advance a
 * finished row and to go back to an earlier one. */
export function moveToRow(project: Project, row: number): Project {
  const { total } = rowProgressPosition(project)
  return touch(project, {
    rowProgress: { ...project.rowProgress, [pointerKey(project.rowProgress)]: clampRow(row, total) },
  })
}

/** Swaps in a whole new set of beads, returning a new Project rather than mutating the one passed in. */
export function restoreBeads(project: Project, beads: BeadMap): Project {
  return touch(project, { beads })
}

/** One entry on the editing-session undo stack (ADR 0036): a full snapshot of what an Edit can change (beads, Row
 * progress, Bead, Frame, Technique). All immutable, sharing structure. */
export interface UndoEntry {
  beads: BeadMap
  rowProgress: RowProgress
  /** The Palette as it was, so Undo and Redo of adding, removing or moving a swatch restore it (ticket 0525). */
  palette: PaletteIds
  /** The removed default colors as they were (ticket 0528), restored with the Palette they belong to. */
  removedDefaults?: string[]
  /** The swatch codes as they were (ticket 0538), restored with the Palette they belong to. */
  paletteCodes?: PaletteCodes
  /** The Swatch letters as they were (ticket 0573), restored with the Palette they belong to. */
  paletteLetters?: SwatchLetters
  beadId: string
  /** The Bead copy as it was, restored with its id (ticket 534). */
  bead?: Bead
  /** The Frame with its own beads, as they were (ADR 0066). */
  frame: FrameSheet | undefined
  /** The Piece names as they were, so Undo and Redo of a naming or of a merge or split restore them (ticket 406). */
  pieceNames?: PieceName[]
  /** The Technique the entry was taken in, so Undo undoes a change of Technique (ticket 351). */
  technique: Technique
  /** The Brick block the entry was taken with, so Undo undoes a change of it (ticket 477). */
  brickBlock?: number
  /** The Bead shape the entry was taken with, so Undo undoes a change of it (ticket 508). */
  beadShape?: BeadShape
}

/** The Project's state as an undo entry. */
export function snapshotOf(project: Project): UndoEntry {
  return { beads: project.beads, rowProgress: project.rowProgress, palette: project.palette, removedDefaults: project.removedDefaults, paletteCodes: project.paletteCodes, paletteLetters: project.paletteLetters, beadId: project.beadId, bead: project.bead, frame: project.frame, pieceNames: project.pieceNames, technique: project.technique, brickBlock: project.brickBlock, beadShape: project.beadShape }
}

/** The Project with everything an undo entry holds put back (see UndoEntry). */
export function restoreSnapshot(project: Project, entry: UndoEntry): Project {
  const { pieceNames: _current, brickBlock: _block, beadShape: _shape, removedDefaults: _removed, paletteCodes: _codes, paletteLetters: _letters, bead: _bead, ...rest } = project
  return touch(rest, {
    beads: entry.beads,
    rowProgress: entry.rowProgress,
    palette: entry.palette,
    beadId: entry.beadId,
    ...(entry.bead ? { bead: entry.bead } : {}),
    frame: entry.frame,
    technique: entry.technique,
    ...(entry.brickBlock ? { brickBlock: entry.brickBlock } : {}),
    ...(entry.beadShape ? { beadShape: entry.beadShape } : {}),
    ...(entry.pieceNames ? { pieceNames: entry.pieceNames } : {}),
    ...(entry.removedDefaults ? { removedDefaults: entry.removedDefaults } : {}),
    ...(entry.paletteCodes ? { paletteCodes: entry.paletteCodes } : {}),
    paletteLetters: lettersOfPalette(entry.palette, entry.beadId, entry.paletteLetters),
  })
}

/** Whether Row progress is already exactly the just-created state (see INITIAL_ROW_PROGRESS), so deleteAll has
 * nothing left to reset. */
function isInitialRowProgress(rowProgress: RowProgress): boolean {
  return (
    rowProgress.direction === INITIAL_ROW_PROGRESS.direction &&
    !rowProgress.reversed &&
    !rowProgress.currentRowBack &&
    !rowProgress.currentColumnBack &&
    rowProgress.currentRow === INITIAL_ROW_PROGRESS.currentRow &&
    rowProgress.currentColumn === INITIAL_ROW_PROGRESS.currentColumn
  )
}

/** Resets the open Project to as first created (CONTEXT.md's Delete all): cells emptied, both Row progress pointers at
 * the first row; name, size, Technique, Bead and rotation stay. Ignores the Row progress lock (see isInFinishedRow):
 * clearing progress is the point, so callers skip keepFinishedRows. Returns the same instance if already so. */
export function deleteAll(project: Project): Project {
  if (!hasProjectBeads(project) && isInitialRowProgress(project.rowProgress)) {
    return project
  }

  // No bead is left, so no Piece is: a name would only wait for a bead painted at its anchor (ticket 406).
  const { pieceNames: _names, ...rest } = project
  return touch(rest, {
    beads: {},
    ...(project.frame ? { frame: { ...project.frame, beads: {} } } : {}),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
  })
}

/** The Swatch letters of a Palette (ticket 0573): each color keeps the letter it had and a new one takes the lowest unused. */
function lettersOfPalette(palette: PaletteIds, beadId: string, kept: unknown): SwatchLetters {
  return lettersFor(paletteColors(palette, defaultPalette(beadId)).map((color) => color.hex), kept)
}

/** The Project with Letters on or off (ticket 0573); off is the default and is left unsaved. */
export function withLetters(project: Project, on: boolean): Project {
  const { letters: _old, ...rest } = project
  return on ? { ...rest, letters: true } : rest
}

/** The Swatch letters to print on beads: the Project's own while Letters is on, none otherwise (ticket 0573). */
export function shownLetters(project: Pick<Project, 'letters' | 'paletteLetters'>): SwatchLetters | undefined {
  return project.letters ? project.paletteLetters : undefined
}

/** Swaps the Project's Bead (ticket 48, ADR 0007); only the Estimated size depends on it. The Palette follows in the
 * same change (ticket 0528) and painted cells keep their hex. A swatch keeps its catalog code only if `catalog`, the
 * new Bead's, lists it in the new size (ticket 0538). */
export function replaceBead(project: Project, bead: Bead, catalog?: ColorCatalog): Project {
  const palette = paletteForBead(project.palette, project.removedDefaults ?? [], defaultPalette(project.beadId), defaultPalette(bead.id))
  const codes = codesForBead(project.paletteCodes ?? {}, catalog, bead.size)
  const { paletteCodes: _codes, ...rest } = project
  const paletteLetters = lettersOfPalette(palette, bead.id, project.paletteLetters)
  return touch(rest, { beadId: bead.id, bead: beadCopy(bead), palette, paletteLetters, ...(Object.keys(codes).length > 0 ? { paletteCodes: codes } : {}) })
}

/** The Project with a new Palette (adding, removing or moving a swatch); the default colors that left it are
 * remembered as removed (ticket 0528). `codes` join it by hex and a swatch's code leaves with it (ticket 0538). */
export function setPalette(project: Project, palette: PaletteIds, codes: PaletteCodes = {}): Project {
  const removed = removedDefaultsAfter(project.palette, palette, project.removedDefaults ?? [])
  const kept = codesInPalette({ ...project.paletteCodes, ...codes }, palette, defaultPalette(project.beadId))
  const { removedDefaults: _removed, paletteCodes: _codes, ...rest } = project
  const paletteLetters = lettersOfPalette(palette, project.beadId, project.paletteLetters)
  return touch(rest, { palette, paletteLetters, ...(removed.length > 0 ? { removedDefaults: removed } : {}), ...(Object.keys(kept).length > 0 ? { paletteCodes: kept } : {}) })
}

/** Where a Fill stops (ADR 0026): the Frame when it starts inside one, else the box round the Frame and every bead,
 * one position wider each side, so filling open space stays a finite patch. */
function fillLimit(project: Pick<Project, 'beads' | 'frame'>, start: GridPosition): Frame {
  if (project.frame && frameContains(project.frame, start)) {
    return project.frame
  }
  const boxes = [project.frame, beadBounds(project.beads), { row: start.row, column: start.column, rows: 1, columns: 1 }].filter(
    (box): box is Frame => box !== undefined,
  )
  const top = Math.min(...boxes.map((box) => box.row)) - 1
  const left = Math.min(...boxes.map((box) => box.column)) - 1
  const bottom = Math.max(...boxes.map((box) => box.row + box.rows)) + 1
  const right = Math.max(...boxes.map((box) => box.column + box.columns)) + 1
  return { row: top, column: left, rows: bottom - top, columns: right - left }
}

/** Every cell reachable from `start` through same-colored neighbors (see neighborsOf): the flood region of a click.
 * Used by Fill (fillArea). */
function floodRegion(project: Pick<Project, 'beads' | 'frame' | 'technique'>, start: GridPosition): GridPosition[] {
  const targetColor = colorAt(project.beads, start.row, start.column)
  // A Custom frame's beads touch across its panels, not along rows and columns (ticket 0592).
  const layout = project.frame && frameLayoutOf(project.frame)
  if (layout) {
    const inside = (position: GridPosition) => layoutPosition(layout, position) !== undefined && colorAt(project.beads, position.row, position.column) === targetColor
    return reachable(start, inside, (position) => layoutNeighbors(layout, position))
  }
  const limit = fillLimit(project, start)
  const weave = describeWeave(project)
  const visited = new Set<string>()
  const region: GridPosition[] = []

  const stack = [start]
  while (stack.length > 0) {
    const position = stack.pop()!
    const key = positionKey(position)
    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    if (!weave.hasPosition(position, project.frame) || colorAt(project.beads, position.row, position.column) !== targetColor) {
      continue
    }
    region.push(position)
    stack.push(...neighborsOf(project, limit, position))
  }

  return region
}

/** Every position joined to `start` through positions that are `inside`, one `next` step at a time. */
function reachable(start: GridPosition, inside: (position: GridPosition) => boolean, next: (position: GridPosition) => GridPosition[]): GridPosition[] {
  const visited = new Set<string>()
  const region: GridPosition[] = []
  const stack = [start]
  while (stack.length > 0) {
    const position = stack.pop()!
    const key = positionKey(position)
    if (visited.has(key)) {
      continue
    }
    visited.add(key)
    if (!inside(position)) {
      continue
    }
    region.push(position)
    stack.push(...next(position))
  }
  return region
}

/** Bucket-fills every cell reachable from (row, column) through same-colored neighbors (see floodRegion), with the
 * given color. Returns the same Project instance, unchanged, if the clicked cell is already that color. */
export function fillArea(project: Project, row: number, column: number, color: string | null): Project {
  if (colorAt(project.beads, row, column) === color) {
    return project
  }

  const region = floodRegion(project, { row, column })
  if (region.length === 0) {
    return project
  }
  return restoreBeads(project, withColors(project.beads, region.map((position) => ({ ...position, color }))))
}

/** Paints every position in `positions` as a single edit, so a whole stroke (ticket 24) is one undo step. A position in
 * the Frame where the Weave has no bead (a net's hole, ticket 486) is left alone. Returns the same Project if nothing
 * changes. Only the touched rows are copied (see withColors). */
export function paintCells(project: Project, positions: GridPosition[], color: string | null): Project {
  const { frame } = project
  const { hasPosition } = describeWeave(project)
  // A Custom frame's view holds only its layout's positions, named by round and place (ticket 0592).
  const layout = frame && frameLayoutOf(frame)
  const targets = layout
    ? positions.filter((position) => layoutPosition(layout, position) !== undefined)
    : positions.filter((position) => !frame || !frameContains(frame, position) || hasPosition(position, frame))
  const beads = withColors(project.beads, targets.map((position) => ({ ...position, color })))
  return beads === project.beads ? project : restoreBeads(project, beads)
}

/** A short, language-neutral identifier for a Project in UI lists (names are proper nouns, not translated): its name
 * and, once it has a Frame, the Frame's size; reflects the rotated view's swapped dimensions, since that's how the
 * Project currently looks. */
export function summarizeProject(project: Project): string {
  // The size is the Frame's: a canvas with none has no size to state (ADR 0026).
  if (!project.frame) {
    return project.name
  }
  const { columns, rows } = countedDimensions(project)
  const [width, height] = rotationSwapsAxes(project.rotation) ? [rows, columns] : [columns, rows]
  return `${project.name} · ${width}×${height}`
}

/** The Bead a Project was woven from (ticket 37): its own copy (ticket 534), so a catalog change or a retired Bead
 * leaves it alone. Undefined for an id nobody knows; callers show a placeholder, not a raw id. */
export function resolveProjectBead(project: Pick<Project, 'bead'>): Bead | undefined {
  return project.bead
}

/** When a Project was last saved, for ordering the library: its updatedAt when it predates savedAt (ticket 145). */
function lastSaved(project: Project): number {
  return project.savedAt ?? project.updatedAt
}

/** Stamps a Project as saved just now: the library's front (ticket 145). */
export function markSaved(project: Project, at = Date.now()): Project {
  return { ...project, savedAt: at }
}

/** The Project library's order (ticket 145): newest saved first; ties, most recently edited first; otherwise as they
 * were, so a library read twice comes out the same. */
export function inSavedOrder(projects: Project[]): Project[] {
  return projects
    .map((project, index) => ({ project, index }))
    .sort((a, b) => lastSaved(b.project) - lastSaved(a.project) || b.project.updatedAt - a.project.updatedAt || a.index - b.index)
    .map(({ project }) => project)
}

export function mostRecentlyUpdated(projects: Project[]): Project | undefined {
  return projects.reduce<Project | undefined>(
    (latest, project) => (!latest || project.updatedAt > latest.updatedAt ? project : latest),
    undefined,
  )
}
