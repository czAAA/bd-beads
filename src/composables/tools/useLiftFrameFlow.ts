import { frameLifted, withFrameLift } from '../../domain/frame'
import { frameOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { Translations } from '../../i18n/translations'
import type { EditFn } from '../project/useEdit'

/** What Lift needs from the app shell: the Edit path, the open Project and the announcer. */
export interface LiftFrameFlowDeps {
  edit: EditFn
  currentProject: () => Project | undefined
  announce: (message: string) => void
  messages: () => Translations
}

/** Lift (ticket 1177, MarginSheet card): the Frame's pieces stand off the grid or lie flat again, as one Edit. Exempt:
 * no bead and no Row progress changes, so it never asks. Said once after each press. */
export function useLiftFrameFlow(deps: LiftFrameFlowDeps) {
  function onToggleLift(): void {
    const project = deps.currentProject()
    if (!frameOf(project)) return
    const lift = !frameLifted(project!)
    deps.edit('exempt', (current) => withFrameLift(current, lift))
    const { announcePiecesLifted, announcePiecesLaidFlat } = deps.messages().frame
    deps.announce(lift ? announcePiecesLifted : announcePiecesLaidFlat)
  }

  return { onToggleLift }
}
