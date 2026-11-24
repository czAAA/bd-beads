import { colorAt, forEachChangedPosition, frameContains, withColors, type BeadChange, type FrameSheet } from './canvas'
import { frameShapeOf, rowOrderOf, type ShapedSheet } from './frameShape'
import { isFrameLayer, type FrameRef, type GridPosition, type Rotation } from './grid'
import { sameBeads } from './layerBeads'
import { beadsOfLayer, FIRST_FRAME, frameById, framesOf, refOfFrame, type Layered, withLayer } from './layerRecord'
import { touchFrameSheet } from './frameSheet'
import { frameGeometryOf } from './layers'
import type { LayerGeometry } from './layerGeometry'
import { frameWeave } from './layerWeave'
import type { Project, RowProgress } from './project'
import type { RowOrder, RowWay } from './rowOrder'
import { ownRowWay, seenWayOfOwn, turnedWay, type SeenWay } from './rowWays'
import { frameQuarterTurnOf } from './table'
import type { AreaLine } from './removeLine'
import type { PassDirection } from './weaveGeometry'

// Row progress (CONTEXT.md): which pass of the Frame's Row order the weaver is on, the lock on finished rows, and
// reading the pointers back from a stored Project.

/** Row progress exactly as a freshly created Project starts out — also what Delete all (ticket 42) resets it back
 * to. */
export const INITIAL_ROW_PROGRESS: RowProgress = { way: 'down' }

/** The Frame's Row progress (ADR 0079): where its weaver is; a Canvas without a Frame is at the first row. */
export function rowProgressOf(project: Layered, ref: FrameRef = FIRST_FRAME): RowProgress {
  return frameById(project, ref)?.rowProgress ?? INITIAL_ROW_PROGRESS
}

/** The Project with its Frame's Row progress set, stamped as a change; the same Project without a Frame. */
function withRowProgress(project: Project, ref: FrameRef, rowProgress: RowProgress): Project {
  const frame = frameById(project, ref)
  return frame ? touchFrameSheet(project, { ...frame, rowProgress }, { frame: ref }) : project
}

/** The four ways as seen, each with its own pointer (ticket 0589). */
const SEEN_WAYS: readonly SeenWay[] = ['down', 'right', 'up', 'left']

/** Whether Row progress is already exactly as it starts afresh (`start`, see startingRowProgressOf, or
 * INITIAL_ROW_PROGRESS with no Frame), so deleteAll has nothing left to reset. */
export function isInitialRowProgress(rowProgress: RowProgress, start: RowProgress = INITIAL_ROW_PROGRESS): boolean {
  return rowProgress.way === start.way && SEEN_WAYS.every((way) => !rowProgress[way])
}

/** Whether Row progress is on: exactly when there is a Frame to count rows on (ticket 434, ADR 0055), of any kind (a
 * Custom frame's Row order, ticket 0594). Derived, never stored, so setting a Frame needn't remember it; an old file's
 * saved flag is ignored. */
export const rowProgressOn = (project: Layered, ref: FrameRef = FIRST_FRAME): boolean => frameById(project, ref) !== undefined

/** The pass the weaver is on, in the current way; every pass before it is finished. */
export function currentPass(rowProgress: RowProgress): number {
  return rowProgress[rowProgress.way] ?? 0
}

/** Row progress with every pointer back at the first pass, the way the weaver runs unchanged. */
function firstPasses(rowProgress: RowProgress): RowProgress {
  return { way: rowProgress.way }
}

/** Row progress with the pointer of `way` set, a first pass left out. */
function withPointer(rowProgress: RowProgress, way: SeenWay, pass: number): RowProgress {
  const { [way]: _was, ...rest } = rowProgress
  return pass > 0 ? { ...rest, [way]: pass } : (rest as RowProgress)
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

/** Row progress with every pointer inside the Frame lying at `turn` (its nearest quarter turn on the table): each way
 * as seen counts the passes of the Frame's own axis and end it runs. A Custom frame's Row order runs one way, along its
 * rows, so it keeps that one pointer. The one clamp a Frame change and an opened file use. */
export function clampPointer(rowProgress: RowProgress, sheet: ShapedSheet, turn: Rotation): RowProgress {
  if (frameShapeOf(sheet)) return withPointer({ way: 'down' }, 'down', clampRow(rowProgress.down ?? 0, passesOf(sheet, { direction: 'rows' })))
  return SEEN_WAYS.reduce((clamped, way) => withPointer(clamped, way, clampRow(rowProgress[way] ?? 0, passesOf(sheet, ownRowWay(way, turn)))), { way: rowProgress.way } as RowProgress)
}

/** What a Frame's Row order is built from beside its rectangle and Weave: its Frame shape, a Custom frame's settings and turn. */
function laidOf(frame: FrameSheet | undefined): Pick<ShapedSheet, 'shape' | 'settings' | 'quarterTurns'> {
  return { shape: frame?.shape, settings: frame?.settings, quarterTurns: frame?.quarterTurns }
}

/** Row progress as an older file held it (before file version 15): a direction along the Frame's own rows or columns
 * and an end, with a pointer for each of its own four ways. */
export interface OwnRowProgress {
  direction?: PassDirection
  reversed?: boolean
  currentRow: number
  currentColumn?: number
  currentRowBack?: number
  currentColumnBack?: number
}

/** An older file's Row progress as seen (ticket 1185): the way it showed, its own way turned `shownTurns` quarters (the
 * Canvas's nearest quarter turn plus the Frame's turn on it), each pointer moved to the slot of the way it showed. */
export function seenProgressOf(own: OwnRowProgress, shownTurns: number): RowProgress {
  const ownWay = seenWayOfOwn({ direction: own.direction ?? 'rows', ...(own.reversed ? { reversed: true } : {}) }, 0)
  const pointers: [SeenWay, number | undefined][] = [['down', own.currentRow], ['right', own.currentColumn], ['up', own.currentRowBack], ['left', own.currentColumnBack]]
  return pointers.reduce((seen, [way, count]) => (count ? { ...seen, [turnedWay(way, shownTurns)]: count } : seen), { way: turnedWay(ownWay, shownTurns) } as RowProgress)
}

/** Row progress as a stored Project holds it, read inside its Frame lying at `turn`: a way it doesn't know reads as top
 * to bottom, and every pointer is clamped to the passes (see clampPointer). */
export function readRowProgress(stored: Partial<Record<keyof RowProgress, unknown>> | undefined, sheet: ShapedSheet, turn: Rotation): RowProgress {
  const way = SEEN_WAYS.find((each) => each === stored?.way) ?? 'down'
  const counts = SEEN_WAYS.flatMap((each) => {
    const count = stored?.[each]
    return typeof count === 'number' && Number.isFinite(count) ? [[each, Math.round(count)] as const] : []
  })
  return clampPointer({ way, ...Object.fromEntries(counts) }, sheet, turn)
}

/** Whether Row progress is on and a pass is done: the Frame is then held still, since the passes belong to it
 * (ticket 411). */
export function rowProgressStarted(project: Layered, ref: FrameRef = FIRST_FRAME): boolean {
  const rowProgress = rowProgressOf(project, ref)
  return rowProgressOn(project, ref) && SEEN_WAYS.some((way) => !!rowProgress[way])
}

/** Whether a Frame line is one of the rows worked `way`, rather than a line across them. */
export const lineRunsAlong = (line: AreaLine, way: RowWay): boolean => (line.axis === 'row') === (way.direction === 'rows')

/** The Frame's own axis and end (spec 1182, see ownRowWay) that its rows run as seen `way` (the way they run now unless
 * given), on its nearest quarter turn; a Custom frame's Row order runs along its rows. */
export function ownRowWayOf(project: Layered, way?: SeenWay, ref: FrameRef = FIRST_FRAME): RowWay {
  const frame = frameById(project, ref)
  return frame && frameShapeOf(frame) ? { direction: 'rows' } : ownRowWay(way ?? rowProgressOf(project, ref).way, frameQuarterTurnOf(project, ref))
}

/** The beads of a Frame line in passes finished `way` as seen (the way the rows run now unless given): how many, and
 * how many passes they make up. */
export function finishedOnLine(project: Layered, line: AreaLine, way?: SeenWay, ref: FrameRef = FIRST_FRAME): { beads: number; passes: number } {
  way ??= rowProgressOf(project, ref).way
  const { rows = 0, columns = 0 } = frameById(project, ref) ?? {}
  const pointer = rowProgressOf(project, ref)[way] ?? 0
  const order = rowOrderOf({ ...frameWeave(project, ref), ...laidOf(frameById(project, ref)), rows, columns }, ownRowWayOf(project, way, ref))
  const length = line.axis === 'row' ? columns : rows
  const at = (along: number) => (line.axis === 'row' ? { row: line.index, column: along } : { row: along, column: line.index })
  const finished = Array.from({ length }, (_bead, along) => order.passAt(at(along))).filter((pass) => pass < pointer)
  return { beads: finished.length, passes: new Set(finished).size }
}

/** Row progress once a line of the Frame is taken out (Remove line, ticket 0647, ADR 0055): each way whose rows run
 * along it goes back by that row's finished passes, so the rows after it, moved up, stay finished; a line across the
 * rows leaves them finished, a bead short. */
export function progressWithoutLine(project: Layered, line: AreaLine, ref: FrameRef = FIRST_FRAME): RowProgress {
  return SEEN_WAYS.reduce((rowProgress, way) => {
    const { passes } = lineRunsAlong(line, ownRowWayOf(project, way, ref)) ? finishedOnLine(project, line, way, ref) : { passes: 0 }
    return passes > 0 ? withPointer(rowProgress, way, (rowProgress[way] ?? 0) - passes) : rowProgress
  }, rowProgressOf(project, ref))
}

/** Takes Row progress back to the first row in both directions, keeping the direction (ticket 455); the grid is
 * untouched. */
export function resetRowProgress(project: Project, ref: FrameRef = FIRST_FRAME): Project {
  return withRowProgress(project, ref, firstPasses(rowProgressOf(project, ref)))
}

export type { SeenWay }

/** Which way the Frame's rows run as seen (spec 1182): the way Row progress keeps, on the Frame's nearest quarter turn,
 * so the Progress bar's words and arrows say what the maker sees. A Custom frame's run along its own rows, turned as it
 * lies. */
export function seenWayOf(project: Layered, ref: FrameRef = FIRST_FRAME): SeenWay {
  const frame = frameById(project, ref)
  return frame && frameShapeOf(frame) ? seenWayOfOwn({ direction: 'rows' }, frameQuarterTurnOf(project, ref)) : rowProgressOf(project, ref).way
}

/** Whether the weaver's lines are columns as seen (spec 1182): left to right and right to left are columns, top to
 * bottom and bottom to top rows, whatever the Frame's own lines are. A Custom frame's run along its rows, so they are
 * rows. What every word naming them asks: the labels, the buttons, the toasts and the counter. */
export function columnsAsSeen(project: Layered, ref: FrameRef = FIRST_FRAME): boolean {
  if (!frameRowOrder(project, ref).turns) return false
  const way = seenWayOf(project, ref)
  return way === 'left' || way === 'right'
}

/** The four ways Turn row direction lists, in the order a press of its `D` key steps through them (ticket 0973). */
export const ROW_WAYS: readonly SeenWay[] = SEEN_WAYS

/** The `D` key: the rows on to the next of the four ways as seen, in the list's order (ROW_WAYS), leaving the grid and
 * the turns alone. */
export function toggleRowDirection(project: Project, ref: FrameRef = FIRST_FRAME): Project {
  return turnRowDirectionTo(project, ROW_WAYS[(ROW_WAYS.indexOf(seenWayOf(project, ref)) + 1) % ROW_WAYS.length]!, ref)
}

/** Points the weaver's rows the way they are to run as seen (ticket 0973, UX-060; spec 1182): each way keeps its own
 * pointer, so choosing the way left puts its count back. The same Project where the rows run that way already, or the
 * Row order is worked one way only. */
export function turnRowDirectionTo(project: Project, way: SeenWay, ref: FrameRef = FIRST_FRAME): Project {
  const rowProgress = rowProgressOf(project, ref)
  if (!frameRowOrder(project, ref).turns || rowProgress.way === way) return project
  return withRowProgress(project, ref, { ...rowProgress, way })
}

/** Where the weaving has got to, counted in whichever direction its rows run: the row being woven now, and how many
 * rows the Frame has. */
export function rowProgressPosition(project: Layered, ref: FrameRef = FIRST_FRAME): { current: number; total: number } {
  return { current: currentPass(rowProgressOf(project, ref)), total: frameRowOrder(project, ref).count }
}


/** The Frame line (row or column, from 1 as the rulers number it: left to right and top to bottom as seen, ticket 1165)
 * the current pass works on, and how many lines there are, where a line takes more than one pass (peyote, ticket 0849): there
 * the counter counts passes. A Frame lying turned counts its own lines so. None where a pass is a line, for a Custom frame, and once all are done. */
export function passLine(project: Layered, ref: FrameRef = FIRST_FRAME): { line: number; lines: number } | undefined {
  const frame = frameById(project, ref)
  const order = frameRowOrder(project, ref)
  const pass = currentPass(rowProgressOf(project, ref))
  if (!frame || order.stepOf || pass >= order.count) return undefined
  const { direction } = ownRowWayOf(project, undefined, ref)
  const lines = direction === 'columns' ? frame.columns : frame.rows
  const line = order.lineOf(pass)
  // The Frame's own lines as seen: where they lie running up or to the left, the rulers count from the far end.
  const seen = seenWayOfOwn({ direction }, frameQuarterTurnOf(project, ref))
  const fromEnd = seen === 'up' || seen === 'left'
  return order.count === lines || line === undefined ? undefined : { line: fromEnd ? lines - line : line + 1, lines }
}

/** The Frame's Row order (spec 0590), worked the way the weaver's rows run now: the one thing Row progress asks how
 * passes go. A Canvas with no Frame has no passes, counted in its own Weave. */
export function frameRowOrder(project: Layered, ref: FrameRef = FIRST_FRAME): RowOrder {
  const { rows = 0, columns = 0 } = frameById(project, ref) ?? {}
  return rowOrderOf({ ...frameWeave(project, ref), ...laidOf(frameById(project, ref)), rows, columns }, ownRowWayOf(project, undefined, ref))
}

/** The pass that weaves a bead of the Frame, or undefined for a position outside it or on the Canvas. `order` is the
 * Frame's Row order, for a caller that has it already. */
function framePassAt(project: Layered, position: GridPosition, order: (() => RowOrder) | undefined, frameRef: FrameRef): number | undefined {
  const ref = isFrameLayer(position.layer) ? position.layer : frameRef
  const frame = frameById(project, ref)
  // Row progress covers the Frame only: beads outside it stay editable whatever row the weaver is on.
  if (!frame || position.layer === 'canvas') {
    return undefined
  }
  const own = { row: position.row - frame.row, column: position.column - frame.column }
  // Its rectangle and its positions: a Custom frame's are named by round and place and reach past it
  // (ticket 0594); its Row order puts none of the rectangle's others in a pass.
  if (!frameContains(frame, position) && !frameGeometryOf(project, ref).hasPosition(own)) {
    return undefined
  }
  return (order ?? (() => frameRowOrder(project, ref)))().passAt(own)
}

/** Whether a bead sits in a row the weaver has already finished: its pass (a whole line, or half of one on peyote)
 * is before the pointer, lines counted the way rows run from the Frame's first. Only while the overlay is on and a
 * Frame is set. */
export function isInFinishedRow(project: Layered, position: GridPosition, ref: FrameRef = FIRST_FRAME): boolean {
  const pass = framePassAt(project, position, undefined, ref)
  return pass !== undefined && pass < currentPass(rowProgressOf(project, ref))
}

/** `isInFinishedRow` for many positions at once (ticket 0675): the Frame's Row order worked out once, not for each, for
 * a paste preview that asks of every bead it shows. */
export function finishedRowsOf(project: Layered, ref: FrameRef = FIRST_FRAME): (position: GridPosition) => boolean {
  const current = currentPass(rowProgressOf(project, ref))
  if (!frameById(project, ref) || current === 0) return () => false
  let order: RowOrder | undefined
  return (position) => {
    const pass = framePassAt(project, position, () => (order ??= frameRowOrder(project, ref)), ref)
    return pass !== undefined && pass < current
  }
}

/** Whether each Frame bead of a draw, at its Canvas row and column, sits in a finished pass or the current one (ticket
 * 0676): `isInFinishedRow` and `isInCurrentRow` with the Frame's Row order worked out once, not for each of the
 * thousands of beads drawn, and what framePassAt reads of the Project read once (ticket 0677). */
export function rowPassesOf(project: Layered, ref: FrameRef = FIRST_FRAME): (row: number, column: number) => 'finished' | 'current' | undefined {
  const current = currentPass(rowProgressOf(project, ref))
  const frame = frameById(project, ref)
  if (!frame) return () => undefined
  let order: RowOrder | undefined
  let geometry: LayerGeometry | undefined
  return (row, column) => {
    const own = { row: row - frame.row, column: column - frame.column }
    const inside = own.row >= 0 && own.row < frame.rows && own.column >= 0 && own.column < frame.columns
    if (!inside && !(geometry ??= frameGeometryOf(project, ref)).hasPosition(own)) return undefined
    const pass = (order ??= frameRowOrder(project, ref)).passAt(own)
    return pass < current ? 'finished' : pass === current ? 'current' : undefined
  }
}

/** The Frame lines (rows or columns, from its first, the way the rows run) whose Row progress look differs from what
 * `before` showed of the same Frame (ticket 1038): the passes a step crossed, the one it left and the one it reached.
 * Undefined where that is no set of lines: the way turned (every pass changes), a pass off one line (a Custom frame). */
export function stepLines(project: Layered, before: RowProgress, ref: FrameRef = FIRST_FRAME): { direction: PassDirection; lines: number[] } | undefined {
  const after = rowProgressOf(project, ref)
  if (!frameById(project, ref) || before.way !== after.way) return undefined
  const order = frameRowOrder(project, ref)
  const [from, to] = [currentPass(before), currentPass(after)].sort((a, b) => a - b) as [number, number]
  const lines = new Set<number>()
  for (let pass = from; pass <= Math.min(to, order.count - 1); pass += 1) {
    const line = order.lineOf(pass)
    if (line === undefined) return undefined
    lines.add(line)
  }
  return { direction: ownRowWayOf(project, undefined, ref).direction, lines: [...lines].sort((a, b) => a - b) }
}

/** Whether a bead sits in the pass the weaver is on now (ticket 352): the same pass the pointer points at, so the
 * current row is raised. Only while the overlay is on and a Frame is set.
 * @internal The renderer asks `rowPassesOf` (ticket 0676); tests and the visual check ask of one bead. */
export function isInCurrentRow(project: Layered, position: GridPosition, ref: FrameRef = FIRST_FRAME): boolean {
  const pass = framePassAt(project, position, undefined, ref)
  return pass !== undefined && pass === currentPass(rowProgressOf(project, ref))
}

/** Takes back what a drawing command did to finished rows (ticket 33): those beads are already woven, and they are the
 * Frame's, since the Canvas has no rows to finish (ADR 0066). Nothing left to change returns `before` itself, the
 * drawing commands' "unchanged" signal, so no undo step is recorded. */
export function keepFinishedRows(before: Project, after: Project): Project {
  const kept = framesOf(before).reduce((project, frame) => keptFinishedRows(before, project, refOfFrame(before, frame)), after)
  return sameBeads(before, kept) ? before : kept
}

/** `keepFinishedRows` on one Frame: `after` with that Frame's beads in finished passes put back as `before` had them. */
function keptFinishedRows(before: Project, after: Project, ref: FrameRef): Project {
  const frame = frameById(before, ref)
  const [was, now] = [beadsOfLayer(before, ref), beadsOfLayer(after, ref)]
  // With no pass finished there is nothing to take back, and no bead is read (a Fill changes them all, ticket 0677).
  if (!frame || !was || !now || now === was || currentPass(rowProgressOf(before, ref)) === 0) return after
  // The Row order is worked out once for every changed bead, not for each.
  const finished = finishedRowsOf(before, ref)
  const reverts: BeadChange[] = []
  forEachChangedPosition(was, now, (row, column) => {
    if (finished({ row: row + frame.row, column: column + frame.column, layer: ref })) reverts.push({ row, column, color: colorAt(was, row, column) })
  })
  return reverts.length === 0 ? after : withLayer(after, ref, { beads: withColors(now, reverts) })
}

/** Whether rows marked done take back some of what an edit changed (ticket 0848), so the beader can be told why. */
export function finishedRowsHold(before: Project, after: Project): boolean {
  return !sameBeads(keepFinishedRows(before, after), after)
}

/** Points row progress at the given row in its current direction, clamped to the Project — used to advance a
 * finished row and to go back to an earlier one. */
export function moveToRow(project: Project, row: number, ref: FrameRef = FIRST_FRAME): Project {
  const { total } = rowProgressPosition(project, ref)
  const rowProgress = rowProgressOf(project, ref)
  return withRowProgress(project, ref, withPointer(rowProgress, rowProgress.way, clampRow(row, total)))
}
