import { computed, ref } from 'vue'
import type { GridPosition, PreviewCell } from '../domain/grid'
import type { MirrorAxisCounts } from '../domain/mirror'
import { paintCells, type Pattern } from '../domain/pattern'
import {
  copySelection,
  mirroredPasteBlock,
  mirroredPastedCells,
  selectionBetween,
  type CopiedBlock,
  type Selection,
} from '../domain/selection'

/**
 * The Select tool's whole gesture (ticket 63, architecture review): the Selection itself, the in-session clipboard,
 * the in-progress press that resolves the click-vs-drag ambiguity a Select press starts with, and the live paste
 * preview a hover shows under Select -- moved out of App.vue as one piece, behind this small interface. Mirrors the
 * shape of useMirrorState.ts (ticket 62): the app shell decides when to call in (this module never reads which
 * tool is active -- see leaveSelectTool), and Escape/right-click precedence against confirmation modals and an
 * expanded Tool group stays in the app shell, which calls this module's cancel() last.
 *
 * `currentPattern` and `commitGridChange` are read from the app shell for the same reason useMirrorState reads
 * them: Paste commits through the shell's shared grid-change/undo path (the same one Fill and "Mirror current"
 * use) rather than a private copy of its own. `mirrorAxisCounts`/`mirrorCopyMode` come from ticket 62's own module
 * (useMirrorState) rather than from the app shell directly, per the ticket 63 decision -- this module doesn't need
 * to know useMirrorState exists, only that something supplies its current axis counts and copy mode.
 */
export function useSelectionGesture(
  currentPattern: () => Pattern | undefined,
  commitGridChange: (pattern: Pattern, updated: Pattern) => void,
  mirrorAxisCounts: () => MirrorAxisCounts,
  mirrorCopyMode: () => boolean,
) {
  /** The rectangle the Select tool has marked out, or none (ticket 31). Only one is ever active: a new drag replaces it. */
  const selection = ref<Selection | undefined>()

  /**
   * What Copy last snapshotted, ready to stamp (ticket 92 revised its lifecycle, ADR 0016): it clears only when a
   * new Copy replaces it or a new Selection is made (see copy/extendPress) -- not on a tool switch, a Pattern
   * switch, or cancelling. Like the undo stack it's an editing-session aid, but unlike the undo stack it survives a
   * Pattern switch (see clearSelection()).
   */
  const copiedBlock = ref<CopiedBlock | undefined>()
  /**
   * Hides the paste projection (the live preview plus click-to-stamp gesture, both Select-tool-only) without
   * touching copiedBlock itself (ticket 92, ADR 0016): set on leaving Select or on Escape/right-click (see
   * leaveSelectTool/cancel), and only cleared by a new Copy or a new Selection (see pasteProjectionActive) --
   * switching back to Select alone does not revive it.
   */
  const pasteDismissed = ref(false)
  /** Whether Select should show the live paste preview and treat a click-in-place as a stamp (ticket 92) -- copiedBlock present and not dismissed. */
  const pasteProjectionActive = computed(() => !!copiedBlock.value && !pasteDismissed.value)

  /**
   * Where a Select-tool press started, and whether it has left that cell yet. A press under Select is ambiguous
   * until one of those happens: dragging marks out a new Selection, while a click in place stamps whatever was
   * copied. So the press only records its anchor here, and endPress decides which it turned out to be.
   */
  const selectPress = ref<{ anchor: GridPosition; moved: boolean } | null>(null)

  function beginPress(row: number, column: number) {
    const pattern = currentPattern()
    if (!pattern) {
      return
    }

    selectPress.value = { anchor: { row, column }, moved: false }

    // With no active projection, the press can only be the start of a selection, so the marquee appears from the
    // first cell. With one active the gesture is claimed by Paste instead, which is why re-selecting a single cell
    // then takes a drag out and back rather than a click: a click has to mean one thing, and stamping is the one it
    // means.
    if (!pasteProjectionActive.value) {
      selection.value = selectionBetween(pattern, { row, column }, { row, column })
    }
  }

  /** Grows the in-progress Selection to the cell the drag has reached. A drag replaces the previous Selection, and with it whatever was copied from one (ticket 92: a new Selection is one of the two things that actually clears the clipboard). */
  function extendPress(row: number, column: number) {
    const pattern = currentPattern()
    const press = selectPress.value
    if (!pattern || !press) {
      return
    }

    press.moved = true
    dropClipboard()
    selection.value = selectionBetween(pattern, press.anchor, { row, column })
  }

  /** Ends a Select press: a click that never moved stamps the copied block where it landed (a drag has already updated the Selection as it went). */
  function endPress() {
    const pattern = currentPattern()
    const press = selectPress.value
    selectPress.value = null

    if (!pattern || !press || press.moved || !pasteProjectionActive.value) {
      return
    }

    commitGridChange(
      pattern,
      mirroredPasteBlock(pattern, copiedBlock.value!, press.anchor, mirrorAxisCounts(), mirrorCopyMode()),
    )
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
   * own Escape precedence against confirmation modals and an expanded Tool group (ticket 63 decision).
   */
  function cancel() {
    if (pasteProjectionActive.value) {
      dismissPaste()
    } else {
      selection.value = undefined
    }
  }

  /**
   * Leaving the Select tool (ADR 0016): forgets what it was holding outright, unlike cancel(), which only backs out
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

  /**
   * Snapshots the Selection into the in-session clipboard; from there a click on the canvas stamps it (see
   * endPress). The Selection's marquee is hidden immediately, the same as a right-click or Escape with nothing
   * copied (ticket 49) -- copying the same block again means dragging a new Selection over it first.
   */
  function copy() {
    const pattern = currentPattern()
    if (!pattern || !selection.value) {
      return
    }

    copiedBlock.value = copySelection(pattern, selection.value)
    pasteDismissed.value = false
    selection.value = undefined
  }

  /**
   * Ctrl/Cmd+V (ticket 92): pastes the clipboard's block at `cell`, the same targeting and Mirror-strip stamping as
   * a Select-tool click-to-paste (see endPress) -- but works regardless of which tool is active, since the app
   * shell drives `cell` from wherever the pointer is hovering rather than the Select-only click gesture. Returns
   * whether it actually pasted, so the app shell knows whether to claim the keyboard event from the browser's own
   * handling of the chord. A no-op with nothing copied or with `cell` undefined (pointer off the grid).
   */
  function pasteAt(cell: GridPosition | undefined): boolean {
    const pattern = currentPattern()
    if (!pattern || !cell || !copiedBlock.value) {
      return false
    }

    commitGridChange(
      pattern,
      mirroredPasteBlock(pattern, copiedBlock.value, cell, mirrorAxisCounts(), mirrorCopyMode()),
    )
    return true
  }

  /**
   * Del with Select active and a Selection present (ticket 90): clears just the selected cells (holes, same as an
   * ordinary erase of that rectangle), as one undo step honouring the Row progress lock and Mirror -- reusing
   * paintCells with a null color, the same primitive a Paint stroke's own erase uses. The Selection's own rectangle
   * is left alone; only its contents change.
   */
  function deleteSelection() {
    const pattern = currentPattern()
    const sel = selection.value
    if (!pattern || !sel) {
      return
    }

    const positions: GridPosition[] = []
    for (let rowOffset = 0; rowOffset < sel.rows; rowOffset++) {
      for (let columnOffset = 0; columnOffset < sel.columns; columnOffset++) {
        positions.push({ row: sel.top + rowOffset, column: sel.left + columnOffset })
      }
    }

    commitGridChange(pattern, paintCells(pattern, positions, null, mirrorAxisCounts(), mirrorCopyMode()))
  }

  /**
   * A row or column ruler number was clicked (ticket 123): selects that whole line, the same Selection a
   * Select-tool drag across it would leave -- so it works from whichever tool is active, and clears whatever was
   * copied, the same as a new drag-marked Selection does (see extendPress).
   */
  function selectLine(newSelection: Selection) {
    dropClipboard()
    selection.value = newSelection
  }

  /**
   * The block Paste would stamp under the cursor, Mirror-projected (tickets 31/50): what the app shell's own hover
   * preview shows while Select is active -- empty with no active (undismissed) projection, since there's then
   * nothing a click would put down.
   */
  function pastePreviewCells(pattern: Pattern, hovered: GridPosition): PreviewCell[] {
    return pasteProjectionActive.value
      ? mirroredPastedCells(pattern, copiedBlock.value!, hovered, mirrorAxisCounts(), mirrorCopyMode())
      : []
  }

  /**
   * Clears just the Selection -- not the clipboard, which survives (ADR 0016): a copied block is colors, not a
   * place, so nothing about the grid changing or the open Pattern switching invalidates it. Called from the app shell's single Pattern-switch reset point, and equally from
   * any command that changes the grid's own dimensions (Resize, "remove selected row/column", an Undo/Redo that
   * crosses a size change) -- a Selection may no longer fit, or no longer name a whole line, once those land.
   */
  function clearSelection() {
    selection.value = undefined
  }

  return {
    selection,
    beginPress,
    extendPress,
    endPress,
    cancel,
    leaveSelectTool,
    copy,
    pasteAt,
    deleteSelection,
    selectLine,
    pastePreviewCells,
    clearSelection,
  }
}
