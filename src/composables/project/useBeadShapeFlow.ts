import type { Layer } from '../../domain/grid'
import { beadOfLayer, frameOf } from '../../domain/layerRecord'
import { withBeadShape } from '../../domain/projectBead'
import { touch, type Project } from '../../domain/project'
import type { BeadShape } from '../../domain/weave'

export interface BeadShapeFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
}

/** A layer's Bead shape (ADR 0068, 0079, ticket 0670), picked in its Layer settings: how that layer is drawn, a view
 * saved with the Project like its Background, so no Edit, no Undo step and no Row progress lock. */
export function useBeadShapeFlow(deps: BeadShapeFlowDeps) {
  function setBeadShape(layer: Layer, shape: BeadShape): void {
    const project = deps.currentProject()
    if (!project || (layer === 'frame' && !frameOf(project)) || beadOfLayer(project, layer).beadShape === shape) return
    deps.replaceProject(touch(withBeadShape(project, layer, shape), {}))
  }

  return { setBeadShape }
}
