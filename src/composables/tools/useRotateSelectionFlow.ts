import type { Ref } from 'vue'
import { coveredByRotation, rotateSelection, type RotatedSelection } from '../../domain/rotate'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from '../project/useEdit'

export interface RotateSelectionFlowDeps {
  edit: EditFn
  currentProject: () => Project | undefined
  /** The Select tool's Selection: Rotate turns it, and the turned rectangle takes its place. */
  selection: Ref<Selection | undefined>
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  locale: () => Locale
}

/**
 * Rotate (CONTEXT.md, ADR 0052): a quarter turn of the Selection's beads about its centre, as one drawing Edit, so Undo
 * restores every bead the turn covered. The keep-out margin and finished rows trim it silently, as Paste. The turned
 * rectangle becomes the Selection; a Message says how many beads it covered, with Undo. Deps are read lazily.
 */
export function useRotateSelectionFlow(deps: RotateSelectionFlowDeps) {
  function onRotate(): void {
    const selection = deps.selection.value
    const before = deps.currentProject()
    if (!selection || !before) {
      return
    }

    let turned: RotatedSelection | undefined
    const outcome = deps.edit('drawing', (project) => {
      turned = rotateSelection(project, selection)
      return turned.project
    })
    const turnedSelection = turned?.selection ?? rotateSelection(before, selection).selection
    deps.selection.value = turnedSelection

    const after = deps.currentProject()
    const covered = outcome.kind === 'applied' && after ? coveredByRotation(before, after, selection, turnedSelection) : 0
    const t = deps.messages()
    if (covered > 0) {
      const text = plural(deps.locale(), covered, t.frame.rotateCoveredMessage)
      deps.showToast('selection-rotated', text, 'info', { label: t.palette.undoButton, run: deps.onUndo })
    } else {
      deps.announce(t.frame.announceSelectionRotated)
    }
  }

  return { onRotate }
}
