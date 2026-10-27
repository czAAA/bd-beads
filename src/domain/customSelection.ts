import { colorAt, type BeadChange } from './canvas'
import { layoutPlacement, type LayoutPlacement } from './frameKind'
import { landingAt, layoutPosition, type LayoutPoint, type LayoutPosition } from './frameLayout'
import type { GridPosition } from './grid'
import { frameWeave, type Project } from './project'
import { describeWeave, rowPitch, type Weave } from './weave'

// A Selection over a Custom frame (spec 0590, ADR 0077, ticket 0594): a rectangle of the Frame's cells on screen holding
// every bead whose centre lies in it. Paste and Rotate put each bead on the nearest free position of the panel under it,
// dropping one on a Seam or Off-shape. Each function takes the Frame's layer (`frameLayer`) as a Project of its own.

/** A bead copied from a Custom frame (or a block's cell, placed as a bead): where its centre lies from the block's
 * anchor bead, in cell widths on screen, and its color. */
export interface PlacedColor extends LayoutPoint {
  color: string
}

/** A Custom frame's layout as placed in its rectangle, or none for a Rectangular Frame. */
function placementOf(view: Project): LayoutPlacement | undefined {
  return view.frame && layoutPlacement(view.frame, frameWeave(view))
}

/** A position's centre on screen, in cell widths from the Frame's first position's corner. */
function centreOf(placement: LayoutPlacement, position: LayoutPoint): LayoutPoint {
  return { x: placement.x + position.x * placement.scale, y: placement.y + position.y * placement.scale }
}

/** The cell geometry of a Weave in cell widths: a cell's height and the distance between row tops. */
function cellsOf(weave: Weave): { description: ReturnType<typeof describeWeave>; aspect: number; pitch: number } {
  const description = describeWeave(weave)
  return { description, aspect: description.cellAspect, pitch: rowPitch(weave.technique, description.cellAspect) }
}

/** The Selection's rectangle on screen, in cell widths: its rows and columns with the half bead a shifted row adds on
 * the right, as its outline is drawn. */
function regionOf(weave: Weave, selection: { top: number; left: number; rows: number; columns: number }) {
  const { description, aspect, pitch } = cellsOf(weave)
  return {
    left: selection.left,
    right: selection.left + description.blockExtent(selection.columns, 0, 1, aspect).width,
    top: selection.top * pitch,
    bottom: (selection.top + selection.rows - 1) * pitch + aspect,
  }
}

/** The beads of a Custom frame whose centres lie in a rectangle of its cells, in reading order on screen (top to bottom,
 * then left to right); none on a Rectangular Frame. Empty positions are included: a Selection fills them too. */
export function positionsInRectangle(view: Project, selection: { top: number; left: number; rows: number; columns: number }): LayoutPosition[] {
  const placement = placementOf(view)
  if (!placement) return []
  const region = regionOf(frameWeave(view), selection)
  return placement.layout.positions
    .filter((position) => {
      const { x, y } = centreOf(placement, position)
      return x >= region.left && x <= region.right && y >= region.top && y <= region.bottom
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

/** Whether a Project's Frame is a Custom frame, whose layer these functions work on. */
export function isCustomView(view: Project): boolean {
  return placementOf(view) !== undefined
}

/** The cell of a Weave whose box holds a point on screen, in cell widths: the row by its pitch, the column across it. */
function cellAt(weave: Weave, { x, y }: LayoutPoint): GridPosition {
  const { description, aspect, pitch } = cellsOf(weave)
  const row = Math.round((y - aspect / 2) / pitch)
  const shift = description.center({ row, column: 0 }, 1, aspect).x - 0.5
  return { row, column: Math.floor(x - shift) }
}

/** A cell's centre on screen in a Weave, in cell widths. */
function cellCentre(weave: Weave, cell: GridPosition): LayoutPoint {
  const { description, aspect } = cellsOf(weave)
  return description.center(cell, 1, aspect)
}

/** The Custom frame's cell aimed at one of its beads, named by round and place: a cell whose centre lies on that bead
 * where one does, so a Paste aimed there lands its anchor on it (Ctrl+V under a tool that hovers beads); else the cell
 * holding the bead's centre. Any other position is returned as it is. */
export function cellOfBead(view: Project, position: GridPosition): GridPosition {
  const placement = placementOf(view)
  const found = placement && layoutPosition(placement.layout, position)
  if (!found) return position
  const weave = frameWeave(view)
  const holding = cellAt(weave, centreOf(placement, found))
  const near = [-1, 0, 1].flatMap((rows) => [-1, 0, 1].map((columns) => ({ row: holding.row + rows, column: holding.column + columns })))
  const onBead = (cell: GridPosition) => {
    const { x, y } = cellCentre(weave, cell)
    return landingAt(placement.layout, (x - placement.x) / placement.scale, (y - placement.y) / placement.scale) === found
  }
  return near.find((cell) => cell.row === holding.row && cell.column === holding.column && onBead(cell)) ?? near.find(onBead) ?? holding
}

/** The copied beads of a Custom frame's Selection (Copy keeps each bead's place on screen): their centres from the first
 * bead's in reading order, and the same beads as a block of the Frame's cells, for a Paste onto a rectangle. */
export function copiedFromCustom(view: Project, selection: { top: number; left: number; rows: number; columns: number }): { points: PlacedColor[]; cells: (GridPosition & { color: string })[] } | undefined {
  const placement = placementOf(view)!
  const weave = frameWeave(view)
  const drawn = positionsInRectangle(view, selection).flatMap((position) => {
    const color = colorAt(view.beads, position.row, position.column)
    return color ? [{ ...centreOf(placement, position), color }] : []
  })
  if (drawn.length === 0) return undefined
  const anchor = drawn[0]!
  return {
    points: drawn.map(({ x, y, color }) => ({ x: x - anchor.x, y: y - anchor.y, color })),
    cells: drawn.map((bead) => ({ ...cellAt(weave, bead), color: bead.color })),
  }
}

/** A block's cells as beads on screen (a Paste of a rectangle's copy onto a Custom frame): each cell's centre from the
 * anchor cell's, in the Frame's own Weave. */
export function pointsOfCells(view: Project, cells: readonly (GridPosition & { color: string })[], anchor: GridPosition): PlacedColor[] {
  const weave = frameWeave(view)
  const from = cellCentre(weave, anchor)
  return cells.map((cell) => {
    const { x, y } = cellCentre(weave, cell)
    return { x: x - from.x, y: y - from.y, color: cell.color }
  })
}

/** Beads closer than this to the position under them still find a free one of its panel, in bead widths: a neighbour. */
const REACH = 1.7

/** Where beads on screen land on a Custom frame: each on the position under it, or the nearest free one of that
 * position's panel when an earlier bead took it; one on a Seam or Off-shape, or with no free position near, is dropped.
 * `points` are in cell widths from the Frame's first position's corner. */
export function landOnLayout(view: Project, points: readonly PlacedColor[]): { landed: BeadChange[]; dropped: number } {
  const placement = placementOf(view)!
  const { layout } = placement
  const taken = new Set<string>()
  const landed: BeadChange[] = []
  let dropped = 0
  for (const point of points) {
    const x = (point.x - placement.x) / placement.scale
    const y = (point.y - placement.y) / placement.scale
    const under = landingAt(layout, x, y)
    const panel = under?.panel
    const free = under && !taken.has(`${under.row}:${under.column}`)
      ? { row: under.row, column: under.column }
      : panel === undefined
        ? undefined
        : layout.positions
            .filter((position) => position.panel === panel && !taken.has(`${position.row}:${position.column}`))
            .map((position) => ({ position, distance: Math.hypot(position.x - x, position.y - y) }))
            .filter(({ distance }) => distance <= REACH)
            .sort((a, b) => a.distance - b.distance)[0]?.position
    if (!free) {
      dropped += 1
      continue
    }
    taken.add(`${free.row}:${free.column}`)
    landed.push({ row: free.row, column: free.column, color: point.color })
  }
  return { landed, dropped }
}

/** Where a Paste aimed at a Custom frame's cell puts the anchor bead, on screen in cell widths: on the centre of the bead
 * under the cell's centre, so a copy laid on the same shape lands bead for bead; the cell's centre on a Seam or
 * Off-shape. */
export function aimOf(view: Project, cell: GridPosition): LayoutPoint {
  const placement = placementOf(view)!
  const aim = cellCentre(frameWeave(view), cell)
  const under = landingAt(placement.layout, (aim.x - placement.x) / placement.scale, (aim.y - placement.y) / placement.scale)
  return under ? centreOf(placement, under) : aim
}

/** A Custom frame's Selection turned a quarter clockwise about its middle on screen (Rotate, ticket 0594): where each of
 * its beads lands, how many land on a Seam or Off-shape, and every bead it lifts. */
export function turnedOnLayout(view: Project, selection: { top: number; left: number; rows: number; columns: number }): { lifted: BeadChange[]; landed: BeadChange[]; dropped: number } {
  const placement = placementOf(view)!
  const region = regionOf(frameWeave(view), selection)
  const middle = { x: (region.left + region.right) / 2, y: (region.top + region.bottom) / 2 }
  const beads = positionsInRectangle(view, selection).flatMap((position) => {
    const color = colorAt(view.beads, position.row, position.column)
    return color ? [{ position, color }] : []
  })
  // A quarter turn clockwise on screen, y down: right becomes down.
  const points = beads.map(({ position, color }) => {
    const { x, y } = centreOf(placement, position)
    return { x: middle.x - (y - middle.y), y: middle.y + (x - middle.x), color }
  })
  return { lifted: beads.map(({ position, color }) => ({ row: position.row, column: position.column, color })), ...landOnLayout(view, points) }
}

/** How many beads of a Custom frame a set of landings replaced: positions that held another color and were not lifted. */
export function coveredOnLayout(view: Project, landed: readonly BeadChange[], lifted: readonly BeadChange[]): number {
  const liftedKeys = new Set(lifted.map(({ row, column }) => `${row}:${column}`))
  return landed.filter(({ row, column }) => !liftedKeys.has(`${row}:${column}`) && colorAt(view.beads, row, column) !== null).length
}
