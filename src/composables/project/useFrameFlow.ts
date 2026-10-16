import { computed, ref, watch } from 'vue'
import type { Frame } from '../../domain/canvas'
import { fitToDrawing, frameWithEdges, frameWithEdgeStep, frameWithSize, movedFrame, snapRow, type FrameEdge } from '../../domain/frame'
import type { GridPosition, Technique } from '../../domain/grid'
import { changeFrame, frameChangeDiscardsProgress } from '../../domain/changeFrame'
import { namedPieceCutBy } from '../../domain/pieceNames'
import { rowProgressStarted, type Project } from '../../domain/project'
import { techniqueName } from '../../i18n/techniqueName'
import type { Translations } from '../../i18n/translations'
import type { FramePress } from '../../rendering/frameHandles'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from './useEdit'

export interface FrameFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  messages: () => Translations
  /** Brings a block of beads into the middle of the view. */
  centreOn: (frame: Frame) => void
}

type Gesture =
  | { kind: 'move'; origin: GridPosition; start: Frame }
  | { kind: 'resize'; edges: FrameEdge[]; start: Frame }

/**
 * Editing the Frame (CONTEXT.md, ADRs 0026, 0046, 0054, 0062): the edit toggle on the Frame switches its handles and margin
 * steppers on and off; it is on whenever a Frame is made or a Project opens, kept for the session only, and off while Row
 * progress has started (ticket 411), which still lets the Move handle carry the Frame with its beads (ticket 452). Every
 * resize is one Undo step that never touches a bead, and is announced.
 */
export function useFrameFlow(deps: FrameFlowDeps) {
  /** The weaver's choice on the edit toggle; true until they turn it off. Never saved. */
  const editOn = ref(true)
  /** The Frame as it looks mid-drag, before it is committed. */
  const draft = ref<Frame | undefined>()
  let gesture: Gesture | undefined
  /** How far the Move handle has been dragged, in whole beads. */
  let moved = { rows: 0, columns: 0 }
  /** Whether the pointer has moved since the press: a click that drew nothing is not a Frame. */
  let dragged = false

  const locked = computed(() => {
    const project = deps.currentProject()
    return !!project && rowProgressStarted(project)
  })

  /** Whether the Frame's handles and steppers are on: a Frame, the toggle on, and no pass done. */
  const settingFrame = computed(() => !!deps.currentProject()?.frame && editOn.value && !locked.value)

  // Edit is on again whenever a Frame is made or a Project opens, and when Row progress is reset after having locked it.
  watch(
    [() => deps.currentProject()?.id, () => !!deps.currentProject()?.frame, locked],
    () => {
      editOn.value = true
      cancel()
    },
    { flush: 'sync' },
  )

  /** The edit toggle: nothing happens without a Frame, or once Row progress has started. */
  function toggleEdit(): void {
    if (deps.currentProject()?.frame && !locked.value) editOn.value = !editOn.value
  }

  function describe(frame: Frame): string {
    const t = deps.messages()
    return t.frame.announceSet
      .replace('{width}', String(frame.columns))
      .replace('{height}', String(frame.rows))
  }

  /** Commits a new Frame (or none) as one undo step; a no-change is no step. */
  function commit(frame: Frame | undefined): boolean {
    const outcome = deps.edit('frame', (project) => changeFrame(project, frame ? { set: frame } : { remove: true }))
    if (outcome.kind === 'refused' && outcome.reason === 'cuts-schema' && frame) {
      // Ticket 407: a Frame takes a named Schema whole or leaves it, so say which one it would have cut.
      const project = deps.currentProject()
      const name = project && namedPieceCutBy(project, frame)
      if (name !== undefined) deps.showToast('frame-cuts-schema', deps.messages().frame.refusedCutsSchema.replace('{name}', name), 'info')
      return false
    }
    if (outcome.kind !== 'applied') return outcome.kind === 'unchanged'
    deps.announce(frame ? describe(frame) : deps.messages().frame.announceRemoved)
    return true
  }

  /** Weaves the open Project in another Technique (ticket 351): the grid, the beads and the Frame stay, one Undo step. */
  function setTechnique(technique: Technique): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { technique }))
    if (outcome.kind !== 'applied') return
    const t = deps.messages()
    deps.announce(t.frame.announceTechnique.replace('{technique}', techniqueName(t, technique)))
  }

  function press(target: FramePress, cell: GridPosition): void {
    const project = deps.currentProject()
    const frame = project?.frame
    dragged = false
    moved = { rows: 0, columns: 0 }
    if (!frame) return
    // The Move handle always works; a resize handle only while the edit toggle is on.
    if (target.kind === 'move') gesture = { kind: 'move', origin: cell, start: frame }
    else if (target.kind === 'handle' && settingFrame.value) gesture = { kind: 'resize', edges: target.edges, start: frame }
  }

  function drag(cell: GridPosition): void {
    const project = deps.currentProject()
    if (!project || !gesture) return
    dragged = true
    if (gesture.kind === 'resize') {
      draft.value = frameWithEdges(project.technique, gesture.start, gesture.edges, cell)
    } else {
      moved = { rows: cell.row - gesture.origin.row, columns: cell.column - gesture.origin.column }
      draft.value = movedFrame(project.technique, gesture.start, moved.rows, moved.columns)
    }
  }

  function release(): void {
    const result = draft.value
    const wasMove = gesture?.kind === 'move'
    gesture = undefined
    draft.value = undefined
    if (!result || !dragged) return
    if (wasMove) moveBy(moved.rows, moved.columns)
    else commit(result)
  }

  /** Lets go of a drag without committing it: a second finger arrived, so it was a pinch. */
  function cancel(): void {
    gesture = undefined
    draft.value = undefined
  }

  /** The Move handle's change (ticket 452): the Frame and its beads by whole rows and columns, one announced Undo step; clamped to the beads' reach by the domain. */
  function moveBy(rows: number, columns: number): boolean {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { move: { rows, columns } }))
    if (outcome.kind !== 'applied') return outcome.kind === 'unchanged'
    deps.announce(deps.messages().frame.announceMoved)
    return true
  }

  /** A margin stepper's press (ticket 417): one edge a bead out (1) or in (-1), one Undo step; a step that would empty the Frame is none. */
  function stepEdge(edge: FrameEdge, step: 1 | -1): void {
    const project = deps.currentProject()
    if (!project?.frame || locked.value) return
    const next = frameWithEdgeStep(project.technique, project.frame, edge, step)
    if (next !== project.frame) commit(next)
  }

  /**
   * Frame from a Selection (ticket 415): the Frame becomes the Selection's rectangle, one Undo step, (edit is on for the new Frame, ticket 452). A Selection of a named Piece frames that Schema (ticket 407): the Frame snaps to
   * it, and where rows alternate starts on an even row. With a Frame already set it moves the Frame there.
   */
  function setTo(frame: Frame): void {
    const project = deps.currentProject()
    const top = project ? snapRow(project.technique, frame.row) : frame.row
    commit({ ...frame, row: top, rows: frame.rows + frame.row - top })
  }

  function fit(): void {
    const project = deps.currentProject()
    if (!project) return
    const frame = fitToDrawing(project.technique, project.beads, project.frame)
    if (frame) commit(frame)
    else deps.announce(deps.messages().frame.announceNothingToFit)
  }

  /** Whether the Remove frame confirmation is open: shown only when a pass is done, as removing the Frame throws the passes away (ticket 426). */
  const removeConfirmOpen = ref(false)

  /** Remove Frame; once a pass is done it asks first. */
  function remove(): void {
    const project = deps.currentProject()
    if (!project?.frame) return
    if (frameChangeDiscardsProgress(project, { remove: true })) {
      removeConfirmOpen.value = true
      return
    }
    commit(undefined)
  }

  /** The Remove frame question answered No: nothing changes. */
  function cancelRemove(): void {
    removeConfirmOpen.value = false
  }

  /** Remove Frame after the question: one Undo step restores the Frame and the passes together. */
  function confirmRemove(): void {
    removeConfirmOpen.value = false
    commit(undefined)
  }

  /** A key on a focused Frame handle (ticket 452): arrows move the Frame with its beads, Shift + arrows resize it from its bottom-right. Whether the key was used. */
  function onKey(event: KeyboardEvent): boolean {
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = steps[event.key]
    const project = deps.currentProject()
    if (!step || !project?.frame) return false
    if (event.shiftKey) {
      if (settingFrame.value) commit(frameWithSize(project.frame, project.frame.columns + step[1], project.frame.rows + step[0]))
    } else {
      moveBy(step[0], step[1])
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
    editOn,
    toggleEdit,
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
