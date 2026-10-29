import { rotateCanvas } from '../../domain/rotate'
import type { Project } from '../../domain/project'
import type { Translations } from '../../i18n/translations'

/** What Rotate canvas needs from the app shell: the open Project, its write path and the announcer. */
export interface RotateCanvasFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  announce: (message: string) => void
  messages: () => Translations
}

/**
 * Rotate canvas (ticket 471, ADR 0052): each press turns the picture a quarter clockwise, the Canvas's orientation (ADR
 * 0079). A view setting like Row direction, saved with the Project but no Edit: no Undo step, no lock rule. */
export function useRotateCanvasFlow(deps: RotateCanvasFlowDeps) {
  function onRotateCanvas(): void {
    const project = deps.currentProject()
    if (!project) {
      return
    }
    deps.replaceProject(rotateCanvas(project))
    deps.announce(deps.messages().canvas.announceCanvasRotated)
  }

  return { onRotateCanvas }
}
