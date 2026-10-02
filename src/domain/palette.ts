export interface PaletteColor {
  id: string
  hex: string
}

/** The twelve built-in colors (see CONTEXT.md's Palette entry), independent of the bead catalog; Custom colors that were used join them (ticket 227, ADR 0025). */
export const PALETTE: readonly PaletteColor[] = [
  { id: 'black', hex: '#1a1a1a' },
  { id: 'white', hex: '#ffffff' },
  { id: 'red', hex: '#e63746' },
  { id: 'orange', hex: '#f2994a' },
  { id: 'yellow', hex: '#f2c94c' },
  { id: 'green', hex: '#27ae60' },
  { id: 'teal', hex: '#2fb6ae' },
  { id: 'blue', hex: '#2f6fed' },
  { id: 'purple', hex: '#9b51e0' },
  { id: 'pink', hex: '#ec5990' },
  { id: 'brown', hex: '#8a5a3b' },
  { id: 'grey', hex: '#9aa0a6' },
]

export function findPaletteColor(id: string): PaletteColor | undefined {
  return PALETTE.find((color) => color.id === id)
}

/**
 * Shift+1..9, Shift+0, Q, W (ticket 88), one per PALETTE entry in order: the physical key (`KeyboardEvent.code`,
 * layout- and Shift-independent -- the digit row's *shifted* `.key` values like "!" vary by keyboard layout, unlike
 * `.code`) and its display label. The one source both App.vue's dispatcher and PalettePicker.vue's tooltips read,
 * so the two can't drift apart.
 */
export interface PaletteShortcut {
  code: string
  keyLabel: string
}

export const PALETTE_SHORTCUTS: readonly PaletteShortcut[] = [
  { code: 'Digit1', keyLabel: '1' },
  { code: 'Digit2', keyLabel: '2' },
  { code: 'Digit3', keyLabel: '3' },
  { code: 'Digit4', keyLabel: '4' },
  { code: 'Digit5', keyLabel: '5' },
  { code: 'Digit6', keyLabel: '6' },
  { code: 'Digit7', keyLabel: '7' },
  { code: 'Digit8', keyLabel: '8' },
  { code: 'Digit9', keyLabel: '9' },
  { code: 'Digit0', keyLabel: '0' },
  { code: 'KeyQ', keyLabel: 'Q' },
  { code: 'KeyW', keyLabel: 'W' },
]

/** The Palette color a painted cell holds, looked up by the hex the grid stores; undefined for a hex from outside the Palette. */
export function findPaletteColorByHex(hex: string): PaletteColor | undefined {
  return PALETTE.find((color) => color.hex === hex)
}

/** How many Custom colors can join the Palette; with the twelve built-in ones it tops out at 36 swatches (ticket 227). */
export const MAX_ADDED_COLORS = 24

/** A Custom color as the Palette keeps it: lowercase `#rrggbb`, the shape every grid cell stores; undefined for anything else. */
export function normalizeHex(hex: string): string | undefined {
  const lower = hex.trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(lower) ? lower : undefined
}

/** The id an added swatch is known by: its hex, so the same color is the same swatch on every device. */
export function addedColorId(hex: string): string {
  return `added-${hex.slice(1)}`
}

/** The whole Palette: the built-in colors, then each added one in the order it was first used. */
export function paletteWith(added: readonly string[]): PaletteColor[] {
  return [...PALETTE, ...added.map((hex) => ({ id: addedColorId(hex), hex }))]
}

export type AddUsedColorOutcome = 'added' | 'known' | 'full'

/**
 * A Custom color has just painted a cell: the added colors with it appended on its first use. 'known' when the hex is
 * already a swatch (built-in or added), 'full' when 24 are added and it can't join; either way `added` is unchanged.
 */
export function addUsedColor(
  added: readonly string[],
  hex: string,
): { added: readonly string[]; outcome: AddUsedColorOutcome } {
  const normalized = normalizeHex(hex)
  if (!normalized || paletteWith(added).some((color) => color.hex === normalized)) {
    return { added, outcome: 'known' }
  }
  if (added.length >= MAX_ADDED_COLORS) {
    return { added, outcome: 'full' }
  }
  return { added: [...added, normalized], outcome: 'added' }
}
