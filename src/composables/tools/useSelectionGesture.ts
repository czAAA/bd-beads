import { computed, ref } from 'vue'
import type { GridPosition, PreviewCell } from '../../domain/grid'
import type { MirrorAxisCounts } from '../../domain/mirror'
import { paintCells, type Project } from '../../domain/project'
import {
  selectAllSelection,
  copySelection,
  mirroredPasteBlock,
  mirroredPastedCells,
  movedSelection,
  pieceSelectionAt,
  selectionBetween,
  selectionWithEdges,
  type CopiedBlock,
  type Selection,
} from '../../domain/selection'
import { clampOutOfMargin, inMargin, lineWithinFrame, selectionAllowed } from '../../domain/margin'
import { colorAt } from '../../domain/canvas'
import type { FrameEdge } from '../../domain/frame'
import type { EditFn } from '../project/useEdit'
import type { FramePress } from '../../rendering/frameHandles'

/** Every position in the Selection's rectangle. */
function selectionPositions(sel: Selection): GridPosition[] {
  const positions: GridPosition[] = []
  for (let rowOffset = 0; rowOffset < sel.rows; rowOffset++) {
    for (let columnOffset = 0; columnOffset < sel.columns; columnOffset++) {
      positions.push({ row: sel.top + rowOffset, column: sel.left + columnOffset })
    }
  }
  return positions
}

/**
 * The Select tool's whole gesture (ticket 63, architecture review): the Selection itself, the in-session clipboard,
 * the in-progress press that resolves the click-vs-drag ambiguity a Select press starts with, and the live paste
 * preview a hover shows under Select -- moved out of App.vue as one piece, behind this small interface. Mirrors the
 * shape of useMirrorState.ts (ticket 62): the app shell decides when to call in (this module never reads which
 * tool is active -- see leaveSelectTool), and Escape/right-click precedence against confirmation modals and an
 * expanded Tool group stays in the app shell, which calls this module's cancel() last.
 *
 * `currentProject` and `edit` are read from the app shell for the same reason useMirrorState reads them: Paste and
 * Delete commit as drawing Edits (ADR 0036), the same path Fill and "Mirror current" use, rather than a private copy. `mirrorAxisCounts`/`mirrorCopyMode` come from ticket 62's own module
 * (useMirrorState) rather than from the app shell directly, per the ticket 63 decision -- this module doesn't need
 * to know useMirrorState exists, only that something supplies its current axis counts and copy mode.
 */
export function useSelectionGesture(
  currentProject: () => Project | undefined,
  edit: EditFn,
  mirrorAxisCounts: () => MirrorAxisCounts,
  mirrorCopyMode: () => boolean,
) {
  /** The rectangle the Select tool has marked out, or none (ticket 31). Only one is ever active: a new drag replaces it. */
  const selection = ref<Selection | undefined>()
  /** How many times a Selection has been refused where the pointer cannot show it (a key or a tap, ticket 433): the canvas shows the not-allowed cue each time it grows. */
  const refusals = ref(0)

  /**
   * What Copy last snapshotted, ready to stamp (ticket 92 revised its lifecycle, ADR 0016): it clears only when a
   * new Copy replaces it or a new Selection is made (see copy/extendPress) -- not on a tool switch, a Project
   * switch, or cancelling. Like the undo stack it's an editing-session aid, but unlike the undo stack it survives a
   * Project switch (see clearSelection()).
   */
  const copiedBlock = ref<CopiedBlock | undefined>()
  /**
   * Leaves paste mode (the live preview plus stamp gesture, both Select-tool-only) without touching copiedBlock
   * itself (ticket 92, ADR 0016): set on leaving Select, on Escape/right-click (see leaveSelectTool/cancel) and on
   * touch by Undo or a second tap on Select. A new Copy or Ctrl/Cmd+V re-arms it (ticket 437, ADR 0057) --
   * switching back to Select alone does not.
   */
  const pasteDismissed = ref(false)
  /** Paste mode (ticket 437): Select shows the live paste preview and a click or drag stamps -- copiedBlock present and not dismissed. */
  const pasteProjectionActive = computed(() => !!copiedBlock.value && !pasteDismissed.value)

  /**
   * A press on the Selection's handles or inside it (ticket 414): a handle resizes the rectangle, the inside moves its
   * outline, and neither touches a bead. A press inside that never moves is a tap, so it does what the tool taps do.
   */
  let adjust:
    | { kind: 'resize'; edges: FrameEdge[]; start: Selection }
    | { kind: 'move'; origin: GridPosition; start: Selection; moved: boolean; tool: 'select' | 'piece' }
    | undefined

  /**
   * Where a Select-tool press started, and whether it has left that cell yet. A press under Select is ambiguous
   * until one of those happens: dragging marks out a new Selection, while a click in place stamps whatever was
   * copied. So the press only records its anchor here, and endPress decides which it turned out to be.
   */
  const selectPress = ref<{ anchor: GridPosition; moved: boolean } | null>(null)

  function beginPress(row: number, column: number) {
    const project = currentProject()
    if (!project) {
      return
    }

    // A Selection cannot start in the keep-out margin (ticket 433): nothing begins (the pointer shows the cue itself, a key asks extendPress's caller to).
    if (inMargin(project.frame, { row, column })) {
      return
    }
    selectPress.value = { anchor: { row, column }, moved: false }

    // With no active projection, the press can only be the start of a selection, so the marquee appears from the
    // first cell. With one active the gesture is claimed by Paste instead, which is why re-selecting a single cell
    // then takes a drag out and back rather than a click: a click has to mean one thing, and stamping is the one it
    // means.
    if (!pasteProjectionActive.value) {
      selection.value = selectionBetween({ row, column }, { row, column })
    }
  }

  /**
   * Grows the in-progress Selection to the cell the drag has reached. A drag replaces the previous Selection, and with it whatever was copied from one (ticket 92: a new Selection is one of the two things that actually clears the clipboard).
   * Returns whether the Selection reached that cell: false when the margin held it back (ticket 433), which a key step takes as a refusal.
   */
  function extendPress(row: number, column: number): boolean {
    const project = currentProject()
    const press = selectPress.value
    if (!project || !press) {
      return false
    }

    press.moved = true
    // In paste mode a drag is still one stamp at the press point and never selects (ticket 437, ADR 0057).
    if (pasteProjectionActive.value) return false
    dropClipboard()
    const reached = clampOutOfMargin(project.frame, press.anchor, { row, column })
    selection.value = selectionBetween(press.anchor, reached)
    return reached.row === row && reached.column === column
  }

  /** Ends a Select press: in paste mode, click or drag, one stamp at the press point (ticket 437); otherwise a drag has already updated the Selection as it went. */
  function endPress() {
    const project = currentProject()
    const press = selectPress.value
    selectPress.value = null

    if (!project || !press || !pasteProjectionActive.value) {
      return
    }

    const block = copiedBlock.value!
    edit('drawing', (current) => mirroredPasteBlock(current, block, press.anchor, mirrorAxisCounts(), mirrorCopyMode()))
  }

  /** The Piece tool's tap (ticket 414): the Selection becomes the bounding rectangle of the tapped bead's Piece, on the tapped bead's side of the Frame's margin (ticket 433), and tapping empty space clears it. A tap in the margin is refused. */
  function tapPiece(row: number, column: number) {
    const project = currentProject()
    if (!project) {
      return
    }
    const at = { row, column }
    const picked = pieceSelectionAt(project.beads, project.technique, at, project.frame)
    if (inMargin(project.frame, at) || (!picked && colorAt(project.beads, row, column))) {
      refusals.value += 1
      return
    }
    dropClipboard()
    selection.value = picked
  }

  /** Select all (tickets 414, 428): the Selection becomes the Frame's inside, or without a Frame the rectangle round every placed bead. Returns false, changing nothing, on an empty canvas with no Frame. */
  function selectAll(): boolean {
    const project = currentProject()
    const all = project ? selectAllSelection(project.beads, project.frame) : undefined
    if (!all) {
      return false
    }
    dropClipboard()
    selection.value = all
    return true
  }

  /** Begins resizing (a handle) or moving (the inside) the Selection (ticket 414); `cell` is the bead position under the press. */
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
    if (adjust.kind === 'resize') {
      keepOutOfMargin(selectionWithEdges(adjust.start, adjust.edges, cell))
      return
    }
    const rows = cell.row - adjust.origin.row
    const columns = cell.column - adjust.origin.column
    adjust.moved ||= rows !== 0 || columns !== 0
    keepOutOfMargin(movedSelection(adjust.start, rows, columns))
  }

  /** Takes a resized or moved Selection only if it covers none of the Frame's margin (ticket 428); otherwise the Selection stays as it was. */
  function keepOutOfMargin(next: Selection) {
    if (selectionAllowed(currentProject()?.frame, next)) selection.value = next
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
      selection.value = selectionBetween(done.origin, done.origin)
    }
  }

  /** A new Selection (drag or ruler click) is one of the two things that clear the clipboard (ADR 0016), the other being a new Copy replacing it. */
  function dropClipboard() {
    copiedBlock.value = undefined
    pasteDismissed.value = false
  }

  /**
   * Hides the paste projection (ticket 92): Select goes back to marking out areas, and the live preview stops -- a
   * click means Paste only while a projection is active (see beginPress). copiedBlock itself is left alone (so
   * Ctrl/Cmd+V can still paste it regardless of tool or projection state -- see pasteAt): only a new Copy or a new
   * Selection re-arms the projection (see copy/extendPress).
   */
  function dismissPaste() {
    pasteDismissed.value = true
  }

  /**
   * Right-click or Escape under Select backs out one step at a time (ticket 49): an active paste projection goes
   * first (see dismissPaste); with none active, the Selection itself goes. The app shell calls this last, after its
   * own Escape precedence against confirmation modals and an expanded Tool group (ticket 63 decision). Returns
   * whether there was anything to back out of, so Escape can fall through to selecting Paint (ticket 214).
   */
  function cancel(): boolean {
    if (pasteProjectionActive.value) {
      dismissPaste()
      return true
    }
    if (!selection.value) return false
    selection.value = undefined
    return true
  }

  /**
   * Leaving the Select and Piece tools (ADR 0016; a Selection survives switching between them, ticket 414): forgets what it was holding outright, unlike cancel(), which only backs out
   * one step at a time. The marquee is noise once you're painting rather than selecting, and a clipboard that
   * outlived its marquee would be invisible state -- coming back to Select and clicking would stamp a block out of
   * nowhere. This module never branches on which tool is active (ticket 63 decision): the app shell calls this only
   * when the tool actually changes away from Select, and leaves it alone when Select is re-chosen while already
   * active.
   */
  function leaveSelectTool() {
    selection.value = undefined
    dismissPaste()
  }

  /** Snapshots the Selection's drawn beads into the clipboard; false, changing nothing, when it holds none (ticket 437). */
  function snapshotSelection(): boolean {
    const project = currentProject()
    if (!project || !selection.value) return false
    const block = copySelection(project, selection.value)
    if (!block) return false
    copiedBlock.value = block
    return true
  }

  /**
   * Copy (ticket 437, ADR 0057, reversing ticket 415): keeps only the drawn beads and arms paste mode at once, so the
   * Selection is cleared and one stamp lands the first drawn bead on the clicked cell. Returns whether anything was
   * copied: false for a Selection with no drawn bead, which the app shell turns into a Message.
   */
  function copy(): boolean {
    if (!snapshotSelection()) return false
    selection.value = undefined
    pasteDismissed.value = false
    return true
  }

  /** Cut (ticket 415, Ctrl+X): copies the drawn beads without arming paste mode, then empties the Selection as one Undo step; the Selection is kept. */
  function cut() {
    if (!selection.value) return
    if (snapshotSelection()) pasteDismissed.value = true
    deleteSelection()
  }

  /**
   * Fill (ticket 415): every position in the Selection, empty ones too, takes `color`, as one Undo step. The keep-out
   * margin and finished rows trim it silently, as Paste, since the edit is a drawing one.
   */
  function fill(color: string) {
    const sel = selection.value
    if (!currentProject() || !sel) return
    edit('drawing', (current) => paintCells(current, selectionPositions(sel), color, mirrorAxisCounts(), mirrorCopyMode()))
  }

  /**
   * Ctrl/Cmd+V (ticket 92): pastes the clipboard's block at `cell`, the same targeting and Mirror-strip stamping as
   * a Select-tool click-to-paste (see endPress) -- but works regardless of which tool is active, since the app
   * shell drives `cell` from wherever the pointer is hovering rather than the Select-only click gesture. Returns
   * whether it actually pasted, so the app shell knows whether to claim the keyboard event from the browser's own
   * handling of the chord. A no-op with nothing copied or with `cell` undefined (pointer off the grid).
   */
  function pasteAt(cell: GridPosition | undefined): boolean {
    const project = currentProject()
    if (!project || !cell || !copiedBlock.value) {
      return false
    }

    const block = copiedBlock.value
    pasteDismissed.value = false
    edit('drawing', (current) => mirroredPasteBlock(current, block, cell, mirrorAxisCounts(), mirrorCopyMode()))
    return true
  }

  /**
   * Del with Select active and a Selection present (ticket 90): clears just the selected cells (holes, same as an
   * ordinary erase of that rectangle), as one undo step honouring the Row progress lock and Mirror -- reusing
   * paintCells with a null color, the same primitive a Paint stroke's own erase uses. The Selection's own rectangle
   * is left alone; only its contents change.
   */
  function deleteSelection() {
    const project = currentProject()
    const sel = selection.value
    if (!project || !sel) {
      return
    }

    edit('drawing', (current) => paintCells(current, selectionPositions(sel), null, mirrorAxisCounts(), mirrorCopyMode()))
  }

  /**
   * A row or column ruler number was clicked (ticket 123): selects that whole line, the same Selection a
   * Select-tool drag across it would leave -- so it works from whichever tool is active, and clears whatever was
   * copied, the same as a new drag-marked Selection does (see extendPress). With a Frame it is the line's part inside the
   * Frame (ticket 433), and a line outside the Frame selects nothing. Returns whether a Selection was made.
   */
  function selectLine(newSelection: Selection): boolean {
    const line = lineWithinFrame(currentProject()?.frame, newSelection)
    if (!line) return false
    dropClipboard()
    selection.value = line
    return true
  }

  /**
   * The block Paste would stamp under the cursor, Mirror-projected (tickets 31/50): what the app shell's own hover
   * preview shows while Select is active -- empty with no active (undismissed) projection, since there's then
   * nothing a click would put down.
   */
  function pastePreviewCells(project: Project, hovered: GridPosition): PreviewCell[] {
    return pasteProjectionActive.value
      ? mirroredPastedCells(project.frame, copiedBlock.value!, hovered, mirrorAxisCounts(), mirrorCopyMode())
      : []
  }

  /**
   * Clears just the Selection -- not the clipboard, which survives (ADR 0016): a copied block is colors, not a
   * place, so nothing about the grid changing or the open Project switching invalidates it. Called from the app shell's single Project-switch reset point, and equally from
   * any command that changes the grid's own dimensions (a change of the Frame, "remove selected row/column", an Undo/Redo that
   * crosses a Frame change) -- a Selection may no longer fit, or no longer name a whole line, once those land.
   */
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
    dismissPaste,
    fill,
    pasteAt,
    deleteSelection,
    selectLine,
    tapPiece,
    selectAll,
    beginAdjust,
    dragAdjust,
    endAdjust,
    pastePreviewCells,
    clearSelection,
    /** Whether a copied block is armed to paste (ticket 168's ContextBar: "Tap where to paste" replaces the Selection's own controls once this is true). */
    pasteProjectionActive,
    /** Whether a block is copied, ready for Ctrl/Cmd+V (the Paste control's enabled state). */
    hasClipboard: () => copiedBlock.value !== undefined,
  }
}
