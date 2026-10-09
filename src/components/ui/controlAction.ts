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

/**
 * One key or combination. `key` (any of the listed `event.key` values, case-insensitively) or `code` (the physical
 * key, for the digits Shift turns into symbols) picks the key. `mod` is Ctrl or ⌘, `ctrl` is Ctrl alone; a chord with
 * neither needs both unpressed. `shift` must match exactly, unless it is `'any'` (the key itself needs Shift on some
 * layouts, like `?` and `+`). `label` is the key as the Keyboard shortcuts dialog and the key chips write it.
 */
export interface Chord {
  key?: string | readonly string[]
  code?: string
  mod?: boolean
  ctrl?: boolean
  shift?: boolean | 'any'
  label: string
}


/** A chord's parts as the dialog and the key chips show them: "Ctrl/Cmd", "Shift", then the key. */
export function chordParts(chord: Chord): string[] {
  return [chord.mod ? 'Ctrl/Cmd' : chord.ctrl ? 'Ctrl' : '', chord.shift === true ? 'Shift' : '', chord.label].filter(Boolean)
}

/** The action's first chord as the shortcuts help writes it (`Ctrl/Cmd+S`, `Shift+R`), or undefined without one; every chord, joined by ", ", when the action asks for it. */
export function actionKey(action: ControlActionLike | undefined): string | undefined {
  if (!action) return undefined
  if (!action.chords.length) return action.shownKey
  return (action.chipAllKeys ? action.chords : action.chords.slice(0, 1)).map((chord) => chordParts(chord).join('+')).join(', ')
}
