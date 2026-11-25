import { computed, ref } from 'vue'
import { rotateFrame } from '../../domain/rotate'
import type { Project } from '../../domain/project'
import { rotateFrameQuestion, type RotateFrameQuestion, type WovenChoice } from '../../domain/wovenLines'
import type { Locale, Translations } from '../../i18n/translations'
import type { EditFn } from '../project/useEdit'
import { wovenAskPrompt } from '../project/wovenAskPrompt'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import { frameById, firstFrameId, NO_FRAME } from '../../domain/layerRecord'
import type { FrameRef } from '../../domain/grid'

/** What Rotate Frame needs from the app shell: the Edit path, the open Project, the announcer, the dialog registry and
 * the words its question is put in. */
export interface RotateFrameFlowDeps {
  edit: EditFn
  currentProject: () => Project | undefined
  announce: (message: string) => void
  messages: () => Translations
  /** The language a counted question is worded in. */
  locale: () => Locale
  dialogs?: Dialogs
}

/** Rotate Frame (tickets 471, 0647, 0667, 1016, 1184, ADR 0052, 0079): the Frame a quarter turn on, one Edit; once a
 * pass is done the domain's question comes first. Each turn is counted before its Edit, so the surface shows it
 * turning. */
export function useRotateFrameFlow(deps: RotateFrameFlowDeps) {
  /** How many times Rotate Frame has turned the Frame: what the Frame is seen turning by, never an Undo. */
  const frameTurns = ref(0)
  /** The Frame the last press turned (ticket 1220): only that Frame is seen turning. */
  const frameTurned = ref<FrameRef>()
  /** The question the Rotate Frame dialog shows while it is asked. */
  const question = (deps.dialogs ?? useDialogs()).question<RotateFrameQuestion>('rotate-frame')
  /** The Frame the question waiting is about (ticket 1218). */
  let asking: FrameRef = NO_FRAME

  function turn(woven: WovenChoice, frame: FrameRef): void {
    frameTurned.value = frame
    frameTurns.value += 1
    deps.edit('exempt', (project) => rotateFrame(project, woven, frame) ?? project)
    deps.announce(deps.messages().frame.announceFrameRotated)
  }

  /** Rotate Frame on the Frame named (ticket 1218), the first where none is named (the Frame panel's). Nothing
   * turns where the turn would bring it into another Frame's margin. */
  function onRotateFrame(given?: FrameRef): void {
    const project = deps.currentProject()
    const frame = given ?? firstFrameId(project)
    if (!project || !frameById(project, frame) || !rotateFrame(project, 'keep', frame)) {
      return
    }
    const asked = rotateFrameQuestion(project, frame)
    if (asked) {
      asking = frame
      question.value = asked
      return
    }
    turn('keep', frame)
  }

  /** An answer to the question: the Frame turns, its rows started over or kept, as one Undo step. */
  function answer(woven: WovenChoice): void {
    question.value = undefined
    turn(woven, asking)
  }

  /** The question answered Cancel: the Frame stays unturned. */
  function cancelRotateFrame(): void {
    question.value = undefined
  }

  /** What the Rotate Frame dialog says while it is asked. */
  const rotateFramePrompt = computed(() => {
    const asked = question.value
    if (!asked) return undefined
    const t = deps.messages()
    return wovenAskPrompt(t, deps.locale(), asked, t.frame.wovenAsk.rotateTitle, t.frame.wovenAsk.startOverWay)
  })

  return {
    onRotateFrame,
    frameTurns,
    frameTurned,
    rotateFramePrompt,
    startOverRotateFrame: () => answer('start-over'),
    keepRowsRotateFrame: () => answer('keep'),
    cancelRotateFrame,
  }
}
