import { rotateFrame } from '../../domain/rotate'
import { rowProgressStarted, type Project } from '../../domain/project'
import type { Translations } from '../../i18n/translations'
import type { EditFn } from '../project/useEdit'

/** What Rotate Frame needs from the app shell: the Edit path, the open Project and the announcer. */
export interface RotateFrameFlowDeps {
  edit: EditFn
  currentProject: () => Project | undefined
  announce: (message: string) => void
  messages: () => Translations
}

/** Rotate Frame (ticket 471, ADR 0063, 0066): the Frame and its own beads a quarter turn, as one drawing Edit so Undo
 * restores all. The Canvas under it is not touched, so there is nothing to say was covered. */
export function useRotateFrameFlow(deps: RotateFrameFlowDeps) {
  function onRotateFrame(): void {
    const before = deps.currentProject()
    if (!before?.frame || rowProgressStarted(before)) {
      return
    }
    deps.edit('drawing', (project) => rotateFrame(project) ?? project)
    deps.announce(deps.messages().frame.announceFrameRotated)
  }

  return { onRotateFrame }
}
