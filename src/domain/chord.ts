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
