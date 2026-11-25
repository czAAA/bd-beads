import type { FrameSheet } from './canvas'
import type { FrameRef } from './grid'
import { frameGeometry, type ShapedSheet } from './frameShape'
import type { LayerGeometry } from './layerGeometry'
import { frameById, type Layered } from './layerRecord'
import { frameWeave } from './layerWeave'

// A Frame's Layer geometry, apart from `layers` so that where a Frame lies on the Table (`sheets`) can read it without a
// circle through the layers that read where it lies.

/** The Frame as its Frame shape reads it, in its own Weave with its Bead's cell. The Project must have a Frame. */
export function shapedFrame(project: Layered, frame: FrameRef): ShapedSheet {
  const { rows, columns, shape, settings, quarterTurns } = frameById(project, frame)!
  return { rows, columns, ...(shape ? { shape } : {}), ...(settings ? { settings } : {}), ...(quarterTurns ? { quarterTurns } : {}), ...frameWeave(project, frame) }
}

// A Frame is never changed in place, so its geometry is built once for each Bead's cell it is drawn in.
const geometries = new WeakMap<FrameSheet, Map<string, LayerGeometry>>()

/** A Frame's Layer geometry (ADR 0078), counted from its own first row and column. The Project must have that Frame. */
export function frameGeometryOf(project: Layered, ref: FrameRef): LayerGeometry {
  const frame = frameById(project, ref)!
  const cell = frameWeave(project, ref).cell
  const key = cell ? `${cell.aspect}:${cell.roundness}` : ''
  let known = geometries.get(frame)
  if (!known) {
    known = new Map()
    geometries.set(frame, known)
  }
  let found = known.get(key)
  if (!found) {
    found = frameGeometry(shapedFrame(project, ref))
    known.set(key, found)
  }
  return found
}
