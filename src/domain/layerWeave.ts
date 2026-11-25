import type { FrameSheet } from './canvas'
import { isFrameLayer, type FrameRef, type Layer } from './grid'
import { beadOfLayer, frameById, weaveOfLayer, weaveOf, type Layered } from './layerRecord'
import { describeWeave, weaveSettings, type Weave } from './weave'

export { weaveOf }

// The Weave each layer is woven in (ticket 492), read through the layer's record (ticket 0661), and how a distance in
// one reads in the other.

/** The Canvas's Weave (tickets 492, 0625). */
export function canvasWeave(project: Layered): Weave {
  return weaveOfLayer(project, 'canvas')
}

/** A Frame's Weave (ticket 492), which may differ from the Canvas's; a Canvas without that Frame counts its rows in its
 * own. The one place that says which Weave a Frame's rows, rulers, passes and exports are counted in. */
export function frameWeave(project: Layered, frame: FrameRef): Weave {
  return weaveOfLayer(project, frame) ?? canvasWeave(project)
}

/** The Weave of one layer, the Frame's or the Canvas's (ticket 0625). */
export function layerWeave(project: Layered, layer: Layer): Weave {
  return isFrameLayer(layer) ? frameWeave(project, layer) : canvasWeave(project)
}

/** Whether two Weaves lay positions out alike: the same Technique, and the same value of every setting it describes. */
export function sameWeave(a: Weave, b: Weave): boolean {
  if (a.technique !== b.technique) {
    return false
  }
  const [x, y] = [weaveSettings(a), weaveSettings(b)]
  return Object.keys(x).every((id) => x[id] === y[id])
}

/** How many times wider the Frame's cell is than the Canvas's, each Bead laid as its layer's Technique lays it (ADR 0079,
 * tickets 0665, 0734): what a length of the Frame's is read on the Canvas by, through millimetres. 1 without a Frame, or
 * where a Bead has no copy. */
export function frameScale(project: Layered, ref: FrameRef): number {
  const [canvas, frame] = [beadOfLayer(project, 'canvas').bead, beadOfLayer(project, ref).bead]
  if (!canvas || !frame) return 1
  return describeWeave(frameWeave(project, ref)).beadMm(frame).widthMm / describeWeave(canvasWeave(project)).beadMm(canvas).widthMm
}

/** A layer's cell width in mm: its Bead as its Technique lays it (ADR 0079), the Table's unit (spec 1234); 1 where it
 * has no Bead copy. */
export function cellWidthMm(project: Layered, layer: Layer): number {
  const { bead } = beadOfLayer(project, layer)
  return bead ? describeWeave(layerWeave(project, layer)).beadMm(bead).widthMm : 1
}

/** Whether the Frame's Bead draws its cells as the Canvas's does (ticket 0665): as wide, and as tall where the Bead
 * shape is Real. Without a Frame, the Canvas is alike itself. */
export function sameBeadSize(project: Layered, frame: FrameRef): boolean {
  return frameScale(project, frame) === 1 && frameWeave(project, frame).cell?.aspect === canvasWeave(project).cell?.aspect
}

/** The Frame as it lies on the Canvas (ticket 0665): its sheet, its Weave with its own Bead's cell, and how many times
 * wider its Bead is than the Canvas's. What a view lays the Frame out from; none without a Frame. */
export type PlacedFrame = FrameSheet & Weave & { scale: number }

/** A Frame of the Project as it lies on the Canvas (see `PlacedFrame`), or none. */
export function placedFrame(project: Layered, ref: FrameRef): PlacedFrame | undefined {
  const frame = frameById(project, ref)
  return frame && { ...frame, ...frameWeave(project, ref), scale: frameScale(project, ref) }
}
