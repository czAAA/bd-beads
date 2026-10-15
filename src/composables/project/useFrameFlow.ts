import { computed, ref, watch } from 'vue'
import type { Frame } from '../../domain/canvas'
import { fitToDrawing, frameWithEdges, frameWithEdgeStep, frameWithSize, movedFrame, snapRow, type FrameEdge } from '../../domain/frame'
import type { GridPosition, Technique } from '../../domain/grid'
import { changeFrame, frameChangeDiscardsProgress } from '../../domain/changeFrame'
import { namedPieceCutBy } from '../../domain/pieceNames'
import { rowProgressStarted, type Project } from '../../domain/project'
import { plural } from '../../i18n/plural'
import { techniqueName } from '../../i18n/techniqueName'
import type { Locale, Translations } from '../../i18n/translations'
import type { FramePress } from '../../rendering/frameHandles'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from './useEdit'

export interface FrameFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  onUndo: () => void
  messages: () => Translations
  locale: () => Locale
  /** Brings a block of beads into the middle of the view. */
  centreOn: (frame: Frame) => void
}

/** What the user did to the Frame, for the margin Message's lead. */
type FrameAction = 'set' | 'moved' | 'resized'

type Gesture =
  | { kind: 'move'; origin: GridPosition; start: Frame }
  | { kind: 'resize'; edges: FrameEdge[]; start: Frame }

/**
 * Edit Frame (CONTEXT.md, ADRs 0026, 0046, 0054): the mode in which dragging moves and resizes the Frame, its margin steppers move one
 * edge a bead, and Technique, Fit to drawing and Remove Frame are at hand. It exists only with a Frame and while Row
 * progress has not been used (ticket 411), and ends by itself when either stops being true. A Frame is made from a
 * Selection (ticket 415), which enters Edit Frame, or by Fit to drawing. Every change is one Undo step that never touches
 * a bead, and is announced.
 */
export function useFrameFlow(deps: FrameFlowDeps) {
  const settingFrame = ref(false)
  /** The Frame as it looks mid-drag, before it is committed. */
  const draft = ref<Frame | undefined>()
  let gesture: Gesture | undefined
  /** Whether the pointer has moved since the press: a click that drew nothing is not a Frame. */
  let dragged = false
  /** A press landed outside the Frame: letting go ends Edit Frame (ticket 427). */
  let leavesOnRelease = false

  const locked = computed(() => {
    const project = deps.currentProject()
    return !!project && rowProgressStarted(project)
  })

  // Edit Frame needs a Frame it may change: it ends when the Frame goes (Remove Frame, Undo, another Project) or Row progress locks it.
  watch(
    () => !!deps.currentProject()?.frame && !locked.value,
    (editable) => {
      if (!editable) done()
    },
    { flush: 'sync' },
  )

  function describe(frame: Frame): string {
    const t = deps.messages()
    return t.frame.announceSet
      .replace('{width}', String(frame.columns))
      .replace('{height}', String(frame.rows))
  }

  /** Commits a new Frame (or none) as one undo step; a no-change is no step. The action names what happened in the margin Message. */
  function commit(frame: Frame | undefined, action: FrameAction = 'set', announce = true): boolean {
    // Pieces in the new Frame's margin move clear (ticket 261); the one Undo step restores them with the Frame.
    const outcome = deps.edit('frame', (project) => changeFrame(project, frame ? { set: frame } : { remove: true }))
    if (outcome.kind === 'refused' && outcome.reason === 'cuts-schema' && frame) {
      // Ticket 407: a Frame takes a named Schema whole or leaves it, so say which one it would have cut.
      const project = deps.currentProject()
      const name = project && namedPieceCutBy(project, frame)
      if (name !== undefined) deps.showToast('frame-cuts-schema', deps.messages().frame.refusedCutsSchema.replace('{name}', name), 'info')
      return false
    }
    if (outcome.kind !== 'applied') return outcome.kind === 'unchanged'
    if (outcome.moved > 0) {
      const t = deps.messages()
      const text = `${t.frame.marginLead[action]} ${plural(deps.locale(), outcome.moved, t.frame.marginClearedMessage)}`
      deps.showToast('frame-margin-cleared', text, 'info', {
        label: t.palette.undoButton,
        run: deps.onUndo,
      })
    } else if (announce) {
      deps.announce(frame ? describe(frame) : deps.messages().frame.announceRemoved)
    }
    return true
  }

  /** Weaves the open Project in another Technique (ticket 351): the grid, the beads and the Frame stay, one Undo step. */
  function setTechnique(technique: Technique): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { technique }))
    if (outcome.kind !== 'applied') return
    const t = deps.messages()
    deps.announce(t.frame.announceTechnique.replace('{technique}', techniqueName(t, technique)))
  }

  /** Enters Edit Frame; nothing happens without a Frame, or while Row progress holds it still. */
  function start(): void {
    if (deps.currentProject()?.frame && !locked.value) settingFrame.value = true
  }
  function done(): void {
    settingFrame.value = false
    draft.value = undefined
    gesture = undefined
  }

  function press(target: FramePress, cell: GridPosition): void {
    const project = deps.currentProject()
    if (!project || locked.value) return
    const frame = project.frame
    dragged = false
    leavesOnRelease = target.kind === 'outside'
    if (!frame) return
    if (target.kind === 'handle') gesture = { kind: 'resize', edges: target.edges, start: frame }
    else if (target.kind === 'inside') gesture = { kind: 'move', origin: cell, start: frame }
  }

  function drag(cell: GridPosition): void {
    const project = deps.currentProject()
    if (!project) return
    // A drag that starts outside the Frame is not a tap, so it no longer ends Edit Frame.
    if (!gesture) {
      leavesOnRelease = false
      return
    }
    dragged = true
    if (gesture.kind === 'resize') {
      draft.value = frameWithEdges(project.technique, gesture.start, gesture.edges, cell)
    } else {
      draft.value = movedFrame(project.technique, gesture.start, cell.row - gesture.origin.row, cell.column - gesture.origin.column)
    }
  }

  function release(): void {
    const result = draft.value
    const kind = gesture?.kind
    gesture = undefined
    draft.value = undefined
    if (result && dragged) commit(result, kind === 'move' ? 'moved' : 'resized')
    // A tap outside the Frame ends Edit Frame (ticket 427, ADR 0055); a press there that became a pinch is cancelled first.
    else if (leavesOnRelease) done()
    leavesOnRelease = false
  }

  /** Lets go of a drag without committing it: a second finger arrived, so it was a pinch. */
  function cancel(): void {
    leavesOnRelease = false
    gesture = undefined
    draft.value = undefined
  }

  /** A margin stepper's press (ticket 417): one edge a bead out (1) or in (-1), one Undo step; a step that would empty the Frame is none. */
  function stepEdge(edge: FrameEdge, step: 1 | -1): void {
    const project = deps.currentProject()
    if (!project?.frame || locked.value) return
    const next = frameWithEdgeStep(project.technique, project.frame, edge, step)
    if (next !== project.frame) commit(next, 'resized')
  }

  /**
   * Frame from a Selection (ticket 415): the Frame becomes the Selection's rectangle, one Undo step, and Edit Frame
   * starts on it (ticket 417). A Selection of a named Piece frames that Schema (ticket 407): the Frame snaps to
   * it, and where rows alternate starts on an even row. With a Frame already set it moves the Frame there.
   */
  function setTo(frame: Frame): void {
    const project = deps.currentProject()
    const top = project ? snapRow(project.technique, frame.row) : frame.row
    if (commit({ ...frame, row: top, rows: frame.rows + frame.row - top })) start()
  }

  function fit(): void {
    const project = deps.currentProject()
    if (!project) return
    const frame = fitToDrawing(project.technique, project.beads)
    if (frame) commit(frame)
    else deps.announce(deps.messages().frame.announceNothingToFit)
  }

  /** Whether the Remove frame confirmation is open: shown only when a pass is done, as removing the Frame throws the passes away (ticket 426). */
  const removeConfirmOpen = ref(false)

  /** Remove Frame; with no Frame there is nothing to edit, so Edit Frame ends. Once a pass is done it asks first. */
  function remove(): void {
    const project = deps.currentProject()
    if (!project?.frame) return
    if (frameChangeDiscardsProgress(project, { remove: true })) {
      removeConfirmOpen.value = true
      return
    }
    if (commit(undefined)) done()
  }

  /** The Remove frame question answered No: nothing changes. */
  function cancelRemove(): void {
    removeConfirmOpen.value = false
  }

  /** Remove Frame after the question: one Undo step restores the Frame and the passes together. */
  function confirmRemove(): void {
    removeConfirmOpen.value = false
    if (commit(undefined)) done()
  }

  /** The keyboard's Edit Frame: arrows move the Frame, Shift + arrows resize it from its bottom-right, Enter or Escape is done. Whether the key was used. */
  function onKey(event: KeyboardEvent): boolean {
    if (!settingFrame.value || !deps.currentProject()) return false
    if (event.key === 'Enter' || event.key === 'Escape') {
      done()
      return true
    }
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = steps[event.key]
    if (!step) return false
    const project = deps.currentProject()
    if (!project?.frame) return false
    if (event.shiftKey) {
      commit(frameWithSize(project.frame, project.frame.columns + step[1], project.frame.rows + step[0]), 'resized')
    } else {
      commit(movedFrame(project.technique, project.frame, step[0], step[1]), 'moved')
    }
    return true
  }

  function bringIntoView(): void {
    const frame = deps.currentProject()?.frame
    if (frame) deps.centreOn(frame)
  }

  return {
    settingFrame,
    /** What the canvas draws as the Frame while a drag has not committed it. */
    draft,
    frameLocked: locked,
    start,
    done,
    press,
    drag,
    release,
    cancel,
    stepEdge,
    setTechnique,
    fit,
    setTo,
    remove,
    removeConfirmOpen,
    cancelRemove,
    confirmRemove,
    onKey,
    bringIntoView,
  }
}
