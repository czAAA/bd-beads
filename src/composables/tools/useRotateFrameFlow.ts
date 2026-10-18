import { coveredByRotation, frameAreaSelection, rotateFrame } from '../../domain/rotate'
import { rowProgressStarted, type Project } from '../../domain/project'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from '../project/useEdit'

/** What Rotate Frame needs from the app shell: the Edit path, the open Project and the Message and announcer. */
export interface RotateFrameFlowDeps {
  edit: EditFn
  currentProject: () => Project | undefined
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  locale: () => Locale
}

/**
 * Rotate Frame (ticket 471, ADR 0063): the Frame, its margin and the beads inside a quarter turn, as one drawing Edit so
 * Undo restores all. A Message says how many beads outside it covered, with Undo. The Edit chrome is left as it was. */
export function useRotateFrameFlow(deps: RotateFrameFlowDeps) {
  function onRotateFrame(): void {
    const before = deps.currentProject()
    if (!before?.frame || rowProgressStarted(before)) {
      return
    }
    const area = frameAreaSelection(before.frame)

    const outcome = deps.edit('drawing', (project) => rotateFrame(project) ?? project)

    const after = deps.currentProject()
    // The turned area is the new Frame and its margin, which the Edit has already put in the Project.
    const covered =
      outcome.kind === 'applied' && after?.frame ? coveredByRotation(before, after, area, frameAreaSelection(after.frame)) : 0
    const t = deps.messages()
    if (covered > 0) {
      const text = plural(deps.locale(), covered, t.frame.rotateCoveredMessage)
      deps.showToast('frame-rotated', text, 'info', { label: t.palette.undoButton, run: deps.onUndo })
    } else {
      deps.announce(t.frame.announceFrameRotated)
    }
  }

  return { onRotateFrame }
}
