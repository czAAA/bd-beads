import { nearestQuarterTurn, normalizedOrientation } from './canvasOrientation'
import { frameShapeOf } from './frameShape'
import type { FrameRef, Rotation } from './grid'
import { canvasOf, frameById, framesOf, heldFrameById, quarterTurnOf, withCanvas, withFrameById, type Layered } from './layerRecord'
import { cellWidthMm, frameWeave } from './layerWeave'
import type { Project } from './project'
import { tableTurnOf, turnedPoint, type TablePoint } from './table'
import { positionStep } from './weave'

// A layer's place on the Table (spec 1234, ticket 1237): a Frame by its centre in mm and a quarter turn, the Canvas by its
// origin and a quarter turn, the whole Table turned on screen. This turns and moves them, one at a time.

/** The quarter turn the Frame's rectangle is seen at when it is exported or previewed: a plain Frame's grid is drawn
 * upright and shown at the Canvas's turn (`withLaidTurn`); a shaped Frame's layout is built turned, so none (ticket 1186);
 * the Canvas's own with no Frame, the only layer there is to show. */
export function laidTurnOf(project: Layered, ref: FrameRef): Rotation {
  const frame = frameById(project, ref)
  return frame && frameShapeOf(frame) ? 0 : quarterTurnOf(project)
}

/** The Project as every export and preview draws it (ticket 1186): a plain Frame a regular grid shown at `turn` (its own
 * turn unless given), the Canvas turned with it; a shaped Frame by its own quarter turn laid in its layout, the Canvas at
 * `turn`, 0 unless given. The Table upright. As it is when it already lies so, or has no Frame. */
export function withLaidTurn(project: Project, turn: Rotation | undefined, ref: FrameRef): Project {
  const frame = frameById(project, ref)
  if (!frame) return project
  const held = heldFrameById(project, ref)!
  const plain = !frameShapeOf(frame)
  const to = turn ?? (plain ? nearestQuarterTurn(held.angle) : 0)
  const angle = plain ? to : held.angle
  const canvas = canvasOf(project)
  if (canvas.orientation === to && !canvas.tableTurn && held.angle === angle) return project
  const { tableTurn: _turn, ...rest } = canvas
  const laid = withCanvas({ ...project, layers: [rest, ...framesOf(project)] }, { orientation: to })
  return held.angle === angle ? laid : withFrameById(laid, ref, (each) => ({ ...each, angle }))
}

/** The Frame's centre as the Canvas lays it out: from the Canvas's origin along its own axes, in its bead widths. Where a
 * view of the Canvas shows the Frame's middle, whatever the Table turn. */
export function frameCentreOnCanvas(project: Layered, ref: FrameRef): TablePoint | undefined {
  const frame = heldFrameById(project, ref)
  if (!frame) return undefined
  const { orientation, origin } = canvasOf(project)
  const mm = cellWidthMm(project, 'canvas')
  const local = turnedPoint({ x: frame.centre.x - (origin?.x ?? 0), y: frame.centre.y - (origin?.y ?? 0) }, -orientation)
  return { x: local.x / mm, y: local.y / mm }
}

/** The Project with the Frame named at `centre` on the Table, in mm, nothing else touched. As it is without that Frame. */
export function withFrameCentre(project: Project, centre: TablePoint, ref: FrameRef): Project {
  return withFrameById(project, ref, (held) => ({ ...held, centre: { ...centre } }))
}

/** The Project with the Frame turned a quarter turn clockwise about its own centre, which stays where it is on the Table
 * (Rotate Frame, spec 1234). Its beads, rows and Row progress are not looked at. As it is without that Frame. */
export function withFrameQuarterTurned(project: Project, by: 1 | 3, ref: FrameRef): Project {
  const held = heldFrameById(project, ref)
  return held ? withFrameById(project, ref, () => ({ ...held, angle: normalizedOrientation(held.angle + 90 * by) })) : project
}

/** A point of the screen's Table as the Table turn lies it, back on the Table itself. */
function onTable(project: Layered, point: TablePoint): TablePoint {
  return turnedPoint(point, -tableTurnOf(project))
}

/** The Project with its Canvas turned to the quarter turn nearest `angle` on screen, its origin moved `moved` on screen
 * (Rotate canvas, spec 1234): the Canvas alone, about the middle of the view, Frames where they were on the Table. */
export function withCanvasTurned(project: Project, angle: number, moved: TablePoint = { x: 0, y: 0 }): Project {
  const canvas = canvasOf(project)
  const to = nearestQuarterTurn(normalizedOrientation(angle - tableTurnOf(project)))
  if (canvas.orientation === to && moved.x === 0 && moved.y === 0) return project
  const mm = cellWidthMm(project, 'canvas')
  const shift = onTable(project, { x: moved.x * mm, y: moved.y * mm })
  const from = canvas.origin ?? { x: 0, y: 0 }
  const origin = { x: from.x + shift.x, y: from.y + shift.y }
  return withCanvas(project, { orientation: to, ...(origin.x === 0 && origin.y === 0 && !canvas.origin ? {} : { origin }) })
}

/** The Project with the whole Table turned until the Canvas lies at `angle` on screen (a two-finger twist, spec 1234):
 * every layer turns together and keeps its turn relative to the others, so no layer's place on the Table changes. A view,
 * never an Undo step. */
export function withTableTurned(project: Project, angle: number): Project {
  const turn = normalizedOrientation(angle - canvasOf(project).orientation)
  if (turn === tableTurnOf(project)) return project
  const { tableTurn: _was, ...canvas } = canvasOf(project)
  return withCanvas({ ...project, layers: [canvas, ...framesOf(project)] }, turn ? { tableTurn: turn } : {})
}

/** How far a key moves the Frame named on the Table, in mm: one bead of its own along the screen's way, `[rows, columns]`
 * of them (an arrow key), the Table turn undone so it goes the way the arrow points. */
export function frameKeyStep(project: Layered, ref: FrameRef, [rows, columns]: readonly [number, number]): TablePoint {
  const frame = frameById(project, ref)
  const step = positionStep(frameWeave(project, ref))
  const mm = cellWidthMm(project, ref)
  const sideways = (frame?.quarterTurns ?? 0) % 2 === 1
  const [across, down] = sideways ? [step.down, step.across] : [step.across, step.down]
  return onTable(project, { x: columns * across * mm, y: rows * down * mm })
}
