import { computed, ref, watch } from 'vue'
import { type FrameSheet, type Rect, sameFrame } from '../../domain/canvas'
import {
  fitToDrawing,
  frameResizedAround,
  frameWithEdges,
  frameWithEdgeStep,
  frameWithSize,
  movedFrame,
  snappedFrame,
  type FrameEdge,
} from '../../domain/frame'
import { isFrameLayer, type FrameId, type FrameRef, type GridPosition, type Layer } from '../../domain/grid'
import { describeWeave, weaveSettings, type Technique, type TechniqueSettings } from '../../domain/weave'
import { changeCanvasWeave, changeFrame, frameChangeRefusal, framedAround } from '../../domain/changeFrame'
import { changedSetting, frameAllows, settingValuesOf, settingsOf, sizeSettingOf, turnedGrid, type FrameSettings } from '../../domain/frameShape'
import { placedStarter, type Starter, type StarterChoice, type StarterLayerSettings } from '../../domain/starters'
import { starterName, starterSizeWords } from '../../i18n/starterWords'
import { frameById, frameIdOf, frameOf, framesOf, heldWeave, layerOf, firstFrameId, newFrameId } from '../../domain/layerRecord'
import { framesFull } from '../../domain/frameLimit'
import { nextFrameName } from '../../domain/frameNames'
import { frameLabel } from '../../i18n/frameLabel'
import { copyLayerSelection, type CopiedBlock } from '../../domain/selection'
import { frameWeave, layerWeave, sameWeave } from '../../domain/layerWeave'
import { laidFrame, ownEdge, ownSize, seenSize, turnedWithEdges } from '../../domain/frameOrientation'
import { rowProgressStarted } from '../../domain/rowProgress'
import { switchedWeave } from '../../domain/weaveSwitch'
import type { Project } from '../../domain/project'
import { mirrorSettingOf, withFittedArea, type MirrorGrowth } from '../../domain/mirror'
import { mirrorGrownMessage } from '../tools/mirrorGrownMessage'
import { weaveSettingWords } from '../../i18n/settingWords'
import { techniqueName } from '../../i18n/techniqueName'
import { plural } from '../../i18n/plural'
import type { Locale, Translations } from '../../i18n/translations'
import type { FramePress } from '../../rendering/frameHandles'
import type { MessageTone, Toast } from '../ui/useToasts'
import type { Edit, EditFn, EditOutcome } from './useEdit'
import { fillBlanks } from '../../domain/fillBlanks'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import { techniqueChangeQuestion, type TechniqueChangeQuestion, type WovenChoice } from '../../domain/wovenLines'
import { wovenAskPrompt } from './wovenAskPrompt'

export interface FrameFlowDeps {
  currentProject: () => Project | undefined
  edit: EditFn
  /** Edit's held Frame change and its settle (ticket 0640): a Custom frame's steppers show each press at once and
   * commit once, when the Frame popover closes. */
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
  /** The dialog registry its questions open through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
  /** Puts a block of beads on the clipboard and starts Paste mode, as Cut does (ticket 1215): what Remove and copy ends
   * with. */
  copyToClipboard?: (block: CopiedBlock) => void
}

/** How far a press on a resize handle is from the beads its edges stand on (ticket 0977): the drag keeps this distance,
 * so the press alone changes nothing and a drag of some beads moves the edges by that many, however near the corner. */
function gripOf(frame: Rect, edges: readonly FrameEdge[], press: GridPosition): GridPosition {
  const row = edges.includes('top') ? frame.row : frame.row + frame.rows - 1
  const column = edges.includes('left') ? frame.column : frame.column + frame.columns - 1
  return {
    row: edges.includes('top') || edges.includes('bottom') ? press.row - row : 0,
    column: edges.includes('left') || edges.includes('right') ? press.column - column : 0,
  }
}

/** A Frame drag held open (ticket 1220): which Frame it moves or resizes, whatever other Frames are being set. */
type Gesture =
  | { kind: 'move'; frame: FrameId; origin: GridPosition; start: Rect }
  | { kind: 'resize'; frame: FrameId; edges: FrameEdge[]; start: FrameSheet; grip: GridPosition }

/** The Frames a Project holds, none while no Project is open. */
const framesIn = (project: Project | undefined) => (project ? framesOf(project) : [])

// Editing the Frames (CONTEXT.md, ADRs 0026, 0046, 0054, 0066): the edit pencil shows a Frame's handles, off once Row
// progress has started (ticket 411), though the Move handle still carries the Frame with its beads. Each resize is one
// announced Undo step that touches no bead. A Project holds up to MAX_FRAMES Frames; every way of making one adds.
export function useFrameFlow(deps: FrameFlowDeps) {
  const dialogs = deps.dialogs ?? useDialogs()
  /** The Frames whose edit pencil is on (ticket 510): their handles show; none until the weaver turns one on. Each Frame
   * has its own (ticket 1220), so turning one on or off leaves the others as they were. Never saved. */
  const handlesFor = ref<readonly FrameId[]>([])
  /** The Frame as it looks mid-drag, before it is committed, and which Frame it is; `move` is how far a Move drag has
   * carried it with its beads. */
  const draft = ref<{ ref: FrameId; frame: Rect; move?: { rows: number; columns: number } } | undefined>()
  /** The Frame the Remove frame question is asked about (ticket 1220). */
  const removing = ref<FrameId>()
  let gesture: Gesture | undefined
  /** How far the Move handle has been dragged, in whole beads. */
  let moved = { rows: 0, columns: 0 }
  /** Whether the pointer has moved since the press: a click that drew nothing is not a Frame. */
  let dragged = false

  const draftProject = computed(() => {
    const project = deps.currentProject()
    if (!project || !draft.value) return project
    // Shown as the release will leave it: a resize that shrinks the Frame already folds what it gives up.
    const outcome = changeFrame(project, draft.value.move ? { move: draft.value.move } : { set: draft.value?.frame }, draft.value.ref)
    return outcome.kind === 'changed' ? outcome.project : project
  })

  const locked = computed(() => lockedOn(firstFrameId(deps.currentProject())))

  /** Whether a Frame's handles and steppers are on: its toggle on, and no pass done on it. */
  function settingOn(frame: FrameRef): boolean {
    const project = deps.currentProject()
    // A Custom frame's handles step its size setting (ticket 0669).
    return !!project && !!frameById(project, frame) && frameAllows(project, 'resize', frame) && handlesFor.value.includes(frame as FrameId) && !lockedOn(frame)
  }
  /** The Frames being set (ticket 1220): each its own, so two can be at once. */
  const settingFrames = computed<readonly FrameId[]>(() => framesIn(deps.currentProject()).map(frameIdOf).filter(settingOn))
  /** Whether any Frame's handles and steppers are on. */
  const settingFrame = computed(() => settingFrames.value.length > 0)

  // The handles go off when a Project opens or when their Frame goes; a Frame made or a lock changing only drops a drag
  // in progress.
  watch(
    [() => deps.currentProject()?.id, () => framesIn(deps.currentProject()).map((frame) => frame.id).join()],
    ([id, framed], [previousId]) => {
      if (id !== previousId) handlesFor.value = []
      else handlesFor.value = handlesFor.value.filter((frame) => framed.split(',').includes(frame))
    },
    { flush: 'sync' },
  )
  watch([() => deps.currentProject()?.id, () => !!frameOf(deps.currentProject()), locked], cancel, { flush: 'sync' })

  /** The edit pencil of a Frame's sheet (ticket 1220): shows or hides that Frame's handles, the others' as they were;
   * nothing happens without it. */
  function toggleHandles(frame: FrameRef = firstFrameId(deps.currentProject())): void {
    if (!frameById(deps.currentProject(), frame)) return
    const on = handlesFor.value.includes(frame as FrameId)
    handlesFor.value = on ? handlesFor.value.filter((each) => each !== frame) : [...handlesFor.value, frame as FrameId]
  }

  /** The Frame whose settings popover is asked to open (ticket 1222), as the Frame stays toast's Open Frame does: its
   * sheet's ··· button opens it and says so. */
  const popoverAsked = ref<FrameId>()

  /** Opens a Frame's settings popover, the Frame brought into view first. */
  function openSettings(frame: FrameRef = firstFrameId(deps.currentProject())): void {
    if (!frameById(deps.currentProject(), frame)) return
    bringIntoView(frame)
    popoverAsked.value = frame as FrameId
  }

  /** What a resize left, said as the Frame is sized: its width and height, or a Custom frame's size setting. */
  function describe(frame: FrameSheet, before: FrameSheet | undefined): string {
    const t = deps.messages()
    // The setting a handle changed, a side's own (ticket 0814), or else the size setting.
    const was = before && settingValuesOf(before)
    const values = settingValuesOf(frame)
    const id = values.find(({ name, value }) => was?.find((each) => each.name === name)?.value !== value)?.name ?? sizeSettingOf(frame)?.id
    const setting = values.find(({ name }) => name === id)
    if (setting) return fillBlanks(t.frame.sizeSettings[setting.name].announce, { count: String(setting.value) })
    const { columns, rows } = seenSize(frame)
    return fillBlanks(t.frame.announceSet, { width: columns, height: rows })
  }

  /** A new Frame's reference (ticket 1222): an id none of the open Project's layers has. */
  const newFrameRef = (): FrameRef => newFrameId(deps.currentProject()!)

  /** The names the other Frames go by, a Frame with none by the default its place gives it (spec 1214). */
  const namesTaken = (project: Project, ref: FrameRef): string[] =>
    framesIn(project).flatMap((each, at) => (each.id === ref ? [] : [frameLabel(deps.messages(), each, at)]))

  /** The Project with the Frame `ref` named as a Frame is when it has none (spec 1214): "Frame N", N the lowest number free,
   * and left as it is where the Piece it was made from named it. */
  function withDefaultName(project: Project, ref: FrameRef): Project {
    const frame = frameById(project, ref)
    if (!frame || frame.name) return project
    const named = changeFrame(project, { name: nextFrameName(deps.messages().frame.defaultName, namesTaken(project, ref)) }, ref)
    return named.kind === 'changed' ? named.project : project
  }

  /** What a Frame change that was refused tells (spec 1214, ticket 1222): a change that would bring the Frame into another
   * Frame's margin says which Frame is in the way. */
  function tellRefusal(outcome: EditOutcome): void {
    if (outcome.kind !== 'refused' || outcome.reason !== 'meets-frame' || !outcome.met) return
    const t = deps.messages()
    const frames = framesIn(deps.currentProject())
    const at = frames.findIndex((each) => each.id === outcome.met)
    deps.showToast('frame-meets', fillBlanks(t.frame.meetsFrame, { name: at < 0 ? '' : frameLabel(t, frames[at]!, at) }), 'warning')
  }

  /** Commits a Frame resized (`set`), made new round beads (`make`, `around`) or removed, as one undo step. It acts on
   * the Frame `given` (ticket 1218): a new one's own reference, named at once, refused naming the Frame in the way (1222). */
  function commit(frame: Rect | undefined, how: 'set' | 'make' | 'around', given: FrameRef): boolean {
    const before = deps.currentProject()
    if (frame && how !== 'set' && !frameById(before, given) && framesFull(before)) return false
    const outcome = deps.edit('frame', (project) => {
      const made = frame && how === 'around' ? framedAround(project, frame, given) : changeFrame(project, frame ? (how === 'make' ? { make: frame } : { set: frame }) : { remove: true }, given)
      return made.kind === 'changed' && frame && how !== 'set' ? { ...made, project: withDefaultName(made.project, given) } : made
    })
    if (outcome.kind === 'refused') {
      tellRefusal(outcome)
      return false
    }
    if (outcome.kind !== 'applied') return outcome.kind === 'unchanged'
    const left = frameById(deps.currentProject(), given)
    deps.announce(frame && left ? describe(left, frameById(before, given)) : deps.messages().frame.announceRemoved)
    return true
  }

  /** The Frame a change names (ticket 1218): the one given, else the first (what the keys use, ticket 1222). */
  function named(given: FrameRef | undefined): FrameRef {
    return given ?? firstFrameId(deps.currentProject())
  }

  /** Whether the Frame named holds still: a pass is done on it. */
  function lockedOn(frame: FrameRef): boolean {
    const project = deps.currentProject()
    return !!project && rowProgressStarted(project, frame)
  }

  function applySwitch(layer: Layer, technique: Technique, values: TechniqueSettings, woven?: WovenChoice): void {
    const project = deps.currentProject()
    if (!project) return
    const before = layerWeave(project, layer)
    const width = frameById(project, layer)?.settings?.topWidth
    const change = { technique, techniqueSettings: values }
    // A Canvas Mirror Area the new Weave does not fit grows in the same Undo step (ticket 1029); the Message says so.
    let growth: MirrorGrowth | undefined
    const rewoven = (current: Project) => {
      const fitted = withFittedArea(changeCanvasWeave(current, change))
      growth = fitted.growth
      return fitted.project
    }
    const outcome =
      isFrameLayer(layer) ? deps.edit('frame', (current) => changeFrame(current, woven ? { ...change, woven } : change, layer)) : deps.edit('exempt', rewoven)
    if (outcome.kind === 'refused') return tellRefusal(outcome)
    if (outcome.kind !== 'applied') return
    const t = deps.messages()
    if (growth) deps.showToast('mirror-grown', mirrorGrownMessage(t, deps.locale(), mirrorSettingOf(deps.currentProject()!), growth), 'info')
    // A Fringe earring's top switched to peyote keeps a middle column, so its Width may move (ticket 0814).
    const kept = isFrameLayer(layer) ? frameById(deps.currentProject(), layer)?.settings?.topWidth : undefined
    if (kept !== undefined && kept !== width) deps.showToast('frame-odd-width', fillBlanks(t.frame.oddWidthNote, { count: kept }), 'info')
    if (technique !== before.technique) {
      deps.announce(fillBlanks(t.frame.announceTechnique, { technique: techniqueName(t, technique) }))
      return
    }
    const changed = describeWeave({ technique }).settings.find((setting) => values[setting.id] !== before.techniqueSettings?.[setting.id])
    if (changed) deps.announce(fillBlanks(weaveSettingWords(t, changed).changed, { count: values[changed.id] ?? changed.default }))
  }

  /** The question a change of the Frame's Technique asks once a pass is done (ticket 1184), and the change it waits on. */
  const techniqueQuestion = dialogs.question<TechniqueChangeQuestion>('technique-change')
  let pendingTechnique: { layer: FrameRef; technique: Technique; values: TechniqueSettings } | undefined

  /** An answer to the question: the Frame is woven in the new Technique, its rows started over or kept, one Undo step. */
  function answerTechniqueChange(woven: WovenChoice): void {
    const pending = pendingTechnique
    pendingTechnique = undefined
    techniqueQuestion.value = undefined
    if (pending) applySwitch(pending.layer, pending.technique, pending.values, woven)
  }

  /** The question answered Cancel: the Frame keeps its Technique and its rows. */
  function cancelTechniqueChange(): void {
    pendingTechnique = undefined
    techniqueQuestion.value = undefined
  }

  /** What the Technique change dialog says while it is asked. */
  const techniqueChangePrompt = computed(() => {
    const asked = techniqueQuestion.value
    if (!asked) return undefined
    const t = deps.messages()
    const technique = techniqueName(t, asked.technique)
    const words = t.frame.wovenAsk
    return wovenAskPrompt(t, deps.locale(), asked, fillBlanks(words.techniqueTitle, { technique }), fillBlanks(words.startOverTechnique, { technique }))
  })

  /** Changes a layer's Technique or one of its settings (tickets 507, 0626, ADR 0038): at once, as every bead keeps its
   * row and column; the Frame's Technique asks first once a pass is done (ticket 1184). */
  function changeWeave(layer: Layer, change: { technique: Technique } | { setting: string; value: number }): void {
    const project = deps.currentProject()
    if (!project || (isFrameLayer(layer) && !frameById(project, layer))) return
    const current = layerWeave(project, layer)
    const technique = 'technique' in change ? change.technique : current.technique
    // The layer's values for the Technique's settings, one kept from before it was woven in another (a Drop) too.
    const held = weaveSettings({ ...current, technique })
    const values = 'setting' in change ? weaveSettings({ technique, techniqueSettings: { ...held, [change.setting]: change.value } }) : held
    if (sameWeave(current, switchedWeave(current, technique, values))) return
    if (isFrameLayer(layer) && frameChangeRefusal(project, { technique }, layer)) return
    const asked = isFrameLayer(layer) ? techniqueChangeQuestion(project, technique, layer) : undefined
    if (asked) {
      pendingTechnique = { layer: layer as FrameRef, technique, values }
      techniqueQuestion.value = asked
      return
    }
    applySwitch(layer, technique, values)
  }

  /** Weaves a Frame of the open Project in another Technique (tickets 351, 507, 1218): one Undo step, asking first once
   * a pass is done (ticket 1184). */
  function setTechnique(technique: Technique, frame?: FrameRef): void {
    changeWeave(named(frame), { technique })
  }

  /** Weaves a layer in another Technique from its Layer settings (tickets 492, 507, 0670): the Canvas's any time, since
   * Row progress belongs to the Frame, the Frame's asking first once a pass is done (ticket 1184); one Undo step. */
  function setLayerTechnique(layer: Layer, technique: Technique): void {
    changeWeave(layer, { technique })
  }

  /** Sets any setting of a layer's Technique (ticket 0626, ADR 0078), a Drop today: one Undo step. */
  function setWeaveSetting(layer: Layer, id: string, value: number): void {
    changeWeave(layer, { setting: id, value })
  }

  /** A press on a Frame's chrome (ticket 1220): its Move bar or a handle of its own, whichever other Frames are being
   * set. */
  function press(target: FramePress, cell: GridPosition, ref: FrameId = firstFrameId(deps.currentProject())): void {
    const project = deps.currentProject()
    const frame = frameById(project, ref)
    dragged = false
    moved = { rows: 0, columns: 0 }
    if (!frame) return
    // The Move handle always works; a resize handle only while the edit toggle is on.
    if (target.kind === 'move') gesture = { kind: 'move', frame: ref, origin: cell, start: frame }
    // A turned Frame's handles stand on the rectangle it lies in (ticket 1016), so the grip is measured there.
    else if (target.kind === 'handle' && settingOn(ref)) gesture = { kind: 'resize', frame: ref, edges: target.edges, start: frame, grip: gripOf(laidFrame(project!, ref)!, target.edges, cell) }
  }

  function drag(cell: GridPosition): void {
    const project = deps.currentProject()
    if (!project || !gesture) return
    dragged = true
    if (gesture.kind === 'resize') {
      const { grip, start } = gesture
      const at = { row: cell.row - grip.row, column: cell.column - grip.column }
      const weave = frameWeave(project, gesture.frame)
      draft.value = { ref: gesture.frame, frame: turnedGrid(start) ? turnedWithEdges({ ...start, ...weave }, gesture.edges, at) : frameWithEdges(weave, start, gesture.edges, at) }
    } else {
      const next = { rows: cell.row - gesture.origin.row, columns: cell.column - gesture.origin.column }
      // A pointer move inside the same bead changes nothing, so the draft (and the preview built from it) is left
      // alone.
      if (draft.value && next.rows === moved.rows && next.columns === moved.columns) return
      moved = next
      draft.value = { ref: gesture.frame, frame: movedFrame(gesture.start, next.rows, next.columns), move: next }
    }
  }

  function release(): void {
    const result = draft.value?.frame
    const wasMove = gesture?.kind === 'move'
    const ref = gesture?.frame
    gesture = undefined
    draft.value = undefined
    if (!result || !dragged || !ref) return
    if (wasMove) moveBy(moved.rows, moved.columns, ref)
    else commit(result, 'set', ref)
  }

  /** Lets go of a drag without committing it: a second finger arrived, so it was a pinch. */
  function cancel(): void {
    gesture = undefined
    draft.value = undefined
  }

  /** The Move handle's change (ticket 452): the Frame and its beads by whole rows and columns, one announced Undo
   * step. */
  function moveBy(rows: number, columns: number, frame: FrameRef = firstFrameId(deps.currentProject())): void {
    const outcome = deps.edit('frame', (project) => changeFrame(project, { move: { rows, columns } }, frame))
    if (outcome.kind === 'applied') deps.announce(deps.messages().frame.announceMoved)
  }

  /** An edge stepper's press (ticket 417): one edge as seen a bead out (1) or in (-1), one Undo step; a step that would
   * empty the Frame is none. On a turned Frame it is the own edge lying there that steps (ticket 1016). */
  function stepEdge(edge: FrameEdge, step: 1 | -1, frame?: FrameRef): void {
    const project = deps.currentProject()
    const ref = named(frame)
    const held = frameById(project, ref)
    if (!project || !held || lockedOn(ref)) return
    const next = frameWithEdgeStep(frameWeave(project, ref), held, ownEdge(held, edge), step)
    if (next !== held) commit(next, 'set', ref)
  }

  /** The size typed into the Frame panel (ticket 473): both sides grow or shrink evenly about the Frame, one Undo step.
   * Width and Height are as seen, a turned Frame's own swapped (ticket 1016). */
  function resizeTo(columns: number, rows: number, frame?: FrameRef): void {
    const project = deps.currentProject()
    const ref = named(frame)
    const held = frameById(project, ref)
    if (!project || !held || lockedOn(ref)) return
    const own = ownSize(held, { columns, rows })
    const next = frameResizedAround(frameWeave(project, ref), held, own.columns, own.rows)
    if (!sameFrame(next, held)) commit(next, 'set', ref)
  }

  /** A Frame's name, typed on its sheet (ticket 555): one Undo step; empty gives "Frame N" back, N the lowest number no
   * other Frame uses (spec 1214). */
  function rename(name: string, frame?: FrameRef): void {
    const ref = named(frame)
    deps.edit('frame', (project) => changeFrame(project, { name: name || nextFrameName(deps.messages().frame.defaultName, namesTaken(project, ref)) }, ref))
  }

  // Frame from a Selection (tickets 415, 452, 1222): a new Frame holding a copy of the beads in its rectangle, one Undo
  // step, refused naming the Frame it would meet. A named Piece's Selection snaps to that Schema, starting on an even row
  // where rows alternate (ticket 407) or an even column where columns do (ticket 0734).
  function setTo(frame: Rect): void {
    const project = deps.currentProject()
    const snapped = project ? snappedFrame(heldWeave(project, 'canvas'), frame) : frame
    const top = snapped.row
    const left = snapped.column
    const applied = commit(snapped, 'make', newFrameRef())
    // Ticket 570: a toast saying how many rows or columns the snap added to what was picked.
    const words = deps.messages().frame
    if (applied && top < frame.row) deps.showToast('frame-snapped', plural(deps.locale(), frame.row - top, words.snapAddedTop), 'info')
    else if (applied && left < frame.column) deps.showToast('frame-snapped', plural(deps.locale(), frame.column - left, words.snapAddedLeft), 'info')
  }

  /** Set Frame around the picture (ticket 0883): the Frame becomes the rectangle round the reference image's beads,
   * already snapped where a Frame may start (domain's framedAround: a Custom frame becomes rectangular). One Undo step. */
  function setAround(frame: Rect): void {
    commit(frame, 'around', newFrameRef())
  }

  /** Fit a Frame to the drawing (ticket 1222): a new Frame round the beads no Frame covers. */
  function fit(): void {
    const project = deps.currentProject()
    if (!project) return
    const ref = newFrameRef()
    const frame = fitToDrawing(project, ref)
    if (frame) commit(frame, 'make', ref)
    else deps.announce(deps.messages().frame.announceNothingToFit)
  }

  /** Whether the Remove frame confirmation is open: always asked; any done passes go with the Frame
   * (tickets 426, 455). */
  const removeConfirmOpen = dialogs.flag('remove-frame')

  /** Remove Frame: asks first, a Custom frame as any Frame (ticket 0669), of the Frame whose sheet or panel asked. */
  function remove(frame: FrameRef = firstFrameId(deps.currentProject())): void {
    const project = deps.currentProject()
    if (!project || !layerOf(project, frame)) return
    removing.value = frame as FrameId
    removeConfirmOpen.value = true
  }

  /** The Remove frame question answered No: nothing changes. */
  function cancelRemove(): void {
    removeConfirmOpen.value = false
  }

  /** What the Remove frame question says (ticket 1215): the beads go with the Frame, and Row progress too once a pass is
   * done. */
  const removeFramePrompt = computed(() => {
    const project = deps.currentProject()
    const words = deps.messages().frame
    return { message: project && rowProgressStarted(project, removing.value ?? firstFrameId(project)) ? words.removeConfirmMessageDone : words.removeConfirmMessage }
  })

  /** Remove frame after the question: the Frame goes with all its beads, Folded ones too, and its passes; one Undo step
   * brings it all back. Nothing lands on the Canvas (ticket 1215). */
  function confirmRemove(): void {
    removeConfirmOpen.value = false
    commit(undefined, 'set', removing.value ?? firstFrameId(deps.currentProject()))
  }

  /** Remove and copy (ticket 1215): the same, and the Frame's beads are put on the clipboard with Paste mode started, as
   * after Cut. */
  function confirmRemoveAndCopy(): void {
    removeConfirmOpen.value = false
    const project = deps.currentProject()
    const ref = removing.value ?? firstFrameId(project)
    const frame = frameById(project, ref)
    if (!project || !frame) return
    const block = copyLayerSelection(project, { top: frame.row, left: frame.column, rows: frame.rows, columns: frame.columns, layer: frameIdOf(frame) })
    if (commit(undefined, 'set', ref) && block) deps.copyToClipboard?.(block)
  }

  /** Add Frame from Starter (tickets 495, 0596, 0671, 1222): the Starter's Frame as a new Frame in the setup's Layer
   * settings, pre-filled with its design or empty, round the middle of the view or the nearest place clear of every other
   * Frame's margin; one Undo step. */
  function placeFromStarter(starter: Starter, choice: StarterChoice & Partial<StarterLayerSettings>): void {
    const before = deps.currentProject()
    if (!before || framesFull(before)) return
    const centre = deps.visibleCentre() ?? { row: 0, column: 0 }
    const ref = newFrameRef()
    const outcome = deps.edit('frame', (project) => {
      const placed = placedStarter(project, starter, choice, centre, ref)
      return placed.kind === 'changed' ? { ...placed, project: withDefaultName(placed.project, ref) } : placed
    })
    const t = deps.messages()
    const size = starterSizeWords(t, deps.locale(), starter, choice.sizes)
    if (outcome.kind === 'applied') deps.announce(fillBlanks(t.frame.announceCustom, { shape: starterName(t, starter), size }))
    else tellRefusal(outcome)
  }

  /** A Custom frame's setting from its settings popover (tickets 0592, 0593, 0597, 0640): a stepper's press shows at once
   * and is held, all of them one Undo step once the popover closes; the Fringe style is a step of its own. Nothing is
   * asked, as what a smaller setting leaves out folds until it grows again (ADR 0066). Held still once a pass is done. */
  function setSettings(change: FrameSettings, given?: FrameRef): void {
    const ref = named(given)
    const frame = frameById(deps.currentProject(), ref)
    if (!frame || !settingsOf(frame) || lockedOn(ref)) return
    const name = changedSetting(change)
    const command = (current: Project) => changeFrame(current, { settings: change }, ref)
    const outcome = name === 'fringeStyle' ? deps.edit('frame', command) : deps.hold(command)
    const settled = frameById(deps.currentProject(), ref)
    if (outcome.kind === 'refused') return tellRefusal(outcome)
    if (outcome.kind !== 'applied' || !settled) return
    const t = deps.messages()
    if (name === 'fringeStyle') {
      deps.announce(fillBlanks(t.frame.fringeStyle.announce, { style: t.starters.picks.fringeStyle.options[change.fringeStyle!] }))
      return
    }
    const value = settingValuesOf(settled).find((each) => each.name === name)?.value
    deps.announce(fillBlanks(t.frame.sizeSettings[name].announce, { count: String(value) }))
  }

  /** A key on a focused Frame handle (ticket 452): arrows move the Frame with its beads, Shift + arrows resize it
   * from its bottom-right. Whether the key was used. */
  function onKey(event: KeyboardEvent, ref: FrameRef = firstFrameId(deps.currentProject())): boolean {
    const steps: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
    const step = steps[event.key]
    const frame = frameById(deps.currentProject(), ref)
    if (!step || !frame) return false
    if (event.shiftKey) {
      // A turned Frame grows from its bottom-right as seen: the own edges lying there (ticket 1016).
      if (settingOn(ref) && turnedGrid(frame)) {
        stepEdge(step[0] ? 'bottom' : 'right', (step[0] || step[1]) as 1 | -1, ref)
      } else if (settingOn(ref)) commit(frameWithSize(frame, frame.columns + step[1], frame.rows + step[0]), 'set', ref)
    } else {
      moveBy(step[0], step[1], ref)
    }
    return true
  }

  function bringIntoView(ref: FrameRef = firstFrameId(deps.currentProject())): void {
    const frame = frameById(deps.currentProject(), ref)
    if (frame) deps.centreOn(frame)
  }

  return {
    setAround,
    settingFrame,
    settingFrames,
    /** The Project as the canvas draws it while a drag has not committed: a Move drag shows the beads travelling
     * too, exactly as the release will leave them. */
    draftProject,
    frameLocked: locked,
    handlesFor,
    toggleHandles,
    popoverAsked,
    openSettings,
    press,
    drag,
    release,
    cancel,
    stepEdge,
    resizeTo,
    rename,
    setTechnique,
    setLayerTechnique,
    setWeaveSetting,
    techniqueChangePrompt,
    startOverTechniqueChange: () => answerTechniqueChange('start-over'),
    keepRowsTechniqueChange: () => answerTechniqueChange('keep'),
    cancelTechniqueChange,
    fit,
    setTo,
    remove,
    removeConfirmOpen,
    cancelRemove,
    confirmRemove,
    confirmRemoveAndCopy,
    removeFramePrompt,
    placeFromStarter,
    setSettings,
    onKey,
    bringIntoView,
  }
}
