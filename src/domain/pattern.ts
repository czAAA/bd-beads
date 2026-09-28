import { beadLabel, findBead, type Bead } from './beads'
import {
  neighborsOf,
  nextRotation as nextRotationOf,
  positionKey,
  rotationSwapsAxes,
  type GridDimensions,
  type GridPosition,
  type Rotation,
  type Technique,
} from './grid'
import { normalizeMakerName } from './makerName'
import { mirrorCounterpartInStrip, mirrorCounterparts, stripOf, type MirrorAxisCounts } from './mirror'
import { gridFromSize, type StatedSize } from './patternSize'

export type { MirrorAxisCounts } from './mirror'

export type { Rotation, Technique } from './grid'

export interface Cell {
  color: string | null
}

export type Grid = Cell[][]

/**
 * Which way the weaver's rows run across the grid (ticket 32): along the grid's rows, or down its columns. Separate
 * from Pattern.rotation, which only turns the picture: rotating changes which grid axis runs across the screen, so
 * the weaver flips this too, but neither setting ever changes the other.
 */
export type RowDirection = 'rows' | 'columns'

/** Which row the weaver is on, and whether the editor is showing that overlay (see CONTEXT.md's Row progress entry). */
export interface RowProgress {
  enabled: boolean
  direction: RowDirection
  /** Zero-based index of the row being woven now; every row before it counts as finished. */
  currentRow: number
  /** The same pointer for when rows run down the grid's columns, kept apart so flipping the direction never loses either place. */
  currentColumn: number
}

export interface Pattern {
  id: string
  name: string
  technique: Technique
  beadId: string
  /**
   * The Pattern size (CONTEXT.md): the grid itself is the size, counted in beads. A Pattern stores no real-world size
   * — what the editor shows in millimetres is an Estimated size worked out on demand (see estimatedSizeMm, ADR 0017).
   */
  columns: number
  rows: number
  grid: Grid
  rowProgress: RowProgress
  /**
   * A view-only orientation turn (tickets 28, 171): shows the Pattern turned this many degrees clockwise, like a
   * rotated photo. Purely cosmetic — the grid, technique geometry, and every other field stay exactly as woven; only
   * the on-screen (and printed/exported) presentation turns. Deliberately not a data transform: for Peyote/Brick, the
   * offset stagger is tied to weave direction, so actually transposing the grid would change which cells are
   * adjacent — a different, unweavable schema, not the same picture turned sideways.
   */
  rotation: Rotation
  /**
   * The colors one Convert image found (CONTEXT.md's Image colors, ADR 0011), offered in the Colors group alongside
   * the Palette while this Pattern is open. Absent on a Pattern created any other way — which is most of them, hence
   * optional rather than an empty array everywhere.
   *
   * Frozen at the moment of conversion: nothing in this file ever adds to it or takes from it, so painting a new
   * color never grows it and erasing one never shrinks it. Deliberately not the same thing as the per-Pattern color
   * table the compact storage encoding builds (patternEncoding.ts), which describes the grid as it stands now; the two
   * differ the moment a color is erased and both are then correct.
   */
  imageColors?: string[]
  /**
   * This Pattern's own maker's name (ticket 182), overriding the device-wide one (domain/makerName.ts) on its exports
   * and its background watermark. Absent by default: a Pattern set no override keeps whatever the device says, even
   * as that changes later, the same way an imported Pattern with no override picks up the importing device's name.
   */
  makerName?: string
  createdAt: number
  updatedAt: number
  /**
   * When the Pattern last reached this device's storage (ticket 145): what orders the Pattern library, most recently
   * saved first. Absent on a Pattern saved before the order existed, whose updatedAt stands in for it (see lastSaved).
   */
  savedAt?: number
}

export interface CreatePatternInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
  technique: Technique
  beadId: string
  /** How big the Pattern is, in beads or in mm/cm — the latter converted once to a grid and not remembered (ADR 0017). */
  size: StatedSize
  /** This Pattern's own maker's name (ticket 182); blank or omitted keeps the device-wide one instead. */
  makerName?: string
}

function createEmptyGrid(columns: number, rows: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({ color: null })),
  )
}

/** Row progress exactly as a freshly created Pattern starts out — also what Delete all (ticket 42) resets it back to. */
const INITIAL_ROW_PROGRESS: RowProgress = { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 }

/** What a new Pattern's stated size and Bead work out to: the Bead, and the grid that implies. */
export interface PatternGeometry extends GridDimensions {
  bead: Bead
}

/**
 * The grid a New Pattern form state implies, or undefined when the Bead isn't in the catalog.
 *
 * Shared with Convert image (ticket 58), whose frame is this same geometry: the frame has to be the grid the Pattern
 * will actually be created at, so both read it from here rather than each converting units and dividing by the Bead's
 * footprint in their own way.
 */
export function patternGeometry(input: CreatePatternInput): PatternGeometry | undefined {
  // findBead looks the id up in the fixed built-in catalog (ADR 0007 / ticket 38).
  const bead = findBead(input.beadId)
  if (!bead) {
    return undefined
  }

  return { bead, ...gridFromSize(input.size, bead) }
}

export function createPattern(input: CreatePatternInput): Pattern {
  const geometry = patternGeometry(input)
  if (!geometry) {
    throw new Error(`Unknown bead id: ${input.beadId}`)
  }

  const { bead, columns, rows } = geometry
  const now = Date.now()
  const name = input.name?.trim() || beadLabel(bead)
  const makerName = normalizeMakerName(input.makerName ?? '')

  return {
    id: crypto.randomUUID(),
    name,
    technique: input.technique,
    beadId: input.beadId,
    columns,
    rows,
    grid: createEmptyGrid(columns, rows),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
    rotation: 0,
    ...(makerName ? { makerName } : {}),
    createdAt: now,
    updatedAt: now,
  }
}

/** A new Pattern made from a picture (CONTEXT.md's Convert image): the same fields as any other, plus what the conversion produced. */
export interface CreatePatternFromImageInput extends CreatePatternInput {
  /** The converted cells, sampled at the Pattern's own grid size (see domain/imageConversion.ts). */
  grid: Grid
  /** The colors that conversion found, saved on the Pattern and never changed afterwards (ADR 0011). */
  imageColors: string[]
}

/**
 * Creates a Pattern from a picture (ticket 58): an ordinary new Pattern in every respect — same name/size/Bead/
 * Technique handling, same fresh Row progress — except that its cells arrive painted and it carries the conversion's
 * Image colors.
 *
 * Conversion is a way of creating a Pattern, never a command on one already open (ADR 0010), so this is the only place
 * Image colors is ever written and there is no Row progress lock, Mirror strip or undo step for it to answer to.
 *
 * The grid is fitted to the dimensions the stated size implies rather than trusted to match: a cell the conversion
 * didn't reach comes back empty and a surplus one is dropped, the same tolerance the stored encoding applies, so a
 * disagreement can never produce a Pattern whose grid and dimensions contradict each other.
 */
export function createPatternFromImage(input: CreatePatternFromImageInput): Pattern {
  const pattern = createPattern(input)

  return {
    ...pattern,
    grid: pattern.grid.map((row, rowIndex) =>
      row.map((cell, columnIndex) => ({ color: input.grid[rowIndex]?.[columnIndex]?.color ?? cell.color })),
    ),
    imageColors: [...input.imageColors],
  }
}

/** Applies a change to a Pattern as a new object, stamping it as just-edited. */
function touch(pattern: Pattern, changes: Partial<Pattern>): Pattern {
  return { ...pattern, ...changes, updatedAt: Date.now() }
}

function clampRow(row: number, rows: number): number {
  return Math.min(rows - 1, Math.max(0, row))
}

/**
 * A Pattern as an older version of the app may have saved it: still carrying the color-to-bead override field ADR
 * 0007/ticket 36 dropped, the stored real-world size (`widthMm`/`heightMm`) ADR 0017 dropped, and rotation as
 * ticket 28's two-position `rotated` boolean rather than ticket 171's four-position `rotation`.
 */
type PatternWithLegacyFields = Pattern & {
  colorBeadOverrides?: unknown
  widthMm?: unknown
  heightMm?: unknown
  rotated?: unknown
}

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270]

/** `rotation` as ticket 171 shipped it, or ticket 28's `rotated` boolean read as its nearest quarter turn, or upright for a Pattern from before either existed. */
function normalizeRotation(pattern: PatternWithLegacyFields): Rotation {
  if (typeof pattern.rotation === 'number' && (ROTATIONS as readonly number[]).includes(pattern.rotation)) {
    return pattern.rotation
  }
  return pattern.rotated ? 90 : 0
}

/**
 * Fills in fields added after a Pattern was first saved, re-clamps the row pointer, and drops the fields nothing
 * reads anymore — the color-to-bead override a Pattern saved before ticket 36 may carry (ADR 0007: a Pattern now has
 * one Bead, not a per-color mapping) and the stored millimetre size (ADR 0017: the grid is the size) — so a Pattern
 * read back from storage or an imported file is safe to use whatever version wrote it, and never re-saves them.
 */
export function normalizePattern(pattern: Pattern): Pattern {
  const rowProgress = pattern.rowProgress ?? { enabled: false, currentRow: 0 }
  const legacy = pattern as PatternWithLegacyFields
  const {
    colorBeadOverrides: _legacyOverrides,
    widthMm: _legacyWidthMm,
    heightMm: _legacyHeightMm,
    rotated: _legacyRotated,
    ...rest
  } = legacy

  return {
    ...rest,
    rowProgress: {
      ...rowProgress,
      direction: rowProgress.direction ?? 'rows',
      currentRow: clampRow(rowProgress.currentRow, pattern.rows),
      currentColumn: clampRow(rowProgress.currentColumn ?? 0, pattern.columns),
    },
    rotation: normalizeRotation(legacy),
  }
}

/** Shows or hides the row-progress overlay, leaving the pointer where it is. */
export function setRowProgressEnabled(pattern: Pattern, enabled: boolean): Pattern {
  return touch(pattern, { rowProgress: { ...pattern.rowProgress, enabled } })
}

/** Steps the view-only rotation (see Pattern.rotation) one quarter turn clockwise, wrapping 270° back to 0° (ticket 171) — like rotating a photo, without touching the grid itself. */
export function toggleRotated(pattern: Pattern): Pattern {
  return touch(pattern, { rotation: nextRotationOf(pattern.rotation) })
}

/** Flips which way the weaver's rows run across the grid (see RowDirection), leaving the grid and the rotated view alone. */
export function toggleRowDirection(pattern: Pattern): Pattern {
  const direction = pattern.rowProgress.direction === 'rows' ? 'columns' : 'rows'
  return touch(pattern, { rowProgress: { ...pattern.rowProgress, direction } })
}

/** Where the weaving has got to, counted in whichever direction its rows run: the row being woven now, and how many rows there are. */
export function rowProgressPosition(pattern: Pattern): { current: number; total: number } {
  const { direction, currentRow, currentColumn } = pattern.rowProgress
  return direction === 'rows'
    ? { current: currentRow, total: pattern.rows }
    : { current: currentColumn, total: pattern.columns }
}

/** Whether a bead sits in a row the weaver has already finished: before the pointer, counted the way rows run. Only while the overlay is on. */
export function isInFinishedRow(pattern: Pick<Pattern, 'rowProgress'>, { row, column }: GridPosition): boolean {
  const { enabled, direction, currentRow, currentColumn } = pattern.rowProgress
  if (!enabled) {
    return false
  }
  return direction === 'rows' ? row < currentRow : column < currentColumn
}

/**
 * Takes back whatever a drawing command did to finished rows (ticket 33): those beads are already woven, so an edit
 * only lands on the row being woven now and the ones after it. An edit left with nothing to change hands back
 * `before` itself, the same "unchanged" signal the drawing commands give, so it records no undo step.
 */
export function keepFinishedRows(before: Pattern, after: Pattern): Pattern {
  const { enabled, direction, currentRow, currentColumn } = before.rowProgress
  // Only a row the edit actually replaced can hold a change, so the others (shared with `before`) are passed over.
  const grid = after.grid.map((cells, row) => {
    const was = before.grid[row]!
    if (!enabled || cells === was) {
      return cells
    }
    if (direction === 'rows') {
      return row < currentRow ? was : cells
    }
    return cells.map((cell, column) => (column < currentColumn ? was[column]! : cell))
  })
  const changed = grid.some(
    (cells, row) => cells !== before.grid[row] && cells.some((cell, column) => cell.color !== before.grid[row]![column]!.color),
  )
  return changed ? { ...after, grid } : before
}

/** Points row progress at the given row in its current direction, clamped to the Pattern — used to advance a finished row and to go back to an earlier one. */
export function moveToRow(pattern: Pattern, row: number): Pattern {
  const { total } = rowProgressPosition(pattern)
  const pointer = pattern.rowProgress.direction === 'rows' ? 'currentRow' : 'currentColumn'
  return touch(pattern, {
    rowProgress: { ...pattern.rowProgress, [pointer]: clampRow(row, total) },
  })
}

/** Swaps in a whole new grid (e.g. to restore a prior snapshot on undo), returning a new Pattern rather than mutating the one passed in. */
export function restoreGrid(pattern: Pattern, grid: Grid): Pattern {
  return touch(pattern, { grid })
}

/**
 * What a Resize (ADR 0017) changes alongside the grid, bundled onto one UndoEntry: the grid's dimensions, plus
 * Mirror's axis counts, which a Resize resets. Mirror's counts are an editing-session setting App.vue owns, not a
 * Pattern field, so restoreSnapshot leaves applying them to the caller — bundled here only so a single history entry
 * carries everything one Undo/Redo step needs.
 */
export interface SizeSnapshot {
  columns: number
  rows: number
  mirrorAxisCounts: MirrorAxisCounts
}

/**
 * One entry on the editing-session undo stack (App.vue): the grid to restore, plus whatever else the command that
 * made it also changed, so a single Undo brings it all back together — Row progress for Delete all (ticket 42, see
 * deleteAll) and Resize (which may clamp its pointers), the Bead for Replace Bead (ticket 48, see replaceBead), the
 * grid's dimensions for Resize. Every other drawing command's entry carries only a grid, leaving the rest as Undo
 * finds it.
 */
export interface UndoEntry {
  grid: Grid
  rowProgress?: RowProgress
  /** Present only for Replace Bead (ticket 48): the Bead to go back to. */
  beadId?: string
  /** Present only for Resize (ADR 0017) — see SizeSnapshot. */
  size?: SizeSnapshot
}

/** Restores a grid, and Row progress/Bead/dimensions alongside it when the undo entry carries them (see UndoEntry) — otherwise the same as restoreGrid. */
export function restoreSnapshot(pattern: Pattern, entry: UndoEntry): Pattern {
  return touch(pattern, {
    grid: entry.grid,
    ...(entry.rowProgress ? { rowProgress: entry.rowProgress } : {}),
    ...(entry.beadId ? { beadId: entry.beadId } : {}),
    ...(entry.size ? { columns: entry.size.columns, rows: entry.size.rows } : {}),
  })
}

function isEmptyGrid(grid: Grid): boolean {
  return grid.every((row) => row.every((cell) => cell.color === null))
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
 * Resets the open Pattern to how it was when first created at its size (CONTEXT.md's Delete all): every cell
 * emptied and Row progress back to its just-created state — off, both pointers at the first row — while name, size,
 * Technique, Bead and rotation stay exactly as they were. Unlike Paint/Fill/Paste/Mirror it ignores the Row
 * progress lock (see isInFinishedRow): clearing progress is the point, so callers apply this directly rather than
 * routing it through keepFinishedRows. Returns the same Pattern instance, unchanged, if it's already in that state.
 */
export function deleteAll(pattern: Pattern): Pattern {
  if (isEmptyGrid(pattern.grid) && isInitialRowProgress(pattern.rowProgress)) {
    return pattern
  }

  return touch(pattern, {
    grid: createEmptyGrid(pattern.columns, pattern.rows),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
  })
}

/**
 * Swaps the Pattern's Bead for a different catalog entry (ticket 48, ADR 0017). Nothing else changes: the grid, its
 * columns and rows, every painted cell, Row progress and Mirror all stay exactly as they were, since the grid is the
 * Pattern's size and only its Estimated size depends on the Bead. Someone who wants the old size back afterwards
 * adds or removes rows and columns (see resizePattern).
 */
export function replaceBead(pattern: Pattern, bead: Bead): Pattern {
  return touch(pattern, { beadId: bead.id })
}

/**
 * Every cell reachable from `start` through same-colored neighbors, per the Pattern's grid adjacency (see
 * neighborsOf) -- the flood region a click at `start` would act on. Used by Fill (fillArea), including right-click
 * erase under Fill (ticket 25), which calls fillArea with a null color.
 */
function floodRegionKeys(pattern: Pick<Pattern, 'grid' | 'technique' | 'columns' | 'rows'>, start: GridPosition): Set<string> {
  const targetColor = pattern.grid[start.row]?.[start.column]?.color
  const dimensions = { columns: pattern.columns, rows: pattern.rows }
  const visited = new Set<string>()
  const region = new Set<string>()
  if (targetColor === undefined) {
    return region
  }

  const stack = [start]
  while (stack.length > 0) {
    const position = stack.pop()!
    const key = positionKey(position)
    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    if (pattern.grid[position.row]?.[position.column]?.color !== targetColor) {
      continue
    }
    region.add(key)
    stack.push(...neighborsOf(pattern.technique, dimensions, position))
  }

  return region
}

/** Bucket-fills every cell reachable from (row, column) through same-colored neighbors (see floodRegionKeys), with the given color. Returns the same Pattern instance, unchanged, if the clicked cell is already that color. */
export function fillArea(pattern: Pattern, row: number, column: number, color: string | null): Pattern {
  const targetColor = pattern.grid[row]?.[column]?.color
  if (targetColor === undefined || targetColor === color) {
    return pattern
  }

  const region = floodRegionKeys(pattern, { row, column })
  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, columnIndex) => (region.has(positionKey({ row: rowIndex, column: columnIndex })) ? { color } : cell)),
  )

  return restoreGrid(pattern, grid)
}

/**
 * Every cell a live-mirrored stroke touches when painting `position` (ADR 0006/ticket 22, generalized to
 * per-direction axis *counts* by ticket 44): itself, plus its reflection(s) across every Mirror axis, fixed to the
 * grid's exact center(s) rather than mirrorCurrent's adaptive "fullest strip" heuristic (there's no drawn-so-far
 * content to judge a source strip from mid-stroke). `axes.columns` splits the grid across its columns
 * ("horizontal"), `axes.rows` across its rows ("vertical"); see domain/mirror.ts for the strip math and why counts
 * are grid-space, never screen-space. `copyMode` (ticket 45) is one switch for both directions: strips repeat the
 * same way round (A | A | A) instead of mirror-imaging (A | A' | A).
 */
export function mirroredCells(
  pattern: Pick<Pattern, 'rows' | 'columns'>,
  position: GridPosition,
  axes: MirrorAxisCounts,
  copyMode = false,
): GridPosition[] {
  const rows = mirrorCounterparts(position.row, pattern.rows, axes.rows, copyMode)
  const columns = mirrorCounterparts(position.column, pattern.columns, axes.columns, copyMode)

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
 * Pattern edit, so a whole stroke — mirrored or not, one cell or a whole dragged path (ticket 24) — is one undo
 * step rather than one per cell. Returns the same Pattern instance, unchanged, if every touched cell is already
 * that color.
 */
export function paintCells(
  pattern: Pattern,
  positions: GridPosition[],
  color: string | null,
  axes: MirrorAxisCounts,
  copyMode = false,
): Pattern {
  const targets = new Map<string, GridPosition>()
  for (const position of positions) {
    for (const cell of mirroredCells(pattern, position, axes, copyMode)) {
      targets.set(positionKey(cell), cell)
    }
  }

  const changed = [...targets.values()].some(
    ({ row, column }) => pattern.grid[row]?.[column]?.color !== color,
  )
  if (!changed) {
    return pattern
  }

  // Only the rows a stroke touched are copied: the others are the very arrays the Pattern already had, so an edit costs
  // what it touched, not the size of the Pattern (and whatever compares two Patterns can tell those rows are the same by
  // looking no further than the array).
  const columnsByRow = new Map<number, Set<number>>()
  for (const { row, column } of targets.values()) {
    const columns = columnsByRow.get(row) ?? new Set<number>()
    columns.add(column)
    columnsByRow.set(row, columns)
  }
  const grid = pattern.grid.map((gridRow, rowIndex) => {
    const columns = columnsByRow.get(rowIndex)
    return columns ? gridRow.map((cell, columnIndex) => (columns.has(columnIndex) ? { color } : cell)) : gridRow
  })

  return restoreGrid(pattern, grid)
}

/** How many painted cells (non-null color) fall in each strip (0-indexed, 0..axisCount) along `axis`, per the same "as equal as possible" split domain/mirror.ts's strip math uses. */
function paintedCountsByStrip(grid: Grid, dimension: number, axis: 'columns' | 'rows', axisCount: number): number[] {
  const counts = new Array(axisCount + 1).fill(0)
  grid.forEach((gridRow, rowIndex) => {
    gridRow.forEach((cell, columnIndex) => {
      if (cell.color === null) {
        return
      }
      const index = axis === 'columns' ? columnIndex : rowIndex
      counts[stripOf(index, dimension, axisCount)]++
    })
  })
  return counts
}

/**
 * "Mirror current" (ticket 46, ADR 0006 amendment): a one-time sync of what's already painted along ONE direction,
 * using that direction's own axis count -- the other direction is left alone entirely, matching how the per-axis
 * buttons have always worked (see onMirrorCurrent in App.vue). The strip holding the most painted cells becomes the
 * source and is copied onto every other strip, mirrored by default or unflipped in copy mode (see
 * mirrorCounterpartInStrip). Ties go to the lowest strip index (leftmost/topmost).
 *
 * A count of 0 acts as a single center axis (1 axis, 2 strips) purely for this one sync -- the stored axis count
 * itself is untouched -- so the button always does something even before any axis is turned on.
 */
export function mirrorCurrent(
  pattern: Pattern,
  axis: 'columns' | 'rows',
  axisCount: number,
  copyMode: boolean,
): Pattern {
  const dimension = axis === 'columns' ? pattern.columns : pattern.rows
  const effectiveAxisCount = axisCount === 0 ? 1 : axisCount

  const counts = paintedCountsByStrip(pattern.grid, dimension, axis, effectiveAxisCount)
  const sourceStrip = counts.reduce((best, count, strip) => (count > counts[best]! ? strip : best), 0)

  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, columnIndex) => {
      const index = axis === 'columns' ? columnIndex : rowIndex
      if (stripOf(index, dimension, effectiveAxisCount) === sourceStrip) {
        return cell
      }

      const sourceIndex = mirrorCounterpartInStrip(index, dimension, effectiveAxisCount, copyMode, sourceStrip)
      const sourceCell = axis === 'columns' ? pattern.grid[rowIndex]![sourceIndex]! : pattern.grid[sourceIndex]![columnIndex]!
      return { color: sourceCell.color }
    }),
  )

  return restoreGrid(pattern, grid)
}

/**
 * Every cell whose color differs between two same-shaped grids -- what the "Mirror current" hover preview (ticket
 * 47) dims: the cells a click would actually overwrite, and nothing else. Kept here as a plain domain function
 * (rather than inline in App.vue) so it's unit-testable on its own and matches this file's other grid-diffing
 * helpers, e.g. keepFinishedRows above and paintedCountsByStrip's own cell-by-cell walk.
 */
export function changedCells(before: Grid, after: Grid): GridPosition[] {
  const changed: GridPosition[] = []
  after.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (cell.color !== before[rowIndex]![columnIndex]!.color) {
        changed.push({ row: rowIndex, column: columnIndex })
      }
    })
  })
  return changed
}

/** A short, language-neutral identifier for a Pattern in UI lists (names are proper nouns, not translated); reflects the rotated view's swapped dimensions, since that's how the Pattern currently looks. */
export function summarizePattern(pattern: Pattern): string {
  const [width, height] = rotationSwapsAxes(pattern.rotation) ? [pattern.rows, pattern.columns] : [pattern.columns, pattern.rows]
  return `${pattern.name} · ${width}×${height}`
}

/**
 * The Bead a Pattern was woven from (ticket 37), or undefined when the catalog no longer has it — a custom Bead
 * removed since (ticket 38), or one an imported file names that this device never had. Callers show a neutral
 * placeholder for the undefined case rather than a raw id.
 */
export function resolvePatternBead(pattern: Pattern): Bead | undefined {
  return findBead(pattern.beadId)
}

/** When a Pattern was last saved, for ordering the library: its updatedAt when it predates savedAt (ticket 145). */
export function lastSaved(pattern: Pattern): number {
  return pattern.savedAt ?? pattern.updatedAt
}

/** Stamps a Pattern as saved just now: the library's front (ticket 145). */
export function markSaved(pattern: Pattern, at = Date.now()): Pattern {
  return { ...pattern, savedAt: at }
}

/**
 * The Pattern library's order (ticket 145): most recently saved first; saved at the same moment, most recently edited
 * first; and otherwise as they were, so a library read twice comes out the same twice.
 */
export function inSavedOrder(patterns: Pattern[]): Pattern[] {
  return patterns
    .map((pattern, index) => ({ pattern, index }))
    .sort((a, b) => lastSaved(b.pattern) - lastSaved(a.pattern) || b.pattern.updatedAt - a.pattern.updatedAt || a.index - b.index)
    .map(({ pattern }) => pattern)
}

export function mostRecentlyUpdated(patterns: Pattern[]): Pattern | undefined {
  return patterns.reduce<Pattern | undefined>(
    (latest, pattern) => (!latest || pattern.updatedAt > latest.updatedAt ? pattern : latest),
    undefined,
  )
}
