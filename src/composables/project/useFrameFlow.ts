import { computed, ref, watch, type Ref } from 'vue'
import { hasBeads, type Rect, sameFrame } from '../../domain/canvas'
import {
  fitToDrawing,
  frameResizedAround,
  frameWithEdges,
  frameWithEdgeStep,
  frameWithSize,
  movedFrame,
  snapRow,
  type FrameEdge,
} from '../../domain/frame'
import type { GridPosition, Layer } from '../../domain/grid'
import { describeWeave, weaveSettings, type Technique, type TechniqueSettings } from '../../domain/weave'
import { changeCanvasWeave, changeFrame, frameChangeRefusal } from '../../domain/changeFrame'
import { grownFrame } from '../../domain/frameGrowth'
import { changedSetting, frameAllows, removedBeadsOf, settingsOf, settingValuesOf, type FrameSettings } from '../../domain/frameShape'
import { namedPieceCutBy } from '../../domain/pieceNames'
import { placedStarter, type Starter, type StarterChoice } from '../../domain/starters'
import { starterName, starterSizeWords } from '../../i18n/starterWords'
import { layerOf } from '../../domain/layerRecord'
import { frameWeave, layerWeave, sameWeave } from '../../domain/layerWeave'
import { rowProgressStarted } from '../../domain/rowProgress'
import { switchedWeave } from '../../domain/weaveSwitch'
import type { Project } from '../../domain/project'
import { weaveSettingWords } from '../../i18n/settingWords'
import { techniqueName } from '../../i18n/techniqueName'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { FramePress } from '../../rendering/frameHandles'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { Edit, EditFn } from './useEdit'
import type { OpenPanel } from '../shell/openPanel'
import { fillBlanks } from '../../domain/fillBlanks'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

export interface FrameFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  /** Edit's held Frame change and its settle (ticket 0640): a Custom frame's steppers show each press at once and
   * commit once, when the Frame panel closes. */
  hold: Edit['hold']
  settle: Edit['settle']
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
   * is done it holds the size, Rotate Frame and Remove Frame (tickets 475, 0647: a panel that closes on a press outside
   * cannot stay up for good). */
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
  // The steppers' presses are one Undo step, taken as the panel closes (ticket 0640).
  watch(barOpen, (open) => open || deps.settle(), { flush: 'sync' })

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
    return fillBlanks(t.frame.announceSet, { width: frame.columns, height: frame.rows })
  }

  /** Commits a Frame resized (`set`), made around beads (`make`) or removed as one undo step; a no-change is no step.
   * A resize stopped at a named Schema's edge says which (ticket 0639). */
  function commit(frame: Rect | undefined, how: 'set' | 'make' = 'set'): boolean {
    const before = deps.currentProject()
    const stoppedAt = frame && how === 'set' && before ? grownFrame(before, frame).stoppedAt : undefined
    const outcome = deps.edit('frame', (project) => changeFrame(project, frame ? (how === 'make' ? { make: frame } : { set: frame }) : { remove: true }))
    if (stoppedAt !== undefined && outcome.kind !== 'refused') deps.showToast('frame-cuts-schema', fillBlanks(deps.messages().frame.refusedCutsSchema, { name: stoppedAt }), 'info')
    if (outcome.kind === 'refused' && outcome.reason === 'cuts-schema' && frame) {
      // Ticket 407: a Frame takes a named Schema whole or leaves it, so say which one it would have cut.
      const project = deps.currentProject()
      const name = project && namedPieceCutBy(project, frame)
      if (name !== undefined) deps.showToast('frame-cuts-schema', fillBlanks(deps.messages().frame.refusedCutsSchema, { name }), 'info')
      return false
    }
    if (outcome.kind !== 'applied') return outcome.kind === 'unchanged'
    const left = deps.currentProject()?.frame
    deps.announce(frame && left ? describe(left) : deps.messages().frame.announceRemoved)
    return true
  }

  function applySwitch(layer: Layer, technique: Technique, values: TechniqueSettings): void {
    const project = deps.currentProject()
    if (!project) return
    const before = layerWeave(project, layer)
    const change = { technique, techniqueSettings: values }
    const outcome =
      layer === 'frame'
        ? deps.edit('frame', (current) => changeFrame(current, change))
        : deps.edit('exempt', (current) => changeCanvasWeave(current, change))
    if (outcome.kind !== 'applied') return
    const t = deps.messages()
    if (technique !== before.technique) {
      deps.announce(fillBlanks(t.frame.announceTechnique, { technique: techniqueName(t, technique) }))
      return
    }
    const changed = describeWeave({ technique }).settings.find((setting) => values[setting.id] !== before.techniqueSettings?.[setting.id])
    if (changed) deps.announce(fillBlanks(weaveSettingWords(t, changed).changed, { count: values[changed.id] ?? changed.default }))
  }

  /** Changes a layer's Technique or one of its settings (tickets 507, 0626, ADR 0038): at once, as every bead keeps its
   * row and column. */
  function changeWeave(layer: Layer, change: { technique: Technique } | { setting: string; value: number }): void {
    const project = deps.currentProject()
    if (!project || (layer === 'frame' && !project.frame)) return
    const current = layerWeave(project, layer)
    const technique = 'technique' in change ? change.technique : current.technique
    // The layer's values for the Technique's settings, one kept from before it was woven in another (a Brick block) too.
    const held = weaveSettings({ ...current, technique })
    const values = 'setting' in change ? weaveSettings({ technique, techniqueSettings: { ...held, [change.setting]: change.value } }) : held
    if (sameWeave(current, switchedWeave(current, technique, values))) return
    if (layer === 'frame' && frameChangeRefusal(project, { technique })) return
    applySwitch(layer, technique, values)
  }

  /** Weaves the open Project's Frame in another Technique (tickets 351, 507): one Undo step, once a pass is done not at all. */
  function setTechnique(technique: Technique): void {
    changeWeave('frame', { technique })
  }

  /** Weaves the Canvas in another Technique (tickets 492, 507): any time, since Row progress belongs to the Frame; one
   * Undo step. */
  function setCanvasTechnique(technique: Technique): void {
    changeWeave('canvas', { technique })
  }

  /** Sets any setting of a layer's Technique (ticket 0626, ADR 0078), the Brick block today: one Undo step. */
  function setWeaveSetting(layer: Layer, id: string, value: number): void {
    changeWeave(layer, { setting: id, value })
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
      const next = { rows: cell.row - gesture.origin.row, columns: cell.column - gesture.origin.column }
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
    const applied = commit({ ...frame, row: top, rows: frame.row + frame.rows - top }, 'make')
    // Ticket 570: a toast saying how many rows the snap added on top of what was picked.
    if (applied && top < frame.row) deps.showToast('frame-snapped', plural(deps.locale(), frame.row - top, deps.messages().frame.snapAddedTop), 'info')
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
    return !!frame && removedBeadsOf(frame) === 'removed'
  })

  /** Remove Frame: asks first, except for an empty Frame that takes its beads with it, as there is nothing to lose
   * (ticket 0592). */
  function remove(): void {
    const project = deps.currentProject()
    const frame = project && layerOf(project, 'frame')
    if (!frame) return
    if (removeTakesBeads.value && !hasBeads(frame.beads) && !locked.value) {
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
    const frame = layerOf(project, 'frame')
    if (frame && hasBeads(frame.beads)) {
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
      if (outcome.kind === 'applied') deps.announce(fillBlanks(t.frame.announceCustom, { shape: starterName(t, starter), size }))
    })
  }

  /** A Custom frame's setting from the Frame panel (tickets 0592, 0593, 0597, 0640): a stepper's press shows at once
   * and is held, all of them one Undo step once the panel closes; the Fringe style is a step of its own. Nothing is
   * asked, as what a smaller setting leaves out folds until it grows again (ADR 0066). Held still once a pass is done. */
  function setSettings(change: FrameSettings): void {
    const project = deps.currentProject()
    if (!project?.frame || !settingsOf(project.frame) || locked.value) return
    const name = changedSetting(change)
    const command = (current: Project) => changeFrame(current, { settings: change })
    const outcome = name === 'fringeStyle' ? deps.edit('frame', command) : deps.hold(command)
    const settled = deps.currentProject()?.frame
    if (outcome.kind !== 'applied' || !settled) return
    const t = deps.messages()
    if (name === 'fringeStyle') {
      deps.announce(fillBlanks(t.frame.fringeStyle.announce, { style: t.starters.picks.fringeStyle.options[change.fringeStyle!] }))
      return
    }
    const value = settingValuesOf(settled).find((each) => each.name === name)?.value
    deps.announce(fillBlanks(t.frame.sizeSettings[name].announce, { count: String(value) }))
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
    setCanvasTechnique,
    setWeaveSetting,
    fit,
    setTo,
    remove,
    removeConfirmOpen,
    removeTakesBeads,
    cancelRemove,
    confirmRemove,
    placeFromStarter,
    setSettings,
    replaceConfirmOpen,
    cancelReplace,
    confirmReplace,
    onKey,
    bringIntoView,
  }
}
