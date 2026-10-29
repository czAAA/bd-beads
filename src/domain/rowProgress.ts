import { changedPositions, colorAt, frameContains, withColors, type BeadChange, type FrameSheet } from './canvas'
import { rowOrderOf, type ShapedSheet } from './frameShape'
import type { GridPosition } from './grid'
import { sameBeads } from './layerBeads'
import { beadsOfLayer, frameOf, type Layered, withFrameSheet, withLayer } from './layerRecord'
import { frameGeometryOf } from './layers'
import { frameWeave } from './layerWeave'
import { touch, type Project, type RowProgress } from './project'
import type { RowOrder, RowWay } from './rowOrder'
import type { AreaLine } from './removeLine'

// Row progress (CONTEXT.md): which pass of the Frame's Row order the weaver is on, the lock on finished rows, and
// reading the pointers back from a stored Project.

/** Row progress exactly as a freshly created Project starts out — also what Delete all (ticket 42) resets it back
 * to. */
export const INITIAL_ROW_PROGRESS: RowProgress = { direction: 'rows', currentRow: 0, currentColumn: 0 }

/** The Frame's Row progress (ADR 0079): where its weaver is; a Canvas without a Frame is at the first row. */
export function rowProgressOf(project: Layered): RowProgress {
  return frameOf(project)?.rowProgress ?? INITIAL_ROW_PROGRESS
}

/** The Project with its Frame's Row progress set, stamped as a change; the same Project without a Frame. */
function withRowProgress(project: Project, rowProgress: RowProgress): Project {
  const frame = frameOf(project)
  return frame ? touch(withFrameSheet(project, { ...frame, rowProgress }), {}) : project
}

/** Whether Row progress is already exactly the just-created state (see INITIAL_ROW_PROGRESS), so deleteAll has
 * nothing left to reset. */
export function isInitialRowProgress(rowProgress: RowProgress): boolean {
  return (
    rowProgress.direction === INITIAL_ROW_PROGRESS.direction &&
    !rowProgress.reversed &&
    !rowProgress.currentRowBack &&
    !rowProgress.currentColumnBack &&
    rowProgress.currentRow === INITIAL_ROW_PROGRESS.currentRow &&
    rowProgress.currentColumn === INITIAL_ROW_PROGRESS.currentColumn
  )
}

/** Whether Row progress is on: exactly when there is a Frame to count rows on (ticket 434, ADR 0055), of any kind (a
 * Custom frame's Row order, ticket 0594). Derived, never stored, so setting a Frame needn't remember it; an old file's
 * saved flag is ignored. */
export const rowProgressOn = (project: Layered): boolean => frameOf(project) !== undefined

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
function passesOf(sheet: ShapedSheet, way: RowWay): number {
  return rowOrderOf(sheet, way).count
}

/** The bottom to top and right to left pointers inside the Frame; absent while neither has moved. */
function clampedBack(rowProgress: Partial<RowProgress>, sheet: ShapedSheet): Partial<RowProgress> {
  const { currentRowBack, currentColumnBack } = rowProgress
  return {
    ...(currentRowBack ? { currentRowBack: clampRow(currentRowBack, passesOf(sheet, { direction: 'rows', reversed: true })) } : {}),
    ...(currentColumnBack ? { currentColumnBack: clampRow(currentColumnBack, passesOf(sheet, { direction: 'columns', reversed: true })) } : {}),
  }
}

/** Row progress with both pointers (the row and the column being woven) inside the Frame; the one clamp a Frame
 * change uses. */
export function clampPointer(rowProgress: RowProgress, sheet: ShapedSheet): RowProgress {
  return {
    ...rowProgress,
    currentRow: clampRow(rowProgress.currentRow, passesOf(sheet, { direction: 'rows' })),
    currentColumn: clampRow(rowProgress.currentColumn, passesOf(sheet, { direction: 'columns' })),
    ...clampedBack(rowProgress, sheet),
  }
}

/** What a Frame's Row order is built from beside its rectangle and Weave: its Frame shape, a Custom frame's settings and turn. */
function laidOf(frame: FrameSheet | undefined): Pick<ShapedSheet, 'shape' | 'settings' | 'quarterTurns'> {
  return { shape: frame?.shape, settings: frame?.settings, quarterTurns: frame?.quarterTurns }
}

/** Row progress as a stored Project holds it, read inside its Frame (or the box round its beads): an old file's
 * `enabled` and `decided` are dropped, as Row progress follows the Frame (ticket 426, 434), and every pointer is
 * clamped to the passes. */
export function readRowProgress(stored: (Partial<RowProgress> & { currentRow: number }) | undefined, sheet: ShapedSheet): RowProgress {
  const rowProgress: Partial<RowProgress> & { currentRow: number } = stored ?? { currentRow: 0 }
  const turns = rowOrderOf(sheet, { direction: 'rows' }).turns
  return {
    // Turn row direction isn't offered where the Row order is worked one way only (a Custom frame, ticket 0594).
    direction: turns ? (rowProgress.direction ?? 'rows') : 'rows',
    currentRow: clampRow(rowProgress.currentRow, passesOf(sheet, { direction: 'rows' })),
    currentColumn: clampRow(rowProgress.currentColumn ?? 0, passesOf(sheet, { direction: 'columns' })),
    ...(turns && rowProgress.reversed === true ? { reversed: true } : {}),
    ...clampedBack(rowProgress, sheet),
  }
}

/** Whether Row progress is on and a pass is done: the Frame is then held still, since the passes belong to it
 * (ticket 411). */
export function rowProgressStarted(project: Layered): boolean {
  const { currentRow, currentColumn, currentRowBack, currentColumnBack } = rowProgressOf(project)
  return rowProgressOn(project) && (currentRow > 0 || currentColumn > 0 || !!currentRowBack || !!currentColumnBack)
}

/** The four pointers and the way each counts (ticket 0589). */
const POINTER_WAYS: readonly (readonly [PointerKey, RowWay])[] = [
  ['currentRow', { direction: 'rows' }],
  ['currentColumn', { direction: 'columns' }],
  ['currentRowBack', { direction: 'rows', reversed: true }],
  ['currentColumnBack', { direction: 'columns', reversed: true }],
]

/** Whether a Frame line is one of the rows worked `way`, rather than a line across them. */
export const lineRunsAlong = (line: AreaLine, way: RowWay): boolean => (line.axis === 'row') === (way.direction === 'rows')

/** The beads of a Frame line in passes finished `way` (the way the rows run now unless given): how many, and how many
 * passes they make up. */
export function finishedOnLine(project: Layered, line: AreaLine, way: RowWay = rowProgressOf(project)): { beads: number; passes: number } {
  const { rows = 0, columns = 0 } = frameOf(project) ?? {}
  const pointer = rowProgressOf(project)[pointerKey(way)] ?? 0
  const order = rowOrderOf({ ...frameWeave(project), ...laidOf(frameOf(project)), rows, columns }, way)
  const length = line.axis === 'row' ? columns : rows
  const at = (along: number) => (line.axis === 'row' ? { row: line.index, column: along } : { row: along, column: line.index })
  const finished = Array.from({ length }, (_bead, along) => order.passAt(at(along))).filter((pass) => pass < pointer)
  return { beads: finished.length, passes: new Set(finished).size }
}

/** Row progress once a line of the Frame is taken out (Remove line, ticket 0647, ADR 0055): each way whose rows run
 * along it goes back by that row's finished passes, so the rows after it, moved up, stay finished; a line across the
 * rows leaves them finished, a bead short. */
export function progressWithoutLine(project: Layered, line: AreaLine): RowProgress {
  const rowProgress = { ...rowProgressOf(project) }
  for (const [key, way] of POINTER_WAYS) {
    const { passes } = lineRunsAlong(line, way) ? finishedOnLine(project, line, way) : { passes: 0 }
    if (passes > 0) rowProgress[key] = (rowProgress[key] ?? 0) - passes
  }
  return rowProgress
}

/** Takes Row progress back to the first row in both directions, keeping the direction (ticket 455); the grid is
 * untouched. */
export function resetRowProgress(project: Project): Project {
  return withRowProgress(project, firstPasses(rowProgressOf(project)))
}

/** Which way the rows run on the Canvas, as an arrow points: down is top to bottom. */
export type ShownWay = 'down' | 'left' | 'up' | 'right'

/** The ways in the order a quarter turn clockwise takes each to the next. */
const CLOCKWISE: readonly ShownWay[] = ['down', 'left', 'up', 'right']

/** Which way the rows run as the Frame lies (ticket 0667, ADR 0079): its own way (top to bottom, left to right and back),
 * turned with the Frame on the Canvas, whose own rows and pointers do not change. */
export function shownWay({ direction, reversed }: Pick<RowProgress, 'direction' | 'reversed'>, quarterTurns = 0): ShownWay {
  const own: ShownWay = direction === 'rows' ? (reversed ? 'up' : 'down') : reversed ? 'left' : 'right'
  return CLOCKWISE[(CLOCKWISE.indexOf(own) + quarterTurns) % 4]!
}

/** Flips which way the weaver's rows run across the grid (see RowDirection), leaving the grid and the rotated view
 * alone. */
export function toggleRowDirection(project: Project): Project {
  if (!frameRowOrder(project).turns) {
    return project
  }
  const { direction, reversed } = rowProgressOf(project)
  // The four ways in turn: top to bottom, left to right, bottom to top, right to left (ticket 0589).
  const next = direction === 'rows'
    ? { direction: 'columns' as const, reversed }
    : { direction: 'rows' as const, reversed: reversed ? undefined : true }
  return withRowProgress(project, { ...rowProgressOf(project), ...next })
}

/** Where the weaving has got to, counted in whichever direction its rows run: the row being woven now, and how many
 * rows the Frame has. */
export function rowProgressPosition(project: Layered): { current: number; total: number } {
  return { current: currentPass(rowProgressOf(project)), total: frameRowOrder(project).count }
}


/** The Frame's Row order (spec 0590), worked the way the weaver's rows run now: the one thing Row progress asks how
 * passes go. A Canvas with no Frame has no passes, counted in its own Weave. */
export function frameRowOrder(project: Layered): RowOrder {
  const { rows = 0, columns = 0 } = frameOf(project) ?? {}
  return rowOrderOf({ ...frameWeave(project), ...laidOf(frameOf(project)), rows, columns }, rowProgressOf(project))
}

/** The pass that weaves a bead of the Frame, or undefined for a position outside it or on the Canvas. `order` is the
 * Frame's Row order, for a caller that has it already. */
function framePassAt(project: Layered, position: GridPosition, order: () => RowOrder = () => frameRowOrder(project)): number | undefined {
  const frame = frameOf(project)
  // Row progress covers the Frame only: beads outside it stay editable whatever row the weaver is on.
  if (!frame || position.layer === 'canvas') {
    return undefined
  }
  const own = { row: position.row - frame.row, column: position.column - frame.column }
  // Its rectangle and its positions: a Custom frame's are named by round and place and reach past it
  // (ticket 0594); its Row order puts none of the rectangle's others in a pass.
  if (!frameContains(frame, position) && !frameGeometryOf(project).hasPosition(own)) {
    return undefined
  }
  return order().passAt(own)
}

/** Whether a bead sits in a row the weaver has already finished: its pass (a whole line, or half of one on peyote)
 * is before the pointer, lines counted the way rows run from the Frame's first. Only while the overlay is on and a
 * Frame is set. */
export function isInFinishedRow(project: Layered, position: GridPosition): boolean {
  const pass = framePassAt(project, position)
  return pass !== undefined && pass < currentPass(rowProgressOf(project))
}

/** `isInFinishedRow` for many positions at once (ticket 0675): the Frame's Row order worked out once, not for each, for
 * a paste preview that asks of every bead it shows. */
export function finishedRowsOf(project: Layered): (position: GridPosition) => boolean {
  const current = currentPass(rowProgressOf(project))
  if (!frameOf(project) || current === 0) return () => false
  let order: RowOrder | undefined
  return (position) => {
    const pass = framePassAt(project, position, () => (order ??= frameRowOrder(project)))
    return pass !== undefined && pass < current
  }
}

/** Whether each bead of a draw sits in a finished pass or the current one (ticket 0676): `isInFinishedRow` and
 * `isInCurrentRow` with the Frame's Row order worked out once, not for each of the thousands of beads drawn. */
export function rowPassesOf(project: Layered): (position: GridPosition) => 'finished' | 'current' | undefined {
  const current = currentPass(rowProgressOf(project))
  if (!frameOf(project)) return () => undefined
  let order: RowOrder | undefined
  return (position) => {
    const pass = framePassAt(project, position, () => (order ??= frameRowOrder(project)))
    return pass === undefined ? undefined : pass < current ? 'finished' : pass === current ? 'current' : undefined
  }
}

/** Whether a bead sits in the pass the weaver is on now (ticket 352): the same pass the pointer points at, so the
 * current row is drawn brighter. Only while the overlay is on and a Frame is set.
 * @internal The renderer asks `rowPassesOf` (ticket 0676); tests and the visual check ask of one bead. */
export function isInCurrentRow(project: Layered, position: GridPosition): boolean {
  const pass = framePassAt(project, position)
  return pass !== undefined && pass === currentPass(rowProgressOf(project))
}

/** Takes back what a drawing command did to finished rows (ticket 33): those beads are already woven, and they are the
 * Frame's, since the Canvas has no rows to finish (ADR 0066). Nothing left to change returns `before` itself, the
 * drawing commands' "unchanged" signal, so no undo step is recorded. */
export function keepFinishedRows(before: Project, after: Project): Project {
  const frame = frameOf(before)
  const [was, now] = [beadsOfLayer(before, 'frame'), beadsOfLayer(after, 'frame')]
  if (!frame || !was || !now || now === was) {
    return sameBeads(before, after) ? before : after
  }
  const reverts: BeadChange[] = changedPositions(was, now)
    .filter(({ row, column }) => isInFinishedRow(before, { row: row + frame.row, column: column + frame.column, layer: 'frame' }))
    .map(({ row, column }) => ({ row, column, color: colorAt(was, row, column) }))
  const kept = reverts.length === 0 ? after : withLayer(after, 'frame', { beads: withColors(now, reverts) })
  return sameBeads(before, kept) ? before : kept
}

/** Points row progress at the given row in its current direction, clamped to the Project — used to advance a
 * finished row and to go back to an earlier one. */
export function moveToRow(project: Project, row: number): Project {
  const { total } = rowProgressPosition(project)
  return withRowProgress(project, { ...rowProgressOf(project), [pointerKey(rowProgressOf(project))]: clampRow(row, total) })
}
