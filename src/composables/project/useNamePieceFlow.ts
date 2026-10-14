import { computed, ref } from 'vue'
import { pieceInSelection, pieceNameAt, withPieceName } from '../../domain/pieceNames'
import type { GridPosition } from '../../domain/grid'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import type { EditFn } from './useEdit'

/** What Name Piece needs from the app shell: the open Project, Edit and the Selection. */
export interface NamePieceFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  selection: () => Selection | undefined
}

/**
 * "Name Piece" (ticket 406, ADR 0050): the Selection holds beads of exactly one Piece, and Name asks for its name in a
 * dialog; saving an empty name takes the name off and makes it a plain Piece again. One Edit, so one Undo step. The
 * Piece is fixed when the dialog opens, so a changed Selection behind it cannot move the name. Deps are read lazily.
 */
export function useNamePieceFlow(deps: NamePieceFlowDeps) {
  /** The bead that stands for the Piece the Selection covers, or undefined when it covers none or several. */
  const target = computed(() => {
    const project = deps.currentProject()
    const selection = deps.selection()
    return project && selection ? pieceInSelection(project, selection) : undefined
  })

  const canNamePiece = computed(() => !!target.value)

  /** The Piece being named while the dialog is open. */
  const naming = ref<{ at: GridPosition; name: string }>()

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
