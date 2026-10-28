import { computed, ref, watch, type Ref } from 'vue'
import { hasBeads, type Rect } from '../../domain/canvas'
import { fitToDrawing, frameResizedAround, frameWithEdges, frameWithEdgeStep, frameWithSize, movedFrame, sameFrame, snapColumn, snappedMove, snapRow, type FrameEdge } from '../../domain/frame'
import type { GridPosition } from '../../domain/grid'
import { DEFAULT_NET_SIZE, DEFAULT_TECHNIQUE, describeWeave, type Technique } from '../../domain/weave'
import { changeCanvasWeave, changeFrame, customFrameLoss, frameChangeRefusal } from '../../domain/changeFrame'
import { changedSetting, frameAllows, frameKindOf, settingsOf, settingValuesOf, type FrameSettings } from '../../domain/frameKind'
import { namedPieceCutBy } from '../../domain/pieceNames'
import { placedStarter, type Starter, type StarterChoice } from '../../domain/starters'
import { starterName, starterSizeWords } from '../../i18n/starterWords'
import { canvasWeave, frameWeave, rowProgressStarted, sameWeave, switchedWeave, switchLoss, type Project } from '../../domain/project'
import { techniqueName } from '../../i18n/techniqueName'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { FramePress } from '../../rendering/frameHandles'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { EditFn } from './useEdit'
import type { OpenPanel } from '../shell/openPanel'
import { fillBlanks } from '../../domain/fillBlanks'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

export interface FrameFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  announce: (message: string) => void
  showToast: (id: string, text: string, tone?: MessageTone, action?: Toast['action']) => void
  messages: () => Translations
  locale: () => Locale
  /** Brings a block of beads into the middle of the view. */
  centreOn: (frame: Rect) => void
  /** The Canvas position under the middle of the view, or nothing until the area is measured. */
  visibleCentre: () => GridPosition | undefined
  /** The app's one open panel (ticket 510): the Frame panel is open while it is 'frame'. Its own when none is given. */
  openPanel?: Ref<OpenPanel | null>
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

type Layer = 'canvas' | 'frame'

const layerHasBeads = (project: Project, layer: Layer): boolean => hasBeads(layer === 'frame' ? (project.frame?.beads ?? {}) : project.beads)

type Gesture =
  | { kind: 'move'; origin: GridPosition; start: Rect }
  | { kind: 'resize'; edges: FrameEdge[]; start: Rect }

// Editing the Frame (CONTEXT.md, ADRs 0026, 0046, 0054): the edit pencil shows the handles and the strip's Frame
// button opens the Frame panel; closed whenever a Project opens (ticket 473), off once Row progress has started (ticket 411), though the
// Move handle still carries the Frame with its beads. Each resize is one announced Undo step that touches no bead.
export function useFrameFlow(deps: FrameFlowDeps) {
  /** The weaver's choice on the edit toggle (the Frame panel open); false until they turn it on. Never saved. */
  const openPanel = deps.openPanel ?? ref<OpenPanel | null>(null)
  const dialogs = deps.dialogs ?? useDialogs()
  const barOpen = computed({
    get: () => openPanel.value === 'frame',
    set: (on: boolean) => {
      if (on) openPanel.value = 'frame'
      else if (openPanel.value === 'frame') openPanel.value = null
    },
  })
  /** The edit pencil's choice (ticket 510): the Frame's handles are on; false until they turn it on. Never saved. */
  const handlesOn = ref(false)
  /** The Frame as it looks mid-drag, before it is committed; `move` is how far a Move drag has carried it with its
   * beads. */
  const draft = ref<{ frame: Rect; move?: { rows: number; columns: number } } | undefined>()
  let gesture: Gesture | undefined
  /** How far the Move handle has been dragged, in whole beads. */
  let moved = { rows: 0, columns: 0 }
  /** Whether the pointer has moved since the press: a click that drew nothing is not a Frame. */
  let dragged = false

  const draftProject = computed(() => {
    const project = deps.currentProject()
    if (!project || !draft.value) return project
    // Shown as the release will leave it: a resize that shrinks the Frame already lays its given-up beads on the Canvas.
    const outcome = changeFrame(project, draft.value.move ? { move: draft.value.move } : { set: draft.value.frame })
    return outcome.kind === 'changed' ? outcome.project : project
  })

  const locked = computed(() => {
    const project = deps.currentProject()
    return !!project && rowProgressStarted(project)
  })

  /** Whether the Frame's handles and steppers are on: a Frame, the toggle on, and no pass done. */
  const settingFrame = computed(() => {
    const frame = deps.currentProject()?.frame
    // A Custom frame's shape comes from its settings, not handles (ticket 0592).
    return !!frame && frameAllows(frame, 'resize') && handlesOn.value && !locked.value
  })

  /** Whether the Frame panel shows: a Project and the panel opened, with or without a Frame (ticket 555). Once a pass
   * is done it holds the size and Remove Frame alone (ticket 475: a panel that closes on a press outside cannot stay up
   * for good). */
  const barShown = computed(() => !!deps.currentProject() && barOpen.value)

  // The panel is closed whenever a Project opens (ticket 473), and the handles go off with it or when the Frame goes; a
  // Frame made or a lock changing only drops a drag in progress.
  watch(
    [() => deps.currentProject()?.id, () => !!deps.currentProject()?.frame],
    ([id, framed], [previousId]) => {
      if (id !== previousId) barOpen.value = false
      if (id !== previousId || !framed) handlesOn.value = false
    },
    { flush: 'sync' },
  )
  watch([() => deps.currentProject()?.id, () => !!deps.currentProject()?.frame, locked], cancel, { flush: 'sync' })

  /** The edit pencil: shows or hides the Frame's handles; nothing happens without a Frame. */
  function toggleHandles(): void {
    if (deps.currentProject()?.frame) handlesOn.value = !handlesOn.value
  }

  /** The strip's Frame button: opens or closes the Frame panel, with or without a Frame (ticket 555). Once Row progress
   * has started the panel still opens, for the size and Remove Frame. */
  function toggleBar(): void {
    if (deps.currentProject()) barOpen.value = !barOpen.value
  }

  /** The bar closed by Escape or a press outside it. */
  function closeBar(): void {
    barOpen.value = false
  }

  function describe(frame: Rect): string {
    const t = deps.messages()
    const project = deps.currentProject()
    const { columns, rows } = describeWeave(project ? frameWeave(project) : { technique: DEFAULT_TECHNIQUE }).unitsOf(frame)
    return fillBlanks(t.frame.announceSet, { width: columns, height: rows })
  }

  /** Commits a Frame resized (`set`), made around beads (`make`) or removed as one undo step; a no-change is no step. */
  function commit(frame: Rect | undefined, how: 'set' | 'make' = 'set'): boolean {
    const outcome = deps.edit('frame', (project) => changeFrame(project, frame ? (how === 'make' ? { make: frame } : { set: frame }) : { remove: true }))
    if (outcome.kind === 'refused' && outcome.reason === 'cuts-schema' && frame) {
      // Ticket 407: a Frame takes a named Schema whole or leaves it, so say which one it would have cut.
      const project = deps.currentProject()
      const name = project && namedPieceCutBy(project, frame)
      if (name !== undefined) deps.showToast('frame-cuts-schema', fillBlanks(deps.messages().frame.refusedCutsSchema, { name }), 'info')
      return false
    }
    if (outcome.kind !== 'applied') return outcome.kind === 'unchanged'
    deps.announce(frame ? describe(frame) : deps.messages().frame.announceRemoved)
    return true
  }

  /** The weave change waiting on its question (tickets 507, 568): a layer with drawn beads says what would be lost, and
   * Netting asks for its Net size and Brick stitch for its Brick block, before anything changes. */
  const switchAsk = dialogs.question<{ layer: Layer; technique: Technique; netSize: number; brickBlock: number }>('switch-technique')

  /** The open question as the dialog shows it: the Technique, the beads that would be lost, the Net size and Brick block
   * asked for, whether the layer has beads at all, and whether the Technique stays (only a setting changes). */
  const switchQuestion = computed(() => {
    const ask = switchAsk.value
    const project = deps.currentProject()
    if (!ask || !project) return undefined
    const { hasNetSize, hasBrickBlock } = describeWeave({ technique: ask.technique })
    return {
      technique: ask.technique,
      lost: switchLoss(project, ask.layer, ask.technique, ask.netSize),
      drawn: layerHasBeads(project, ask.layer),
      keeps: ask.technique === layerWeave(project, ask.layer).technique,
      asksNetSize: hasNetSize,
      netSize: ask.netSize,
      asksBrickBlock: hasBrickBlock,
      brickBlock: ask.brickBlock,
    }
  })

  const layerWeave = (project: Project, layer: Layer) => (layer === 'frame' ? frameWeave(project) : canvasWeave(project))

  function applySwitch(layer: Layer, technique: Technique, netSize?: number, brickBlock?: number): void {
    const project = deps.currentProject()
    if (!project) return
    const before = layerWeave(project, layer)
    const outcome =
      layer === 'frame'
        ? deps.edit('frame', (current) => changeFrame(current, { technique, netSize, brickBlock }))
        : deps.edit('exempt', (current) => changeCanvasWeave(current, { technique, netSize, brickBlock }))
    if (outcome.kind !== 'applied') return
    const t = deps.messages()
    if (technique !== before.technique) deps.announce(fillBlanks(t.frame.announceTechnique, { technique: techniqueName(t, technique) }))
    else if (brickBlock !== undefined && brickBlock !== (before.brickBlock ?? 1)) deps.announce(fillBlanks(t.frame.announceBrickBlock, { count: brickBlock }))
    else if (netSize !== undefined) deps.announce(fillBlanks(t.frame.announceNetSize, { count: netSize }))
  }

  /** Changes a layer's Technique, Net size or Brick block (tickets 507, 568). Asks first when a Technique switch has
   * drawn beads or settings to choose, or when a Net size would drop beads; otherwise changes at once. */
  function askWeave(layer: Layer, change: { technique?: Technique; netSize?: number; brickBlock?: number }): void {
    const project = deps.currentProject()
    if (!project || (layer === 'frame' && !project.frame)) return
    const current = layerWeave(project, layer)
    const technique = change.technique ?? current.technique
    const netSize = change.netSize ?? current.netSize ?? DEFAULT_NET_SIZE
    const brickBlock = change.brickBlock ?? current.brickBlock ?? 1
    const { hasNetSize, hasBrickBlock } = describeWeave({ technique })
    if (sameWeave(current, switchedWeave(current, technique, netSize, hasBrickBlock ? brickBlock : undefined))) return
    if (layer === 'frame' && frameChangeRefusal(project, { technique })) return
    const switching = technique !== current.technique
    if ((switching && (layerHasBeads(project, layer) || hasNetSize || hasBrickBlock)) || switchLoss(project, layer, technique, netSize) > 0) {
      switchAsk.value = { layer, technique, netSize, brickBlock }
      return
    }
    applySwitch(layer, technique, hasNetSize ? netSize : undefined, hasBrickBlock ? brickBlock : undefined)
  }

  function setSwitchNetSize(netSize: number): void {
    if (switchAsk.value) switchAsk.value = { ...switchAsk.value, netSize }
  }

  function setSwitchBrickBlock(brickBlock: number): void {
    if (switchAsk.value) switchAsk.value = { ...switchAsk.value, brickBlock }
  }

  function cancelSwitch(): void {
    switchAsk.value = undefined
  }

  function confirmSwitch(): void {
    const ask = switchAsk.value
    switchAsk.value = undefined
    if (!ask) return
    const { hasNetSize, hasBrickBlock } = describeWeave({ technique: ask.technique })
    applySwitch(ask.layer, ask.technique, hasNetSize ? ask.netSize : undefined, hasBrickBlock ? ask.brickBlock : undefined)
  }

  /** Weaves the open Project's Frame in another Technique (tickets 351, 507): one Undo step, once a pass is done not at all. */
  function setTechnique(technique: Technique): void {
    askWeave('frame', { technique })
  }

  /** Weaves the open brick stitch Project with another Brick block (ticket 477): every bead keeps its cell, one Undo
   * step. */
  function setBrickBlock(brickBlock: number): void {
    askWeave('frame', { brickBlock })
  }

  /** Weaves the open Netting Project's Frame with another Net size (ticket 568): beads without a place in the new net are
   * dropped, after asking. */
  function setNetSize(netSize: number): void {
    askWeave('frame', { netSize })
  }

  /** Weaves the Canvas in another Technique (tickets 492, 507): any time, since Row progress belongs to the Frame; one
   * Undo step. */
  function setCanvasTechnique(technique: Technique): void {
    askWeave('canvas', { technique })
  }

  /** The Canvas with another Brick block (ticket 492). */
  function setCanvasBrickBlock(brickBlock: number): void {
    askWeave('canvas', { brickBlock })
  }

  /** The Canvas with another Net size (ticket 568). */
  function setCanvasNetSize(netSize: number): void {
    askWeave('canvas', { netSize })
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

  /** The size typed into the Frame panel (ticket 473): both sides grow or shrink evenly about the Frame, one Undo step. */
  function resizeTo(columns: number, rows: number): void {
    const project = deps.currentProject()
    if (!project?.frame || locked.value) return
    const next = frameResizedAround(frameWeave(project), project.frame, columns, rows)
    if (!sameFrame(next, project.frame)) commit(next)
  }

  /** The Frame's name, typed in the Frame panel (ticket 555): one Undo step; empty clears it. */
  function rename(name: string): void {
    deps.edit('frame', (project) => changeFrame(project, { name }))
  }

  // Frame from a Selection (tickets 415, 452): the Frame becomes its rectangle, one Undo step. A named Piece's
  // Selection snaps to that Schema, starting on an even row where rows alternate (ticket 407); with a Frame already
  // set, it moves it there.
  function setTo(frame: Rect): void {
    const project = deps.currentProject()
    const top = project ? snapRow(project, frame.row) : frame.row
    const bottom = project ? describeWeave(project).snapBottom(top, frame.row + frame.rows - 1) : frame.row + frame.rows - 1
    const left = project ? snapColumn(project, frame.column) : frame.column
    const right = project ? describeWeave(project).snapRight(left, frame.column + frame.columns - 1) : frame.column + frame.columns - 1
    const applied = commit({ row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }, 'make')
    if (applied) explainSnap(frame, { top, bottom, left, right })
  }

  /** Ticket 570: one toast saying how much each edge grew when the snap pushed the Frame past what was picked. */
  function explainSnap(picked: Rect, snapped: Record<FrameEdge, number>): void {
    const grown: ['snapAddedTop' | 'snapAddedBottom' | 'snapAddedLeft' | 'snapAddedRight', number][] = [
      ['snapAddedTop', picked.row - snapped.top],
      ['snapAddedBottom', snapped.bottom - (picked.row + picked.rows - 1)],
      ['snapAddedLeft', picked.column - snapped.left],
      ['snapAddedRight', snapped.right - (picked.column + picked.columns - 1)],
    ]
    const lines = grown.filter(([, added]) => added > 0).map(([key, added]) => plural(deps.locale(), added, deps.messages().frame[key]))
    if (lines.length > 0) deps.showToast('frame-snapped', lines.join(' '), 'info')
  }

  function fit(): void {
    const project = deps.currentProject()
    if (!project) return
    const frame = fitToDrawing(project)
    if (frame) commit(frame, 'make')
    else deps.announce(deps.messages().frame.announceNothingToFit)
  }

  /** Whether the Remove frame confirmation is open: always asked; any done passes go with the Frame
   * (tickets 426, 455). */
  const removeConfirmOpen = dialogs.flag('remove-frame')

  /** Whether Remove Frame takes the Frame's beads with it rather than dropping them onto the Canvas (ADR 0077): the
   * question says so. */
  const removeTakesBeads = computed(() => {
    const frame = deps.currentProject()?.frame
    return !!frame && frameKindOf(frame).removedBeads === 'removed'
  })

  /** Remove Frame: asks first, except for an empty Frame that takes its beads with it, as there is nothing to lose
   * (ticket 0592). */
  function remove(): void {
    const project = deps.currentProject()
    if (!project?.frame) return
    if (removeTakesBeads.value && !hasBeads(project.frame.beads) && !locked.value) {
      commit(undefined)
      return
    }
    removeConfirmOpen.value = true
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

  /** Whether the Replace Frame question is open; the pending Starter waits behind it (tickets 495, 0596). */
  const replaceConfirmOpen = dialogs.flag('replace-frame')
  let pendingPlace: (() => void) | undefined

  /** Puts a Frame in place now, or once the weaver agrees to replace a Frame that holds beads, as they go with it. */
  function replaceAsking(place: () => void): void {
    const project = deps.currentProject()
    if (!project || locked.value) return
    if (project.frame && hasBeads(project.frame.beads)) {
      pendingPlace = place
      replaceConfirmOpen.value = true
      return
    }
    place()
  }

  /** Add Frame from Starter and Replace Frame (tickets 495, 0596): the Starter's Frame, pre-filled with its design or
   * empty, round the middle of the view, in place of any Frame there; one Undo step. Replacing a Frame that holds beads
   * asks first, as they go with it. */
  function placeFromStarter(starter: Starter, choice: StarterChoice): void {
    replaceAsking(() => {
      const centre = deps.visibleCentre() ?? { row: 0, column: 0 }
      const outcome = deps.edit('frame', (project) => placedStarter(project, starter, choice, centre))
      const t = deps.messages()
      const size = starterSizeWords(t, deps.locale(), starter, choice.sizes)
      if (outcome.kind === 'applied') deps.announce(fillBlanks(t.frame.announceCustom, { kind: starterName(t, starter), size }))
    })
  }

  /** The settings change waiting on its question: the one setting asked for and how many painted beads it would drop. */
  const sizeAsk = dialogs.question<{ change: FrameSettings; lost: number }>('frame-size')

  /** One of a Custom frame's settings from the Frame panel (tickets 0592, 0593, 0597): its Rounds, Part size or Rows, a
   * Fringe earring's Top width, Top rows, Fringe length or Fringe style. One Undo step, asking first when painted beads
   * would go; held still once a pass is done. */
  function setSettings(change: FrameSettings): void {
    const project = deps.currentProject()
    if (!project?.frame || !settingsOf(project.frame) || locked.value) return
    const lost = customFrameLoss(project, change)
    if (lost > 0) {
      sizeAsk.value = { change, lost }
      return
    }
    applySettings(change)
  }

  function applySettings(change: FrameSettings): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { settings: change }))
    const settled = deps.currentProject()?.frame
    if (outcome.kind !== 'applied' || !settled) return
    const t = deps.messages()
    const name = changedSetting(change)
    if (name === 'fringeStyle') {
      deps.announce(fillBlanks(t.frame.fringeStyle.announce, { style: t.starters.picks.fringeStyle.options[change.fringeStyle!] }))
      return
    }
    const value = settingValuesOf(settled).find((each) => each.name === name)?.value
    deps.announce(fillBlanks(t.frame.sizeSettings[name].announce, { count: String(value) }))
  }

  /** The size question answered No: nothing changes. */
  function cancelSize(): void {
    sizeAsk.value = undefined
  }

  /** The size question answered Yes: the outer rounds, last rows or strands' ends go with their beads, as one Undo step. */
  function confirmSize(): void {
    const ask = sizeAsk.value
    sizeAsk.value = undefined
    if (ask) applySettings(ask.change)
  }

  /** The Replace Frame question answered No: nothing changes. */
  function cancelReplace(): void {
    replaceConfirmOpen.value = false
    pendingPlace = undefined
  }

  /** The question answered Yes: the Frame goes and the new one is made, as one Undo step. */
  function confirmReplace(): void {
    replaceConfirmOpen.value = false
    const place = pendingPlace
    pendingPlace = undefined
    place?.()
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
    barOpen,
    handlesOn,
    toggleHandles,
    toggleBar,
    closeBar,
    press,
    drag,
    release,
    cancel,
    stepEdge,
    resizeTo,
    rename,
    setTechnique,
    setBrickBlock,
    setNetSize,
    setCanvasTechnique,
    switchQuestion,
    setSwitchNetSize,
    setSwitchBrickBlock,
    cancelSwitch,
    confirmSwitch,
    setCanvasBrickBlock,
    setCanvasNetSize,
    fit,
    setTo,
    remove,
    removeConfirmOpen,
    removeTakesBeads,
    cancelRemove,
    confirmRemove,
    placeFromStarter,
    setSettings,
    sizeAsk,
    cancelSize,
    confirmSize,
    replaceConfirmOpen,
    cancelReplace,
    confirmReplace,
    onKey,
    bringIntoView,
  }
}
