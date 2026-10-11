import { beadLabel, findBead, type Bead } from './beads'
import {
  beadBounds,
  beadsFromColors,
  colorAt,
  colorsInFrame,
  forEachBead,
  frameContains,
  frameDimensions,
  withColors,
  type BeadChange,
  type BeadMap,
  type Frame,
} from './canvas'
import { sameFrame, snapRow } from './frame'
import {
  neighborsOf,
  positionKey,
  rotationSwapsAxes,
  type GridDimensions,
  type GridPosition,
  type Rotation,
  type Technique,
} from './grid'
import { normalizeMakerName } from './makerName'
import { mirrorCounterpartInStrip, mirrorCounterparts, stripOf, type MirrorAxisCounts } from './mirror'
import { passCount, passOf } from './passes'
import { gridFromSize, type StatedSize } from './projectSize'

export type { MirrorAxisCounts } from './mirror'

export type { Technique } from './grid'

export interface Cell {
  color: string | null
}

/** A dense rows × columns array of cells: not what a Project stores (it stores `beads`), but what Convert image produces and what older Projects were saved as. */
export type Grid = Cell[][]

/**
 * Which way the weaver's rows run across the grid (ticket 32): along the grid's rows, or down its columns. Separate
 * from Project.rotation, which only turns the picture: rotating changes which grid axis runs across the screen, so
 * the weaver flips this too, but neither setting ever changes the other.
 */
type RowDirection = 'rows' | 'columns'

/** Which row the weaver is on, and whether the editor is showing that overlay (see CONTEXT.md's Row progress entry). */
export interface RowProgress {
  enabled: boolean
  direction: RowDirection
  /** Zero-based index of the row being woven now; every row before it counts as finished. */
  currentRow: number
  /** The same pointer for when rows run down the grid's columns, kept apart so flipping the direction never loses either place. */
  currentColumn: number
}

export interface Project {
  id: string
  name: string
  technique: Technique
  beadId: string
  /**
   * What is painted on the Open canvas, by position (ADR 0026); see BeadMap. A Project stores no real-world size —
   * what the editor shows in millimetres is an Estimated size worked out on demand from the Frame (estimatedSizeMm).
   */
  beads: BeadMap
  /**
   * The Frame (CONTEXT.md): which beads are the Project, and so its size in beads. Absent on a canvas that has none
   * yet; a Project saved before the open canvas has one the size of its old grid (see normalizeProject).
   */
  frame?: Frame
  rowProgress: RowProgress
  /**
   * A view-only orientation turn (tickets 28, 171): shows the Project turned this many degrees clockwise, like a
   * rotated photo. Purely cosmetic — the grid, technique geometry, and every other field stay exactly as woven; only
   * the on-screen (and printed/exported) presentation turns. Deliberately not a data transform: for Peyote/Brick, the
   * offset stagger is tied to weave direction, so actually transposing the grid would change which cells are
   * adjacent — a different, unweavable schema, not the same picture turned sideways.
   */
  rotation: Rotation
  /**
   * The colors one Convert image found (CONTEXT.md's Image colors, ADR 0011), offered in the Colors group alongside
   * the Palette while this Project is open. Absent on a Project created any other way — which is most of them, hence
   * optional rather than an empty array everywhere.
   *
   * Frozen at the moment of conversion: nothing in this file ever adds to it or takes from it, so painting a new
   * color never grows it and erasing one never shrinks it. Deliberately not the same thing as the per-Project color
   * table the compact storage encoding builds (projectEncoding.ts), which describes the grid as it stands now; the two
   * differ the moment a color is erased and both are then correct.
   */
  imageColors?: string[]
  /**
   * This Project's own maker's name (ticket 182), overriding the device-wide one (domain/makerName.ts) on its exports
   * and its background watermark. Absent by default: a Project set no override keeps whatever the device says, even
   * as that changes later, the same way an imported Project with no override picks up the importing device's name.
   */
  makerName?: string
  createdAt: number
  updatedAt: number
  /**
   * When the Project last reached this device's storage (ticket 145): what orders the Project library, most recently
   * saved first. Absent on a Project saved before the order existed, whose updatedAt stands in for it (see lastSaved).
   */
  savedAt?: number
}

export interface CreateProjectInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
  technique: Technique
  beadId: string
  /**
   * How big the Project's Frame is, in beads or in mm/cm — the latter converted once to a grid and not remembered
   * (ADR 0026). Left out, the Project is an open canvas with no Frame (ADR 0026).
   */
  size?: StatedSize
  /** This Project's own maker's name (ticket 182); blank or omitted keeps the device-wide one instead. */
  makerName?: string
}

/** Row progress exactly as a freshly created Project starts out — also what Delete all (ticket 42) resets it back to. */
const INITIAL_ROW_PROGRESS: RowProgress = { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 }

/** What a new Project's stated size and Bead work out to: the Bead, and the grid that implies. */
export interface ProjectGeometry extends GridDimensions {
  bead: Bead
}

/**
 * The grid a New Project form state implies, or undefined when the Bead isn't in the catalog.
 *
 * Shared with Convert image (ticket 58), whose frame is this same geometry: the frame has to be the grid the Project
 * will actually be created at, so both read it from here rather than each converting units and dividing by the Bead's
 * footprint in their own way.
 */
export function projectGeometry(input: CreateProjectInput & { size: StatedSize }): ProjectGeometry | undefined {
  // findBead looks the id up in the fixed built-in catalog (ADR 0007 / ticket 38).
  const bead = findBead(input.beadId)
  if (!bead) {
    return undefined
  }

  return { bead, ...gridFromSize(input.size, bead) }
}

export function createProject(input: CreateProjectInput): Project {
  const bead = findBead(input.beadId)
  if (!bead) {
    throw new Error(`Unknown bead id: ${input.beadId}`)
  }

  const dimensions = input.size ? gridFromSize(input.size, bead) : undefined
  const now = Date.now()
  const name = input.name?.trim() || beadLabel(bead)
  const makerName = normalizeMakerName(input.makerName ?? '')

  return {
    id: crypto.randomUUID(),
    name,
    technique: input.technique,
    beadId: input.beadId,
    beads: {},
    ...(dimensions ? { frame: { row: 0, column: 0, columns: dimensions.columns, rows: dimensions.rows } } : {}),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
    rotation: 0,
    ...(makerName ? { makerName } : {}),
    createdAt: now,
    updatedAt: now,
  }
}

/** A new Project made from a picture (CONTEXT.md's Convert image): the same fields as any other, plus what the conversion produced. */
export interface CreateProjectFromImageInput extends CreateProjectInput {
  /** A picture needs a Frame to land in: the Frame's size, which is also the grid it was sampled at. */
  size: StatedSize
  /** The converted cells, sampled at the Project's own Frame size (see domain/imageConversion.ts). */
  grid: Grid
  /** The colors that conversion found, saved on the Project and never changed afterwards (ADR 0011). */
  imageColors: string[]
}

/**
 * Creates a Project from a picture (ticket 58): an ordinary new Project in every respect — same name/size/Bead/
 * Technique handling, same fresh Row progress — except that its cells arrive painted and it carries the conversion's
 * Image colors.
 *
 * Conversion is a way of creating a Project, never a command on one already open (ADR 0010), so this is the only place
 * Image colors is ever written and there is no Row progress lock, Mirror strip or undo step for it to answer to.
 *
 * The grid is fitted to the dimensions the stated size implies rather than trusted to match: a cell the conversion
 * didn't reach comes back empty and a surplus one is dropped, the same tolerance the stored encoding applies, so a
 * disagreement can never produce a Project whose grid and dimensions contradict each other.
 */
export function createProjectFromImage(input: CreateProjectFromImageInput): Project {
  const project = createProject(input)
  const frame = project.frame!

  return {
    ...project,
    beads: beadsFromColors(
      Array.from({ length: frame.rows }, (_row, rowIndex) =>
        Array.from({ length: frame.columns }, (_cell, columnIndex) => input.grid[rowIndex]?.[columnIndex]?.color ?? null),
      ),
      frame,
    ),
    imageColors: [...input.imageColors],
  }
}

/** Applies a change to a Project as a new object, stamping it as just-edited. */
function touch(project: Project, changes: Partial<Project>): Project {
  return { ...project, ...changes, updatedAt: Date.now() }
}

function clampRow(row: number, rows: number): number {
  return Math.max(0, Math.min(rows - 1, row))
}

/** Row progress with both pointers (the row and the column being woven) inside the Frame; the one clamp a Frame change uses. */
export function clampPointer(rowProgress: Project['rowProgress'], frame: Frame, technique: Technique): Project['rowProgress'] {
  return {
    ...rowProgress,
    currentRow: clampRow(rowProgress.currentRow, passCount(technique, frame.rows)),
    currentColumn: clampRow(rowProgress.currentColumn, passCount(technique, frame.columns)),
  }
}

/**
 * The Project's Frame, or — for a canvas that has none — the smallest box round its beads (nothing at all for an empty
 * one). What the parts of the app that still think in a Project's extent read: with a Frame it is the Project itself.
 */
export function projectFrame(project: Pick<Project, 'frame' | 'beads'>): Frame {
  return project.frame ?? beadBounds(project.beads) ?? { row: 0, column: 0, columns: 0, rows: 0 }
}

/** What the open Project's Frame measures in beads, for the grid-shaped helpers (mirror strips, adjacency, fit zoom). */
export function projectDimensions(project: Pick<Project, 'frame' | 'beads'>): GridDimensions {
  return frameDimensions(projectFrame(project))
}

/** The Frame's beads as a dense grid of cells: for the parts of the app that still think in rows and columns (the Tour's check, a test's expectation). Empty with no Frame and no beads. */
export function frameGrid(project: Pick<Project, 'frame' | 'beads'>): Grid {
  return colorsInFrame(project.beads, projectFrame(project)).map((row) => row.map((color) => ({ color })))
}

/** A dense grid of cells as beads with a Frame the size of the grid: what the Convert image preview, the Overview's pictures and a test's hand-made block of beads are drawn from. */
export function framedGrid(grid: Grid): Pick<Project, 'beads' | 'frame'> {
  return {
    beads: beadsFromColors(grid.map((row) => row.map((cell) => cell.color))),
    frame: { row: 0, column: 0, columns: grid[0]?.length ?? 0, rows: grid.length },
  }
}

/** The Project with its Frame's beads replaced by a dense grid of cells whose top-left sits at the Frame's; beads outside the Frame stay as they are. */
export function withFrameGrid(project: Project, grid: Grid): Project {
  const frame = projectFrame(project)
  const outside = withColors(
    project.beads,
    colorsInFrame(project.beads, frame).flatMap((cells, rowOffset) =>
      cells.map((_color, columnOffset) => ({ row: frame.row + rowOffset, column: frame.column + columnOffset, color: null })),
    ),
  )
  return {
    ...project,
    beads: withColors(
      outside,
      grid.flatMap((cells, rowOffset) =>
        cells.map((cell, columnOffset) => ({ row: frame.row + rowOffset, column: frame.column + columnOffset, color: cell.color })),
      ),
    ),
  }
}

/** The color at a position on the open canvas: a hex, or null where nothing is painted. */
export function beadColorAt(project: Pick<Project, 'beads'>, row: number, column: number): string | null {
  return colorAt(project.beads, row, column)
}

/**
 * A Project as it was saved before the open canvas (ADR 0026): a fixed `columns` × `rows` grid of cells in place of
 * beads by position and a Frame. Read by normalizeProject only, which gives it a Frame the size of the grid.
 */
export type GridProject = Omit<Project, 'beads' | 'frame'> & { columns: number; rows: number; grid: Grid }

function isGridProject(project: Project | GridProject): project is GridProject {
  return Array.isArray((project as GridProject).grid)
}

/**
 * A Project as an older version of the app may have saved it: still carrying the color-to-bead override field ADR
 * 0007/ticket 36 dropped, the stored real-world size (`widthMm`/`heightMm`) ADR 0026 dropped, and rotation as
 * ticket 28's two-position `rotated` boolean rather than ticket 171's four-position `rotation`.
 */
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

/** `rotation` as ticket 171 shipped it, or ticket 28's `rotated` boolean read as its nearest quarter turn, or upright for a Project from before either existed. */
function normalizeRotation(project: ProjectWithLegacyFields): Rotation {
  if (typeof project.rotation === 'number' && (ROTATIONS as readonly number[]).includes(project.rotation)) {
    return project.rotation
  }
  return project.rotated ? 90 : 0
}

/**
 * Fills in fields added after a Project was first saved, re-clamps the row pointer, and drops the fields nothing
 * reads anymore — the color-to-bead override a Project saved before ticket 36 may carry (ADR 0007: a Project now has
 * one Bead, not a per-color mapping) and the stored millimetre size (ADR 0026: the grid is the size) — so a Project
 * read back from storage or an imported file is safe to use whatever version wrote it, and never re-saves them.
 */
export function normalizeProject(project: Project | GridProject): Project {
  const rowProgress = project.rowProgress ?? { enabled: false, currentRow: 0 }
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

  // A Project saved before the open canvas becomes beads by position with a Frame the size of its old grid.
  const placed = isGridProject(project)
    ? {
        beads: beadsFromColors(project.grid.map((row) => row.map((cell) => cell.color))),
        frame: { row: 0, column: 0, columns: project.columns, rows: project.rows },
      }
    : { beads: project.beads ?? {}, ...(project.frame ? { frame: project.frame } : {}) }
  const frame = projectFrame(placed)
  const technique = project.technique

  return {
    ...rest,
    ...placed,
    rowProgress: {
      ...rowProgress,
      direction: rowProgress.direction ?? 'rows',
      currentRow: clampRow(rowProgress.currentRow, passCount(technique, frame.rows)),
      currentColumn: clampRow(rowProgress.currentColumn ?? 0, passCount(technique, frame.columns)),
    },
    rotation: normalizeRotation(legacy),
  }
}

/**
 * The Project with its Frame set, moved, resized or removed (ADR 0026). No bead changes: the Frame only says which of
 * them are the Project. Row progress's pointers are kept inside the new Frame; a Project with the same Frame comes back
 * as it is, so a gesture that ends where it began is no change.
 */
export function withFrame(project: Project, frame: Frame | undefined): Project {
  if (sameFrame(project.frame, frame)) {
    return project
  }
  const { frame: _previous, ...rest } = project
  const rowProgress = frame ? clampPointer(project.rowProgress, frame, project.technique) : project.rowProgress
  return { ...rest, ...(frame ? { frame } : {}), rowProgress, updatedAt: Date.now() }
}

/**
 * The Project woven in another Technique (ticket 351): the grid, Bead and cells stay, only the geometry changes. Offset
 * Techniques start their Frame on an even row, so a Frame that began on an odd one takes in the empty row above it
 * rather than moving or losing a row.
 */
export function withTechnique(project: Project, technique: Technique): Project {
  const frame = project.frame
  const top = frame ? snapRow(technique, frame.row) : 0
  if (!frame || top === frame.row) {
    return touch(project, { technique })
  }
  return touch(project, { technique, frame: { ...frame, row: top, rows: frame.rows + frame.row - top } })
}

/** Shows or hides the row-progress overlay, leaving the pointer where it is. */
export function setRowProgressEnabled(project: Project, enabled: boolean): Project {
  // Row progress counts the Frame's rows, so with no Frame there is nothing to switch on.
  if (enabled && !project.frame) {
    return project
  }
  return touch(project, { rowProgress: { ...project.rowProgress, enabled } })
}

/** Flips which way the weaver's rows run across the grid (see RowDirection), leaving the grid and the rotated view alone. */
export function toggleRowDirection(project: Project): Project {
  const direction = project.rowProgress.direction === 'rows' ? 'columns' : 'rows'
  return touch(project, { rowProgress: { ...project.rowProgress, direction } })
}

/** Where the weaving has got to, counted in whichever direction its rows run: the row being woven now, and how many rows the Frame has. */
export function rowProgressPosition(project: Pick<Project, 'rowProgress' | 'frame' | 'technique'>): { current: number; total: number } {
  const { direction, currentRow, currentColumn } = project.rowProgress
  const frame = project.frame
  return direction === 'rows'
    ? { current: currentRow, total: passCount(project.technique, frame?.rows ?? 0) }
    : { current: currentColumn, total: passCount(project.technique, frame?.columns ?? 0) }
}

/** Whether a bead sits in a row the weaver has already finished: its pass (a whole line, or half of one on peyote) is before the pointer, lines counted the way rows run from the Frame's first. Only while the overlay is on and a Frame is set. */
export function isInFinishedRow(project: Pick<Project, 'rowProgress' | 'frame' | 'technique'>, { row, column }: GridPosition): boolean {
  const { enabled, direction, currentRow, currentColumn } = project.rowProgress
  const frame = project.frame
  // The lock covers the Frame only: beads outside it stay editable whatever row the weaver is on.
  if (!enabled || !frame || !frameContains(frame, { row, column })) {
    return false
  }
  const relativeRow = row - frame.row
  const relativeColumn = column - frame.column
  return direction === 'rows'
    ? passOf(project.technique, relativeRow, relativeColumn) < currentRow
    : passOf(project.technique, relativeColumn, relativeRow) < currentColumn
}

/** Whether a bead sits in the pass the weaver is on now (ticket 352): the same pass the pointer points at, so the current row is drawn brighter. Only while the overlay is on and a Frame is set. */
export function isInCurrentRow(project: Pick<Project, 'rowProgress' | 'frame' | 'technique'>, { row, column }: GridPosition): boolean {
  const { enabled, direction, currentRow, currentColumn } = project.rowProgress
  const frame = project.frame
  if (!enabled || !frame || !frameContains(frame, { row, column })) {
    return false
  }
  const relativeRow = row - frame.row
  const relativeColumn = column - frame.column
  return direction === 'rows'
    ? passOf(project.technique, relativeRow, relativeColumn) === currentRow
    : passOf(project.technique, relativeColumn, relativeRow) === currentColumn
}

/** Every position whose color differs between two bead maps; a row both share is passed over unread. */
export function changedPositions(before: BeadMap, after: BeadMap): GridPosition[] {
  const changed: GridPosition[] = []
  const rows = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of rows) {
    const row = Number(key)
    const was = before[row]
    const now = after[row]
    if (was === now) {
      continue
    }
    const columns = new Set([...Object.keys(was ?? {}), ...Object.keys(now ?? {})])
    for (const columnKey of columns) {
      const column = Number(columnKey)
      if (was?.[column] !== now?.[column]) {
        changed.push({ row, column })
      }
    }
  }
  return changed.sort((a, b) => a.row - b.row || a.column - b.column)
}

/**
 * Takes back whatever a drawing command did to finished rows (ticket 33): those beads are already woven, so an edit
 * only lands on the row being woven now and the ones after it. An edit left with nothing to change hands back
 * `before` itself, the same "unchanged" signal the drawing commands give, so it records no undo step.
 */
export function keepFinishedRows(before: Project, after: Project): Project {
  const reverts: BeadChange[] = changedPositions(before.beads, after.beads)
    .filter((position) => isInFinishedRow(before, position))
    .map(({ row, column }) => ({ row, column, color: colorAt(before.beads, row, column) }))
  const beads = withColors(after.beads, reverts)
  return changedPositions(before.beads, beads).length > 0 ? { ...after, beads } : before
}

/** Points row progress at the given row in its current direction, clamped to the Project — used to advance a finished row and to go back to an earlier one. */
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

/**
 * One entry on the editing-session undo stack (ADR 0036): a full snapshot of what an Edit can change, so every Undo and
 * Redo step restores the same things whichever command made it: the beads, Row progress, the Bead, the Frame, and
 * Mirror's axis counts. Mirror's counts are an editing-session setting, not a Project field, so restoreSnapshot leaves
 * applying them to the caller. All of it is immutable, so a snapshot shares structure with the Project it came from.
 */
export interface UndoEntry {
  beads: BeadMap
  rowProgress: RowProgress
  beadId: string
  frame: Frame | undefined
  /** The Technique the entry was taken in, so Undo undoes a change of Technique (ticket 351). */
  technique: Technique
  mirrorAxisCounts: MirrorAxisCounts
}

/** The Project's state as an undo entry, with Mirror's axis counts as they are now. */
export function snapshotOf(project: Project, mirrorAxisCounts: MirrorAxisCounts): UndoEntry {
  return { beads: project.beads, rowProgress: project.rowProgress, beadId: project.beadId, frame: project.frame, technique: project.technique, mirrorAxisCounts }
}

/** The Project with everything an undo entry holds put back (Mirror's axis counts aside; see UndoEntry). */
export function restoreSnapshot(project: Project, entry: UndoEntry): Project {
  return touch(project, { beads: entry.beads, rowProgress: entry.rowProgress, beadId: entry.beadId, frame: entry.frame, technique: entry.technique })
}

/** Whether Row progress is already exactly the just-created state (see INITIAL_ROW_PROGRESS), so deleteAll has nothing left to reset. */
function isInitialRowProgress(rowProgress: RowProgress): boolean {
  return (
    rowProgress.enabled === INITIAL_ROW_PROGRESS.enabled &&
    rowProgress.direction === INITIAL_ROW_PROGRESS.direction &&
    rowProgress.currentRow === INITIAL_ROW_PROGRESS.currentRow &&
    rowProgress.currentColumn === INITIAL_ROW_PROGRESS.currentColumn
  )
}

/**
 * Resets the open Project to how it was when first created at its size (CONTEXT.md's Delete all): every cell
 * emptied and Row progress back to its just-created state — off, both pointers at the first row — while name, size,
 * Technique, Bead and rotation stay exactly as they were. Unlike Paint/Fill/Paste/Mirror it ignores the Row
 * progress lock (see isInFinishedRow): clearing progress is the point, so callers apply this directly rather than
 * routing it through keepFinishedRows. Returns the same Project instance, unchanged, if it's already in that state.
 */
export function deleteAll(project: Project): Project {
  if (Object.keys(project.beads).length === 0 && isInitialRowProgress(project.rowProgress)) {
    return project
  }

  return touch(project, {
    beads: {},
    rowProgress: { ...INITIAL_ROW_PROGRESS },
  })
}

/**
 * Swaps the Project's Bead for a different catalog entry (ticket 48, ADR 0007). Nothing else changes: the grid, its
 * columns and rows, every painted cell, Row progress and Mirror all stay exactly as they were, since the grid is the
 * Project's size and only its Estimated size depends on the Bead. Someone who wants the old size back afterwards
 * adds or removes rows and columns (see resizeProject).
 */
export function replaceBead(project: Project, bead: Bead): Project {
  return touch(project, { beadId: bead.id })
}

/**
 * Where a Fill stops (ADR 0026): the Frame when it starts inside one, otherwise the box round the Frame and every
 * painted bead, one position wider on each side, so filling empty open space stays a finite patch rather than the
 * whole endless canvas.
 */
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

/**
 * Every cell reachable from `start` through same-colored neighbors, per the Project's grid adjacency (see
 * neighborsOf) -- the flood region a click at `start` would act on. Used by Fill (fillArea), including right-click
 * erase under Fill (ticket 25), which calls fillArea with a null color.
 */
function floodRegion(project: Pick<Project, 'beads' | 'frame' | 'technique'>, start: GridPosition): GridPosition[] {
  const targetColor = colorAt(project.beads, start.row, start.column)
  const limit = fillLimit(project, start)
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

    if (colorAt(project.beads, position.row, position.column) !== targetColor) {
      continue
    }
    region.push(position)
    stack.push(...neighborsOf(project.technique, limit, position))
  }

  return region
}

/** Bucket-fills every cell reachable from (row, column) through same-colored neighbors (see floodRegion), with the given color. Returns the same Project instance, unchanged, if the clicked cell is already that color. */
export function fillArea(project: Project, row: number, column: number, color: string | null): Project {
  if (colorAt(project.beads, row, column) === color) {
    return project
  }

  const region = floodRegion(project, { row, column })
  return restoreBeads(project, withColors(project.beads, region.map((position) => ({ ...position, color }))))
}

/**
 * Every cell a live-mirrored stroke touches when painting `position` (ADR 0006/ticket 22, generalized to
 * per-direction axis *counts* by ticket 44): itself, plus its reflection(s) across every Mirror axis, fixed to the
 * Frame's exact center(s) rather than mirrorCurrent's adaptive "fullest strip" heuristic (there's no drawn-so-far
 * content to judge a source strip from mid-stroke). `axes.columns` splits the Frame across its columns
 * ("horizontal"), `axes.rows` across its rows ("vertical"); see domain/mirror.ts for the strip math and why counts
 * are grid-space, never screen-space. `copyMode` (ticket 45) is one switch for both directions: strips repeat the
 * same way round (A | A | A) instead of mirror-imaging (A | A' | A). A position outside the Frame, or a canvas
 * without one, has no axes to reflect across and is only itself.
 */
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

/**
 * Paints every position in `positions` plus each one's live-mirror counterpart(s) (see mirroredCells) as a single
 * Project edit, so a whole stroke — mirrored or not, one cell or a whole dragged path (ticket 24) — is one undo
 * step rather than one per cell. Returns the same Project instance, unchanged, if every touched cell is already
 * that color. Only the rows a stroke touched are copied (see withColors): an edit costs what it touched, not the size
 * of the Project.
 */
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

/** How many painted cells (non-null color) fall in each strip (0-indexed, 0..axisCount) of the Frame along `axis`, per the same "as equal as possible" split domain/mirror.ts's strip math uses. */
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

/**
 * "Mirror current" (ticket 46, ADR 0006 amendment): a one-time sync of what's already painted in the Frame along ONE
 * direction, using that direction's own axis count -- the other direction is left alone entirely, matching how the
 * per-axis buttons have always worked (see onMirrorCurrent in App.vue). The strip holding the most painted cells
 * becomes the source and is copied onto every other strip, mirrored by default or unflipped in copy mode (see
 * mirrorCounterpartInStrip). Ties go to the lowest strip index (leftmost/topmost). Beads outside the Frame are not
 * touched; with no Frame there is nothing to mirror across and the Project comes back unchanged.
 *
 * A count of 0 acts as a single center axis (1 axis, 2 strips) purely for this one sync -- the stored axis count
 * itself is untouched -- so the button always does something even before any axis is turned on.
 */
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

/** A short, language-neutral identifier for a Project in UI lists (names are proper nouns, not translated): its name and, once it has a Frame, the Frame's size; reflects the rotated view's swapped dimensions, since that's how the Project currently looks. */
export function summarizeProject(project: Project): string {
  // The size is the Frame's: a canvas with none has no size to state (ADR 0026).
  if (!project.frame) {
    return project.name
  }
  const { columns, rows } = projectDimensions(project)
  const [width, height] = rotationSwapsAxes(project.rotation) ? [rows, columns] : [columns, rows]
  return `${project.name} · ${width}×${height}`
}

/**
 * The Bead a Project was woven from (ticket 37), or undefined when the catalog no longer has it — a custom Bead
 * removed since (ticket 38), or one an imported file names that this device never had. Callers show a neutral
 * placeholder for the undefined case rather than a raw id.
 */
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

/**
 * The Project library's order (ticket 145): most recently saved first; saved at the same moment, most recently edited
 * first; and otherwise as they were, so a library read twice comes out the same twice.
 */
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
