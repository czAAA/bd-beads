import { computed, type Ref } from 'vue'
import { rotateLayerSelection } from '../../domain/rotate'
import type { Project } from '../../domain/project'
import { selectionInFinishedRows, type Selection } from '../../domain/selection'
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
  /** The language a counted Message is worded in. */
  locale: () => Locale
}

// Rotate (CONTEXT.md, ADR 0052): a quarter turn of the Selection's beads about its centre as one drawing Edit, held back
// where the Selection reaches into finished rows and trimmed where it lands on them (ticket 0647). The turned rectangle
// becomes the Selection; a Message says when it covered beads, with Undo, or how many a Custom frame dropped (0594).
export function useRotateSelectionFlow(deps: RotateSelectionFlowDeps) {
  /** Whether the Selection reaches into finished rows, so Rotate shows disabled and saying why. */
  const heldBack = computed(() => {
    const selection = deps.selection.value
    const project = deps.currentProject()
    return !!selection && !!project && selectionInFinishedRows(project, selection)
  })

  function onRotate(): void {
    const selection = deps.selection.value
    const before = deps.currentProject()
    // Shift+R reaches here without asking the control, so the rule is checked here too.
    if (!selection || !before || heldBack.value) {
      return
    }

    let turnedSelection = selection
    let turnedCovered = 0
    let turnedDropped = 0
    const outcome = deps.edit('drawing', (project) => {
      const turned = rotateLayerSelection(project, selection)
      turnedSelection = turned.selection
      turnedCovered = turned.covered
      turnedDropped = turned.dropped
      return turned.project
    })
    deps.selection.value = turnedSelection

    const covered = outcome.kind === 'applied' ? turnedCovered : 0
    const dropped = outcome.kind === 'applied' ? turnedDropped : 0
    const t = deps.messages()
    if (dropped > 0) {
      deps.showToast('selection-rotated', plural(deps.locale(), dropped, t.tools.droppedOnShapeMessage), 'info', { label: t.palette.undoButton, run: deps.onUndo })
    } else if (covered > 0) {
      deps.showToast('selection-rotated', t.frame.rotateCoveredMessage, 'info', { label: t.palette.undoButton, run: deps.onUndo })
    } else {
      deps.announce(t.frame.announceSelectionRotated)
    }
  }

  return { onRotate, heldBack }
}
