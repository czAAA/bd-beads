import { watch, type Ref } from 'vue'
import type { Translations } from '../../i18n/translations'
import type { MessageTone } from '../ui/useToasts'

/** What the armed-mode toasts need: whether the pointer is a finger, the toasts, and the three modes that wait for a
 * tap on the Canvas. */
export interface ArmedToolToastsDeps {
  /** A coarse pointer: a finger has no cursor to show the mode. */
  touch: Readonly<Ref<boolean>>
  showToast: (id: string, text: string, tone?: MessageTone) => void
  dismissToast: (id: string) => void
  messages: () => Translations
  mirrorMarking: () => boolean
  /** Whether the Mirror has its Area: Mirror mode entered then has nothing to mark first. */
  mirrorOn: () => boolean
  picking: () => boolean
  pasteArmed: () => boolean
}

/** On touch, a mode that waits for a tap on the Canvas says what to do next, as a mouse's cursor does (ticket 0845):
 * Mirror mode with no Area yet, paste mode, and Pick color from canvas. Each toast goes when its mode ends. */
export function useArmedToolToasts(deps: ArmedToolToastsDeps) {
  const modes = [
    { id: 'mirror-armed', armed: () => deps.mirrorMarking() && !deps.mirrorOn(), text: (t: Translations) => t.tools.mirrorArmedHint },
    { id: 'paste-armed', armed: deps.pasteArmed, text: (t: Translations) => t.tools.pasteArmedHint },
    { id: 'pick-armed', armed: deps.picking, text: (t: Translations) => t.tools.pickArmedHint },
  ]
  for (const mode of modes) {
    watch(mode.armed, (armed) => {
      if (!armed) deps.dismissToast(mode.id)
      else if (deps.touch.value) deps.showToast(mode.id, mode.text(deps.messages()), 'info')
    })
  }
}
