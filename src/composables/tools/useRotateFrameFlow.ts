import { computed, ref } from 'vue'
import { rotateFrame } from '../../domain/rotate'
import type { Project } from '../../domain/project'
import { rotateFrameQuestion, type RotateFrameQuestion, type WovenChoice } from '../../domain/wovenLines'
import type { Locale, Translations } from '../../i18n/translations'
import type { EditFn } from '../project/useEdit'
import { wovenAskPrompt } from '../project/wovenAskPrompt'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import { frameOf } from '../../domain/layerRecord'

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
  /** The question the Rotate Frame dialog shows while it is asked. */
  const question = (deps.dialogs ?? useDialogs()).question<RotateFrameQuestion>('rotate-frame')

  function turn(woven: WovenChoice): void {
    frameTurns.value += 1
    deps.edit('exempt', (project) => rotateFrame(project, woven) ?? project)
    deps.announce(deps.messages().frame.announceFrameRotated)
  }

  function onRotateFrame(): void {
    const project = deps.currentProject()
    if (!project || !frameOf(project)) {
      return
    }
    const asked = rotateFrameQuestion(project)
    if (asked) {
      question.value = asked
      return
    }
    turn('keep')
  }

  /** An answer to the question: the Frame turns, its rows started over or kept, as one Undo step. */
  function answer(woven: WovenChoice): void {
    question.value = undefined
    turn(woven)
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
    rotateFramePrompt,
    startOverRotateFrame: () => answer('start-over'),
    keepRowsRotateFrame: () => answer('keep'),
    cancelRotateFrame,
  }
}
