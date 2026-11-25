import type { Project } from '../../domain/project'
import { tableTurnOf } from '../../domain/table'

/** What Fit needs from the app shell: the open Project, the two moves it makes and whether the Frame is expanded. */
export interface FitFlowDeps {
  currentProject: () => Project | undefined
  /** Puts the Table back to 0°, a view setting with no Undo step (the Rotate canvas flow's twist keep). */
  turnTableBack: () => void
  /** The view's own fit (the zoom and place). */
  fitView: () => void
  /** The expanded Frame fills the room and its own turn is the Frame's alone: Fit then only refits it. */
  frameExpanded: () => boolean
}

/** Fit (ticket 1227, spec 1214, spec 1234): the Table turn back to 0°, every layer's own quarter turn as it is, then the
 * zoom to fit. */
export function useFitFlow(deps: FitFlowDeps) {
  function onFit(): void {
    const project = deps.currentProject()
    if (project && !deps.frameExpanded() && tableTurnOf(project) !== 0) deps.turnTableBack()
    deps.fitView()
  }

  return { onFit }
}
