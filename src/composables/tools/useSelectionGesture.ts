import { computed, ref } from 'vue'
import { frameGeometryOf, layerAt, type Layer } from '../../domain/layers'
import type { GridPosition, PreviewCell } from '../../domain/grid'
import { beadColorAt } from '../../domain/layerBeads'
import type { Project } from '../../domain/project'
import {
  selectAllSelection,
  copyLayerSelection,
  movedSelection,
  paintLayerSelection,
  pasteLostCount,
  pasteOnLayer,
  pastedCellsOnLayer,
  pieceSelectionOnLayer,
  selectionBetween,
  selectionWithEdges,
  type CopiedBlock,
  type PasteLoss,
  type Selection,
} from '../../domain/selection'
import { frameAllows } from '../../domain/frameShape'
import { laidFrame } from '../../domain/frameOrientation'
import { layerOf } from '../../domain/layerRecord'
import type { FrameEdge } from '../../domain/frame'
import type { EditFn } from '../project/useEdit'
import type { FramePress } from '../../rendering/frameHandles'

// The Select tool's whole gesture (ticket 63): the Selection, in-session clipboard, the in-progress press (click vs
// drag) and the live paste preview. It never reads the active tool (see
// leaveSelectTool); Escape precedence stays in the shell, which calls cancel() last.
export function useSelectionGesture(
  currentProject: () => Project | undefined,
  edit: EditFn,
  /** Told how many beads a Paste lost: clipped to the Frame (ticket 491), or on a Custom frame's Seams and Off-shape
   * (ticket 0594). */
  onClipped: (count: number, loss: PasteLoss) => void,
) {
  /** The rectangle the Select tool has marked out, or none (ticket 31). Only one is ever active: a new drag replaces
   * it. */
  const selection = ref<Selection | undefined>()
  /** How many times a Selection has been refused where the pointer cannot show it (a key or a tap, ticket 433): the
   * canvas shows the not-allowed cue each time it grows. */
  const refusals = ref(0)

  // What Copy last snapshotted, ready to stamp (ticket 92, ADR 0016): cleared only by a new Copy or a new Selection
  // (see copy/extendPress), not by a tool or Project switch or cancelling. An editing-session aid like the undo stack,
  // but it survives a Project switch (see clearSelection()).
  const copiedBlock = ref<CopiedBlock | undefined>()
  // Leaves paste mode (live preview plus stamp, Select-only) without touching copiedBlock (ticket 92, ADR 0016): on
  // leaving Select, on Escape (see leaveSelectTool/cancel) and on touch by Undo or a second tap on Select.
  // A new Copy or Ctrl/Cmd+V re-arms it (ticket 437, ADR 0016); switching back to Select alone does not.
  const pasteDismissed = ref(false)
  /** Paste mode (ticket 437): Select shows the live paste preview and a click or drag stamps -- copiedBlock present
   * and not dismissed. */
  const pasteProjectionActive = computed(() => !!copiedBlock.value && !pasteDismissed.value)

  // A press on the Selection's handles or inside it (ticket 414): a handle resizes, the inside moves the outline,
  // neither touches a bead. A press inside that never moves is a tap, so it does what the tool taps do.
  let adjust:
    | { kind: 'resize'; edges: FrameEdge[]; start: Selection }
    | { kind: 'move'; origin: GridPosition; start: Selection; moved: boolean; tool: 'select' | 'piece' }
    | undefined

  // Where a Select press started and whether it has left that cell. Dragging marks a new Selection, a click in place
  // stamps the copy, so the press only records its anchor here and endPress decides which it was.
  const selectPress = ref<{ anchor: GridPosition; focus: GridPosition; layer: Layer; moved: boolean } | null>(null)

  /** Whether a Selection may not start here: on a Frame whose kind offers none (a Custom frame, ticket 0592). The
   * margin is the Canvas's, where a drag may start (ticket 0659). */
  function refusesSelection(project: Project, at: GridPosition): boolean {
    return layerAt(project, at) === 'frame' && !frameAllows(project.frame, 'select')
  }

  function beginPress(row: number, column: number, named?: Layer) {
    const project = currentProject()
    if (!project) {
      return
    }
    const at = { row, column, ...(named ? { layer: named } : {}) }

    // A Selection cannot start on a Frame whose kind offers none (ticket 0592): nothing begins (the pointer shows the
    // cue itself, a key asks extendPress's caller to).
    if (refusesSelection(project, at)) {
      return
    }
    const layer = layerAt(project, at)
    selectPress.value = { anchor: at, focus: at, layer, moved: false }

    // With no active projection the press can only start a selection, so the marquee appears from the first cell. With
    // one active Paste claims the gesture, hence re-selecting a single cell takes a drag out and back: a click must
    // mean one thing, and stamping is it.
    if (!pasteProjectionActive.value) {
      selection.value = selectionBetween({ row, column }, { row, column }, layer)
    }
  }

  // Grows the in-progress Selection to the cell the drag reached. A drag replaces the previous Selection and the copy
  // with it (ticket 92). Returns false when no Selection grew, which a key step takes as a refusal.
  function extendPress(row: number, column: number): boolean {
    const project = currentProject()
    const press = selectPress.value
    if (!project || !press) {
      return false
    }

    press.moved = true
    // In paste mode a drag is still one stamp at the press point and never selects (ticket 437, ADR 0016).
    if (pasteProjectionActive.value) return false
    dropClipboard()
    // The rectangle follows the pointer anywhere, across the Frame and its margin; the Selection stays on the layer the
    // drag began on (ticket 491), and selects only what that layer shows (ticket 0659).
    press.focus = { row, column }
    selection.value = selectionBetween(press.anchor, press.focus, press.layer)
    return true
  }

  /** Ends a Select press: in paste mode, click or drag, one stamp at the press point (ticket 437); otherwise a drag
   * has already updated the Selection as it went. */
  function endPress() {
    const project = currentProject()
    const press = selectPress.value
    selectPress.value = null

    if (!project || !press || !pasteProjectionActive.value) {
      return
    }

    const block = copiedBlock.value!
    stamp(block, press.anchor)
  }

  /** One Paste as one Edit; a Message says how many beads the Frame's edge clipped (ticket 491) or a Custom frame's
   * Seams and Off-shape dropped (ticket 0594). */
  function stamp(block: CopiedBlock, at: GridPosition) {
    const lost = pasteLostCount(currentProject()!, block, at)
    const outcome = edit('drawing', (current) => pasteOnLayer(current, block, at))
    if (lost.count > 0 && outcome.kind === 'applied') onClipped(lost.count, lost.loss)
  }

  /** The Piece tool's tap (ticket 414): the Selection becomes the bounding rectangle of the tapped bead's Piece, on
   * the tapped bead's side of the Frame's margin (ticket 433), and tapping empty space clears it. A tap in the
   * margin is refused. */
  function tapPiece(row: number, column: number, named?: Layer) {
    const project = currentProject()
    if (!project) {
      return
    }
    const at = { row, column, ...(named ? { layer: named } : {}) }
    // A Custom frame's beads are named by round and place, not Pieces of a Grid (ticket 0594): the Piece tool refuses it.
    const custom = layerAt(project, at) === 'frame' && !frameGeometryOf(project).grid
    const picked = custom ? undefined : pieceSelectionOnLayer(project, at)
    if (custom || refusesSelection(project, at) || (!picked && beadColorAt(project, row, column, named))) {
      refusals.value += 1
      return
    }
    dropClipboard()
    selection.value = picked
  }

  /** Select all (tickets 414, 428): the Selection becomes the Frame's inside, or without a Frame the rectangle round
   * every placed bead. Returns false, changing nothing, on an empty canvas with no Frame. */
  function selectAll(): boolean {
    const project = currentProject()
    // A Frame that offers no Selection leaves Select all the Canvas's beads.
    const all = project ? selectAllSelection(layerOf(project, 'canvas').beads, frameAllows(project.frame, 'select') ? laidFrame(project) : undefined) : undefined
    if (!all) {
      return false
    }
    dropClipboard()
    selection.value = all
    return true
  }

  /** Begins resizing (a handle) or moving (the inside) the Selection (ticket 414); `cell` is the bead position under
   * the press. */
  function beginAdjust(target: FramePress, cell: GridPosition, tool: 'select' | 'piece') {
    const start = selection.value
    if (!start) {
      return
    }
    if (target.kind === 'handle') {
      adjust = { kind: 'resize', edges: target.edges, start }
    } else if (target.kind === 'inside') {
      adjust = { kind: 'move', origin: cell, start, moved: false, tool }
    }
  }

  /** Carries the adjust on to the bead position the drag has reached. */
  function dragAdjust(cell: GridPosition) {
    if (!adjust) {
      return
    }
    // Neither stops at the Frame or its margin (ticket 0659): the Selection keeps its layer wherever it goes.
    if (adjust.kind === 'resize') {
      selection.value = selectionWithEdges(adjust.start, adjust.edges, cell)
      return
    }
    const rows = cell.row - adjust.origin.row
    const columns = cell.column - adjust.origin.column
    adjust.moved ||= rows !== 0 || columns !== 0
    selection.value = movedSelection(adjust.start, rows, columns)
  }

  /** Ends the adjust; a press inside that never moved was a tap on a bead, so the tool's own tap happens. */
  function endAdjust() {
    const done = adjust
    adjust = undefined
    if (done?.kind !== 'move' || done.moved) {
      return
    }
    if (done.tool === 'piece') {
      tapPiece(done.origin.row, done.origin.column)
    } else {
      dropClipboard()
      const project = currentProject()
      selection.value = selectionBetween(done.origin, done.origin, project && layerAt(project, done.origin))
    }
  }

  /** A new Selection (drag or ruler click) is one of the two things that clear the clipboard (ADR 0016), the other
   * being a new Copy replacing it. */
  function dropClipboard() {
    copiedBlock.value = undefined
    pasteDismissed.value = false
  }

  // Hides the paste projection (ticket 92): Select goes back to marking areas and the live preview stops (a click means
  // Paste only while a projection is active, see beginPress). copiedBlock is left alone so Ctrl/Cmd+V still pastes (see
  // pasteAt); only a new Copy or Selection re-arms the projection (see copy/extendPress).
  function dismissPaste() {
    pasteDismissed.value = true
  }

  // Escape under Select backs out one step (ticket 49): an active paste projection first (see
  // dismissPaste), else the Selection. The app shell calls this last (ticket 63). Returns whether there was anything to
  // back out of, so Escape can fall through to selecting Paint (ticket 214).
  function cancel(): boolean {
    if (pasteProjectionActive.value) {
      dismissPaste()
      return true
    }
    if (!selection.value) return false
    selection.value = undefined
    return true
  }

  // Leaving Select and Piece (ADR 0016; a Selection survives switching between them, ticket 414) forgets what it held,
  // unlike cancel(). A clipboard outliving its marquee would be invisible state: back in Select a click would stamp
  // from nowhere. The shell calls this only when the tool changes away from Select (ticket 63).
  function leaveSelectTool() {
    selection.value = undefined
    dismissPaste()
  }

  /** Snapshots the Selection's drawn beads into the clipboard; false, changing nothing, when it holds none (ticket
   * 437). */
  function snapshotSelection(): boolean {
    const project = currentProject()
    if (!project || !selection.value) return false
    const block = copyLayerSelection(project, selection.value)
    if (!block) return false
    copiedBlock.value = block
    return true
  }

  // Copy (ticket 437, ADR 0016): keeps only the drawn beads, clears the Selection and arms paste mode,
  // so one stamp lands the first drawn bead on the clicked cell. Returns false for a Selection with no drawn bead,
  // which the shell turns into a Message.
  function copy(): boolean {
    if (!snapshotSelection()) return false
    selection.value = undefined
    pasteDismissed.value = false
    return true
  }

  // Cut (tickets 415, 447, Ctrl+X): copies the drawn beads, empties the Selection as one Undo step, then clears it and
  // arms paste as Copy does. With no drawn bead nothing is copied, the Selection stays (a no-op edit); returns whether
  // anything was cut, for the shell's tool change.
  function cut(): boolean {
    if (!selection.value) return false
    const copied = snapshotSelection()
    deleteSelection()
    if (copied) {
      selection.value = undefined
      pasteDismissed.value = false
    }
    return copied
  }

  /** Paste mode on again without stamping (ticket 447): the Selection bar's Paste button and the Paste tool. False
   * with an empty clipboard. */
  function armPaste(): boolean {
    if (!copiedBlock.value) return false
    selection.value = undefined
    pasteDismissed.value = false
    return true
  }

  // Fill (ticket 415): every position in the Selection, empty ones too, takes `color`, as one Undo step. Finished
  // rows trim it silently, as Paste, since the edit is a drawing one.
  function fill(color: string) {
    const sel = selection.value
    if (!currentProject() || !sel) return
    edit('drawing', (current) => paintLayerSelection(current, sel, color))
  }

  // Ctrl/Cmd+V (ticket 92): pastes the clipboard block at `cell` as a Select click does (see endPress), but under any
  // tool, since the shell drives `cell` from the hover position. Returns whether it pasted, so the shell can claim the
  // key event. A no-op with nothing copied or `cell` undefined.
  function pasteAt(cell: GridPosition | undefined): boolean {
    const project = currentProject()
    if (!project || !cell || !copiedBlock.value) {
      return false
    }

    const block = copiedBlock.value
    pasteDismissed.value = false
    stamp(block, cell)
    return true
  }

  // Del with Select active and a Selection (ticket 90): clears the selected cells (holes) as one undo step honouring
  // the Row progress lock, via paintCells with a null color as a Paint erase does. The Selection's own
  // rectangle is left alone.
  function deleteSelection() {
    const project = currentProject()
    const sel = selection.value
    if (!project || !sel) {
      return
    }

    edit('drawing', (current) => paintLayerSelection(current, sel, null))
  }

  // The block Paste would stamp under the cursor (ticket 31): the shell's hover preview under
  // Select; empty with no active (undismissed) projection, since a click would then put nothing down.
  function pastePreviewCells(project: Project, hovered: GridPosition): PreviewCell[] {
    return pasteProjectionActive.value
      ? pastedCellsOnLayer(project, copiedBlock.value!, hovered)
      : []
  }

  // Clears just the Selection, not the clipboard (ADR 0016): a copied block is colors, not a place. Called on a Project
  // switch and by any command that changes the grid's dimensions (Frame change, row/column removal, Undo/Redo across
  // one), after which a Selection may no longer fit.
  function clearSelection() {
    selection.value = undefined
  }

  return {
    selection,
    refusals,
    /** Asks the canvas to show the not-allowed cue (ticket 433), for a refusal the pointer did not make itself. */
    refuse: () => (refusals.value += 1),
    beginPress,
    extendPress,
    endPress,
    cancel,
    leaveSelectTool,
    copy,
    cut,
    armPaste,
    dismissPaste,
    fill,
    pasteAt,
    deleteSelection,
    tapPiece,
    selectAll,
    beginAdjust,
    dragAdjust,
    endAdjust,
    pastePreviewCells,
    clearSelection,
    /** Whether a copied block is armed to paste (ticket 168's ContextBar: "Tap where to paste" replaces the
     * Selection's own controls once this is true). */
    pasteProjectionActive,
    /** Whether a block is copied, ready for Ctrl/Cmd+V (the Paste control's enabled state). */
    hasClipboard: () => copiedBlock.value !== undefined,
  }
}
