import { changeFrame } from '../../domain/changeFrame'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from './useEdit'

export interface RotateFlowDeps {
  edit: EditFn
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  locale: () => Locale
}

/**
 * Rotate (CONTEXT.md, ADR 0026): a quarter turn of the Frame and its beads about its centre, as one Undo step that
 * restores the beads, the Frame and any Piece it had to move. changeFrame refuses it without a Frame or while Row
 * progress is on. A Piece the turned Frame covers moves clear of it, and a
 * Message says how many, with Undo. Deps are read lazily.
 */
export function useRotateFlow(deps: RotateFlowDeps) {
  function onRotate(): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { rotate: true }))
    if (outcome.kind !== 'applied') {
      return
    }

    const t = deps.messages()
    if (outcome.moved > 0) {
      const text = plural(deps.locale(), outcome.moved, t.frame.rotatedMessage)
      deps.showToast('project-rotated', text, 'info', { label: t.palette.undoButton, run: deps.onUndo })
    } else {
      deps.announce(t.frame.announceRotated)
    }
  }

  return { onRotate }
}
