import { computed, ref } from 'vue'
import type { Frame } from '../../domain/canvas'
import { fitToDrawing, frameFromCells, frameWithEdges, frameWithSize, movedFrame, type FrameEdge } from '../../domain/frame'
import type { GridPosition } from '../../domain/grid'
import type { MirrorAxisCounts } from '../../domain/mirror'
import { clearMargin } from '../../domain/margin'
import { withFrame, type Pattern, type UndoEntry } from '../../domain/pattern'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { FramePress } from '../../rendering/frameHandles'
import type { MessageTone, Toast } from '../ui/useToasts'

export interface FrameFlowDeps {
  currentPattern: () => Pattern | undefined
  replacePattern: (pattern: Pattern) => void
  recordHistory: (entry: UndoEntry) => void
  mirrorAxisCounts: () => MirrorAxisCounts
  clearMirrorAxisCounts: () => void
  clearSelectionAndHover: () => void
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  locale: () => Locale
  /** Brings a block of beads into the middle of the view. */
  centreOn: (frame: Frame) => void
}


type Gesture =
  | { kind: 'draw'; anchor: GridPosition }
  | { kind: 'move'; origin: GridPosition; start: Frame }
  | { kind: 'resize'; edges: FrameEdge[]; start: Frame }

/**
 * Set Frame (CONTEXT.md, ADR 0026): the mode in which dragging draws, moves and resizes the Frame, and the commands that
 * change it from the Toolbox (size steppers, Fit to drawing, Remove Frame). Every change is one Undo step that never
 * touches a bead, refused while Row progress is on (its rows are the Frame's), and announced.
 */
export function useFrameFlow(deps: FrameFlowDeps) {
  const settingFrame = ref(false)
  /** The Frame as it looks mid-drag, before it is committed. */
  const draft = ref<Frame | undefined>()
  let gesture: Gesture | undefined
  /** Whether the pointer has moved since the press: a click that drew nothing is not a Frame. */
  let dragged = false

  const locked = computed(() => !!deps.currentPattern()?.rowProgress.enabled)

  function describe(frame: Frame): string {
    const t = deps.messages()
    return t.frame.announceSet
      .replace('{columns}', plural(deps.locale(), frame.columns, t.canvas.columnsCount))
      .replace('{rows}', plural(deps.locale(), frame.rows, t.canvas.rowsCount))
  }

  /** Commits a new Frame (or none) as one undo step; a no-change is no step. */
  function commit(frame: Frame | undefined, announce = true): void {
    const pattern = deps.currentPattern()
    if (!pattern || locked.value) return
    const framed = withFrame(pattern, frame)
    if (framed === pattern) return
    // Beads in the new Frame's margin move clear (ticket 261); the one Undo step restores them with the Frame.
    const { pattern: updated, moved } = clearMargin(framed)
    deps.recordHistory({
      beads: pattern.beads,
      rowProgress: pattern.rowProgress,
      size: { frame: pattern.frame, mirrorAxisCounts: deps.mirrorAxisCounts() },
    })
    deps.replacePattern(updated)
    deps.clearMirrorAxisCounts()
    deps.clearSelectionAndHover()
    if (moved > 0) {
      const t = deps.messages()
      deps.showToast('frame-margin-cleared', plural(deps.locale(), moved, t.frame.marginClearedMessage), 'info', {
        label: t.palette.undoButton,
        run: deps.onUndo,
      })
    } else if (announce) {
      deps.announce(frame ? describe(frame) : deps.messages().frame.announceRemoved)
    }
  }

  function start(): void {
    if (deps.currentPattern()) settingFrame.value = true
  }
  function done(): void {
    settingFrame.value = false
    draft.value = undefined
    gesture = undefined
  }
  function toggle(): void {
    if (settingFrame.value) done()
    else start()
  }

  function press(target: FramePress, cell: GridPosition): void {
    const pattern = deps.currentPattern()
    if (!pattern || locked.value) return
    const frame = pattern.frame
    dragged = false
    if (target.kind === 'handle' && frame) {
      gesture = { kind: 'resize', edges: target.edges, start: frame }
    } else if (target.kind === 'inside' && frame) {
      gesture = { kind: 'move', origin: cell, start: frame }
    } else {
      gesture = { kind: 'draw', anchor: cell }
      draft.value = frameFromCells(pattern.technique, cell, cell)
    }
  }

  function drag(cell: GridPosition): void {
    const pattern = deps.currentPattern()
    if (!pattern || !gesture) return
    dragged = true
    if (gesture.kind === 'draw') {
      draft.value = frameFromCells(pattern.technique, gesture.anchor, cell)
    } else if (gesture.kind === 'resize') {
      draft.value = frameWithEdges(pattern.technique, gesture.start, gesture.edges, cell)
    } else {
      draft.value = movedFrame(pattern.technique, gesture.start, cell.row - gesture.origin.row, cell.column - gesture.origin.column)
    }
  }

  function release(): void {
    const result = draft.value
    gesture = undefined
    draft.value = undefined
    if (result && dragged) commit(result)
  }

  /** Lets go of a drag without committing it: a second finger arrived, so it was a pinch. */
  function cancel(): void {
    gesture = undefined
    draft.value = undefined
  }

  function setSize(columns: number, rows: number): void {
    const frame = deps.currentPattern()?.frame
    if (frame) commit(frameWithSize(frame, columns, rows))
  }

  function fit(): void {
    const pattern = deps.currentPattern()
    if (!pattern) return
    const frame = fitToDrawing(pattern.technique, pattern.beads)
    if (frame) commit(frame)
    else deps.announce(deps.messages().frame.announceNothingToFit)
  }

  /** Remove Frame, leaving Set Frame on so a new Frame can be drawn straight away (ticket 258). */
  function remove(): void {
    const pattern = deps.currentPattern()
    if (!pattern?.frame || locked.value) return
    commit(undefined)
    start()
  }

  /** The keyboard's Set Frame: arrows move the Frame, Shift + arrows resize it from its bottom-right, Enter or Escape is done. Whether the key was used. */
  function onKey(event: KeyboardEvent): boolean {
    const pattern = deps.currentPattern()
    if (!settingFrame.value || !pattern) return false
    if (event.key === 'Enter' || event.key === 'Escape') {
      done()
      return true
    }
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = steps[event.key]
    if (!step) return false
    if (!pattern.frame) {
      commit(frameFromCells(pattern.technique, { row: 0, column: 0 }, { row: 0, column: 0 }))
    } else if (event.shiftKey) {
      commit(frameWithSize(pattern.frame, pattern.frame.columns + step[1], pattern.frame.rows + step[0]))
    } else {
      commit(movedFrame(pattern.technique, pattern.frame, step[0], step[1]))
    }
    return true
  }

  function bringIntoView(): void {
    const frame = deps.currentPattern()?.frame
    if (frame) deps.centreOn(frame)
  }

  return {
    settingFrame,
    draft,
    frameLocked: locked,
    start,
    done,
    toggle,
    press,
    drag,
    release,
    cancel,
    setSize,
    fit,
    remove,
    onKey,
    bringIntoView,
  }
}
