import { nearestQuarterTurn, normalizedOrientation } from './canvasOrientation'
import { laidSize } from './frameOrientation'
import { frameShapeOf } from './frameShape'
import type { GridPosition, Rotation } from './grid'
import { canvasOf, frameOf, quarterTurnOf, withCanvas, withFrameFields, type Layered } from './layerRecord'
import { canvasWeave, frameScale, frameWeave } from './layerWeave'
import type { FrameLayer, Project } from './project'
import { canvasPlacement, frameAngleOf, frameQuarterTurnOf, type Placement, type TablePoint } from './table'
import { columnCycle, describeWeave, rowCycle } from './weave'

// The Frame's placement on the table (spec 1182, ticket 1185): its own angle and its centre, worked out from the Canvas
// position it lies at through the Canvas's placement, and back. What file version 15 keeps of where the Frame is.

/** A vector turned `degrees` clockwise on a table whose y runs down, exact at a quarter turn. */
function turned({ x, y }: TablePoint, degrees: number): TablePoint {
  const radians = (degrees * Math.PI) / 180
  const quarter = degrees % 90 === 0
  const cos = quarter ? Math.round(Math.cos(radians)) : Math.cos(radians)
  const sin = quarter ? Math.round(Math.sin(radians)) : Math.sin(radians)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

/** Where a Canvas position's bead corner sits on the Canvas, in its bead widths from its origin along its own axes. */
function cornerOf(project: Layered, position: GridPosition): TablePoint {
  const canvas = describeWeave(canvasWeave(project))
  return canvas.origin(position, 1, canvas.cellAspect)
}

/** How far the Frame reaches across and down as it lies on the Canvas, in the Canvas's bead widths: its laid rows and
 * columns in its own Weave, as many times larger as its Bead is. */
function laidExtent(project: Layered): TablePoint {
  const weave = frameWeave(project)
  const own = describeWeave(weave)
  const { rows, columns } = laidSize({ ...frameOf(project)!, ...weave })
  const { width, height } = own.blockExtent(columns, rows, 1, own.cellAspect)
  const scale = frameScale(project)
  return { x: width * scale, y: height * scale }
}

/** The Frame's placement on the table: its own angle, and its centre: carried through the Canvas's placement from the
 * Canvas position it lies at, or kept where it lies off the Canvas's grid (ticket 1188). None without a Frame. */
export function framePlacement(project: Layered): Placement | undefined {
  const frame = frameOf(project)
  if (!frame) return undefined
  if (frame.centre) return { angle: frameAngleOf(project), at: { ...frame.centre } }
  const corner = cornerOf(project, frame)
  const extent = laidExtent(project)
  const canvas = canvasPlacement(project)
  const at = turned({ x: corner.x + extent.x / 2, y: corner.y + extent.y / 2 }, canvas.angle)
  return { angle: frameAngleOf(project), at: { x: canvas.at.x + at.x, y: canvas.at.y + at.y } }
}

/** The Canvas position whose corner puts the Frame's centre at `centre` on the table (`framePlacement` undone): the
 * nearest, so a placement read back from a file lands on the very position it was worked out from. The Frame's own row
 * and column are not read. */
export function frameCornerAt(project: Layered, centre: TablePoint): GridPosition {
  const extent = laidExtent(project)
  const canvas = canvasPlacement(project)
  const local = turned({ x: centre.x - canvas.at.x, y: centre.y - canvas.at.y }, -canvas.angle)
  const target = { x: local.x - extent.x / 2, y: local.y - extent.y / 2 }
  const aspect = describeWeave(canvasWeave(project)).cellAspect
  const guess = { row: Math.round(target.y / aspect), column: Math.round(target.x) }
  let best = { at: guess, off: Infinity }
  // A shifted Weave puts a corner up to half a bead off the plain lattice, so the nearest is among the guess's neighbours.
  for (let row = guess.row - 2; row <= guess.row + 2; row += 1) {
    for (let column = guess.column - 2; column <= guess.column + 2; column += 1) {
      const corner = cornerOf(project, { row, column })
      const off = Math.hypot(corner.x - target.x, corner.y - target.y)
      if (off < best.off) best = { at: { row, column }, off }
    }
  }
  return best.at
}

/** The quarter turn the Frame's laid rectangle is seen at (spec 1182, ticket 1186): its nearest quarter turn, less the
 * quarters its rows lie turned in that rectangle (none once `withLaidTurn` laid it, but a Custom frame's), never a lean.
 * What exports, previews and sizes as seen go by; with no Frame, the Canvas's, the only layer there is to show. */
export function laidTurnOf(project: Layered): Rotation {
  const frame = frameOf(project)
  return frame ? nearestQuarterTurn(frameQuarterTurnOf(project) - 90 * (frame.quarterTurns ?? 0)) : quarterTurnOf(project)
}

/** The Project as every export and preview draws it (ticket 1186): the Frame at its nearest quarter turn, no lean, on
 * a Canvas laid at `turn` under it: a Frame upright, by its own rows whatever the Canvas's turn, a Custom frame (its
 * layout built turned on the grid) as many quarters off as it lies. As it is when it already lies so, or has no Frame. */
export function withLaidTurn(project: Project, turn?: Rotation): Project {
  const frame = frameOf(project)
  if (!frame) return project
  const lies = frameShapeOf(frame) ? 90 * (frame.quarterTurns ?? 0) : 0
  const under = turn ?? nearestQuarterTurn(frameQuarterTurnOf(project) - lies)
  const angle = normalizedOrientation(under + lies)
  const held = project.layers[1]!
  if (canvasOf(project).orientation === under && held.angle === angle && !held.centre) return project
  // Laid on the Canvas's grid: one that lay off it (ticket 1188) is drawn where its row and column address it.
  const { centre: _centre, ...laid } = held
  return withFrameFields(withCanvas(withHeld(project, laid), { orientation: under }), { angle })
}

/** How near two points on the table are the same, in bead widths: float noise from turning back and forth, or a file
 * keeping a millionth, is no move. */
const SAME_POINT = 1e-5

/** The Project with its Frame layer record replaced as given, nothing else looked at. */
function withHeld(project: Project, frame: FrameLayer): Project {
  return { ...project, layers: [canvasOf(project), frame, ...project.layers.slice(2)] as Project['layers'] }
}

/** The Project with its Frame's centre at `centre` on the table, its angle as it is (ticket 1188): on the Canvas's grid
 * where it lies whole quarter turns off the Canvas and that centre is a whole position's, else off the grid, keeping
 * the centre, its row and column the nearest position's only to address its cells. As it is with no Frame. */
export function withFrameAt(project: Project, centre: TablePoint): Project {
  const held = project.layers[1]
  if (!held) return project
  const { centre: _was, ...onGrid } = held
  if (normalizedOrientation(held.angle - canvasOf(project).orientation) % 90 === 0) {
    const laid = withHeld(project, { ...onGrid, ...frameCornerAt(withHeld(project, onGrid), centre) })
    const at = framePlacement(laid)!.at
    if (Math.hypot(at.x - centre.x, at.y - centre.y) < SAME_POINT) return laid
  }
  // Its row and column only address its cells: a position a Frame may start on, so the margin round it is laid as round
  // any Frame (an unshifted first row and column).
  const off = { ...onGrid, centre: { ...centre } }
  const corner = frameCornerAt(withHeld(project, off), centre)
  const weave = canvasWeave(project)
  const snapped = (at: number, cycle: number) => at - (((at % cycle) + cycle) % cycle)
  return withHeld(project, { ...off, row: snapped(corner.row, rowCycle(weave)), column: snapped(corner.column, columnCycle(weave)) })
}

/** The Project with its Canvas turned to `orientation` and its origin moved `moved` on the table (a turn about a pivot,
 * in the Canvas's bead widths): Rotate canvas and its twist (spec 1182, ticket 1188). The Frame stays where it is on the
 * table, at its own angle, its Row progress untouched, so nothing of it moves on screen. Not stamped. */
export function withCanvasTurned(project: Project, orientation: number, moved: TablePoint = { x: 0, y: 0 }): Project {
  const canvas = canvasOf(project)
  const to = normalizedOrientation(orientation)
  if (canvas.orientation === to && moved.x === 0 && moved.y === 0) return project
  const from = canvasPlacement(project).at
  const origin = { x: from.x + moved.x, y: from.y + moved.y }
  const centre = framePlacement(project)?.at
  const turned = withCanvas(project, { orientation: to, ...(origin.x === 0 && origin.y === 0 && !canvas.origin ? {} : { origin }) })
  return centre ? withFrameAt(turned, centre) : turned
}

/** Where a Frame off the Canvas's grid lies once its sheet is changed to `after`'s (ticket 1188): turned, about its own
 * centre; resized or moved, its centre goes as far as its own drawing's does, the Frame laid by its own quarter turns
 * on a Canvas at its own angle less them. */
export function carriedOffGrid(before: Project, after: Project): Project {
  const was = before.layers[1]
  const now = after.layers[1]
  if (!was?.centre || !now) return after
  if (now.angle !== was.angle) return withFrameAt(after, was.centre)
  const under = was.angle - 90 * (frameOf(before)!.quarterTurns ?? 0)
  const own = (project: Project) => {
    const { centre: _centre, ...onGrid } = project.layers[1]!
    return framePlacement(withCanvas(withHeld(project, onGrid), { orientation: normalizedOrientation(under) }))!.at
  }
  const [from, to] = [own(before), own(after)]
  return withFrameAt(after, { x: was.centre.x + to.x - from.x, y: was.centre.y + to.y - from.y })
}

/** The Frame's centre on the Canvas (ticket 1188): from the Canvas's origin along its own axes, in its bead widths, its
 * place on the table turned back by the Canvas's. Where a view of the Canvas shows the Frame's middle. */
export function frameCentreOnCanvas(project: Layered): TablePoint | undefined {
  const placed = framePlacement(project)
  if (!placed) return undefined
  const canvas = canvasPlacement(project)
  return turned({ x: placed.at.x - canvas.at.x, y: placed.at.y - canvas.at.y }, -canvas.angle)
}

/** The Project as the Frame's own surface draws it (ticket 1188): its Canvas at `rotation`, the quarter turn that
 * surface is drawn at, and the Frame on its grid there, by its own quarter turns and no lean, wherever it lies; its
 * view lays the drawing where the Frame is. As it is with no Frame. */
export function withFrameLaidAt(project: Project, rotation: Rotation): Project {
  const held = project.layers[1]
  if (!held) return project
  const turns = frameOf(project)!.quarterTurns ?? 0
  const { centre: _centre, ...onGrid } = held
  const angle = normalizedOrientation(rotation + 90 * turns)
  if (canvasOf(project).orientation === rotation && !held.centre && held.angle === angle) return project
  return withHeld(withCanvas(project, { orientation: rotation }), { ...onGrid, angle })
}

/** Where a point of a Frame off the Canvas's grid lies on the Canvas (ticket 1188): from the corner of the rectangle it
 * lies in, in its own cell widths, to the Canvas's own axes from its origin, in its cell widths: through its centre
 * and angle on the table. What Remove frame drops its beads by until ticket 1189. */
export function offGridOnCanvas(project: Layered): (point: TablePoint) => TablePoint {
  const frame = frameOf(project)!
  const scale = frameScale(project)
  const extent = laidExtent(project)
  const at = framePlacement(project)!.at
  const canvas = canvasPlacement(project)
  const under = frame.angle - 90 * (frame.quarterTurns ?? 0)
  return ({ x, y }) => {
    const from = turned({ x: x * scale - extent.x / 2, y: y * scale - extent.y / 2 }, under)
    return turned({ x: at.x + from.x - canvas.at.x, y: at.y + from.y - canvas.at.y }, -canvas.angle)
  }
}
