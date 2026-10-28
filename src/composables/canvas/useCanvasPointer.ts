import { computed, ref, type Ref } from 'vue'
import type { GridPosition, PreviewCell } from '../../domain/grid'
import type { Layer } from '../../domain/layers'
import { isInFinishedRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { pasteAimAtBead } from '../../domain/selection'
import type { Tool } from '../../domain/tool'

/** What pointer input on the canvas needs from the app shell: the open Project and tool, the paint color, and the
 * paint/selection gestures it drives. */
export interface CanvasPointerDeps {
  currentProject: () => Project | undefined
  activeTool: () => Tool
  /** Whether Space is held: Space+drag pans the canvas, never paints. */
  spaceHeld: () => boolean
  strokeMode: () => 'paint' | 'erase' | null
  selectedColorHex: () => string | null
  pastePreviewCells: (project: Project, hovered: GridPosition) => PreviewCell[]
  beginSelectPress: (row: number, column: number, layer?: Layer) => void
  extendSelection: (row: number, column: number, layer?: Layer) => void
  /** The Piece tool's tap on a bead (ticket 414): selects its Piece's rectangle, or clears the Selection on empty
   * space. */
  tapPiece: (row: number, column: number, layer?: Layer) => void
  beginOrCommitPress: (mode: 'paint' | 'erase', color: string | null, row: number, column: number, layer?: Layer) => void
  paintStrokeCell: (row: number, column: number, color: string | null, layer?: Layer) => void
  /** Pastes at a cell; true when something was pasted. */
  pasteAt: (cell: GridPosition | undefined) => boolean
  /** Pick color from canvas (ticket 398): true when it is on and took this press. */
  pickColorAt: (row: number, column: number, layer?: Layer) => boolean
}

/** Mouse, touch and pen input on the Project (tickets 22-25, 31, 33, 92, 95, 176, 206; ADR 0020): hover preview and
 * what a press and drag does under each tool. */
export function useCanvasPointer(deps: CanvasPointerDeps) {
  /** The cell the cursor is over, for the hover paint preview (ticket 23); cleared when the cursor leaves the
   * canvas. */
  const hoveredCell: Ref<GridPosition | undefined> = ref()

  function cellsUnderCursor(project: Project, hovered: GridPosition): PreviewCell[] {
    const tool = deps.activeTool()
    if (tool === 'hand') {
      return []
    }
    if (tool === 'piece') {
      return []
    }
    if (tool === 'select') {
      return deps.pastePreviewCells(project, hovered)
    }
    return [hovered]
  }

  // The hover preview: the block Paste would stamp (ticket 31), or the cell Paint/Fill would touch (tickets 22/23). Beads in rows already woven are left out (ticket 33).
  const previewCells = computed<PreviewCell[]>(() => {
    const project = deps.currentProject()
    if (!project || !hoveredCell.value) {
      return []
    }
    return cellsUnderCursor(project, hoveredCell.value).filter((cell) => !isInFinishedRow(project, cell))
  })

  function onCellHover(row: number, column: number, layer?: Layer) {
    hoveredCell.value = { row, column, ...(layer ? { layer } : {}) }
  }

  function onHoverEnd() {
    hoveredCell.value = undefined
  }

  // Ctrl/Cmd+V (ticket 92): pastes at the hovered cell under any tool. Claims the chord from the browser only when
  // something was pasted, so a no-op leaves the browser's own handling alone.
  function pasteAtPointer(event: KeyboardEvent) {
    const hovered = hoveredCell.value
    const project = deps.currentProject()
    // Select hovers cells; every other tool hovers beads, which a Custom frame names by round and place (ticket 0594).
    const aim = hovered && project && deps.activeTool() !== 'select' ? pasteAimAtBead(project, hovered) : hovered
    if (deps.pasteAt(aim)) {
      event.preventDefault()
    }
  }

  function onCellPrimaryDown(row: number, column: number, layer?: Layer) {
    if (deps.spaceHeld()) {
      // Space+drag pans the canvas (ticket 95): never a paint/fill/erase/select, regardless of the active tool.
      return
    }

    if (!deps.currentProject()) {
      return
    }

    if (deps.pickColorAt(row, column, layer)) {
      return
    }

    const tool = deps.activeTool()
    // The Hand tool moves the canvas (the surface handles the drag) and never changes a bead.
    if (tool === 'hand') {
      return
    }
    if (tool === 'select') {
      deps.beginSelectPress(row, column, layer)
      return
    }
    // Piece never drags: a tap selects the bead's Piece (ticket 414).
    if (tool === 'piece') {
      deps.tapPiece(row, column, layer)
      return
    }

    // Eraser (ticket 176): single-bead erase by default, so it works on touch.
    if (tool === 'erase') {
      deps.beginOrCommitPress('erase', null, row, column, layer)
      return
    }

    const color = deps.selectedColorHex()
    if (!color) {
      return
    }

    deps.beginOrCommitPress('paint', color, row, column, layer)
  }

  function onCellPrimaryMove(row: number, column: number, layer?: Layer) {
    if (deps.spaceHeld()) {
      return
    }

    if (deps.activeTool() === 'select') {
      deps.extendSelection(row, column, layer)
      return
    }

    const mode = deps.strokeMode()
    if (mode === 'erase') {
      deps.paintStrokeCell(row, column, null, layer)
      return
    }

    if (mode !== 'paint') {
      return
    }

    const color = deps.selectedColorHex()
    if (!color) {
      return
    }

    deps.paintStrokeCell(row, column, color, layer)
  }

  return {
    hoveredCell,
    previewCells,
    onCellHover,
    onHoverEnd,
    pasteAtPointer,
    onCellPrimaryDown,
    onCellPrimaryMove,
  }
}
