import { computed, ref, watch } from 'vue'
import { hasBeads, type Frame } from '../../domain/canvas'
import { fitToDrawing, frameResizedAround, frameWithEdges, frameWithEdgeStep, frameWithSize, movedFrame, sameFrame, snapColumn, snappedMove, snapRow, type FrameEdge } from '../../domain/frame'
import type { GridPosition } from '../../domain/grid'
import { DEFAULT_NET_SIZE, DEFAULT_TECHNIQUE, describeWeave, type Technique } from '../../domain/weave'
import { changeCanvasWeave, changeFrame, frameChangeDiscardsProgress, frameChangeRefusal } from '../../domain/changeFrame'
import { namedPieceCutBy } from '../../domain/pieceNames'
import { canvasWeave, createProject, frameWeave, rowProgressStarted, switchLoss, weaveOf, withFrame, type CreateProjectInput, type Project } from '../../domain/project'
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
  /** The Canvas position under the middle of the view, or nothing until the area is measured. */
  visibleCentre: () => GridPosition | undefined
}

type Layer = 'canvas' | 'frame'

const layerHasBeads = (project: Project, layer: Layer): boolean => hasBeads(layer === 'frame' ? (project.frame?.beads ?? {}) : project.beads)

type Gesture =
  | { kind: 'move'; origin: GridPosition; start: Frame }
  | { kind: 'resize'; edges: FrameEdge[]; start: Frame }

// Editing the Frame (CONTEXT.md, ADRs 0026, 0046, 0054, 0062): the edit toggle opens the Frame bar and shows the
// handles; closed whenever a Project opens (ticket 473), off once Row progress has started (ticket 411), though the
// Move handle still carries the Frame with its beads. Each resize is one announced Undo step that touches no bead.
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
    const { columns, rows } = describeWeave(project ? frameWeave(project) : { technique: DEFAULT_TECHNIQUE }).unitsOf(frame)
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

  /** The Technique switch waiting on its question (ticket 507): a layer with drawn beads says what would be lost, and
   * Netting asks for its Net size, before anything changes. */
  const switchAsk = ref<{ layer: Layer; technique: Technique; netSize: number } | undefined>()

  /** The open switch question as the dialog shows it: the new Technique's name, the beads that would be lost, the Net
   * size asked for, and whether the layer has beads at all. */
  const switchQuestion = computed(() => {
    const ask = switchAsk.value
    const project = deps.currentProject()
    if (!ask || !project) return undefined
    return {
      technique: ask.technique,
      lost: switchLoss(project, ask.layer, ask.technique, ask.netSize),
      drawn: layerHasBeads(project, ask.layer),
      asksNetSize: describeWeave({ technique: ask.technique }).hasNetSize,
      netSize: ask.netSize,
    }
  })

  function applySwitch(layer: Layer, technique: Technique, netSize?: number): void {
    const outcome =
      layer === 'frame'
        ? deps.edit('frame', (project) => changeFrame(project, { technique, netSize }))
        : deps.edit('exempt', (project) => changeCanvasWeave(project, { technique, netSize }))
    if (outcome.kind !== 'applied') return
    const t = deps.messages()
    deps.announce(t.frame.announceTechnique.replace('{technique}', techniqueName(t, technique)))
  }

  /** Asks first when the layer has drawn beads or the Technique needs a Net size; otherwise switches at once. */
  function askSwitch(layer: Layer, technique: Technique): void {
    const project = deps.currentProject()
    if (!project) return
    const current = layer === 'frame' ? project.frame?.technique : project.technique
    if (current === undefined || current === technique) return
    if (layer === 'frame' && frameChangeRefusal(project, { technique })) return
    const weave = layer === 'frame' ? frameWeave(project) : canvasWeave(project)
    const netSize = weave.netSize ?? DEFAULT_NET_SIZE
    if (layerHasBeads(project, layer) || describeWeave({ technique }).hasNetSize) {
      switchAsk.value = { layer, technique, netSize }
      return
    }
    applySwitch(layer, technique)
  }

  function setSwitchNetSize(netSize: number): void {
    if (switchAsk.value) switchAsk.value = { ...switchAsk.value, netSize }
  }

  function cancelSwitch(): void {
    switchAsk.value = undefined
  }

  function confirmSwitch(): void {
    const ask = switchAsk.value
    switchAsk.value = undefined
    if (ask) applySwitch(ask.layer, ask.technique, describeWeave({ technique: ask.technique }).hasNetSize ? ask.netSize : undefined)
  }

  /** Weaves the open Project's Frame in another Technique (tickets 351, 507): one Undo step, once a pass is done not at all. */
  function setTechnique(technique: Technique): void {
    askSwitch('frame', technique)
  }

  /** Weaves the open brick stitch Project with another Brick block (ticket 477): every bead keeps its cell, one Undo
   * step. */
  function setBrickBlock(brickBlock: number): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { brickBlock }))
    if (outcome.kind !== 'applied') return
    deps.announce(deps.messages().frame.announceBrickBlock.replace('{count}', String(brickBlock)))
  }

  /** Weaves the Canvas in another Technique (tickets 492, 507): any time, since Row progress belongs to the Frame; one
   * Undo step. */
  function setCanvasTechnique(technique: Technique): void {
    askSwitch('canvas', technique)
  }

  /** The Canvas with another Brick block (ticket 492). */
  function setCanvasBrickBlock(brickBlock: number): void {
    const outcome = deps.edit('exempt', (project) => changeCanvasWeave(project, { brickBlock }))
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
      draft.value = { frame: frameWithEdges(frameWeave(project), gesture.start, gesture.edges, cell) }
    } else {
      const next = snappedMove(canvasWeave(project), cell.row - gesture.origin.row, cell.column - gesture.origin.column)
      // A pointer move inside the same bead changes nothing, so the draft (and the preview built from it) is left
      // alone.
      if (draft.value && next.rows === moved.rows && next.columns === moved.columns) return
      moved = next
      draft.value = { frame: movedFrame(gesture.start, next.rows, next.columns), move: next }
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

  /** An edge stepper's press (ticket 417): one edge a bead out (1) or in (-1), one Undo step; a step that would
   * empty the Frame is none. */
  function stepEdge(edge: FrameEdge, step: 1 | -1): void {
    const project = deps.currentProject()
    if (!project?.frame || locked.value) return
    const next = frameWithEdgeStep(frameWeave(project), project.frame, edge, step)
    if (next !== project.frame) commit(next)
  }

  /** The size typed into the Frame bar (ticket 473): both sides grow or shrink evenly about the Frame, one Undo step. */
  function resizeTo(columns: number, rows: number): void {
    const project = deps.currentProject()
    if (!project?.frame || locked.value) return
    const next = frameResizedAround(frameWeave(project), project.frame, columns, rows)
    if (!sameFrame(next, project.frame)) commit(next)
  }

  // Frame from a Selection (tickets 415, 452): the Frame becomes its rectangle, one Undo step. A named Piece's
  // Selection snaps to that Schema, starting on an even row where rows alternate (ticket 407); with a Frame already
  // set, it moves it there.
  function setTo(frame: Frame): void {
    const project = deps.currentProject()
    const top = project ? snapRow(project, frame.row) : frame.row
    const bottom = project ? describeWeave(project).snapBottom(top, frame.row + frame.rows - 1) : frame.row + frame.rows - 1
    const left = project ? snapColumn(project, frame.column) : frame.column
    const right = project ? describeWeave(project).snapRight(left, frame.column + frame.columns - 1) : frame.column + frame.columns - 1
    commit({ row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }, 'make')
  }

  function fit(): void {
    const project = deps.currentProject()
    if (!project) return
    const frame = fitToDrawing(project)
    if (frame) commit(frame, 'make')
    else deps.announce(deps.messages().frame.announceNothingToFit)
  }

  /** Whether the Remove frame confirmation is open: asked only when a pass is done, as the passes go with the Frame
   * (tickets 426, 455, 497). */
  const removeConfirmOpen = ref(false)

  /** Remove Frame: asks first only when it would throw away a done pass (ticket 497); otherwise the Frame goes at once. */
  function remove(): void {
    const project = deps.currentProject()
    if (!project?.frame) return
    if (frameChangeDiscardsProgress(project, { remove: true })) removeConfirmOpen.value = true
    else commit(undefined)
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

  /** Whether the Replace Frame question is open; the pending Template choice waits behind it (ticket 495). */
  const replaceConfirmOpen = ref(false)
  let pendingTemplate: CreateProjectInput | undefined

  /** Add Frame from Template and Replace Frame (ticket 495): an empty Frame in the Template's Technique, centred on what
   * is on screen and snapped to a Canvas position, over whatever lies there. Replacing a Frame that holds beads asks first,
   * as they go with it. */
  function placeFromTemplate(input: CreateProjectInput): void {
    const project = deps.currentProject()
    if (!project || locked.value) return
    if (project.frame && Object.keys(project.frame.beads).length > 0) {
      pendingTemplate = input
      replaceConfirmOpen.value = true
      return
    }
    applyTemplate(input)
  }

  function applyTemplate(input: CreateProjectInput): void {
    const made = createProject(input).frame!
    const weave = weaveOf(made)
    const centre = deps.visibleCentre() ?? { row: 0, column: 0 }
    const outcome = deps.edit('frame', (project) => {
      const row = snapRow(canvasWeave(project), snapRow(weave, centre.row - Math.floor(made.rows / 2)))
      const column = snapColumn(canvasWeave(project), snapColumn(weave, centre.column - Math.floor(made.columns / 2)))
      return changeFrame(project, { place: { frame: { row, column, rows: made.rows, columns: made.columns }, weave } })
    })
    if (outcome.kind === 'applied') deps.announce(describe(deps.currentProject()!.frame!))
  }

  /** The Replace Frame question answered No: nothing changes. */
  function cancelReplace(): void {
    replaceConfirmOpen.value = false
    pendingTemplate = undefined
  }

  /** The question answered Yes: the Frame goes and the new one is made, as one Undo step. */
  function confirmReplace(): void {
    replaceConfirmOpen.value = false
    const input = pendingTemplate
    pendingTemplate = undefined
    if (input) applyTemplate(input)
  }

  /** A key on a focused Frame handle (ticket 452): arrows move the Frame with its beads, Shift + arrows resize it
   * from its bottom-right. Whether the key was used. */
  function onKey(event: KeyboardEvent): boolean {
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = steps[event.key]
    const project = deps.currentProject()
    if (!step || !project?.frame) return false
    if (event.shiftKey) {
      const weave = frameWeave(project)
      const { rowsPerUnit, columnsPerUnit } = describeWeave(weave)
      if (settingFrame.value) commit(frameWithSize(project.frame, project.frame.columns + step[1] * columnsPerUnit, project.frame.rows + step[0] * rowsPerUnit, weave))
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
    setCanvasTechnique,
    switchQuestion,
    setSwitchNetSize,
    cancelSwitch,
    confirmSwitch,
    setCanvasBrickBlock,
    fit,
    setTo,
    remove,
    removeConfirmOpen,
    cancelRemove,
    confirmRemove,
    placeFromTemplate,
    replaceConfirmOpen,
    cancelReplace,
    confirmReplace,
    onKey,
    bringIntoView,
  }
}
