import { beadLabel, findBead, type Bead } from './beads'
import {
  beadBounds,
  beadsFromColors,
  changedPositions,
  colorAt,
  colorsInFrame,
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
import { sameFrame, snapRow } from './frame'
import { frameLayer } from './layers'
import { isVersionThree, liftVersionThree, type VersionThreeProject } from './versionThree'
import { positionKey, rotationSwapsAxes, type GridDimensions, type GridPosition, type Rotation } from './grid'
import { clampNetSize, describeWeave, MAX_BRICK_BLOCK, neighborsOf, passCount, passOf, type PassDirection, type Technique, type Weave } from './weave'
import { normalizeMakerName } from './makerName'
import { readPieceNames, type PieceName } from './pieceNames'
import { mirrorCounterpartInStrip, mirrorCounterparts, stripOf, type MirrorAxisCounts } from './mirror'
import { gridFromSize, type StatedSize } from './projectSize'

export type { MirrorAxisCounts } from './mirror'

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
  /** What is painted on the Canvas, by position (ADR 0026); see BeadMap. No real-world size is stored: the
   * Estimated size is worked out from the Frame (estimatedSizeMm). */
  beads: BeadMap
  /** The Frame (CONTEXT.md, ADR 0066): a sheet of its own beads laid over the Canvas, opaque to what lies under it. Its
   * beads are the Project: Row progress, Export and Beads needed read them alone. Absent on a Canvas with none; an old
   * Project gets one holding the beads inside its old Frame (see normalizeProject). */
  frame?: FrameSheet
  rowProgress: RowProgress
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

/** Whether Row progress is on: exactly when there is a Frame to count rows on (ticket 434, ADR 0055). Derived, never
 * stored, so setting a Frame needn't remember it; an old file's saved flag is ignored. */
export const rowProgressOn = (project: Pick<Project, 'frame'>): boolean => project.frame !== undefined

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

  return {
    id: crypto.randomUUID(),
    name,
    technique: input.technique,
    ...(input.brickBlock && input.brickBlock > 1 ? { brickBlock: clampBrickBlock(input.brickBlock) } : {}),
    ...(input.technique === 'netting' ? { netSize: clampNetSize(input.netSize) } : {}),
    beadId: input.beadId,
    beads: {},
    ...(dimensions ? { frame: { row: 0, column: 0, columns: dimensions.columns, rows: dimensions.rows, beads: {} } } : {}),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
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
  const weave = describeWeave(project)

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

/** Keeps a pointer inside 0..passes: one past the last pass means every pass is done (ticket 411), which fills the
 * track. */
function clampRow(row: number, passes: number): number {
  return Math.max(0, Math.min(passes, row))
}

/** Row progress with both pointers (the row and the column being woven) inside the Frame; the one clamp a Frame
 * change uses. */
function clampPointer(rowProgress: Project['rowProgress'], frame: Frame, weave: Weave): Project['rowProgress'] {
  return {
    ...rowProgress,
    currentRow: clampRow(rowProgress.currentRow, passCount(weave, frame.rows, 'rows')),
    currentColumn: clampRow(rowProgress.currentColumn, passCount(weave, frame.columns, 'columns')),
  }
}

/** The Project's Frame, or for a Canvas without one the smallest box round its beads (nothing for an empty one). For
 * the parts of the app that still think in a Project's extent. */
export function projectFrame(project: Pick<Project, 'frame' | 'beads'>): Frame {
  return project.frame ?? beadBounds(project.beads) ?? { row: 0, column: 0, columns: 0, rows: 0 }
}

/** What the open Project's Frame measures in beads, for the grid-shaped helpers (mirror strips, adjacency, fit
 * zoom). */
export function projectDimensions(project: Pick<Project, 'frame' | 'beads'>): GridDimensions {
  return frameDimensions(projectFrame(project))
}

/** What the Frame measures in what the Technique counts (ticket 482): beads, or Units where it counts them. What the
 * person is told the size is, and what the rulers and the printed pages number. */
export function countedDimensions(project: Pick<Project, 'frame' | 'beads' | 'technique' | 'netSize'>): GridDimensions {
  return describeWeave(project).unitsOf(projectDimensions(project))
}

/** The Frame's beads as a dense grid of cells: for the parts of the app that still think in rows and columns (the
 * Tour's check, a test's expectation). With no Frame, the box round the Canvas's beads; empty with none. */
export function frameGrid(project: Pick<Project, 'frame' | 'beads'>): Grid {
  const beads = project.frame ? project.frame.beads : project.beads
  const area = project.frame ? { row: 0, column: 0, rows: project.frame.rows, columns: project.frame.columns } : projectFrame(project)
  return colorsInFrame(beads, area).map((row) => row.map((color) => ({ color })))
}

/** A dense grid of cells as a Frame the size of the grid holding them: what the Convert image preview, the Overview's
 * pictures and a test's hand-made block of beads are drawn from. */
export function framedGrid(grid: Grid): Pick<Project, 'beads' | 'frame'> {
  return {
    beads: {},
    frame: { row: 0, column: 0, columns: grid[0]?.length ?? 0, rows: grid.length, beads: beadsFromColors(grid.map((row) => row.map((cell) => cell.color))) },
  }
}

/** The Project with its Frame's beads replaced by a dense grid of cells; a Project with no Frame takes them on the
 * Canvas from its origin, as the beads of a Canvas whose box round them is nothing. */
export function withFrameGrid(project: Project, grid: Grid): Project {
  const beads = beadsFromColors(grid.map((row) => row.map((cell) => cell.color)))
  return project.frame ? { ...project, frame: { ...project.frame, beads } } : { ...project, beads }
}

/** The color of the bead you see at a Canvas position: the Frame's own where the Frame lies over it, else the Canvas's
 * (ADR 0066). A hex, or null where nothing is painted. */
export function beadColorAt(project: Pick<Project, 'beads' | 'frame'>, row: number, column: number): string | null {
  const frame = project.frame
  return frame && frameContains(frame, { row, column }) ? colorAt(frame.beads, row - frame.row, column - frame.column) : colorAt(project.beads, row, column)
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

  const placed = { beads: project.beads ?? {}, ...(project.frame ? { frame: { ...project.frame, beads: project.frame.beads ?? {} } } : {}) }
  const frame = projectFrame(placed)
  const technique = project.technique

  const { pieceNames: _stored, brickBlock: storedBlock, netSize: storedNet, ...withoutNames } = rest
  // An unreadable Brick block reads as the default; a valid one is kept even off brick stitch.
  const brickBlock = readBrickBlock(storedBlock)
  const pieceNames = readPieceNames(legacy.pieceNames)
  const netSize = technique === 'netting' ? clampNetSize(typeof storedNet === 'number' ? storedNet : undefined) : undefined
  const weave: Weave = { technique, ...(netSize ? { netSize } : {}) }

  return {
    ...withoutNames,
    ...placed,
    ...(brickBlock ? { brickBlock } : {}),
    ...(netSize ? { netSize } : {}),
    ...(pieceNames.length > 0 ? { pieceNames } : {}),
    rowProgress: {
      // Turn row direction isn't offered where a Technique is woven in rows only (ticket 487).
      direction: describeWeave(weave).rowDirection ? (rowProgress.direction ?? 'rows') : 'rows',
      // An old file's `enabled` and `decided` are read and dropped: Row progress follows the Frame (ticket 426, 434).
      currentRow: clampRow(rowProgress.currentRow, passCount(weave, frame.rows, 'rows')),
      currentColumn: clampRow(rowProgress.currentColumn ?? 0, passCount(weave, frame.columns, 'columns')),
    },
    rotation: normalizeRotation(legacy),
  }
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
    return { ...rest, rowProgress: { ...project.rowProgress, currentRow: 0, currentColumn: 0 }, updatedAt: Date.now() }
  }
  const { row, column, rows, columns } = rectangle
  const frame: FrameSheet = {
    row,
    column,
    rows,
    columns,
    beads: current ? shiftedBeads(current.beads, current.row - row, current.column - column, { rows, columns }) : {},
    ...(current?.name ? { name: current.name } : {}),
  }
  return { ...rest, frame, rowProgress: clampPointer(project.rowProgress, frame, project), updatedAt: Date.now() }
}

/** The Project woven in another Technique (ticket 351): grid, Bead and cells stay, only geometry changes. Offset
 * Techniques start their Frame on an even row, so a Frame on an odd one takes in the empty row above it. */
export function withTechnique(project: Project, technique: Technique): Project {
  return withWeave(project, { technique })
}

/** The Project with its Brick block changed (ticket 477): the same cells, only the shift's rhythm changes. */
export function withBrickBlock(project: Project, brickBlock: number): Project {
  return withWeave(project, { brickBlock: clampBrickBlock(brickBlock) })
}

/** A stored Brick block if it is a whole number from 1 to MAX_BRICK_BLOCK, otherwise nothing (read as 1). */
function readBrickBlock(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_BRICK_BLOCK ? value : undefined
}

/** A Brick block as a whole number from 1 to MAX_BRICK_BLOCK. */
export function clampBrickBlock(value: number): number {
  return Math.min(MAX_BRICK_BLOCK, Math.max(1, Math.round(value) || 1))
}

// A Frame whose first row is not the start of a cycle of the new weave takes in the empty rows above it.
function withWeave(project: Project, change: Partial<Pick<Project, 'technique' | 'brickBlock'>>): Project {
  const frame = project.frame
  const changed = { ...project, ...change }
  const top = frame ? snapRow(changed, frame.row) : 0
  if (!frame || top === frame.row) {
    return touch(project, change)
  }
  // The Frame grows upwards, and its beads stay where they are on the Canvas: counted from its new first row.
  const grown = frame.row - top
  return touch(project, { ...change, frame: { ...frame, row: top, rows: frame.rows + grown, beads: shiftedBeads(frame.beads, grown, 0) } })
}

/** Whether Row progress is on and a pass is done: the Frame is then held still, since the passes belong to it
 * (ticket 411). */
export function rowProgressStarted(project: Pick<Project, 'rowProgress' | 'frame'>): boolean {
  const { currentRow, currentColumn } = project.rowProgress
  return rowProgressOn(project) && (currentRow > 0 || currentColumn > 0)
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
  return touch(project, { rowProgress: { ...project.rowProgress, currentRow: 0, currentColumn: 0 } })
}

/** Flips which way the weaver's rows run across the grid (see RowDirection), leaving the grid and the rotated view
 * alone. */
export function toggleRowDirection(project: Project): Project {
  if (!describeWeave(project).rowDirection) {
    return project
  }
  const direction = project.rowProgress.direction === 'rows' ? 'columns' : 'rows'
  return touch(project, { rowProgress: { ...project.rowProgress, direction } })
}

/** Where the weaving has got to, counted in whichever direction its rows run: the row being woven now, and how many
 * rows the Frame has. */
export function rowProgressPosition(project: Pick<Project, 'rowProgress' | 'frame' | 'technique' | 'netSize'>): { current: number; total: number } {
  const { direction, currentRow, currentColumn } = project.rowProgress
  const frame = project.frame
  return direction === 'rows'
    ? { current: currentRow, total: passCount(project, frame?.rows ?? 0, 'rows') }
    : { current: currentColumn, total: passCount(project, frame?.columns ?? 0, 'columns') }
}

/** Whether a bead sits in a row the weaver has already finished: its pass (a whole line, or half of one on peyote)
 * is before the pointer, lines counted the way rows run from the Frame's first. Only while the overlay is on and a
 * Frame is set. */
export function isInFinishedRow(project: Pick<Project, 'rowProgress' | 'frame' | 'technique' | 'netSize'>, { row, column }: GridPosition): boolean {
  const { direction, currentRow, currentColumn } = project.rowProgress
  const frame = project.frame
  // The lock covers the Frame only: beads outside it stay editable whatever row the weaver is on.
  if (!frame || !frameContains(frame, { row, column })) {
    return false
  }
  const relativeRow = row - frame.row
  const relativeColumn = column - frame.column
  return direction === 'rows'
    ? passOf(project, relativeRow, relativeColumn, 'rows') < currentRow
    : passOf(project, relativeColumn, relativeRow, 'columns') < currentColumn
}

/** Whether a bead sits in the pass the weaver is on now (ticket 352): the same pass the pointer points at, so the
 * current row is drawn brighter. Only while the overlay is on and a Frame is set. */
export function isInCurrentRow(project: Pick<Project, 'rowProgress' | 'frame' | 'technique' | 'netSize'>, { row, column }: GridPosition): boolean {
  const { direction, currentRow, currentColumn } = project.rowProgress
  const frame = project.frame
  if (!frame || !frameContains(frame, { row, column })) {
    return false
  }
  const relativeRow = row - frame.row
  const relativeColumn = column - frame.column
  return direction === 'rows'
    ? passOf(project, relativeRow, relativeColumn, 'rows') === currentRow
    : passOf(project, relativeColumn, relativeRow, 'columns') === currentColumn
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
  const pointer = project.rowProgress.direction === 'rows' ? 'currentRow' : 'currentColumn'
  return touch(project, {
    rowProgress: { ...project.rowProgress, [pointer]: clampRow(row, total) },
  })
}

/** Swaps in a whole new set of beads, returning a new Project rather than mutating the one passed in. */
export function restoreBeads(project: Project, beads: BeadMap): Project {
  return touch(project, { beads })
}

/** One entry on the editing-session undo stack (ADR 0036): a full snapshot of what an Edit can change (beads, Row
 * progress, Bead, Frame, Mirror's axis counts). Mirror's counts are a session setting, not a Project field, so
 * restoreSnapshot leaves applying them to the caller. All immutable, sharing structure. */
export interface UndoEntry {
  beads: BeadMap
  rowProgress: RowProgress
  beadId: string
  /** The Frame with its own beads, as they were (ADR 0066). */
  frame: FrameSheet | undefined
  /** The Piece names as they were, so Undo and Redo of a naming or of a merge or split restore them (ticket 406). */
  pieceNames?: PieceName[]
  /** The Technique the entry was taken in, so Undo undoes a change of Technique (ticket 351). */
  technique: Technique
  /** The Brick block the entry was taken with, so Undo undoes a change of it (ticket 477). */
  brickBlock?: number
  mirrorAxisCounts: MirrorAxisCounts
}

/** The Project's state as an undo entry, with Mirror's axis counts as they are now. */
export function snapshotOf(project: Project, mirrorAxisCounts: MirrorAxisCounts): UndoEntry {
  return { beads: project.beads, rowProgress: project.rowProgress, beadId: project.beadId, frame: project.frame, pieceNames: project.pieceNames, technique: project.technique, brickBlock: project.brickBlock, mirrorAxisCounts }
}

/** The Project with everything an undo entry holds put back (Mirror's axis counts aside; see UndoEntry). */
export function restoreSnapshot(project: Project, entry: UndoEntry): Project {
  const { pieceNames: _current, brickBlock: _block, ...rest } = project
  return touch(rest, {
    beads: entry.beads,
    rowProgress: entry.rowProgress,
    beadId: entry.beadId,
    frame: entry.frame,
    technique: entry.technique,
    ...(entry.brickBlock ? { brickBlock: entry.brickBlock } : {}),
    ...(entry.pieceNames ? { pieceNames: entry.pieceNames } : {}),
  })
}

/** Whether Row progress is already exactly the just-created state (see INITIAL_ROW_PROGRESS), so deleteAll has
 * nothing left to reset. */
function isInitialRowProgress(rowProgress: RowProgress): boolean {
  return (
    rowProgress.direction === INITIAL_ROW_PROGRESS.direction &&
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

/** Swaps the Project's Bead for another catalog entry (ticket 48, ADR 0007). Nothing else changes: the grid is the
 * Project's size and only the Estimated size depends on the Bead; resizeProject restores the old size. */
export function replaceBead(project: Project, bead: Bead): Project {
  return touch(project, { beadId: bead.id })
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
 * Used by Fill (fillArea), including right-click erase under Fill (ticket 25), which passes a null color. */
function floodRegion(project: Pick<Project, 'beads' | 'frame' | 'technique'>, start: GridPosition): GridPosition[] {
  const targetColor = colorAt(project.beads, start.row, start.column)
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

/** Bucket-fills every cell reachable from (row, column) through same-colored neighbors (see floodRegion), with the
 * given color. Returns the same Project instance, unchanged, if the clicked cell is already that color. */
export function fillArea(project: Project, row: number, column: number, color: string | null): Project {
  if (colorAt(project.beads, row, column) === color) {
    return project
  }

  const region = floodRegion(project, { row, column })
  return restoreBeads(project, withColors(project.beads, region.map((position) => ({ ...position, color }))))
}

/** Resets the open Project to as first created (CONTEXT.md's Delete all): cells emptied, Row progress at the first row;
 * name, size, Technique, Bead and rotation stay. Ignores the Row progress lock (see isInFinishedRow): clearing
 * progress is the point. Returns the same instance if already so. */
export function mirroredCells(
  project: Pick<Project, 'frame'>,
  position: GridPosition,
  axes: MirrorAxisCounts,
  copyMode = false,
): GridPosition[] {
  const frame = project.frame
  if (!frame || !frameContains(frame, position)) {
    return [position]
  }
  const rows = mirrorCounterparts(position.row - frame.row, frame.rows, axes.rows, copyMode).map((row) => row + frame.row)
  const columns = mirrorCounterparts(position.column - frame.column, frame.columns, axes.columns, copyMode).map(
    (column) => column + frame.column,
  )

  const seen = new Set<string>()
  const cells: GridPosition[] = []
  for (const row of rows) {
    for (const column of columns) {
      const key = positionKey({ row, column })
      if (!seen.has(key)) {
        seen.add(key)
        cells.push({ row, column })
      }
    }
  }
  return cells
}

/** Paints every position in `positions` plus each one's live-mirror counterparts (see mirroredCells) as a single
 * edit, so a whole stroke (ticket 24) is one undo step. Returns the same Project if nothing changes. Only the touched
 * rows are copied (see withColors). */
export function paintCells(
  project: Project,
  positions: GridPosition[],
  color: string | null,
  axes: MirrorAxisCounts,
  copyMode = false,
): Project {
  const targets = new Map<string, BeadChange>()
  for (const position of positions) {
    for (const cell of mirroredCells(project, position, axes, copyMode)) {
      targets.set(positionKey(cell), { ...cell, color })
    }
  }

  const beads = withColors(project.beads, targets.values())
  return beads === project.beads ? project : restoreBeads(project, beads)
}

/** How many painted cells (non-null color) fall in each strip (0-indexed, 0..axisCount) of the Frame along `axis`,
 * per the same "as equal as possible" split domain/mirror.ts's strip math uses. */
function paintedCountsByStrip(project: Project, frame: Frame, axis: 'columns' | 'rows', axisCount: number): number[] {
  const counts = new Array(axisCount + 1).fill(0)
  const dimension = axis === 'columns' ? frame.columns : frame.rows
  forEachBead(project.beads, (row, column) => {
    if (!frameContains(frame, { row, column })) {
      return
    }
    const index = axis === 'columns' ? column - frame.column : row - frame.row
    counts[stripOf(index, dimension, axisCount)]++
  })
  return counts
}

/** "Mirror current" (ticket 46, ADR 0006 amendment): a one-time sync along ONE direction using its own axis count.
 * The strip with the most painted cells (ties: lowest index) is copied onto the others (mirrorCounterpartInStrip).
 * No Frame: unchanged. A count of 0 acts as one center axis for this sync only, so the button always does something. */
export function mirrorCurrent(
  project: Project,
  axis: 'columns' | 'rows',
  axisCount: number,
  copyMode: boolean,
): Project {
  const frame = project.frame
  if (!frame) {
    return project
  }
  const dimension = axis === 'columns' ? frame.columns : frame.rows
  const effectiveAxisCount = axisCount === 0 ? 1 : axisCount

  const counts = paintedCountsByStrip(project, frame, axis, effectiveAxisCount)
  const sourceStrip = counts.reduce((best, count, strip) => (count > counts[best]! ? strip : best), 0)

  const changes: BeadChange[] = []
  for (let rowOffset = 0; rowOffset < frame.rows; rowOffset++) {
    for (let columnOffset = 0; columnOffset < frame.columns; columnOffset++) {
      const index = axis === 'columns' ? columnOffset : rowOffset
      if (stripOf(index, dimension, effectiveAxisCount) === sourceStrip) {
        continue
      }
      const sourceIndex = mirrorCounterpartInStrip(index, dimension, effectiveAxisCount, copyMode, sourceStrip)
      const sourceRow = frame.row + (axis === 'columns' ? rowOffset : sourceIndex)
      const sourceColumn = frame.column + (axis === 'columns' ? sourceIndex : columnOffset)
      changes.push({
        row: frame.row + rowOffset,
        column: frame.column + columnOffset,
        color: colorAt(project.beads, sourceRow, sourceColumn),
      })
    }
  }

  return restoreBeads(project, withColors(project.beads, changes))
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

/** The Bead a Project was woven from (ticket 37), or undefined when the catalog no longer has it (a removed custom
 * Bead, ticket 38, or one an imported file names). Callers show a placeholder, not a raw id. */
export function resolveProjectBead(project: Project): Bead | undefined {
  return findBead(project.beadId)
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
