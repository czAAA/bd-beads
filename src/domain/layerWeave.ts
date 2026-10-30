import { beadPitchMm } from './beads'
import { beadBounds, colorAt, shiftedBeads, withColors, type BeadChange, type BeadMap, type FrameSheet } from './canvas'
import type { GridPosition, Layer } from './grid'
import { beadOfLayer, frameOf, heldWeave, weaveOfLayer, weaveOf, type Layered } from './layerRecord'
import { describeWeave, positionStep, weaveSettings, withCell, type Weave } from './weave'

export { weaveOf }

// The Weave each layer is woven in (ticket 492), read through the layer's record (ticket 0661), and how a distance in
// one reads in the other.

/** The Canvas's Weave (tickets 492, 0625). */
export function canvasWeave(project: Layered): Weave {
  return weaveOfLayer(project, 'canvas')
}

/** The Frame's Weave (ticket 492), which may differ from the Canvas's; a Canvas with no Frame counts its rows in its
 * own. The one place that says which Weave a Frame's rows, rulers, passes and exports are counted in. */
export function frameWeave(project: Layered): Weave {
  return weaveOfLayer(project, 'frame') ?? canvasWeave(project)
}

/** The Weave of one layer, the Frame's or the Canvas's (ticket 0625). */
export function layerWeave(project: Layered, layer: Layer): Weave {
  return layer === 'frame' ? frameWeave(project) : canvasWeave(project)
}

/** Whether two Weaves lay positions out alike: the same Technique, and the same value of every setting it describes. */
export function sameWeave(a: Weave, b: Weave): boolean {
  if (a.technique !== b.technique) {
    return false
  }
  const [x, y] = [weaveSettings(a), weaveSettings(b)]
  return Object.keys(x).every((id) => x[id] === y[id])
}

/** How many times wider the Frame's Bead is than the Canvas's along a row (ADR 0079, ticket 0665): what a length of
 * the Frame's is read on the Canvas by, through millimetres. 1 without a Frame, or where a Bead has no copy. */
export function frameScale(project: Layered): number {
  const [canvas, frame] = [beadOfLayer(project, 'canvas').bead, beadOfLayer(project, 'frame').bead]
  return canvas && frame ? beadPitchMm(frame) / beadPitchMm(canvas) : 1
}

/** Whether the Frame's Bead draws its cells as the Canvas's does (ticket 0665): as wide, and as tall where the Bead
 * shape is Real. Without a Frame, the Canvas is alike itself. */
export function sameBeadSize(project: Layered): boolean {
  return frameScale(project) === 1 && frameWeave(project).cell?.aspect === canvasWeave(project).cell?.aspect
}

/** Whether the Frame's positions are the Canvas's one to one (ADR 0066, 0079): woven alike, in a Bead of the same
 * size. Otherwise a Frame's position is read on the Canvas through millimetres. False without a Frame. */
export function layersAlike(project: Layered): boolean {
  const frame = heldWeave(project, 'frame')
  return !!frame && sameWeave(canvasWeave(project), frame) && sameBeadSize(project)
}

/** The Frame as it lies on the Canvas (ticket 0665): its sheet, its Weave with its own Bead's cell, and how many times
 * wider its Bead is than the Canvas's. What a view lays the Frame out from; none without a Frame. */
export type PlacedFrame = FrameSheet & Weave & { scale: number }

/** The Project's Frame as it lies on the Canvas (see `PlacedFrame`), or none. */
export function placedFrame(project: Layered): PlacedFrame | undefined {
  const frame = frameOf(project)
  return frame && { ...frame, ...frameWeave(project), scale: frameScale(project) }
}

/** A distance in the Frame's own rows and columns (in `frame`, a Weave of its, drawn in its Bead), as the nearest whole
 * Canvas positions through millimetres (tickets 492, 0665), the same where the layers are alike. A half rounds away
 * from zero both ways, so an edge moved out and back puts the Frame where it was (ticket 0638). */
export function canvasDistance(project: Layered, frame: Weave, rows: number, columns: number): GridPosition {
  const canvas = canvasWeave(project)
  if (sameWeave(canvas, frame) && sameBeadSize(project)) {
    return { row: rows, column: columns }
  }
  const scale = frameScale(project)
  const own = positionStep(withCell(weaveOf(frame), frame.cell ?? frameWeave(project).cell))
  const target = positionStep(canvas)
  const nearest = (distance: number) => Math.sign(distance) * Math.round(Math.abs(distance)) || 0
  return { row: nearest((rows * own.down * scale) / target.down), column: nearest((columns * own.across * scale) / target.across) }
}

/** Beads in the Frame's own rows and columns laid on the Canvas, its first row and column at `corner` (ADR 0079, ticket
 * 0665): in a Bead of the same size each keeps its row and column; in another, each Canvas position takes the bead
 * whose cell holds its middle, read through millimetres, so what lands looks as the Frame drew it. */
export function laidOnCanvas(project: Layered, beads: BeadMap, corner: GridPosition): BeadMap {
  const bounds = beadBounds(beads)
  if (sameBeadSize(project) || !bounds) {
    return shiftedBeads(beads, corner.row, corner.column)
  }
  const scale = frameScale(project)
  const canvas = describeWeave(canvasWeave(project))
  // Its cells read square-cornered, so a middle on a round bead's corner still finds the bead whose cell holds it.
  const frame = describeWeave(withCell(frameWeave(project), { aspect: describeWeave(frameWeave(project)).cellAspect, roundness: 0 }))
  // Everything in Canvas bead widths, from the Canvas's top-left; the Frame's from its corner, `scale` times as wide.
  const origin = canvas.origin(corner, 1, canvas.cellAspect)
  const box = frame.blockBox(bounds, scale, scale * frame.cellAspect)
  const area = { left: origin.x + box.x, right: origin.x + box.x + box.width, top: origin.y + box.y, bottom: origin.y + box.y + box.height }
  const seen = canvas.visible(area, 1, canvas.cellAspect)
  const laid: BeadChange[] = []
  for (let row = seen.firstRow; row <= seen.lastRow; row += 1) {
    const { first, last } = seen.columnsOf(row)
    for (let column = first; column <= last; column += 1) {
      const middle = canvas.center({ row, column }, 1, canvas.cellAspect)
      const under = frame.positionAt((middle.x - origin.x) / scale, (middle.y - origin.y) / scale, 1, frame.cellAspect)
      const color = under && colorAt(beads, under.row, under.column)
      if (color) laid.push({ row, column, color })
    }
  }
  return withColors({}, laid)
}
