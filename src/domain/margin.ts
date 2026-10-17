import { forEachBead, frameContains, withColors, type BeadChange, type Frame } from './canvas'
import type { GridPosition } from './grid'
import { changedPositions, isInFinishedRow, keepFinishedRows, type Project } from './project'
import { carryNames, keepNamesApart } from './pieceNames'
import type { Selection } from './selection'

/**
 * The keep-out margin round the Frame (CONTEXT.md, ticket 261, ADR 0027): the 6 bead positions all the way round it (3 until ticket 427, ADR 0056),
 * outside its line, where nothing can be drawn, so beads never end up right against the Frame and its rulers. Erase
 * still works there. A change of the Frame leaves beads already there where they are: the margin covers them.
 */

/** How many bead positions the margin is wide: the room kept for the Frame's line and rulers. */
export const MARGIN = 6

/**
 * How many bead positions the margin shows at a zoom (ticket 459): the 6 of `MARGIN`, or more once zoomed out so far that
 * their band, `pitchPx` per position at `zoom`, is shorter than `neededPx`, the room the Frame's corner controls take.
 * Only what is shown and refused on screen widens; a margin removes nothing, so covering more loses no bead.
 */
export function marginAt({ neededPx, pitchPx, zoom }: { neededPx: number; pitchPx: number; zoom: number }): number {
  return Math.max(MARGIN, Math.ceil(neededPx / (pitchPx * zoom)))
}

/** The Frame grown by the margin on every side: the Frame and its margin together. */
export function withMargin(frame: Frame, margin: number = MARGIN): Frame {
  return { row: frame.row - margin, column: frame.column - margin, rows: frame.rows + 2 * margin, columns: frame.columns + 2 * margin }
}

/** Whether a bead may be placed at a position: not in a row the weaver has finished (ticket 33), and not in the Frame's margin (ticket 261). The one statement of the rule, which an Edit enforces and a press asks to show it is refused. */
export function mayPlace(project: Pick<Project, 'rowProgress' | 'frame' | 'technique'>, position: GridPosition, margin: number = MARGIN): boolean {
  return !isInFinishedRow(project, position) && !inMargin(project.frame, position, margin)
}

/**
 * What a drawing command did, minus what it did to finished rows (ticket 33), what it painted in the margin and what
 * would join two named Pieces (ticket 406), with the Piece names carried over; `before` itself when nothing is left.
 */
export function keepAllowedEdits(before: Project, after: Project): Project {
  const allowed = keepNamesApart(before, keepMarginClear(before, keepFinishedRows(before, after)))
  return allowed === before ? before : carryNames(before, allowed)
}

/** Whether a position lies in the Frame's margin: within MARGIN of the Frame, but not in it. */
export function inMargin(frame: Frame | undefined, position: GridPosition, margin: number = MARGIN): boolean {
  return !!frame && frameContains(withMargin(frame, margin), position) && !frameContains(frame, position)
}

/**
 * The one statement of what a Selection may be (ticket 433, ADR 0055, spec 432): wholly inside the Frame, wholly
 * clear of the Frame's margin band, or round the whole Frame and its band (so it never stops in the margin or cuts the
 * Frame, but can take in everything), never anything else. With no Frame there is no rule. Every path that makes a
 * Selection asks this: a drag clamps to it, a resize or move is refused by it, a one-shot Selection is trimmed to it.
 */
export function selectionAllowed(frame: Frame | undefined, selection: Selection): boolean {
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

/**
 * `selection` cut down to the largest rectangle that holds `anchor` and is allowed (ticket 433): the cut that takes the
 * band out on whichever axis keeps more. Unchanged when it is allowed already; none when `anchor` is in the margin or
 * no cut is left.
 */
export function trimToAllowed(frame: Frame | undefined, selection: Selection, anchor: GridPosition): Selection | undefined {
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

/** The cell one step back from `value` on an axis, on the anchor's side of the margin band `[start - MARGIN, end + MARGIN)`: the margin's outer edge there. Unchanged when the anchor is level with the band. */
function outsideEdge(start: number, length: number, anchor: number, value: number): number {
  if (anchor < start - MARGIN) return Math.min(value, start - MARGIN - 1)
  if (anchor >= start + length + MARGIN) return Math.max(value, start + length + MARGIN)
  return value
}

/**
 * Where a Selection drag that reached `cell` ends when it began at `anchor` (ticket 428, ADR 0055), so the Selection
 * never stops in the margin or cuts it (a drag that goes right across the Frame and its margin is allowed). A drag begun inside the Frame stays inside it (the cell is held to the Frame's bounds). One
 * begun outside is stopped at the margin's outer edge on the anchor's side, on whichever axis (the one that keeps more
 * of the drag) takes the rectangle out of the margin, so it cannot end in the margin nor stop part-way across it. A drag begun in the
 * margin (a Project saved with beads there) is refused (ticket 433): the Selection cannot start there, so the anchor is returned.
 */
export function clampOutOfMargin(frame: Frame | undefined, anchor: GridPosition, cell: GridPosition): GridPosition {
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

/**
 * What an edit did, with every bead it newly painted in the margin taken back (erasing there stays). An edit left with
 * nothing to change hands back `before` itself, the same "unchanged" signal the drawing commands give.
 */
function keepMarginClear(before: Project, after: Project): Project {
  const frame = before.frame
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
  return changedPositions(before.beads, beads).length === 0 ? before : { ...after, beads }
}
