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

/** The keyboard a key is written for (ticket 0993, writing.md): an Apple one names ⌘ and ⌫, any other Ctrl and Del. */
export type Keyboard = 'apple' | 'other'

/** The platform's modifier in a help row written by hand (`[MOD_KEY, 'wheel']`), named for the keyboard by `keyParts`. */
export const MOD_KEY = 'Mod'

/** The Option or Alt key in a help row written by hand (`[ALT_KEY, '←→']`, ticket 1159), named by `keyParts`. */
export const ALT_KEY = 'Alt'

/** The four arrows as one key of a help row: they share a chip (ShortcutsHelp card). */
export const ARROWS = '←↑↓→'

/** Keys named for the keyboard (ticket 0993): `MOD_KEY` as ⌘ or Ctrl, Del as ⌫ and Alt as ⌥ on an Apple keyboard,
 * where Shift also comes before ⌘ as macOS writes it (Shift, ⌘, Z). */
export function keyParts(parts: readonly string[], keyboard: Keyboard): string[] {
  if (keyboard === 'other') return parts.map((part) => (part === MOD_KEY ? 'Ctrl' : part))
  const named = parts.map((part) => (part === MOD_KEY ? '⌘' : part === 'Del' ? '⌫' : part === ALT_KEY ? '⌥' : part))
  return named.includes('⌘') && named.includes('Shift') ? ['Shift', ...named.filter((part) => part !== 'Shift')] : named
}

/** A chord's parts as the dialog and the key chips show them for the keyboard: the modifiers, then the key. */
export function chordParts(chord: Chord, keyboard: Keyboard): string[] {
  const modifier = chord.mod ? MOD_KEY : chord.ctrl ? 'Ctrl' : ''
  return keyParts([modifier, chord.shift === true ? 'Shift' : '', chord.label].filter(Boolean), keyboard)
}

/** Whether a "+" stands before part `index` of a chord: not between ⌘ and a one-character key (writing.md: "⌘V", no
 * plus; "⌘+wheel" keeps it), and not before a key that is itself a sign (`Ctrl+`, `Ctrl−`, not `Ctrl++`). */
export function plusBefore(parts: readonly string[], index: number): boolean {
  if (index === 0 || (parts[index - 1] === '⌘' && parts[index].length === 1)) return false
  return !(index === parts.length - 1 && (parts[index] === '+' || parts[index] === '−'))
}

/** A chord's parts on one line: "⌘V", "Shift+⌘Z", "Ctrl+Shift+Z", "Ctrl+", "⌘+wheel". */
export function chordLine(parts: readonly string[]): string {
  return parts.map((part, index) => (plusBefore(parts, index) ? `+${part}` : part)).join('')
}
