import { computed, ref, watch } from 'vue'
import type { Frame } from '../../domain/canvas'
import { fitToDrawing, frameResizedAround, frameWithEdges, frameWithEdgeStep, frameWithSize, movedFrame, sameFrame, snapRow, type FrameEdge } from '../../domain/frame'
import type { GridPosition } from '../../domain/grid'
import { describeWeave, type Technique } from '../../domain/weave'
import { changeFrame } from '../../domain/changeFrame'
import { namedPieceCutBy } from '../../domain/pieceNames'
import { rowProgressStarted, withFrame, type Project } from '../../domain/project'
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

// Editing the Frame (CONTEXT.md, ADRs 0026, 0046, 0054, 0062): the edit toggle opens the Frame bar and shows the
// handles; closed whenever a Project opens (ticket 473), off once Row progress has started (ticket 411), though the
// Margin handle still carries the Frame with its beads. Each resize is one announced Undo step that touches no bead.
/** The control that opened the Frame bar, for it to hang from (ticket 475). */
export type FrameBarOrigin = 'pencil' | 'strip'

export function useFrameFlow(deps: FrameFlowDeps) {
  /** The weaver's choice on the edit toggle (the Frame bar open); false until they turn it on. Never saved. */
  const editOn = ref(false)
  /** Which control opened the bar: the edit pencil, or the strip's Frame button. */
  const barFrom = ref<FrameBarOrigin>('strip')
  /** The Frame as it looks mid-drag, before it is committed; `move` is how far a Move drag has carried it with its
   * beads. */
  const draft = ref<{ frame: Frame; move?: { rows: number; columns: number } } | undefined>()
  let gesture: Gesture | undefined
  /** How far the Move handle has been dragged, in whole beads. */
  let moved = { rows: 0, columns: 0 }
  /** Whether the pointer has moved since the press: a click that drew nothing is not a Frame. */
  let dragged = false

  const draftProject = computed(() => {
    const project = deps.currentProject()
    if (!project || !draft.value) return project
    if (!draft.value.move) return withFrame(project, draft.value.frame)
    const outcome = changeFrame(project, { move: draft.value.move })
    return outcome.kind === 'changed' ? outcome.project : project
  })

  const locked = computed(() => {
    const project = deps.currentProject()
    return !!project && rowProgressStarted(project)
  })

  /** Whether the Frame's handles and steppers are on: a Frame, the toggle on, and no pass done. */
  const settingFrame = computed(() => !!deps.currentProject()?.frame && editOn.value && !locked.value)

  /** Whether the Frame bar shows: a Frame and the bar opened. Once a pass is done it holds the size and Remove Frame
   * alone (ticket 475: a panel that closes on a press outside cannot stay up for good). */
  const barShown = computed(() => !!deps.currentProject()?.frame && editOn.value)

  // The bar is closed whenever a Project opens or its Frame goes (ticket 473); a Frame made or a lock changing only
  // drops a drag in progress.
  watch(
    [() => deps.currentProject()?.id, () => !!deps.currentProject()?.frame],
    ([id, framed], [previousId]) => {
      if (id !== previousId || !framed) editOn.value = false
    },
    { flush: 'sync' },
  )
  watch([() => deps.currentProject()?.id, () => !!deps.currentProject()?.frame, locked], cancel, { flush: 'sync' })

  /** The edit toggle: nothing happens without a Frame. Once Row progress has started it opens the bar alone, with no
   * handles. */
  function toggleEdit(from: FrameBarOrigin = 'strip'): void {
    if (!deps.currentProject()?.frame) return
    editOn.value = !editOn.value
    if (editOn.value) barFrom.value = from
  }

  /** The bar closed by Escape or a press outside it. */
  function closeEdit(): void {
    editOn.value = false
  }

  function describe(frame: Frame): string {
    const t = deps.messages()
    const project = deps.currentProject()
    const { columns, rows } = describeWeave(project ?? { technique: 'loom' }).unitsOf(frame)
    return t.frame.announceSet.replace('{width}', String(columns)).replace('{height}', String(rows))
  }

  /** Commits a Frame resized (`set`), made around beads (`make`) or removed as one undo step; a no-change is no step. */
  function commit(frame: Frame | undefined, how: 'set' | 'make' = 'set'): boolean {
    const outcome = deps.edit('frame', (project) => changeFrame(project, frame ? (how === 'make' ? { make: frame } : { set: frame }) : { remove: true }))
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

  /** Weaves the open Project in another Technique (ticket 351): the grid, the beads and the Frame stay, one Undo
   * step. */
  function setTechnique(technique: Technique): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { technique }))
    if (outcome.kind !== 'applied') return
    const t = deps.messages()
    deps.announce(t.frame.announceTechnique.replace('{technique}', techniqueName(t, technique)))
  }

  /** Weaves the open brick stitch Project with another Brick block (ticket 477): every bead keeps its cell, one Undo
   * step. */
  function setBrickBlock(brickBlock: number): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { brickBlock }))
    if (outcome.kind !== 'applied') return
    deps.announce(deps.messages().frame.announceBrickBlock.replace('{count}', String(brickBlock)))
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
      draft.value = { frame: frameWithEdges(project, gesture.start, gesture.edges, cell) }
    } else {
      const next = { rows: cell.row - gesture.origin.row, columns: cell.column - gesture.origin.column }
      // A pointer move inside the same bead changes nothing, so the draft (and the preview built from it) is left
      // alone.
      if (draft.value && next.rows === moved.rows && next.columns === moved.columns) return
      moved = next
      draft.value = { frame: movedFrame(project, gesture.start, next.rows, next.columns), move: next }
    }
  }

  function release(): void {
    const result = draft.value?.frame
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

  /** The Move handle's change (ticket 452): the Frame and its beads by whole rows and columns, one announced Undo
   * step. */
  function moveBy(rows: number, columns: number): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { move: { rows, columns } }))
    if (outcome.kind === 'applied') deps.announce(deps.messages().frame.announceMoved)
  }

  /** A margin stepper's press (ticket 417): one edge a bead out (1) or in (-1), one Undo step; a step that would
   * empty the Frame is none. */
  function stepEdge(edge: FrameEdge, step: 1 | -1): void {
    const project = deps.currentProject()
    if (!project?.frame || locked.value) return
    const next = frameWithEdgeStep(project, project.frame, edge, step)
    if (next !== project.frame) commit(next)
  }

  /** The size typed into the Frame bar (ticket 473): both sides grow or shrink evenly about the Frame, one Undo step. */
  function resizeTo(columns: number, rows: number): void {
    const project = deps.currentProject()
    if (!project?.frame || locked.value) return
    const next = frameResizedAround(project, project.frame, columns, rows)
    if (!sameFrame(next, project.frame)) commit(next)
  }

  // Frame from a Selection (tickets 415, 452): the Frame becomes its rectangle, one Undo step. A named Piece's
  // Selection snaps to that Schema, starting on an even row where rows alternate (ticket 407); with a Frame already
  // set, it moves it there.
  function setTo(frame: Frame): void {
    const project = deps.currentProject()
    const top = project ? snapRow(project, frame.row) : frame.row
    const bottom = project ? describeWeave(project).snapBottom(top, frame.row + frame.rows - 1) : frame.row + frame.rows - 1
    commit({ ...frame, row: top, rows: bottom - top + 1 }, 'make')
  }

  function fit(): void {
    const project = deps.currentProject()
    if (!project) return
    const frame = fitToDrawing(project)
    if (frame) commit(frame, 'make')
    else deps.announce(deps.messages().frame.announceNothingToFit)
  }

  /** Whether the Remove frame confirmation is open: always asked first: the passes go with the Frame (tickets 426,
   * 455). */
  const removeConfirmOpen = ref(false)

  /** Remove Frame: asks first (ticket 455). */
  function remove(): void {
    if (deps.currentProject()?.frame) removeConfirmOpen.value = true
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

  /** A key on a focused Frame handle (ticket 452): arrows move the Frame with its beads, Shift + arrows resize it
   * from its bottom-right. Whether the key was used. */
  function onKey(event: KeyboardEvent): boolean {
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = steps[event.key]
    const project = deps.currentProject()
    if (!step || !project?.frame) return false
    if (event.shiftKey) {
      const down = describeWeave(project).rowsPerUnit
      if (settingFrame.value) commit(frameWithSize(project.frame, project.frame.columns + step[1], project.frame.rows + step[0] * down, project))
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
    barShown,
    /** The Project as the canvas draws it while a drag has not committed: a Move drag shows the beads travelling
     * too, exactly as the release will leave them. */
    draftProject,
    frameLocked: locked,
    editOn,
    barFrom,
    toggleEdit,
    closeEdit,
    press,
    drag,
    release,
    cancel,
    stepEdge,
    resizeTo,
    setTechnique,
    setBrickBlock,
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
