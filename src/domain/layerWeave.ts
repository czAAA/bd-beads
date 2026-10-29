import type { GridPosition, Layer } from './grid'
import { weaveOfLayer, type Layered } from './layerRecord'
import { positionStep, weaveSettings, type Weave } from './weave'

export { weaveOf } from './layerRecord'

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

/** A distance counted in the Frame's own rows and columns, as Canvas positions (ticket 492): the nearest whole ones,
 * exactly the same where Frame and Canvas are woven alike. A half rounds away from zero both ways, so an edge moved out
 * and back puts the Frame where it was (ticket 0638). */
export function canvasDistance(project: Layered, frame: Weave, rows: number, columns: number): GridPosition {
  const canvas = canvasWeave(project)
  if (sameWeave(canvas, frame)) {
    return { row: rows, column: columns }
  }
  const own = positionStep(frame)
  const target = positionStep(canvas)
  const nearest = (distance: number) => Math.sign(distance) * Math.round(Math.abs(distance)) || 0
  return { row: nearest((rows * own.down) / target.down), column: nearest((columns * own.across) / target.across) }
}
