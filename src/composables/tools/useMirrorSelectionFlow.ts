import type { Ref } from 'vue'
import { isMirrorOn, type MirrorSetting } from '../../domain/mirror'
import { mirrorLayerSelection } from '../../domain/mirrorSelection'
import type { Selection } from '../../domain/selection'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from '../project/useEdit'

export interface MirrorSelectionFlowDeps {
  edit: EditFn
  /** The Select tool's Selection: the fragment Mirror copies from, and still the Selection after. */
  selection: Ref<Selection | undefined>
  /** The Project's Mirror setting (useMirrorFlow): the Axes and Mirror mode the counterparts follow. */
  mirror: () => MirrorSetting
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  /** The language a counted Message is worded in. */
  locale: () => Locale
}

// Mirror (Selection bar) (ticket 0707, spec 0702, ADR 0082): the fragment's beads copied to their counterparts as one
// drawing Edit, the fragment untouched and still selected. One Message counts the counterparts that had nowhere to
// land, with Undo where something landed; otherwise the result is announced.
export function useMirrorSelectionFlow(deps: MirrorSelectionFlowDeps) {
  function onMirrorSelection(): void {
    const selection = deps.selection.value
    const setting = deps.mirror()
    if (!selection || !isMirrorOn(setting)) return

    let dropped = 0
    const outcome = deps.edit('drawing', (project) => {
      const mirrored = mirrorLayerSelection(project, selection, setting)
      dropped = mirrored.dropped
      return mirrored.project
    })

    const t = deps.messages()
    if (dropped > 0) {
      const undo = outcome.kind === 'applied' ? { label: t.palette.undoButton, run: deps.onUndo } : undefined
      deps.showToast('selection-mirrored', plural(deps.locale(), dropped, t.mirror.droppedMessage), 'info', undo)
    } else if (outcome.kind === 'applied') {
      deps.announce(t.mirror.announceSelectionMirrored)
    }
  }

  return { onMirrorSelection }
}
