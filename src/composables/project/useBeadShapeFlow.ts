import type { Layer } from '../../domain/grid'
import { layerOf } from '../../domain/layerRecord'
import { withBeadShape } from '../../domain/projectBead'
import type { Project } from '../../domain/project'
import type { BeadShape } from '../../domain/weave'
import type { EditFn } from './useEdit'

export interface BeadShapeFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
}

/** A layer's Bead shape choice (ADR 0068, tickets 508, 0687), from that layer's panel: the Project panel's Canvas section
 * or the Frame panel. Applied at once to that layer alone, one Undo step. */
export function useBeadShapeFlow(deps: BeadShapeFlowDeps) {
  function setBeadShape(layer: Layer, shape: BeadShape): void {
    const project = deps.currentProject()
    const held = project && layerOf(project, layer)
    if (!held || held.beadShape === shape) return
    deps.edit('exempt', (project) => withBeadShape(project, shape, layer))
  }

  return { setBeadShape }
}
