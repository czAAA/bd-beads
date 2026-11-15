import { chordLine, chordParts, type Chord, type Keyboard } from '../../domain/chord'
import { deviceKeyboard } from '../../composables/ui/useKeyHints'
import type { Translations } from '../../i18n/translations'
import type { IconName } from './icons'

/** What a registry `action` is to a shared control: the control registry's `ControlAction`, seen structurally
 * (ADR 0020: `ui/` imports from no feature folder). `deps` is whatever the action's `enabled` and `disabledBody` read. */
export interface ControlActionLike {
  icon?: IconName
  name: (t: Translations) => string
  body?: (t: Translations) => string
  /** The body on a touch device, where the usual one would speak of hovering or clicking (ticket 0845). */
  touchBody?: (t: Translations) => string
  chords: readonly Chord[]
  /** A key the action shows without owning it: Done, Cancel and Clear selection show Back out's `Esc`. */
  shownKey?: string
  enabled?: (deps: never) => boolean
  disabledBody?: (t: Translations, deps: never) => string
}

/** The action's first chord as the shortcuts help writes it for the keyboard (`⌘S` or `Ctrl+S`, `Shift+R`), or
 * undefined without one. */
export function actionKey(action: ControlActionLike | undefined, keyboard: Keyboard = deviceKeyboard()): string | undefined {
  if (!action) return undefined
  const [first] = action.chords
  return first ? chordLine(chordParts(first, keyboard)) : action.shownKey
}
