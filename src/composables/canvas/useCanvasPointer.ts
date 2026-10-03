import { computed, ref, type Ref } from 'vue'
import type { GridPosition, PreviewCell } from '../../domain/grid'
import type { MirrorAxisCounts } from '../../domain/mirror'
import { isInFinishedRow, mirroredCells, type Pattern } from '../../domain/pattern'
import type { Tool } from '../../domain/tool'

/** What pointer input on the canvas needs from the app shell: the open Pattern and tool, the paint color, and the paint/selection gestures it drives. */
export interface CanvasPointerDeps {
  currentPattern: () => Pattern | undefined
  activeTool: () => Tool
  /** Whether Space is held: Space+drag pans the canvas, never paints. */
  spaceHeld: () => boolean
  strokeMode: () => 'paint' | 'erase' | null
  selectedColorHex: () => string | null
  mirrorAxisCounts: () => MirrorAxisCounts
  mirrorCopyMode: () => boolean
  pastePreviewCells: (pattern: Pattern, hovered: GridPosition) => PreviewCell[]
  beginSelectPress: (row: number, column: number) => void
  extendSelection: (row: number, column: number) => void
  backOutOfSelect: () => void
  beginOrCommitPress: (mode: 'paint' | 'erase', color: string | null, row: number, column: number) => void
  paintStrokeCell: (row: number, column: number, color: string | null) => void
  /** Pastes at a cell; true when something was pasted. */
  pasteAt: (cell: GridPosition | undefined) => boolean
}

/**
 * Mouse, touch and pen input on the Pattern (tickets 22-25, 31, 33, 92, 95, 176, 206; ADR 0023): the hovered cell and
 * its paint preview, and what a primary or secondary press and drag does under each tool. Deps are read lazily.
 */
export function useCanvasPointer(deps: CanvasPointerDeps) {
  /** The cell the cursor is over, for the hover paint preview (ticket 23); cleared when the cursor leaves the canvas. */
  const hoveredCell: Ref<GridPosition | undefined> = ref()

  function cellsUnderCursor(pattern: Pattern, hovered: GridPosition): PreviewCell[] {
    const tool = deps.activeTool()
    if (tool === 'hand') {
      return []
    }
    if (tool === 'select') {
      return deps.pastePreviewCells(pattern, hovered)
    }
    if (tool !== 'paint') {
      // Fill is unaffected by mirror state (ticket 22), so its preview only ever shows the hovered cell itself.
      return [hovered]
    }
    return mirroredCells(pattern, hovered, deps.mirrorAxisCounts(), deps.mirrorCopyMode())
  }

  /**
   * What the hover preview shows: the block Paste would stamp under the cursor (ticket 31), or the cell Paint/Fill would
   * touch plus its live-mirror counterpart(s) (tickets 22/23). Beads in rows already woven are left out, since nothing
   * lands on them (ticket 33).
   */
  const previewCells = computed<PreviewCell[]>(() => {
    const pattern = deps.currentPattern()
    if (!pattern || !hoveredCell.value) {
      return []
    }
    return cellsUnderCursor(pattern, hoveredCell.value).filter((cell) => !isInFinishedRow(pattern, cell))
  })

  function onCellHover(row: number, column: number) {
    hoveredCell.value = { row, column }
  }

  function onHoverEnd() {
    hoveredCell.value = undefined
  }

  /**
   * Ctrl/Cmd+V (ticket 92): pastes at the cell under the pointer, regardless of the active tool -- driven by hoveredCell
   * rather than the Select-only click gesture. Claims the chord from the browser only when something was pasted, so a
   * no-op (nothing copied, pointer off the grid -- see onHoverEnd) leaves the browser's own handling alone.
   */
  function pasteAtPointer(event: KeyboardEvent) {
    if (deps.pasteAt(hoveredCell.value)) {
      event.preventDefault()
    }
  }

  function onCellPrimaryDown(row: number, column: number) {
    if (deps.spaceHeld()) {
      // Space+drag pans the canvas (ticket 95): never a paint/fill/erase/select, regardless of the active tool.
      return
    }

    if (!deps.currentPattern()) {
      return
    }

    const tool = deps.activeTool()
    // The Hand tool moves the canvas (the surface handles the drag) and never changes a bead.
    if (tool === 'hand') {
      return
    }
    if (tool === 'select') {
      deps.beginSelectPress(row, column)
      return
    }

    // Eraser (ticket 176): single-bead erase by default, the same stroke path right-click erase already used --
    // so it works on touch/phone without needing a right-click. Right-click stays as-is (see onCellSecondaryDown);
    // it's now simply redundant with the primary press while Eraser is the active tool, and still the only way to
    // erase without leaving Paint, or to flood-erase without leaving Fill.
    if (tool === 'erase') {
      deps.beginOrCommitPress('erase', null, row, column)
      return
    }

    const color = deps.selectedColorHex()
    if (!color) {
      return
    }

    deps.beginOrCommitPress('paint', color, row, column)
  }

  function onCellPrimaryMove(row: number, column: number) {
    if (deps.spaceHeld()) {
      return
    }

    if (deps.activeTool() === 'select') {
      deps.extendSelection(row, column)
      return
    }

    const mode = deps.strokeMode()
    if (mode === 'erase') {
      deps.paintStrokeCell(row, column, null)
      return
    }

    if (mode !== 'paint') {
      return
    }

    const color = deps.selectedColorHex()
    if (!color) {
      return
    }

    deps.paintStrokeCell(row, column, color)
  }

  /** Right-click erase, mapped to the active tool (ticket 25): flood-erase in one click under Fill, single-cell/dragged-line erase under Paint and Eraser -- the latter now redundant with Eraser's own primary press (ticket 176), and kept for Paint/Fill where it's the only erase available without switching tools. */
  function onCellSecondaryDown(row: number, column: number) {
    if (deps.spaceHeld()) {
      return
    }

    // The Hand tool changes no bead, with either button.
    if (deps.activeTool() === 'hand') {
      return
    }

    // Select never erases; under it the right button backs out of a pending Paste or the Selection, alongside Escape.
    if (deps.activeTool() === 'select') {
      deps.backOutOfSelect()
      return
    }

    deps.beginOrCommitPress('erase', null, row, column)
  }

  function onCellSecondaryMove(row: number, column: number) {
    if (deps.spaceHeld()) {
      return
    }

    if (deps.strokeMode() !== 'erase') {
      return
    }

    deps.paintStrokeCell(row, column, null)
  }

  return {
    hoveredCell,
    previewCells,
    onCellHover,
    onHoverEnd,
    pasteAtPointer,
    onCellPrimaryDown,
    onCellPrimaryMove,
    onCellSecondaryDown,
    onCellSecondaryMove,
  }
}
