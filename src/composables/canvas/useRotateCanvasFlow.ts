import { turnCanvasTo, turnTableTo } from '../../domain/rotate'
import { turnedOrientation } from '../../domain/canvasOrientation'
import { orientationOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { TablePoint } from '../../domain/table'
import type { Translations } from '../../i18n/translations'

/** What Rotate canvas needs from the app shell: the open Project, its write path, the announcer, and the view, which
 * turns the Canvas about the middle of the drawing area. */
export interface RotateCanvasFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  announce: (message: string) => void
  messages: () => Translations
  /** Turns the view to `orientation` about the drawing area's middle; how far the Canvas's origin moved on the table,
   * in its bead widths (ticket 1188). Left out, it turns about its origin. */
  turnView?: (orientation: number) => TablePoint
}

/**
 * Rotate canvas (ticket 471, ADR 0052): each press turns the Canvas a quarter clockwise about the screen's middle, its
 * orientation (ADR 0079), and a twist on touch any angle (ticket 0672); the Frame stays where it is (ticket 1188). A view setting like Row direction, saved with the Project but no Edit: no Undo step, no lock rule. */
export function useRotateCanvasFlow(deps: RotateCanvasFlowDeps) {
  function onRotateCanvas(): void {
    const project = deps.currentProject()
    if (!project) {
      return
    }
    const to = turnedOrientation(orientationOf(project), 90)
    deps.replaceProject(turnCanvasTo(project, to, deps.turnView?.(to)))
    deps.announce(deps.messages().canvas.announceCanvasRotated)
  }

  /** Keeps the angle a two-finger twist settled on (ticket 0672), saved with the Project like the button's turn: the whole
   * Table turned, every layer with it (spec 1234). A gesture the person watched as it went, so nothing is announced. */
  function onTwistTable(angle: number): void {
    const project = deps.currentProject()
    if (project) {
      deps.replaceProject(turnTableTo(project, angle))
    }
  }

  return { onRotateCanvas, onTwistTable }
}
