import { forEachBead, frameContains, withColors, type BeadChange, type BeadMap, type Frame } from './canvas'
import { isOffsetTechnique, positionKey, type GridPosition } from './grid'
import { changedPositions, isInFinishedRow, keepFinishedRows, type Project } from './project'
import { carryNames, keepNamesApart } from './pieceNames'
import { touching } from './pieces'
import type { Selection } from './selection'

/**
 * The keep-out margin round the Frame (CONTEXT.md, ticket 261, ADR 0027): the 3 bead positions all the way round it,
 * outside its line, where nothing can be drawn, so beads never end up right against the Frame and its rulers. Erase
 * still works there. A change of the Frame that leaves beads in it moves each Piece in the way clear, whole.
 */

/** How many bead positions the margin is wide: the room kept for the Frame's line and rulers, and between a moved Piece and anything else. */
export const MARGIN = 3

/** The Frame grown by the margin on every side: the Frame and its margin together. */
export function withMargin(frame: Frame): Frame {
  return { row: frame.row - MARGIN, column: frame.column - MARGIN, rows: frame.rows + 2 * MARGIN, columns: frame.columns + 2 * MARGIN }
}

/** Whether a bead may be placed at a position: not in a row the weaver has finished (ticket 33), and not in the Frame's margin (ticket 261). The one statement of the rule, which an Edit enforces and a press asks to show it is refused. */
export function mayPlace(project: Pick<Project, 'rowProgress' | 'frame' | 'technique'>, position: GridPosition): boolean {
  return !isInFinishedRow(project, position) && !inMargin(project.frame, position)
}

/**
 * What a drawing command did, minus what it did to finished rows (ticket 33), what it painted in the margin and what
 * would join two named Pieces (ticket 406), with the Piece names carried over; `before` itself when nothing is left.
 */
export function keepAllowedEdits(before: Project, after: Project): Project {
  const allowed = keepNamesApart(before, keepMarginClear(before, keepFinishedRows(before, after)))
  return allowed === before ? before : carryNames(before, allowed)
}

/** Where each bead that `relocateFromMargin` moved went, as `carryNames` wants it: the position it was at, or itself when it stayed. */
function movedByRelocation(moving: { changes: readonly BeadChange[]; placed: readonly Cell[] }): (position: GridPosition) => GridPosition {
  const to = new Map<string, GridPosition>()
  moving.changes.forEach(({ row, column }, index) => to.set(positionKey({ row, column }), moving.placed[index]))
  return (position) => {
    const moved = to.get(positionKey(position))
    return moved ? { row: moved.row, column: moved.column } : position
  }
}

/** Whether a position lies in the Frame's margin: within 3 of the Frame, but not in it. */
export function inMargin(frame: Frame | undefined, position: GridPosition): boolean {
  return !!frame && frameContains(withMargin(frame), position) && !frameContains(frame, position)
}

/** Whether a Selection covers any of the Frame's margin (ticket 428): it reaches into the margin from inside the Frame or from outside, or surrounds the Frame. */
export function selectionCoversMargin(frame: Frame | undefined, selection: Selection): boolean {
  if (!frame) return false
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
  return overlaps && !inside
}

/** The cell one step back from `value` on an axis, on the anchor's side of the margin band `[start - MARGIN, end + MARGIN)`: the margin's outer edge there. Unchanged when the anchor is level with the band. */
function outsideEdge(start: number, length: number, anchor: number, value: number): number {
  if (anchor < start - MARGIN) return Math.min(value, start - MARGIN - 1)
  if (anchor >= start + length + MARGIN) return Math.max(value, start + length + MARGIN)
  return value
}

/**
 * Where a Selection drag that reached `cell` ends when it began at `anchor` (ticket 428, ADR 0055), so the Selection
 * never covers the margin. A drag begun inside the Frame stays inside it (the cell is held to the Frame's bounds). One
 * begun outside is stopped at the margin's outer edge on the anchor's side, on whichever axis (the one that keeps more
 * of the drag) takes the rectangle out of the margin, so it cannot end in the margin nor cross it. A drag begun in the
 * margin (a Project saved with beads there) is left alone.
 */
export function clampOutOfMargin(frame: Frame | undefined, anchor: GridPosition, cell: GridPosition): GridPosition {
  if (!frame) return cell
  if (frameContains(frame, anchor)) {
    return {
      row: Math.min(Math.max(cell.row, frame.row), frame.row + frame.rows - 1),
      column: Math.min(Math.max(cell.column, frame.column), frame.column + frame.columns - 1),
    }
  }
  if (inMargin(frame, anchor)) return cell
  const between = (to: GridPosition): Selection => ({
    top: Math.min(anchor.row, to.row),
    left: Math.min(anchor.column, to.column),
    rows: Math.abs(anchor.row - to.row) + 1,
    columns: Math.abs(anchor.column - to.column) + 1,
  })
  if (!selectionCoversMargin(frame, between(cell))) return cell
  const row = outsideEdge(frame.row, frame.rows, anchor.row, cell.row)
  const column = outsideEdge(frame.column, frame.columns, anchor.column, cell.column)
  const area = (to: GridPosition) => between(to).rows * between(to).columns
  const candidates = [{ row, column: cell.column }, { row: cell.row, column }, { row, column }]
  return candidates.filter((to) => !selectionCoversMargin(frame, between(to))).sort((x, y) => area(y) - area(x))[0] ?? { row, column }
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

interface Cell extends GridPosition {
  color: string
}

/** Every Piece's beads among the ones given: those that touch by a side or a corner, as lists of cells. */
function groups(project: Pick<Project, 'technique'>, beads: BeadMap): Cell[][] {
  const unvisited = new Map<string, Cell>()
  forEachBead(beads, (row, column, color) => unvisited.set(positionKey({ row, column }), { row, column, color }))
  const found: Cell[][] = []
  for (const [key, first] of [...unvisited]) {
    if (!unvisited.delete(key)) {
      continue
    }
    const cells: Cell[] = []
    const stack = [first]
    while (stack.length > 0) {
      const at = stack.pop()!
      cells.push(at)
      for (const next of touching(project.technique, at)) {
        const neighbour = unvisited.get(positionKey(next))
        if (neighbour) {
          unvisited.delete(positionKey(next))
          stack.push(neighbour)
        }
      }
    }
    found.push(cells)
  }
  return found
}

function boundsOf(cells: readonly GridPosition[]): Frame {
  const rows = cells.map((cell) => cell.row)
  const columns = cells.map((cell) => cell.column)
  const row = Math.min(...rows)
  const column = Math.min(...columns)
  return { row, column, rows: Math.max(...rows) - row + 1, columns: Math.max(...columns) - column + 1 }
}

function overlaps(a: Frame, b: Frame): boolean {
  return a.row < b.row + b.rows && b.row < a.row + a.rows && a.column < b.column + b.columns && b.column < a.column + a.columns
}

/**
 * The nearest shift of a Piece that leaves it clear of the `avoid` rectangle and one bead from every occupied position,
 * so it neither lands on a bead nor joins another Piece. Rows alternate on peyote and brick stitch, so a Piece there
 * moves by whole pairs of rows and keeps its stagger.
 */
function clearShift(project: Pick<Project, 'technique'>, cells: readonly Cell[], avoid: Frame, occupied: ReadonlySet<string>): GridPosition {
  const box = boundsOf(cells)
  const rowStep = isOffsetTechnique(project.technique) ? 2 : 1
  const limit = avoid.rows + avoid.columns + box.rows + box.columns + 2 * MARGIN + 2

  const fits = (dRow: number, dColumn: number): boolean => {
    const moved = { ...box, row: box.row + dRow, column: box.column + dColumn }
    if (overlaps(moved, avoid)) {
      return false
    }
    return cells.every((cell) => {
      const at = { row: cell.row + dRow, column: cell.column + dColumn }
      return !occupied.has(positionKey(at)) && touching(project.technique, at).every((next) => !occupied.has(positionKey(next)))
    })
  }

  for (let distance = 1; distance <= limit; distance += 1) {
    // The ring of shifts `distance` away, nearest first, so the first one that fits is the best: testing a shift reads
    // every bead of the Piece, which on a big drawing is far too much to do for every shift on the ring.
    const ring: (GridPosition & { square: number })[] = []
    for (let dRow = -distance; dRow <= distance; dRow += 1) {
      if (dRow % rowStep !== 0) {
        continue
      }
      const edge = Math.abs(dRow) === distance
      for (let dColumn = -distance; dColumn <= distance; dColumn += edge ? 1 : 2 * distance) {
        ring.push({ row: dRow, column: dColumn, square: dRow * dRow + dColumn * dColumn })
      }
    }
    ring.sort((a, b) => a.square - b.square)
    const best = ring.find((shift) => fits(shift.row, shift.column))
    if (best) {
      return { row: best.row, column: best.column }
    }
  }
  // Unreachable: the search radius reaches past the Frame and every bead, and beads are finite.
  return { row: avoid.rows + box.rows + MARGIN * 2, column: 0 }
}

/**
 * Moves every Piece of `outside` (beads not in the Frame) that reaches the Frame's margin to the nearest empty space
 * clear of the Frame and its margin; the rest stay. Returns the changes to vacate and place, and how many beads moved.
 */
function relocateFromMargin(
  project: Pick<Project, 'technique'>,
  outside: BeadMap,
  frame: Frame,
): { changes: BeadChange[]; placed: Cell[]; pieces: number } {
  const avoid = withMargin(frame)
  const all = groups(project, outside)
  const inTheWay = all.filter((cells) => cells.some((cell) => frameContains(avoid, cell)))
  const occupied = new Set<string>()
  for (const cells of all) {
    if (!inTheWay.includes(cells)) {
      cells.forEach((cell) => occupied.add(positionKey(cell)))
    }
  }
  const changes: BeadChange[] = []
  const placed: Cell[] = []
  for (const cells of inTheWay) {
    const shift = clearShift(project, cells, avoid, occupied)
    for (const cell of cells) {
      changes.push({ row: cell.row, column: cell.column, color: null })
      const moved = { row: cell.row + shift.row, column: cell.column + shift.column, color: cell.color }
      placed.push(moved)
      occupied.add(positionKey(moved))
    }
  }
  return { changes, placed, pieces: inTheWay.length }
}

/** The Project with every bead in the Frame's margin moved clear, and how many Pieces that was; the same Project when none was. */
export function clearMargin(project: Project): { project: Project; moved: number } {
  const frame = project.frame
  if (!frame) {
    return { project, moved: 0 }
  }
  const outside: BeadMap = {}
  forEachBead(project.beads, (row, column, color) => {
    if (!frameContains(frame, { row, column })) {
      outside[row] ??= {}
      outside[row][column] = color
    }
  })
  const { changes, placed, pieces } = relocateFromMargin(project, outside, frame)
  if (pieces === 0) {
    return { project, moved: 0 }
  }
  const beads = withColors(withColors(project.beads, changes), placed)
  const moved = { ...project, beads, updatedAt: Date.now() }
  return { project: carryNames(project, moved, movedByRelocation({ changes, placed })), moved: pieces }
}
