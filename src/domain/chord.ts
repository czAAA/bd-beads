// One key or combination. `key` (any listed `event.key`, case-insensitive) or `code` (physical key, for digits Shift
// turns into symbols) picks it. `mod` is Ctrl or ⌘, `ctrl` Ctrl alone; neither means both unpressed. `shift` must match
// unless `'any'` (some layouts need Shift for `?`). `label` is how the shortcuts dialog and chips write it.
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
