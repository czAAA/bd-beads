import { rotateCanvas, type Project } from '../../domain/project'
import type { Translations } from '../../i18n/translations'

export interface RotateCanvasFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  announce: (message: string) => void
  messages: () => Translations
}

/**
 * Rotate canvas (CONTEXT.md, ticket 471, ADR 0063): each press turns the whole picture a quarter clockwise by advancing
 * `Project.rotation`. A view setting like Row direction: it is saved with the Project but is no Edit, so no Undo step,
 * and no Row progress lock or margin rule applies. Deps are read lazily.
 */
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
