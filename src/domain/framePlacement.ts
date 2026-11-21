import { nearestQuarterTurn, normalizedOrientation } from './canvasOrientation'
import { laidSize } from './frameOrientation'
import { frameShapeOf } from './frameShape'
import type { GridPosition, Rotation } from './grid'
import { canvasOf, frameOf, quarterTurnOf, withCanvas, withFrameFields, type Layered } from './layerRecord'
import { canvasWeave, frameScale, frameWeave } from './layerWeave'
import type { Project } from './project'
import { canvasPlacement, frameAngleOf, frameQuarterTurnOf, type Placement, type TablePoint } from './table'
import { describeWeave } from './weave'

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

/** The Frame's placement on the table: its own angle, and its centre carried through the Canvas's placement from the
 * Canvas position it lies at. None without a Frame. */
export function framePlacement(project: Layered): Placement | undefined {
  const frame = frameOf(project)
  if (!frame) return undefined
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
  if (canvasOf(project).orientation === under && project.layers[1]?.angle === angle) return project
  return withFrameFields(withCanvas(project, { orientation: under }), { angle })
}
