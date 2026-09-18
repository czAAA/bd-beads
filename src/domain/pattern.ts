import { beadLabel, findBead, type Bead } from './beads'
import {
  computeGridDimensions,
  neighborsOf,
  positionKey,
  toMillimeters,
  type GridDimensions,
  type GridPosition,
  type SizeUnit,
  type Technique,
} from './grid'
import { mirrorCounterpartInStrip, mirrorCounterparts, stripOf, type MirrorAxisCounts } from './mirror'

export type { MirrorAxisCounts } from './mirror'

export type { Technique } from './grid'

export interface Cell {
  color: string | null
}

export type Grid = Cell[][]

/**
 * Which way the weaver's rows run across the grid (ticket 32): along the grid's rows, or down its columns. Separate
 * from Pattern.rotated, which only turns the picture: after rotating, the grid's columns are what run across the
 * screen, so the weaver flips this too, but neither setting ever changes the other.
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
  widthMm: number
  heightMm: number
  columns: number
  rows: number
  grid: Grid
  rowProgress: RowProgress
  /**
   * A view-only orientation flip (ticket 28): true shows the Pattern turned 90°, like a rotated photo. Purely
   * cosmetic — the grid, technique geometry, and every other field stay exactly as woven; only the on-screen (and
   * printed/exported) presentation turns. Deliberately not a data transform: for Peyote/Brick, the offset stagger is
   * tied to weave direction, so actually transposing the grid would change which cells are adjacent — a different,
   * unweavable schema, not the same picture turned sideways.
   */
  rotated: boolean
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
  createdAt: number
  updatedAt: number
}

export interface CreatePatternInput {
  /** User-chosen name; blank or omitted defaults to the bead's label. */
  name?: string
  technique: Technique
  beadId: string
  size: { width: number; height: number; unit: SizeUnit }
}

function createEmptyGrid(columns: number, rows: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({ color: null })),
  )
}

/** Row progress exactly as a freshly created Pattern starts out — also what Delete all (ticket 42) resets it back to. */
const INITIAL_ROW_PROGRESS: RowProgress = { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 }

/** What a new Pattern's stated size, Bead and Technique work out to: its real-world size in mm and the grid that implies. */
export interface PatternGeometry extends GridDimensions {
  bead: Bead
  widthMm: number
  heightMm: number
}

/**
 * The real-world size and grid a New Pattern form state implies, or undefined when the Bead isn't in the catalog.
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

  const widthMm = toMillimeters(input.size.width, input.size.unit)
  const heightMm = toMillimeters(input.size.height, input.size.unit)

  return { bead, widthMm, heightMm, ...computeGridDimensions({ widthMm, heightMm }, bead) }
}

export function createPattern(input: CreatePatternInput): Pattern {
  const geometry = patternGeometry(input)
  if (!geometry) {
    throw new Error(`Unknown bead id: ${input.beadId}`)
  }

  const { bead, widthMm, heightMm, columns, rows } = geometry
  const now = Date.now()
  const name = input.name?.trim() || beadLabel(bead)

  return {
    id: crypto.randomUUID(),
    name,
    technique: input.technique,
    beadId: input.beadId,
    widthMm,
    heightMm,
    columns,
    rows,
    grid: createEmptyGrid(columns, rows),
    rowProgress: { ...INITIAL_ROW_PROGRESS },
    rotated: false,
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

/** A Pattern as an older version of the app may have saved it: still carrying the color-to-bead override field ADR 0007/ticket 36 dropped. */
type PatternWithLegacyFields = Pattern & { colorBeadOverrides?: unknown }

/**
 * Fills in fields added after a Pattern was first saved, re-clamps the row pointer, and drops the color-to-bead
 * override field a Pattern saved before ticket 36 may still carry (ADR 0007: a Pattern now has one Bead, not a
 * per-color mapping) — so a Pattern read back from storage or an imported file is safe to use whatever version wrote
 * it, and never re-saves a field nothing reads anymore.
 */
export function normalizePattern(pattern: Pattern): Pattern {
  const rowProgress = pattern.rowProgress ?? { enabled: false, currentRow: 0 }
  const { colorBeadOverrides: _legacyOverrides, ...rest } = pattern as PatternWithLegacyFields

  return {
    ...rest,
    rowProgress: {
      ...rowProgress,
      direction: rowProgress.direction ?? 'rows',
      currentRow: clampRow(rowProgress.currentRow, pattern.rows),
      currentColumn: clampRow(rowProgress.currentColumn ?? 0, pattern.columns),
    },
    rotated: pattern.rotated ?? false,
  }
}

/** Shows or hides the row-progress overlay, leaving the pointer where it is. */
export function setRowProgressEnabled(pattern: Pattern, enabled: boolean): Pattern {
  return touch(pattern, { rowProgress: { ...pattern.rowProgress, enabled } })
}

/** Flips the view-only rotated flag (see Pattern.rotated) — turns the Pattern's on-screen presentation 90°, like rotating a photo, without touching the grid itself. */
export function toggleRotated(pattern: Pattern): Pattern {
  return touch(pattern, { rotated: !pattern.rotated })
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
export function isInFinishedRow(pattern: Pattern, { row, column }: GridPosition): boolean {
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
  const grid = after.grid.map((cells, row) =>
    cells.map((cell, column) => (isInFinishedRow(before, { row, column }) ? before.grid[row]![column]! : cell)),
  )
  const changed = grid.some((cells, row) =>
    cells.some((cell, column) => cell.color !== before.grid[row]![column]!.color),
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
 * What Replace Bead (ticket 48) changes alongside the grid, bundled onto one UndoEntry: the Bead id and the grid
 * size it implied, plus Mirror's axis counts. Mirror's counts are an editing-session setting App.vue owns, not a
 * Pattern field, so restoreSnapshot leaves applying them to the caller — bundled here only so a single history
 * entry carries everything one Undo/Redo step needs.
 */
export interface ReplaceBeadSnapshot {
  beadId: string
  columns: number
  rows: number
  mirrorAxisCounts: MirrorAxisCounts
}

/**
 * One entry on the editing-session undo stack (App.vue): the grid to restore, plus Row progress for the commands
 * that reset that too alongside the grid — Delete all (ticket 42, see deleteAll) and Replace Bead (ticket 48, see
 * replaceBead) — so a single Undo brings both back together. Every other drawing command's entry carries only a
 * grid, leaving Row progress as Undo finds it.
 */
export interface UndoEntry {
  grid: Grid
  rowProgress?: RowProgress
  /** Present only for Replace Bead (ticket 48) — see ReplaceBeadSnapshot. */
  bead?: ReplaceBeadSnapshot
}

/** Restores a grid, and Row progress/Bead alongside it when the undo entry carries them (see UndoEntry) — otherwise the same as restoreGrid. */
export function restoreSnapshot(pattern: Pattern, entry: UndoEntry): Pattern {
  return touch(pattern, {
    grid: entry.grid,
    ...(entry.rowProgress ? { rowProgress: entry.rowProgress } : {}),
    ...(entry.bead ? { beadId: entry.bead.beadId, columns: entry.bead.columns, rows: entry.bead.rows } : {}),
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
 * Nearest-cell resampling from one grid size to another (Replace Bead, ticket 48): each cell in the new grid maps
 * back proportionally to a cell in the old one, so the existing design carries over approximately rather than being
 * cropped or left blank on a resize. Identity when `to` equals `from`.
 */
function rescaleGrid(grid: Grid, from: GridDimensions, to: GridDimensions): Grid {
  return Array.from({ length: to.rows }, (_, row) => {
    const sourceRow = Math.min(from.rows - 1, Math.floor((row * from.rows) / to.rows))
    return Array.from({ length: to.columns }, (_, column) => {
      const sourceColumn = Math.min(from.columns - 1, Math.floor((column * from.columns) / to.columns))
      return { color: grid[sourceRow]![sourceColumn]!.color }
    })
  })
}

/**
 * The grid size Replace Bead (ticket 48, ADR 0008) would resize to if `bead` were confirmed: the new Bead's
 * footprint applied at the Pattern's current real-world size (which stays fixed) — see replaceBead for the actual
 * swap. Used to show what will change before the user confirms.
 */
export function previewReplaceBead(pattern: Pattern, bead: Bead): GridDimensions {
  return computeGridDimensions({ widthMm: pattern.widthMm, heightMm: pattern.heightMm }, bead)
}

/**
 * Swaps the Pattern's Bead for a different catalog entry (ticket 48, ADR 0008). Real-world size (mm) stays fixed,
 * so columns/rows are recomputed from the new Bead's footprint via the same math createPattern uses (see
 * computeGridDimensions), and existing colors are rescaled onto the new grid (see rescaleGrid) rather than cropped.
 * Row progress resets to its just-created state, the same target deleteAll uses, since a row count that may no
 * longer exist makes the old pointer meaningless. Mirror's axis counts are not a Pattern field (see UndoEntry.bead)
 * — resetting those alongside this is the caller's job.
 */
export function replaceBead(pattern: Pattern, bead: Bead): Pattern {
  const dimensions = computeGridDimensions({ widthMm: pattern.widthMm, heightMm: pattern.heightMm }, bead)
  const grid = rescaleGrid(pattern.grid, { columns: pattern.columns, rows: pattern.rows }, dimensions)

  return touch(pattern, {
    beadId: bead.id,
    columns: dimensions.columns,
    rows: dimensions.rows,
    grid,
    rowProgress: { ...INITIAL_ROW_PROGRESS },
  })
}

/** Bucket-fills every cell reachable from (row, column) through same-colored neighbors, per the Pattern's grid adjacency (see neighborsOf), with the given color. Returns the same Pattern instance, unchanged, if the clicked cell is already that color. */
export function fillArea(pattern: Pattern, row: number, column: number, color: string | null): Pattern {
  const targetColor = pattern.grid[row]?.[column]?.color
  if (targetColor === undefined || targetColor === color) {
    return pattern
  }

  const dimensions = { columns: pattern.columns, rows: pattern.rows }
  const visited = new Set<string>()
  const toPaint = new Set<string>()
  const stack = [{ row, column }]

  while (stack.length > 0) {
    const position = stack.pop()!
    const key = `${position.row},${position.column}`
    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    if (pattern.grid[position.row]?.[position.column]?.color !== targetColor) {
      continue
    }
    toPaint.add(key)
    stack.push(...neighborsOf(pattern.technique, dimensions, position))
  }

  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, columnIndex) => (toPaint.has(`${rowIndex},${columnIndex}`) ? { color } : cell)),
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

  const grid = pattern.grid.map((gridRow, rowIndex) =>
    gridRow.map((cell, columnIndex) =>
      targets.has(positionKey({ row: rowIndex, column: columnIndex })) ? { color } : cell,
    ),
  )

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
  const [width, height] = pattern.rotated ? [pattern.rows, pattern.columns] : [pattern.columns, pattern.rows]
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

export function mostRecentlyUpdated(patterns: Pattern[]): Pattern | undefined {
  return patterns.reduce<Pattern | undefined>(
    (latest, pattern) => (!latest || pattern.updatedAt > latest.updatedAt ? pattern : latest),
    undefined,
  )
}
