import type { Translations } from '../../i18n/translations'
import type { IconName } from './icons'

/** What a registry `action` is to a shared control: the control registry's `ControlAction`, seen structurally
 * (ADR 0024: `ui/` imports from no feature folder). `deps` is whatever the action's `enabled` and `disabledBody` read. */
export interface ControlActionLike {
  icon?: IconName
  name: (t: Translations) => string
  body?: (t: Translations) => string
  chords: readonly { mod?: boolean; ctrl?: boolean; shift?: boolean | 'any'; label: string }[]
  /** The key chip lists every key, not just the first. */
  chipAllKeys?: boolean
  enabled?: (deps: never) => boolean
  disabledBody?: (t: Translations, deps: never) => string
}

type Chord = ControlActionLike['chords'][number]

const chordText = (chord: Chord) => [chord.mod ? 'Ctrl/Cmd' : chord.ctrl ? 'Ctrl' : '', chord.shift === true ? 'Shift' : '', chord.label].filter(Boolean).join('+')

/** The action's first chord as the shortcuts help writes it (`Ctrl/Cmd+S`, `Shift+R`), or undefined without one; every chord, joined by ", ", when the action asks for it. */
export function actionKey(action: ControlActionLike | undefined): string | undefined {
  if (!action?.chords.length) return undefined
  return (action.chipAllKeys ? action.chords : action.chords.slice(0, 1)).map(chordText).join(', ')
}
