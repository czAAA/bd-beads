import { footprintOf } from './footprint'
import type { Layer, Placed } from './layers'
import { forEachBead, frameContains, withColors, type BeadChange, type Rect } from './canvas'
import type { GridPosition } from './grid'
import { isInFinishedRow } from './rowProgress'
import { sameBeads } from './layerBeads'
import type { Project } from './project'
import type { Selection } from './selection'

/** The keep-out margin round the Frame (CONTEXT.md, ticket 261, ADR 0066): 4 bead positions (3 until ticket 427, 6
 * until ticket 0656) outside its line where nothing can be drawn. Erase still works there; a Frame change leaves beads
 * already there in place. */

/** How many bead positions the margin is wide (MarginSheet card, ticket 0656): at 100% the room its sheet's top band
 * and title block need, fixed, not a setting. */
export const MARGIN = 4

/** The Frame grown by the margin on every side: the Frame and its margin together. */
export function withMargin(frame: Rect, margin: number = MARGIN): Rect {
  return { row: frame.row - margin, column: frame.column - margin, rows: frame.rows + 2 * margin, columns: frame.columns + 2 * margin }
}

/** The rectangle the margin's rules measure from for something on a layer (ADR 0066): the Frame's own rectangle for what
 * is on the Frame, where a Selection stays inside it, and the footprint for what is on the Canvas, which is held off it. */
export function marginBoxFor(project: Placed, layer: Layer): Rect | undefined {
  return layer === 'frame' ? project.frame : footprintOf(project)
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

/** The one statement of what a Selection may be (ticket 433, ADR 0051, spec 432): wholly inside the Frame, wholly
 * clear of its margin band, or round the whole Frame and band. No Frame, no rule. Every Selection path asks this:
 * a drag clamps, a resize or move is refused, a one-shot Selection is trimmed. */
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

/** The cell one step back from `value` on an axis, on the anchor's side of the margin band `[start - MARGIN, end +
 * MARGIN)`: the margin's outer edge there. Unchanged when the anchor is level with the band. */
function outsideEdge(start: number, length: number, anchor: number, value: number): number {
  if (anchor < start - MARGIN) return Math.min(value, start - MARGIN - 1)
  if (anchor >= start + length + MARGIN) return Math.max(value, start + length + MARGIN)
  return value
}

/** Where a Selection drag from `anchor` to `cell` ends (ticket 428, ADR 0051), never stopping in or cutting the
 * margin. Begun inside the Frame it stays inside; begun outside it stops at the margin's outer edge on the axis that
 * keeps more. Begun in the margin (ticket 433) is refused: `anchor` is returned. */
export function clampOutOfMargin(frame: Rect | undefined, anchor: GridPosition, cell: GridPosition): GridPosition {
  if (!frame) return cell
  if (frameContains(frame, anchor)) {
    return {
      row: Math.min(Math.max(cell.row, frame.row), frame.row + frame.rows - 1),
      column: Math.min(Math.max(cell.column, frame.column), frame.column + frame.columns - 1),
    }
  }
  if (inMargin(frame, anchor)) return anchor
  const between = (to: GridPosition): Selection => ({
    top: Math.min(anchor.row, to.row),
    left: Math.min(anchor.column, to.column),
    rows: Math.abs(anchor.row - to.row) + 1,
    columns: Math.abs(anchor.column - to.column) + 1,
  })
  if (selectionAllowed(frame, between(cell))) return cell
  const row = outsideEdge(frame.row, frame.rows, anchor.row, cell.row)
  const column = outsideEdge(frame.column, frame.columns, anchor.column, cell.column)
  const area = (to: GridPosition) => between(to).rows * between(to).columns
  const candidates = [{ row, column: cell.column }, { row: cell.row, column }, { row, column }]
  return candidates.filter((to) => selectionAllowed(frame, between(to))).sort((x, y) => area(y) - area(x))[0] ?? { row, column }
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
