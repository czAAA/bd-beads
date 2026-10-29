import { footprintOf } from './footprint'
import { forEachBead, frameContains, withColors, type BeadChange, type Rect } from './canvas'
import type { GridPosition } from './grid'
import { isInFinishedRow } from './rowProgress'
import { sameBeads } from './layerBeads'
import type { Project } from './project'
import type { Selection } from './selection'

/** The keep-out margin round the Frame (CONTEXT.md, ticket 261, ADR 0066): 6 bead positions (3 until ticket 427,
 * ADR 0066) outside its line where nothing can be drawn. Erase still works there; a Frame change leaves beads
 * already there in place. */

/** How many bead positions the margin is wide: the room kept for the Frame's line and rulers. */
export const MARGIN = 6

/** The Frame grown by the margin on every side: the Frame and its margin together. */
export function withMargin(frame: Rect, margin: number = MARGIN): Rect {
  return { row: frame.row - margin, column: frame.column - margin, rows: frame.rows + 2 * margin, columns: frame.columns + 2 * margin }
}

/** Whether a bead may be placed at a position: not in a row the weaver has finished (ticket 33), and not in the
 * Frame's margin (ticket 261). The one statement of the rule, which an Edit enforces and a press asks to show it is
 * refused. */
export function mayPlace(project: Pick<Project, 'rowProgress' | 'frame' | 'technique' | 'techniqueSettings'> & Partial<Pick<Project, 'beadId' | 'beadShape'>>, position: GridPosition, margin: number = MARGIN): boolean {
  return !isInFinishedRow(project, position) && !inMargin(footprintOf(project), position, margin)
}

/** Whether a position lies in the Frame's margin: within MARGIN of the Frame's footprint (ADR 0066), but not in it. A
 * position that names the Frame's layer is in the Frame, whatever its number says. */
export function inMargin(frame: Rect | undefined, position: GridPosition, margin: number = MARGIN): boolean {
  return !!frame && position.layer !== 'frame' && frameContains(withMargin(frame, margin), position) && !frameContains(frame, position)
}

/** What a Piece tap's Selection may be (ticket 433, ADR 0051, spec 432): wholly inside the Frame, wholly clear of its
 * margin band, or round the whole Frame and band. No Frame, no rule. A drag lies anywhere instead (ticket 0659).
 * @internal Tests check the rule on its own; `trimToAllowed` is how the app asks it. */
export function selectionAllowed(frame: Rect | undefined, selection: Selection): boolean {
  if (!frame) return true
  const box = withMargin(frame)
  const overlaps =
    selection.top < box.row + box.rows &&
    selection.top + selection.rows > box.row &&
    selection.left < box.column + box.columns &&
    selection.left + selection.columns > box.column
  const inside =
    selection.top >= frame.row &&
    selection.left >= frame.column &&
    selection.top + selection.rows <= frame.row + frame.rows &&
    selection.left + selection.columns <= frame.column + frame.columns
  const encloses =
    selection.top <= box.row &&
    selection.left <= box.column &&
    selection.top + selection.rows >= box.row + box.rows &&
    selection.left + selection.columns >= box.column + box.columns
  return !overlaps || inside || encloses
}

/** `selection` cut to the largest allowed rectangle holding `anchor` (ticket 433), taking the band out on the axis
 * that keeps more. Unchanged if allowed; none if `anchor` is in the margin or no cut is left. */
export function trimToAllowed(frame: Rect | undefined, selection: Selection, anchor: GridPosition): Selection | undefined {
  if (selectionAllowed(frame, selection)) return selection
  if (!frame || inMargin(frame, anchor)) return undefined
  const bottom = selection.top + selection.rows
  const right = selection.left + selection.columns
  const band = withMargin(frame)
  const cut = (start: number, end: number, from: number, length: number, at: number): [number, number] => {
    if (at < from) return [start, Math.min(end, from)]
    if (at >= from + length) return [Math.max(start, from + length), end]
    return [start, end]
  }
  const [rowStart, rowEnd] = cut(selection.top, bottom, band.row, band.rows, anchor.row)
  const [columnStart, columnEnd] = cut(selection.left, right, band.column, band.columns, anchor.column)
  const box = (top: number, bot: number, left: number, rgt: number): Selection => ({ top, left, rows: bot - top, columns: rgt - left })
  const candidates = [
    box(rowStart, rowEnd, selection.left, right),
    box(selection.top, bottom, columnStart, columnEnd),
    box(rowStart, rowEnd, columnStart, columnEnd),
  ]
  return candidates
    .filter((c) => selectionAllowed(frame, c))
    .sort((x, y) => y.rows * y.columns - x.rows * x.columns)[0]
}

/** What an edit did, with every bead it newly painted in the margin taken back (erasing there stays); nothing left
 * to change returns `before` itself, the drawing commands' "unchanged" signal. */
export function keepMarginClear(before: Project, after: Project): Project {
  const frame = footprintOf(before)
  if (!frame) {
    return after
  }
  const reverts: BeadChange[] = []
  forEachBead(after.beads, (row, column, color) => {
    if (inMargin(frame, { row, column }) && before.beads[row]?.[column] !== color) {
      reverts.push({ row, column, color: before.beads[row]?.[column] ?? null })
    }
  })
  if (reverts.length === 0) {
    return after
  }
  const beads = withColors(after.beads, reverts)
  const kept = { ...after, beads }
  return sameBeads(before, kept) ? before : kept
}
