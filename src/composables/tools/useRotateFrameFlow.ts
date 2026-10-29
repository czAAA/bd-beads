import { rotateFrame } from '../../domain/rotate'
import type { Project } from '../../domain/project'
import type { Translations } from '../../i18n/translations'
import type { EditFn } from '../project/useEdit'

/** What Rotate Frame needs from the app shell: the Edit path, the open Project and the announcer. */
export interface RotateFrameFlowDeps {
  edit: EditFn
  currentProject: () => Project | undefined
  announce: (message: string) => void
  messages: () => Translations
}

/** Rotate Frame (tickets 471, 0647, 0667, ADR 0052, 0079): the Frame's orientation a quarter turn on, as one Edit so
 * Undo restores it. An exempt one: no bead moves, so the finished-row lock has nothing to trim, and it never asks. The
 * Canvas under it is not touched, so there is nothing to say was covered. */
export function useRotateFrameFlow(deps: RotateFrameFlowDeps) {
  function onRotateFrame(): void {
    if (!deps.currentProject()?.frame) {
      return
    }
    deps.edit('exempt', (project) => rotateFrame(project) ?? project)
    deps.announce(deps.messages().frame.announceFrameRotated)
  }

  return { onRotateFrame }
}
