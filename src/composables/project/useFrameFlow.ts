import { computed, ref, watch } from 'vue'
import type { Frame } from '../../domain/canvas'
import { fitToDrawing, frameFromCells, frameWithEdges, frameWithSize, frameWithSizeFrom, movedFrame, sameFrame, snapRow, type FrameEdge, type FrameSides } from '../../domain/frame'
import type { GridPosition, Technique } from '../../domain/grid'
import { changeFrame } from '../../domain/changeFrame'
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
  /** The sides the Width and Height steppers grow from (ticket 410), kept on the device. */
  sides: () => FrameSides
  /** Commits a Frame to a Project that is no longer the open one: what a Project switch settles for the Project it leaves. */
  commitIn: (projectId: string, frame: Frame) => void
}


/** What the user did to the Frame, for the margin Message's lead. */
type FrameAction = 'set' | 'moved' | 'resized'

type Gesture =
  | { kind: 'draw'; anchor: GridPosition }
  | { kind: 'move'; origin: GridPosition; start: Frame }
  | { kind: 'resize'; edges: FrameEdge[]; start: Frame }

/**
 * Set Frame (CONTEXT.md, ADR 0026): the mode in which dragging draws, moves and resizes the Frame, and the commands that
 * change it from the Toolbox (size steppers, Technique, Fit to drawing, Remove Frame). Every change is one Undo step that never
 * touches a bead, refused while Row progress is on (its rows are the Frame's), and announced.
 *
 * The size steppers are the one exception to "every press is a step" (ticket 410): a press only changes the pending Frame,
 * which the canvas shows as it shows a drag. It is committed once, by whatever reads the Frame next: the sheet closing,
 * another command, an edit, a Project switch. Undo and Redo drop it, since nothing was baked.
 */
export function useFrameFlow(deps: FrameFlowDeps) {
  const settingFrame = ref(false)
  /** The Frame as it looks mid-drag, before it is committed. */
  const draft = ref<Frame | undefined>()
  let gesture: Gesture | undefined
  /** Whether the pointer has moved since the press: a click that drew nothing is not a Frame. */
  let dragged = false

  /** The size the steppers have set but nothing has committed yet, and the Project it is for (ticket 410). */
  const pending = ref<{ projectId: string; frame: Frame } | undefined>()

  const locked = computed(() => {
    const project = deps.currentProject()
    return !!project && rowProgressStarted(project)
  })

  /** The pending Frame of the open Project; none while Row progress holds the Frame still. */
  const pendingFrame = computed(() => {
    const project = deps.currentProject()
    return project && pending.value?.projectId === project.id && !locked.value ? pending.value.frame : undefined
  })

  /** What the canvas shows of the Frame that is not committed: a drag in progress, else the steppers' pending size. */
  const shownDraft = computed(() => draft.value ?? pendingFrame.value)

  /** Commits the pending Frame as one Undo step, with the Pieces its margin reaches moved once. A no-op with none pending. */
  function commitPending(): void {
    const frame = pendingFrame.value
    pending.value = undefined
    if (frame) commit(frame, 'resized')
  }

  /** Lets the pending Frame go: Undo and Redo replay history, and nothing pending was ever baked into it. */
  function dropPending(): void {
    pending.value = undefined
  }

  // A Project switch settles the pending Frame on the Project it leaves, so no pending Frame outlives its Project.
  watch(
    () => deps.currentProject()?.id,
    (id) => {
      const stale = pending.value
      pending.value = undefined
      if (stale && stale.projectId !== id) deps.commitIn(stale.projectId, stale.frame)
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
  function commit(frame: Frame | undefined, action: FrameAction = 'set', announce = true): void {
    // Pieces in the new Frame's margin move clear (ticket 261); the one Undo step restores them with the Frame.
    const outcome = deps.edit('frame', (project) => changeFrame(project, frame ? { set: frame } : { remove: true }))
    if (outcome.kind === 'refused' && outcome.reason === 'cuts-schema' && frame) {
      // Ticket 407: a Frame takes a named Schema whole or leaves it, so say which one it would have cut.
      const project = deps.currentProject()
      const name = project && namedPieceCutBy(project, frame)
      if (name !== undefined) deps.showToast('frame-cuts-schema', deps.messages().frame.refusedCutsSchema.replace('{name}', name), 'info')
      return
    }
    if (outcome.kind !== 'applied') return
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
  }

  /** Weaves the open Project in another Technique (ticket 351): the grid, the beads and the Frame stay, one Undo step. */
  function setTechnique(technique: Technique): void {
    commitPending()
    const outcome = deps.edit('frame', (project) => changeFrame(project, { technique }))
    if (outcome.kind !== 'applied') return
    const t = deps.messages()
    deps.announce(t.frame.announceTechnique.replace('{technique}', techniqueName(t, technique)))
  }

  function start(): void {
    commitPending()
    if (deps.currentProject()) settingFrame.value = true
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
    commitPending()
    const project = deps.currentProject()
    if (!project || locked.value) return
    const frame = project.frame
    dragged = false
    if (target.kind === 'handle' && frame) {
      gesture = { kind: 'resize', edges: target.edges, start: frame }
    } else if (target.kind === 'inside' && frame) {
      gesture = { kind: 'move', origin: cell, start: frame }
    } else {
      gesture = { kind: 'draw', anchor: cell }
      draft.value = frameFromCells(project.technique, cell, cell)
    }
  }

  function drag(cell: GridPosition): void {
    const project = deps.currentProject()
    if (!project || !gesture) return
    dragged = true
    if (gesture.kind === 'draw') {
      draft.value = frameFromCells(project.technique, gesture.anchor, cell)
    } else if (gesture.kind === 'resize') {
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
    if (result && dragged) commit(result, kind === 'move' ? 'moved' : kind === 'resize' ? 'resized' : 'set')
  }

  /** Lets go of a drag without committing it: a second finger arrived, so it was a pinch. */
  function cancel(): void {
    gesture = undefined
    draft.value = undefined
  }

  /**
   * A press on Width or Height (ticket 410): the Frame, from the chosen sides, becomes the pending one. Closing the sheet
   * commits it; one that comes back to the Frame itself is no change at all.
   */
  function setSize(columns: number, rows: number): void {
    const project = deps.currentProject()
    const base = pendingFrame.value ?? project?.frame
    if (!project || !base || locked.value) return
    const next = frameWithSizeFrom(project.technique, base, columns, rows, deps.sides())
    pending.value = sameFrame(next, project.frame) ? undefined : { projectId: project.id, frame: next }
  }

  /**
   * Frame from a Selection (ticket 415): the Frame becomes the Selection's rectangle, one Undo step. Edit Frame
   * (ticket 417) will follow it. A Selection of a named Piece frames that Schema (ticket 407): the Frame snaps to
   * it, and where rows alternate starts on an even row. With a Frame already set it moves the Frame there.
   */
  function setTo(frame: Frame): void {
    commitPending()
    const project = deps.currentProject()
    const top = project ? snapRow(project.technique, frame.row) : frame.row
    commit({ ...frame, row: top, rows: frame.rows + frame.row - top })
  }

  function fit(): void {
    commitPending()
    const project = deps.currentProject()
    if (!project) return
    const frame = fitToDrawing(project.technique, project.beads)
    if (frame) commit(frame)
    else deps.announce(deps.messages().frame.announceNothingToFit)
  }

  /** Remove Frame, leaving Set Frame on so a new Frame can be drawn straight away (ticket 258). */
  function remove(): void {
    commitPending()
    const project = deps.currentProject()
    if (!project?.frame) return
    commit(undefined)
    start()
  }

  /** The keyboard's Set Frame: arrows move the Frame, Shift + arrows resize it from its bottom-right, Enter or Escape is done. Whether the key was used. */
  function onKey(event: KeyboardEvent): boolean {
    if (!settingFrame.value || !deps.currentProject()) return false
    if (event.key === 'Enter' || event.key === 'Escape') {
      done()
      return true
    }
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = steps[event.key]
    if (!step) return false
    commitPending()
    const project = deps.currentProject()
    if (!project) return false
    if (!project.frame) {
      commit(frameFromCells(project.technique, { row: 0, column: 0 }, { row: 0, column: 0 }))
    } else if (event.shiftKey) {
      commit(frameWithSize(project.frame, project.frame.columns + step[1], project.frame.rows + step[0]), 'resized')
    } else {
      commit(movedFrame(project.technique, project.frame, step[0], step[1]), 'moved')
    }
    return true
  }

  function bringIntoView(): void {
    const frame = pendingFrame.value ?? deps.currentProject()?.frame
    if (frame) deps.centreOn(frame)
  }

  return {
    settingFrame,
    /** What the canvas draws as the Frame while it is not committed: a drag, or the steppers' pending size. */
    draft: shownDraft,
    pendingFrame,
    frameLocked: locked,
    commitPending,
    dropPending,
    start,
    done,
    toggle,
    press,
    drag,
    release,
    cancel,
    setSize,
    setTechnique,
    fit,
    setTo,
    remove,
    onKey,
    bringIntoView,
  }
}
