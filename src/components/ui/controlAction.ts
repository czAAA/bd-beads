import { chordParts, type Chord } from '../../domain/chord'
import type { Translations } from '../../i18n/translations'
import type { IconName } from './icons'

/** What a registry `action` is to a shared control: the control registry's `ControlAction`, seen structurally
 * (ADR 0020: `ui/` imports from no feature folder). `deps` is whatever the action's `enabled` and `disabledBody` read. */
export interface ControlActionLike {
  icon?: IconName
  name: (t: Translations) => string
  body?: (t: Translations) => string
  chords: readonly Chord[]
  /** A key the action shows without owning it: Done, Cancel and Clear selection show Back out's `Esc`. */
  shownKey?: string
  /** The key chip lists every key, not just the first. */
  chipAllKeys?: boolean
  enabled?: (deps: never) => boolean
  disabledBody?: (t: Translations, deps: never) => string
}

/** A chord written on one line: its parts joined by "+", except that a key which is itself a sign takes no separator
 * (`Ctrl/Cmd+`, `Ctrl/Cmd−`, not `Ctrl/Cmd++`, `Ctrl/Cmd+−`). */
function chordText(chord: Chord): string {
  const parts = chordParts(chord)
  const key = parts.pop() ?? ''
  const modifiers = parts.join('+')
  return !modifiers ? key : key === '+' || key === '−' ? modifiers + key : `${modifiers}+${key}`
}

/** The action's first chord as the shortcuts help writes it (`Ctrl/Cmd+S`, `Shift+R`), or undefined without one; every chord, joined by ", ", when the action asks for it. */
export function actionKey(action: ControlActionLike | undefined): string | undefined {
  if (!action) return undefined
  if (!action.chords.length) return action.shownKey
  return (action.chipAllKeys ? action.chords : action.chords.slice(0, 1)).map(chordText).join(', ')
}
