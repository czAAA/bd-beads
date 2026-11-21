import { computed, ref } from 'vue'
import { rotateFrame, twistFrameTo } from '../../domain/rotate'
import type { Project } from '../../domain/project'
import { rotateFrameQuestion, twistFrameQuestion, type RotateFrameQuestion, type WovenChoice } from '../../domain/wovenLines'
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
  /** The view a Frame twist is shown in while its question waits (ticket 1190): shown as the Project holds it once
   * answered, eased back on Cancel. */
  frameTwistView?: () => { releaseFrameTwist: () => void; easeFrameBack: () => void }
}

/** Rotate Frame (tickets 471, 0647, 0667, 1016, 1184, ADR 0052, 0079): the Frame a quarter turn on, one Edit; once a
 * pass is done the domain's question comes first. Each turn is counted before its Edit, so the surface shows it
 * turning. */
export function useRotateFrameFlow(deps: RotateFrameFlowDeps) {
  /** How many times Rotate Frame has turned the Frame: what the Frame is seen turning by, never an Undo. */
  const frameTurns = ref(0)
  /** The question the Rotate Frame dialog shows while it is asked. */
  const question = (deps.dialogs ?? useDialogs()).question<RotateFrameQuestion>('rotate-frame')

  /** The angle a Frame twist came to rest at while its question waits (ticket 1190). */
  let twistedTo: number | undefined

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

  /** A two-finger twist of the Frame came to rest at `angle` (ticket 1190): kept as one Undo step, or 'asked' where it
   * settled on another quarter turn with a pass done, the question coming first as for the button. Watched as it
   * went, so nothing is announced. */
  function onTwistFrame(angle: number): 'kept' | 'asked' {
    const project = deps.currentProject()
    const asked = project && twistFrameQuestion(project, angle)
    if (asked) {
      twistedTo = angle
      question.value = asked
      return 'asked'
    }
    deps.edit('exempt', (project) => twistFrameTo(project, angle) ?? project)
    return 'kept'
  }

  /** An answer to the question: the Frame turns (or a twist is kept), its rows started over or kept, as one Undo step. */
  function answer(woven: WovenChoice): void {
    question.value = undefined
    const angle = twistedTo
    twistedTo = undefined
    if (angle === undefined) return turn(woven)
    deps.edit('exempt', (project) => twistFrameTo(project, angle, woven) ?? project)
    deps.frameTwistView?.().releaseFrameTwist()
  }

  /** The question answered Cancel: the Frame stays unturned, a twist easing back. */
  function cancelRotateFrame(): void {
    question.value = undefined
    if (twistedTo === undefined) return
    twistedTo = undefined
    deps.frameTwistView?.().easeFrameBack()
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
    onTwistFrame,
    frameTurns,
    rotateFramePrompt,
    startOverRotateFrame: () => answer('start-over'),
    keepRowsRotateFrame: () => answer('keep'),
    cancelRotateFrame,
  }
}
