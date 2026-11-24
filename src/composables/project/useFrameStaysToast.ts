import { beadLabel } from '../../domain/beads'
import { frameChangeRefusal } from '../../domain/changeFrame'
import { fillBlanks } from '../../domain/fillBlanks'
import type { FrameRef, Layer } from '../../domain/grid'
import { beadIdOfLayer, frameIdOf, framesOf, layerOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import type { Technique } from '../../domain/weave'
import { techniqueName } from '../../i18n/techniqueName'
import type { Translations } from '../../i18n/translations'
import type { ToastAction, useToasts } from '../ui/useToasts'

/** The part of the Canvas's Layer settings a change set: its Technique or its Bead. */
type CanvasPart = 'technique' | 'bead'

export interface FrameStaysToastDeps {
  currentProject: () => Project | undefined
  messages: () => Translations
  showToast: ReturnType<typeof useToasts>['show']
  /** The Frame's own change of its Technique and of its Bead (with the question that one asks). */
  setFrameTechnique: (technique: Technique, frame: FrameRef) => void
  requestFrameBead: (beadId: string, frame: FrameRef) => void
  /** Opens the Frame's settings popover (ticket 1222). */
  openFrameSettings: (frame: FrameRef) => void
}

/** What the Canvas's Layer settings, set in the Project panel, leave the Frame on (ticket 0935, UX-018): a change of the
 * Canvas's Technique or Bead that leaves a Frame on another says so in a toast, naming the first such Frame and offering
 * its own change and its settings. With no Frame, a change that changed nothing, or Frames that match, it says nothing. */
export function useFrameStaysToast(deps: FrameStaysToastDeps) {
  function canvasValue(project: Project | undefined, part: CanvasPart): string | undefined {
    if (!project) return undefined
    return part === 'technique' ? layerOf(project, 'canvas').weave.technique : beadIdOfLayer(project, 'canvas')
  }

  function frameValue(project: Project, frame: FrameRef, part: CanvasPart): string | undefined {
    return part === 'technique' ? layerOf(project, frame)?.weave.technique : beadIdOfLayer(project, frame)
  }

  /** A Technique or a Bead by name, as the Layer settings show it. */
  function nameOf(project: Project, layer: Layer, part: CanvasPart): string {
    const t = deps.messages()
    const record = layerOf(project, layer)!
    if (part === 'technique') return techniqueName(t, record.weave.technique)
    return record.bead ? beadLabel(record.bead) : record.beadId
  }

  function note(before: string | undefined, part: CanvasPart): void {
    const project = deps.currentProject()
    const now = canvasValue(project, part)
    if (!project || now === undefined || now === before) return
    const staying = framesOf(project).map(frameIdOf).find((each) => frameValue(project, each, part) !== now)
    if (!staying) return
    const t = deps.messages()
    const text = fillBlanks(t.layerSettings.frameStays, { canvas: nameOf(project, 'canvas', part), frame: nameOf(project, staying, part) })
    const open: ToastAction = { label: t.layerSettings.openFrame, run: () => deps.openFrameSettings(staying) }
    // A Frame that can't take the Technique (a pass done, a Custom frame's shape) is offered only its panel.
    const takes = part === 'bead' || !frameChangeRefusal(project, { technique: now as Technique }, staying)
    if (!takes) return deps.showToast('frame-stays', text, 'info', open)
    const change = () => (part === 'technique' ? deps.setFrameTechnique(now as Technique, staying) : deps.requestFrameBead(now, staying))
    deps.showToast('frame-stays', text, 'info', { label: t.layerSettings.changeFrameToo, run: change }, { secondAction: open })
  }

  /** Runs a change of a Layer setting and then says what it left the Frame on, should the Canvas's Technique or Bead have
   * changed; an asking change (Replace Bead's question) is waited for. Either layer's change may run through it. */
  function afterChange<T extends void | Promise<void>>(part: CanvasPart, change: () => T): T {
    const before = canvasValue(deps.currentProject(), part)
    const done = change()
    if (done instanceof Promise) return done.then(() => note(before, part)) as T
    note(before, part)
    return done
  }

  return { afterChange }
}
