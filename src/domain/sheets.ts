import type { FrameSheet, Rect } from './canvas'
import { frameGeometry } from './frameShape'
import type { FrameRef, GridPosition, Layer } from './grid'
import { frameGeometryOf } from './frameGeometryOf'
import { canvasOf, frameById, frameIdOf, framesOf, type Layered } from './layerRecord'
import { canvasWeave, cellWidthMm, frameWeave } from './layerWeave'
import type { Cover } from './margin'
import { turnedPoint, type TablePoint } from './table'
import { describeWeave, positionStep } from './weave'

// Where a Frame's sheet lies on the Table (spec 1234, ticket 1237): the Frame and its keep-out margin as a rectangle in
// mm, and the Canvas positions whose beads it hides. Layers differ only by quarter turns, so every sheet is upright.

/** How many bead positions the margin is wide (MarginSheet card, ticket 0656): at 100% the room its sheet's top band
 * and title block need, fixed, not a setting. Kept here, which `margin` reads, so the two do not import each other. */
export const MARGIN = 4

/** A rectangle on the Table, in mm. */
export interface SheetBox {
  left: number
  top: number
  right: number
  bottom: number
}

/** A Frame's rectangle on the Table and its sheet, the Frame with its keep-out margin round it. */
interface FrameBoxes {
  frame: SheetBox
  sheet: SheetBox
}

/** The Frame's rectangle and its sheet on the Table, in mm: its centre and the rectangle its geometry gives, turned by its
 * quarter turn, and the margin 4 of its own bead positions wide. None for a Frame the Project lacks. */
export function frameBoxesOf(project: Layered, ref: FrameRef): FrameBoxes | undefined {
  const frame = frameById(project, ref)
  if (!frame) return undefined
  const extent = frameGeometryOf(project, ref).extent()!
  const mm = cellWidthMm(project, ref)
  const [width, height] = [extent.width * mm, extent.height * mm]
  const step = positionStep(frameWeave(project, ref))
  const sideways = (frame.quarterTurns ?? 0) % 2 === 1
  const [across, down] = [MARGIN * (sideways ? step.down : step.across) * mm, MARGIN * (sideways ? step.across : step.down) * mm]
  const box = { left: frame.centre.x - width / 2, top: frame.centre.y - height / 2, right: frame.centre.x + width / 2, bottom: frame.centre.y + height / 2 }
  return { frame: box, sheet: { left: box.left - across, top: box.top - down, right: box.right + across, bottom: box.bottom + down } }
}

/** How far two sheets must overlap to meet, in mm: sheets that only share an edge are clear. */
const TOUCH = 1e-6

/** Whether two rectangles on the Table overlap. */
export function boxesMeet(a: SheetBox, b: SheetBox): boolean {
  return a.left < b.right - TOUCH && b.left < a.right - TOUCH && a.top < b.bottom - TOUCH && b.top < a.bottom - TOUCH
}

/** Whether a point lies inside a rectangle of the Table, its left and top edges in. */
function boxHolds(box: SheetBox, { x, y }: TablePoint): boolean {
  return x >= box.left && x < box.right && y >= box.top && y < box.bottom
}

/** The Canvas's place on the Table: its origin in mm and its quarter turn. */
function canvasPlace(project: Layered): { origin: TablePoint; turn: number; mm: number } {
  const { orientation, origin } = canvasOf(project)
  return { origin: origin ?? { x: 0, y: 0 }, turn: orientation, mm: cellWidthMm(project, 'canvas') }
}

/** Where a point of the Canvas, from its origin along its own axes in its bead widths, lies on the Table, in mm: what a
 * pointer over the Canvas's drawing is at. */
export function tablePointOfCanvas(project: Layered, point: TablePoint): TablePoint {
  const { origin, turn, mm } = canvasPlace(project)
  const turned = turnedPoint({ x: point.x * mm, y: point.y * mm }, turn)
  return { x: origin.x + turned.x, y: origin.y + turned.y }
}

/** Where a Canvas position's bead centre lies on the Table, in mm. */
export function tablePointOf(project: Layered, position: GridPosition): TablePoint {
  const { origin, turn, mm } = canvasPlace(project)
  const weave = describeWeave(canvasWeave(project))
  const centre = weave.center(position, 1, weave.cellAspect)
  const turned = turnedPoint({ x: centre.x * mm, y: centre.y * mm }, turn)
  return { x: origin.x + turned.x, y: origin.y + turned.y }
}

/** The Canvas positions whose bead centres lie inside a rectangle of the Table, as the rectangle round them; none where
 * no bead centre does. */
function positionsUnder(project: Layered, box: SheetBox): Rect | undefined {
  const { origin, turn, mm } = canvasPlace(project)
  const weave = describeWeave(canvasWeave(project))
  // The rectangle in the Canvas's own bead widths: turned back by its quarter turn, which keeps it upright.
  const corners = [
    { x: box.left, y: box.top },
    { x: box.right, y: box.bottom },
  ].map(({ x, y }) => turnedPoint({ x: x - origin.x, y: y - origin.y }, -turn))
  const area = {
    left: Math.min(...corners.map((c) => c.x)) / mm,
    right: Math.max(...corners.map((c) => c.x)) / mm,
    top: Math.min(...corners.map((c) => c.y)) / mm,
    bottom: Math.max(...corners.map((c) => c.y)) / mm,
  }
  const seen = weave.visible(area, 1, weave.cellAspect)
  let [top, bottom, left, right] = [Infinity, -Infinity, Infinity, -Infinity]
  for (let row = seen.firstRow; row <= seen.lastRow; row += 1) {
    const { first, last } = seen.columnsOf(row)
    for (let column = first; column <= last; column += 1) {
      if (!boxHolds(box, tablePointOf(project, { row, column }))) continue
      top = Math.min(top, row)
      bottom = Math.max(bottom, row)
      left = Math.min(left, column)
      right = Math.max(right, column)
    }
  }
  return top > bottom ? undefined : { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }
}

/** What a Frame covers of the Canvas: those positions under the Frame are hidden and not counted, those under its margin
 * besides refuse a press (spec 1234). */
export interface FrameCover extends Cover {
  ref: FrameRef
}

const memo = new Map<string, FrameCover[]>()
const MAX_MEMO = 64
const byLayers = new WeakMap<Layered['layers'], readonly FrameCover[]>()

/** The covers of every Frame of the Project that covers a Canvas position, in layer order. Worked out from where the
 * layers lie, so a bead edit does not redo it. */
export function coversOf(project: Layered): readonly FrameCover[] {
  const known = byLayers.get(project.layers)
  if (known) return known
  const refs = framesOf(project).map(frameIdOf)
  const { origin, turn, mm } = canvasPlace(project)
  const key = JSON.stringify([canvasWeave(project), mm, turn, origin, refs.map((ref) => frameKey(project, ref))])
  let covers = memo.get(key)
  if (!covers) {
    covers = refs.flatMap((ref) => {
      const boxes = frameBoxesOf(project, ref)!
      const [frame, sheet] = [positionsUnder(project, boxes.frame), positionsUnder(project, boxes.sheet)]
      return sheet ? [{ ref, frame: frame ?? { row: sheet.row, column: sheet.column, rows: 0, columns: 0 }, sheet }] : []
    })
    if (memo.size >= MAX_MEMO) memo.clear()
    memo.set(key, covers)
  }
  byLayers.set(project.layers, covers)
  return covers
}

/** What decides where a Frame's sheet lies: its place, size, Weave and Bead, never its beads. */
function frameKey(project: Layered, ref: FrameRef): unknown[] {
  const { centre, angle, rows, columns, shape, settings } = frameById(project, ref)!
  return [ref, centre, angle, rows, columns, shape, settings, frameWeave(project, ref), cellWidthMm(project, ref)]
}

/** The layer a Canvas position lies on: the Frame whose rectangle holds its bead centre, the one drawn on top where
 * several do, else the Canvas. What a position that names no layer is on (a picture laid over the Canvas, the Homepage's
 * tours aiming at a bead). */
export function layerUnder(project: Layered, position: GridPosition): Layer {
  const point = tablePointOf(project, position)
  const covering = framesOf(project).filter((frame) => boxHolds(frameBoxesOf(project, frameIdOf(frame))!.frame, point))
  const top = covering.at(-1)
  return top ? frameIdOf(top) : 'canvas'
}

/** The cell of a Frame that a Canvas position's bead centre lies over, named by its own row and column; none where it
 * lies between the Frame's beads (the one place that finds a Frame's cell from a Canvas position). */
export function cellUnder(project: Layered, ref: FrameRef, position: GridPosition): GridPosition | undefined {
  const boxes = frameBoxesOf(project, ref)
  if (!boxes) return undefined
  const point = tablePointOf(project, position)
  const mm = cellWidthMm(project, ref)
  return frameGeometryOf(project, ref).positionAt({ x: (point.x - boxes.frame.left) / mm, y: (point.y - boxes.frame.top) / mm })
}

/** The mm a sheet of a Frame of the Project would take on the Table, as its geometry gives it: its size, Frame shape and
 * turn in the Weave and Bead of the Frame named. What a resize works its centre out from. */
export function extentMmOf(project: Layered, ref: FrameRef, sheet: Pick<FrameSheet, 'rows' | 'columns' | 'shape' | 'settings' | 'quarterTurns'>): TablePoint {
  const { width, height } = frameGeometry({ ...sheet, ...frameWeave(project, ref) }).extent()!
  const mm = cellWidthMm(project, ref)
  return { x: width * mm, y: height * mm }
}

/** Where the middle of a rectangle of Canvas positions lies on the Table, in mm: what a Frame made from a Selection or put
 * round a Canvas rectangle is centred on, so it starts where its copied beads are. */
export function canvasRectCentre(project: Layered, rect: Rect): TablePoint {
  const { origin, turn, mm } = canvasPlace(project)
  const weave = describeWeave(canvasWeave(project))
  const box = weave.blockBox(rect, 1, weave.cellAspect)
  const turned = turnedPoint({ x: (box.x + box.width / 2) * mm, y: (box.y + box.height / 2) * mm }, turn)
  return { x: origin.x + turned.x, y: origin.y + turned.y }
}

/** How far a rectangle of Canvas positions reaches across and down on the Table, in mm. */
export function canvasRectExtent(project: Layered, rect: Rect): TablePoint {
  const { mm, turn } = canvasPlace(project)
  const weave = describeWeave(canvasWeave(project))
  const box = weave.blockBox(rect, 1, weave.cellAspect)
  const [width, height] = [box.width * mm, box.height * mm]
  return (turn / 90) % 2 === 1 ? { x: height, y: width } : { x: width, y: height }
}

/** Where the middle of a Frame's bead lies on the Canvas: from the Canvas's origin along its own axes, in its bead widths.
 * None where the Frame has no such position. What a picture laid over the Canvas is read at (ticket 1119). */
export function frameBeadOnCanvas(project: Layered, ref: FrameRef, position: GridPosition): TablePoint | undefined {
  const boxes = frameBoxesOf(project, ref)
  const place = frameGeometryOf(project, ref).place(position)
  if (!boxes || !place) return undefined
  const { origin, turn, mm } = canvasPlace(project)
  const own = cellWidthMm(project, ref)
  const table = { x: boxes.frame.left + (place.box.x + place.box.width / 2) * own, y: boxes.frame.top + (place.box.y + place.box.height / 2) * own }
  const local = turnedPoint({ x: table.x - origin.x, y: table.y - origin.y }, -turn)
  return { x: local.x / mm, y: local.y / mm }
}
