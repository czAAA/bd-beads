import { computed } from 'vue'
import { pieceInSelection, pieceNameAt, withPieceName } from '../../domain/pieceNames'
import type { GridPosition } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { selectionLayer, type Selection } from '../../domain/selection'
import type { EditFn } from './useEdit'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What Name Piece needs from the app shell: the open Project, Edit and the Selection. */
export interface NamePieceFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  selection: () => Selection | undefined
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

// "Name Piece" (ticket 406, ADR 0050): names the Selection's one Piece in a dialog; an empty name makes it plain. One
// Edit, one Undo step. The Piece is fixed when the dialog opens so a changed Selection can't move the name. Deps are
// lazy.
export function useNamePieceFlow(deps: NamePieceFlowDeps) {
  /** The bead that stands for the Piece the Selection covers, or undefined when it covers none or several. */
  const target = computed(() => {
    const project = deps.currentProject()
    const selection = deps.selection()
    // Pieces are the Canvas's: a Selection on the Frame names nothing (ADR 0066).
    return project && selection && selectionLayer(project, selection) === 'canvas' ? pieceInSelection(project, selection) : undefined
  })

  const canNamePiece = computed(() => !!target.value)

  /** The Piece being named while the dialog is open. */
  const naming = (deps.dialogs ?? useDialogs()).question<{ at: GridPosition; name: string }>('name-piece')

  function onNamePiece() {
    const at = target.value
    const project = deps.currentProject()
    if (at && project) {
      naming.value = { at, name: pieceNameAt(project, at) ?? '' }
    }
  }

  function onSavePieceName(name: string) {
    const at = naming.value?.at
    naming.value = undefined
    if (at) {
      deps.edit('exempt', (project) => withPieceName(project, at, name))
    }
  }

  return { canNamePiece, naming, onNamePiece, onSavePieceName, onCancelPieceName: () => (naming.value = undefined) }
}
