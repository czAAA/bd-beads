import type { MirrorAxisCounts } from '../../domain/mirror'
import type { Pattern, UndoEntry } from '../../domain/pattern'
import { rotatePattern } from '../../domain/rotate'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'

export interface RotateFlowDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
  recordHistory: (entry: UndoEntry) => void
  mirrorAxisCounts: () => MirrorAxisCounts
  clearMirrorAxisCounts: () => void
  clearSelectionAndHover: () => void
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  locale: () => Locale
}

/**
 * Rotate (CONTEXT.md, ADR 0026): a quarter turn of the Frame and its beads about its centre, as one Undo step that
 * restores the beads, the Frame and any Piece it had to move. It needs a Frame, and is refused while Row progress is on
 * (its rows are the Frame's, which a turn would change). A Piece the turned Frame covers moves clear of it, and a
 * Message says how many, with Undo. Deps are read lazily.
 */
export function useRotateFlow(deps: RotateFlowDeps) {
  function onRotate(): void {
    const pattern = deps.currentPattern()
    if (!pattern?.frame || pattern.rowProgress.enabled) {
      return
    }
    const result = rotatePattern(pattern)
    if (!result) {
      return
    }

    deps.recordHistory({
      beads: pattern.beads,
      rowProgress: pattern.rowProgress,
      size: { frame: pattern.frame, mirrorAxisCounts: deps.mirrorAxisCounts() },
    })
    deps.replacePattern(result.pattern)
    deps.clearMirrorAxisCounts()
    deps.clearSelectionAndHover()

    const t = deps.messages()
    if (result.moved > 0) {
      const text = plural(deps.locale(), result.moved, t.frame.rotatedMessage)
      deps.showToast('pattern-rotated', text, 'info', { label: t.palette.undoButton, run: deps.onUndo })
    } else {
      deps.announce(t.frame.announceRotated)
    }
  }

  return { onRotate }
}
