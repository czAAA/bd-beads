import type { Ref } from 'vue'
import { rotateLayerSelection } from '../../domain/rotate'
import { rowProgressStarted, type Project } from '../../domain/project'
import { describeWeave } from '../../domain/weave'
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

// Rotate (CONTEXT.md, ADR 0052): a quarter turn of the Selection's beads about its centre as one drawing Edit (Undo
// restores all). The keep-out margin and finished rows trim it silently, as Paste. The turned rectangle becomes the
// Selection; a Message gives the count, with Undo. Deps are read lazily.
export function useRotateSelectionFlow(deps: RotateSelectionFlowDeps) {
  function onRotate(): void {
    const selection = deps.selection.value
    const before = deps.currentProject()
    // Shift+R reaches here without asking the control, so the lock of ticket 411 is checked here too.
    if (!selection || !before || rowProgressStarted(before) || !describeWeave(before).quarterTurn) {
      return
    }

    let turnedSelection = selection
    let turnedCovered = 0
    const outcome = deps.edit('drawing', (project) => {
      const turned = rotateLayerSelection(project, selection)
      turnedSelection = turned.selection
      turnedCovered = turned.covered
      return turned.project
    })
    deps.selection.value = turnedSelection

    const covered = outcome.kind === 'applied' ? turnedCovered : 0
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
