import { colorAt, forEachBead, type BeadChange, type BeadMap } from './canvas'
import { frameLayoutOf } from './frameShape'
import { laidSize } from './frameOrientation'
import { keyOf, landingAt, layoutPosition, type FrameLayout, type LayoutPoint, type LayoutPosition } from './frameLayout'
import type { GridPosition } from './grid'
import { layoutPlacement, turnedGridCentre, type LayoutPlacement } from './layerGeometry'
import type { LayerSheet } from './layers'
import { describeWeave, rowPitch, type Weave } from './weave'

// A Selection over a Custom frame or a turned Frame (tickets 0594, 0667): a rectangle of the Frame's cells on screen
// holding every bead whose centre lies in it. Paste and Rotate put each bead on the nearest free position of the panel
// under it, dropping one on a Seam or Off-shape. Each function takes the Frame's layer (`layerSheet`).

/** A bead copied from a Custom frame (or a block's cell, placed as a bead): where its centre lies from the block's
 * anchor bead, in cell widths on screen, and its color. */
export interface PlacedColor extends LayoutPoint {
  color: string
}

/** A Selection's rectangle of the Frame's cells, counted from its first row and column. */
type CellRectangle = { top: number; left: number; rows: number; columns: number }

/** The Custom frame's layout as placed in its rectangle, or a turned Frame's grid in the rectangle it lies in (ticket
 * 0667). */
function placementOf(sheet: LayerSheet): LayoutPlacement {
  const frame = { ...sheet.frame!, ...sheet.weave }
  return layoutPlacement(frameLayoutOf(frame)!, laidSize(frame), sheet.weave)
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
function regionOf(weave: Weave, selection: CellRectangle) {
  const { description, aspect, pitch } = cellsOf(weave)
  return {
    left: selection.left,
    right: selection.left + description.blockExtent(selection.columns, 0, 1, aspect).width,
    top: selection.top * pitch,
    bottom: (selection.top + selection.rows - 1) * pitch + aspect,
  }
}

/** The beads of a Custom frame whose centres lie in a rectangle of its cells, in reading order on screen (top to bottom,
 * then left to right). Empty positions are included: a Selection fills them too. */
export function positionsInRectangle(sheet: LayerSheet, selection: CellRectangle): LayoutPosition[] {
  const placement = placementOf(sheet)
  const region = regionOf(sheet.weave, selection)
  return placement.layout.positions
    .filter((position) => {
      const { x, y } = centreOf(placement, position)
      return x >= region.left && x <= region.right && y >= region.top && y <= region.bottom
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
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

/** A cell and the eight cells round it. */
function cellsAround(cell: GridPosition): GridPosition[] {
  return [-1, 0, 1].flatMap((rows) => [-1, 0, 1].map((columns) => ({ row: cell.row + rows, column: cell.column + columns })))
}

/** The Custom frame's cell aimed at one of its beads, named by round and place: a cell whose centre lies on that bead
 * where one does, so a Paste aimed there lands its anchor on it (Ctrl+V under a tool that hovers beads); else the cell
 * holding the bead's centre. Any other position is returned as it is. */
export function cellOfBead(sheet: LayerSheet, position: GridPosition): GridPosition {
  const placement = placementOf(sheet)
  const found = layoutPosition(placement.layout, position)
  if (!found) return position
  const weave = sheet.weave
  const holding = cellAt(weave, centreOf(placement, found))
  const near = cellsAround(holding)
  const onBead = (cell: GridPosition) => {
    const { x, y } = cellCentre(weave, cell)
    return landingAt(placement.layout, (x - placement.x) / placement.scale, (y - placement.y) / placement.scale) === found
  }
  // The cell holding the centre first, if its own centre is on the bead; else a neighbour whose centre is.
  return (onBead(holding) ? holding : near.find(onBead)) ?? holding
}

/** The copied beads of a Custom frame's Selection (Copy keeps each bead's place on screen): their centres from the first
 * bead's in reading order, and the same beads as a block of the Frame's cells, for a Paste onto a rectangle. */
export function copiedFromCustom(sheet: LayerSheet, selection: CellRectangle): { points: PlacedColor[]; cells: (GridPosition & { color: string })[] } | undefined {
  const placement = placementOf(sheet)
  const weave = sheet.weave
  const drawn = positionsInRectangle(sheet, selection).flatMap((position) => {
    const color = colorAt(sheet.beads, position.row, position.column)
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
export function pointsOfCells(sheet: LayerSheet, cells: readonly (GridPosition & { color: string })[], anchor: GridPosition): PlacedColor[] {
  const weave = sheet.weave
  const from = cellCentre(weave, anchor)
  return cells.map((cell) => {
    const { x, y } = cellCentre(weave, cell)
    return { x: x - from.x, y: y - from.y, color: cell.color }
  })
}

/** Beads closer than this to the position under them still find a free one of its panel, in bead widths: a neighbour. */
const REACH = 1.7

/** The free position of a panel nearest a point, within a neighbour's reach; none past it. */
function nearestFree(layout: FrameLayout, panel: number, x: number, y: number, taken: ReadonlySet<string>): GridPosition | undefined {
  let best: { position: LayoutPosition; distance: number } | undefined
  for (const position of layout.positions) {
    if (position.panel !== panel || taken.has(keyOf(position))) continue
    const distance = Math.hypot(position.x - x, position.y - y)
    if (distance <= REACH && (!best || distance < best.distance)) best = { position, distance }
  }
  return best && { row: best.position.row, column: best.position.column }
}

/** Where beads on screen land on a Custom frame: each on the position under it, or the nearest free one of that
 * position's panel when an earlier bead took it; one on a Seam or Off-shape, or with no free position near, is dropped.
 * `points` are in cell widths from the Frame's first position's corner. */
export function landOnLayout(sheet: LayerSheet, points: readonly PlacedColor[]): { landed: BeadChange[]; dropped: number } {
  const landings = landingsOf(sheet, points)
  const landed = landings.flatMap((free, index) => (free ? [{ ...free, color: points[index]!.color }] : []))
  return { landed, dropped: points.length - landed.length }
}

/** The position each point on screen lands on, in order, or none for one that is dropped (see `landOnLayout`). */
function landingsOf(sheet: LayerSheet, points: readonly LayoutPoint[]): (GridPosition | undefined)[] {
  const placement = placementOf(sheet)
  const { layout } = placement
  const taken = new Set<string>()
  return points.map((point) => {
    const x = (point.x - placement.x) / placement.scale
    const y = (point.y - placement.y) / placement.scale
    const under = landingAt(layout, x, y)
    const free = under && !taken.has(keyOf(under)) ? { row: under.row, column: under.column } : under && nearestFree(layout, under.panel, x, y, taken)
    if (free) taken.add(keyOf(free))
    return free
  })
}

/** A grid's beads lifted into a Custom frame (Frame from Selection, ticket 0669): each, from the Frame's cell it is on,
 * lands as a Paste lands it; one that lands on a Seam or Off-shape stays where it was. `cells` are in the Frame's own
 * rows and columns: what landed, by layout position, and the cells it was lifted from. */
export function liftedOntoLayout(sheet: LayerSheet, cells: readonly (GridPosition & { color: string })[]): { landed: BeadChange[]; lifted: GridPosition[] } {
  const landings = landingsOf(sheet, cells.map((cell) => cellCentre(sheet.weave, cell)))
  const landed: BeadChange[] = []
  const lifted: GridPosition[] = []
  landings.forEach((free, index) => {
    if (!free) return
    const { row, column, color } = cells[index]!
    landed.push({ ...free, color })
    lifted.push({ row, column })
  })
  return { landed, lifted }
}

/** A Custom frame's or a turned Frame's beads laid on a grid (Remove Frame, ticket 0669, ADR 0077): each on the Frame's
 * cell nearest its centre, as a Paste of them lays them. In the Frame's own rows and columns. */
export function droppedFromLayout(sheet: LayerSheet): BeadChange[] {
  const placement = placementOf(sheet)
  return droppedOnCells(
    sheet.weave,
    placement.layout.positions.flatMap((position) => {
      const color = colorAt(sheet.beads, position.row, position.column)
      return color ? [{ centre: centreOf(placement, position), color }] : []
    }),
  )
}

/** A turned Frame's Folded beads laid on a grid as `droppedFromLayout` lays its others: each where its own row and
 * column, beyond the Frame's edge, lies as the Frame is turned (ticket 0669). */
export function droppedFromTurnedGrid(sheet: LayerSheet, folded: BeadMap): BeadChange[] {
  const frame = { ...sheet.frame!, ...sheet.weave }
  const beads: { centre: LayoutPoint; color: string }[] = []
  forEachBead(folded, (row, column, color) => beads.push({ centre: turnedGridCentre(frame, { row, column }), color }))
  return droppedOnCells(sheet.weave, beads)
}

/** Beads at points on screen laid on a Weave's cells, read in order on screen: each on the cell holding its centre, or
 * the nearest free cell next to it where an earlier bead took that one. */
function droppedOnCells(weave: Weave, beads: readonly { centre: LayoutPoint; color: string }[]): BeadChange[] {
  const taken = new Set<string>()
  const dropped: BeadChange[] = []
  for (const { centre, color } of [...beads].sort((a, b) => a.centre.y - b.centre.y || a.centre.x - b.centre.x)) {
    const holding = cellAt(weave, centre)
    const away = (cell: GridPosition) => {
      const { x, y } = cellCentre(weave, cell)
      return Math.hypot(x - centre.x, y - centre.y)
    }
    const free = [holding, ...cellsAround(holding).sort((a, b) => away(a) - away(b))].find((cell) => !taken.has(keyOf(cell)))
    if (!free) continue
    taken.add(keyOf(free))
    dropped.push({ ...free, color })
  }
  return dropped
}

/** Where a Paste aimed at a Custom frame's cell puts the anchor bead, on screen in cell widths: on the centre of the bead
 * under the cell's centre, so a copy laid on the same shape lands bead for bead; the cell's centre on a Seam or
 * Off-shape. */
export function aimOf(sheet: LayerSheet, cell: GridPosition): LayoutPoint {
  const placement = placementOf(sheet)
  const aim = cellCentre(sheet.weave, cell)
  const under = landingAt(placement.layout, (aim.x - placement.x) / placement.scale, (aim.y - placement.y) / placement.scale)
  return under ? centreOf(placement, under) : aim
}

/** A Custom frame's Selection turned a quarter clockwise about its middle on screen (Rotate, ticket 0594): where each of
 * its beads lands, how many land on a Seam or Off-shape, and every bead it lifts. */
export function turnedOnLayout(sheet: LayerSheet, selection: CellRectangle): { lifted: BeadChange[]; landed: BeadChange[]; dropped: number } {
  const placement = placementOf(sheet)
  const region = regionOf(sheet.weave, selection)
  const middle = { x: (region.left + region.right) / 2, y: (region.top + region.bottom) / 2 }
  const beads = positionsInRectangle(sheet, selection).flatMap((position) => {
    const color = colorAt(sheet.beads, position.row, position.column)
    return color ? [{ position, color }] : []
  })
  // A quarter turn clockwise on screen, y down: right becomes down.
  const points = beads.map(({ position, color }) => {
    const { x, y } = centreOf(placement, position)
    return { x: middle.x - (y - middle.y), y: middle.y + (x - middle.x), color }
  })
  return { lifted: beads.map(({ position, color }) => ({ row: position.row, column: position.column, color })), ...landOnLayout(sheet, points) }
}

/** How many beads of a Custom frame a set of landings replaced: positions that held another color and were not lifted. */
export function coveredOnLayout({ beads }: LayerSheet, landed: readonly BeadChange[], lifted: readonly BeadChange[]): number {
  const liftedKeys = new Set(lifted.map(keyOf))
  return landed.filter(({ row, column }) => !liftedKeys.has(keyOf({ row, column })) && colorAt(beads, row, column) !== null).length
}
