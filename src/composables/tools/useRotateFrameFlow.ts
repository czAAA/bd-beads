import { ref } from 'vue'
import { rotateFrame } from '../../domain/rotate'
import type { Project } from '../../domain/project'
import type { Translations } from '../../i18n/translations'
import type { EditFn } from '../project/useEdit'
import { frameOf } from '../../domain/layerRecord'

/** What Rotate Frame needs from the app shell: the Edit path, the open Project and the announcer. */
export interface RotateFrameFlowDeps {
  edit: EditFn
  currentProject: () => Project | undefined
  announce: (message: string) => void
  messages: () => Translations
}

/** Rotate Frame (tickets 471, 0647, 0667, 1016, ADR 0052, 0079): the Frame's orientation a quarter turn on, as one
 * Edit; exempt, as no bead moves, so it never asks, and the Canvas under it is untouched. Each press is counted before
 * its Edit, so the surface takes the Frame as drawn and shows it turning. */
export function useRotateFrameFlow(deps: RotateFrameFlowDeps) {
  /** How many times Rotate Frame has turned the Frame: what the Frame is seen turning by, never an Undo. */
  const frameTurns = ref(0)

  function onRotateFrame(): void {
    if (!frameOf(deps.currentProject())) {
      return
    }
    frameTurns.value += 1
    deps.edit('exempt', (project) => rotateFrame(project) ?? project)
    deps.announce(deps.messages().frame.announceFrameRotated)
  }

  return { onRotateFrame, frameTurns }
}
