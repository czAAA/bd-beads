import { withBeadShape } from '../../domain/projectBead'
import type { Project } from '../../domain/project'
import { DEFAULT_BEAD_SHAPE, type BeadShape } from '../../domain/weave'
import type { EditFn } from './useEdit'

export interface BeadShapeFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
}

/** The Project panel's Bead shape choice (ADR 0068, ticket 508): applied at once to both layers, one Undo step. */
export function useBeadShapeFlow(deps: BeadShapeFlowDeps) {
  function setBeadShape(shape: BeadShape): void {
    if ((deps.currentProject()?.beadShape ?? DEFAULT_BEAD_SHAPE) === shape) return
    deps.edit('exempt', (project) => withBeadShape(project, shape))
  }

  return { setBeadShape }
}
