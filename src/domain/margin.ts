import { footprintsOf } from './footprint'
import { forEachChangedPosition, frameContains, withColors, type BeadChange, type BeadMap, type Rect } from './canvas'
import { isFrameLayer, type GridPosition } from './grid'
import { isInFinishedRow } from './rowProgress'
import { sameBeads } from './layerBeads'
import { beadsOfLayer, frameIdOf, framesOf, type Layered, withLayer } from './layerRecord'
import type { Project } from './project'
import type { Selection } from './selection'

/** The keep-out margin round each Frame (CONTEXT.md, ticket 261, ADR 0066): 4 bead positions (3 until ticket 427, 6
 * until ticket 0656) outside its line where nothing can be drawn. Erase still works there; a Frame change leaves beads
 * already there in place. Every rule here holds for each Frame's footprint in turn (ticket 1218). */

/** The footprints a rule is asked of: one Frame's, every Frame's in a list, or none. */
export type Footprints = Rect | readonly Rect[] | undefined

/** The footprints as a list. */
export function footprintList(frames: Footprints): readonly Rect[] {
  return frames === undefined ? [] : 'row' in frames ? [frames] : frames
}

/** How many bead positions the margin is wide (MarginSheet card, ticket 0656): at 100% the room its sheet's top band
 * and title block need, fixed, not a setting. */
export const MARGIN = 4

/** The Frame grown by the margin on every side: the Frame and its margin together. */
export function withMargin(frame: Rect, margin: number = MARGIN): Rect {
  return { row: frame.row - margin, column: frame.column - margin, rows: frame.rows + 2 * margin, columns: frame.columns + 2 * margin }
}

const shownMemo = new WeakMap<BeadMap, { key: string; shown: BeadMap }>()

/** The Canvas beads that show (tickets 1012, 1218): those no Frame and its margin cover, neither drawn nor counted.
 * `beads` itself where nothing is covered; else a copy kept per `beads` and Frames, sharing the rows it leaves be. Only
 * the covered rows are read, so it costs the cover, not the layer. */
export function beadsShown(beads: BeadMap, footprints: Footprints): BeadMap {
  const covers = footprintList(footprints).map((footprint) => withMargin(footprint))
  if (covers.length === 0) return beads
  const key = covers.map((covered) => `${covered.row},${covered.column},${covered.rows},${covered.columns}`).join(';')
  const known = shownMemo.get(beads)
  if (known?.key === key) return known.shown
  let shown = beads
  for (const covered of covers) {
    for (let row = covered.row; row < covered.row + covered.rows; row += 1) {
      const stored = shown[row]
      if (!stored) continue
      const kept = Object.keys(stored).filter((column) => !frameContains(covered, { row, column: Number(column) }))
      if (kept.length === Object.keys(stored).length) continue
      if (shown === beads) shown = { ...beads }
      if (kept.length === 0) delete shown[row]
      else shown[row] = Object.fromEntries(kept.map((column) => [column, stored[Number(column)]!]))
    }
  }
  shownMemo.set(beads, { key, shown })
  return shown
}

/** Whether a bead may be placed at a position: not in a row the weaver has finished on any Frame (ticket 33), and not
 * in any Frame's margin (tickets 261, 1218). The one statement of the rule, which an Edit enforces and a press asks to
 * show it is refused. */
export function mayPlace(project: Layered, position: GridPosition, margin: number = MARGIN): boolean {
  return !(isFrameLayer(position.layer) && framesOf(project).some((frame) => isInFinishedRow(project, position, frameIdOf(frame)))) && !inMargin(footprintsOf(project), position, margin)
}

/** Whether a position lies in a Frame's margin: within MARGIN of a Frame's footprint (ADR 0066), but not in it. A
 * position that names a Frame's layer is in that Frame, whatever its number says. */
export function inMargin(frames: Footprints, position: GridPosition, margin: number = MARGIN): boolean {
  return !isFrameLayer(position.layer) && footprintList(frames).some((frame) => frameContains(withMargin(frame, margin), position) && !frameContains(frame, position))
}

/** What a Piece tap's Selection may be (tickets 433, 1218, ADR 0051, spec 432): for each Frame, wholly inside it, clear
 * of its margin band, or round the whole Frame and band. No Frame, no rule. A drag lies anywhere (ticket 0659).
 * @internal Tests check the rule on its own; `trimToAllowed` is how the app asks it. */
export function selectionAllowed(frames: Footprints, selection: Selection): boolean {
  return footprintList(frames).every((frame) => allowedBy(frame, selection))
}

/** `selectionAllowed` for one Frame. */
function allowedBy(frame: Rect, selection: Selection): boolean {
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

/** `selection` cut to the largest allowed rectangle holding `anchor` (tickets 433, 1218), taking each Frame's band out
 * on the axis that keeps more, until every Frame allows it. Unchanged if allowed; none if `anchor` is in a margin or no
 * cut is left. */
export function trimToAllowed(frames: Footprints, selection: Selection, anchor: GridPosition): Selection | undefined {
  const list = footprintList(frames)
  if (inMargin(list, anchor)) return selectionAllowed(list, selection) ? selection : undefined
  let trimmed: Selection | undefined = selection
  // A cut for one Frame can leave a rectangle no longer round another, so cut again until none is needed.
  for (let pass = 0; trimmed && pass <= list.length && !selectionAllowed(list, trimmed); pass += 1) {
    for (const frame of list) trimmed = trimmed && trimmedFor(frame, trimmed, anchor)
  }
  return trimmed && selectionAllowed(list, trimmed) ? trimmed : undefined
}

/** `trimToAllowed` for one Frame, the anchor clear of its margin. */
function trimmedFor(frame: Rect, selection: Selection, anchor: GridPosition): Selection | undefined {
  if (allowedBy(frame, selection)) return selection
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
    .filter((c) => allowedBy(frame, c))
    .sort((x, y) => y.rows * y.columns - x.rows * x.columns)[0]
}

/** What an edit did, with every bead it newly painted in any Frame's margin taken back (erasing there stays); nothing
 * left to change returns `before` itself, the drawing commands' "unchanged" signal. Only the positions the edit changed
 * are looked at (ticket 0674). */
export function keepMarginClear(before: Project, after: Project): Project {
  const frame = footprintsOf(before)
  if (frame.length === 0) {
    return after
  }
  const [was, now] = [beadsOfLayer(before, 'canvas'), beadsOfLayer(after, 'canvas')]
  const reverts: BeadChange[] = []
  forEachChangedPosition(was, now, (row, column) => {
    if (now[row]?.[column] !== undefined && inMargin(frame, { row, column })) reverts.push({ row, column, color: was[row]?.[column] ?? null })
  })
  if (reverts.length === 0) {
    return after
  }
  const kept = withLayer(after, 'canvas', { beads: withColors(now, reverts) })
  return sameBeads(before, kept) ? before : kept
}
