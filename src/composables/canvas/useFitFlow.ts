import { nearestQuarterTurn } from '../../domain/canvasOrientation'
import { frameIdOf, framesOf, orientationOf } from '../../domain/layerRecord'
import type { FrameId } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { frameAngleOf } from '../../domain/table'

/** What Fit needs from the app shell: the open Project, the three moves it makes and whether the Frame is expanded. */
export interface FitFlowDeps {
  currentProject: () => Project | undefined
  /** Puts the Canvas back to 0°, a view setting with no Undo step (the Rotate canvas flow's twist keep). */
  turnCanvasBack: () => void
  /** Settles the Frame onto `angle`, one Undo step, or asks first where rows are done (Rotate Frame's). */
  settleFrame: (angle: number, frame: FrameId) => unknown
  /** The view's own fit (the zoom and place). */
  fitView: () => void
  /** The expanded Frame fills the room and its own turn is the Frame's alone: Fit then only refits it. */
  frameExpanded: () => boolean
}

/** Fit (ticket 1227, spec 1214): the Canvas back to 0°, every leaning Frame onto its nearest quarter turn, then the
 * zoom to fit. A Frame on a quarter turn stays; each Frame's settle is one Undo step, the Canvas's turn none. */
export function useFitFlow(deps: FitFlowDeps) {
  function onFit(): void {
    const project = deps.currentProject()
    if (project && !deps.frameExpanded()) {
      if (orientationOf(project) !== 0) deps.turnCanvasBack()
      for (const frame of framesOf(project)) {
        const angle = frameAngleOf(project, frameIdOf(frame))
        if (angle !== nearestQuarterTurn(angle)) deps.settleFrame(nearestQuarterTurn(angle), frameIdOf(frame))
      }
    }
    deps.fitView()
  }

  return { onFit }
}
