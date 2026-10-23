import { nearestColor } from './imageColors'

export interface PaletteColor {
  id: string
  hex: string
  /** A brand's own name, the same in every language; absent, the name is the translation of `id` (`colorNames`). */
  literalName?: string
}

/** The built-in colors a Palette starts from (see CONTEXT.md's Palette entry), today the twelve, independent of the bead
 * catalog; Custom colors that were used join them (ticket 227, ADR 0002). Handed to createPalette, so ticket 0528 can
 * swap the set without touching a caller. */
export const BUILT_IN_COLORS: readonly PaletteColor[] = [
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

/** A built-in color by id, for the fixed artwork (Templates, the overview) that names the colors it draws with. */
export function findBuiltInColor(id: string): PaletteColor | undefined {
  return BUILT_IN_COLORS.find((color) => color.id === id)
}

/** Shift+1..9, Shift+0, Q, W (ticket 88), one per first Palette slot: the physical key (`KeyboardEvent.code`; shifted `.key`
 * values like "!" vary by layout) and its label. The one source App.vue's dispatcher and PalettePicker.vue read. */
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

/** A Custom color as the Palette keeps it: lowercase `#rrggbb`, the shape every grid cell stores; undefined for
 * anything else. */
export function normalizeHex(hex: string): string | undefined {
  const lower = hex.trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(lower) ? lower : undefined
}

const ADDED_PREFIX = 'added-'

/** The id an added swatch is known by: its hex, so the same color is the same swatch on every device. */
export function addedColorId(hex: string): string {
  return `${ADDED_PREFIX}${hex.slice(1)}`
}

/** Whether a Palette color joined from a Custom color (and so can be removed) rather than being one of the twelve
 * built-in ones. */
export function isAddedColorId(colorId: string): boolean {
  return colorId.startsWith(ADDED_PREFIX)
}

/** A Project's Palette as it is stored (ticket 0525, ADR 0002): the id of every swatch in slot order, the twelve
 * built-in ones and the added ones alike. */
export type PaletteIds = readonly string[]

/** What a new Project's Palette is: the built-in colors, in their order. */
export function defaultPaletteIds(): string[] {
  return BUILT_IN_COLORS.map((color) => color.id)
}

/** The hex an added swatch's id stands for; undefined for anything that isn't one. */
function addedColorHex(colorId: string): string | undefined {
  return isAddedColorId(colorId) ? normalizeHex(`#${colorId.slice(ADDED_PREFIX.length)}`) : undefined
}

/** The swatches a stored Palette names, in its order: an id that is neither built-in nor an added color's is dropped and
 * a repeated one counts once. What is stored is what is shown: a built-in color it leaves out stays out. */
export function paletteColors(ids: PaletteIds, builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): PaletteColor[] {
  const placed = new Set<string>()
  const colors: PaletteColor[] = []
  for (const id of ids) {
    const color = builtIns.find((builtIn) => builtIn.id === id) ?? paletteColorForAdded(id)
    if (color && !placed.has(color.id)) {
      placed.add(color.id)
      colors.push(color)
    }
  }
  return colors
}

function paletteColorForAdded(id: string): PaletteColor | undefined {
  const hex = addedColorHex(id)
  return hex ? { id: addedColorId(hex), hex } : undefined
}

/** A stored Palette read back whatever it holds (see paletteColors), as the ids to keep. A missing or unreadable one
 * is a new Project's Palette. */
export function normalizePaletteIds(stored: unknown): string[] {
  if (!Array.isArray(stored)) return defaultPaletteIds()
  return paletteColors(stored.filter((id): id is string => typeof id === 'string')).map((color) => color.id)
}

/** A Project's Palette as every reader asks it (ticket 0530): the swatches in slot order and the questions about them.
 * Built from the stored ids, so nothing reads the built-in set directly. */
export interface Palette {
  colors: readonly PaletteColor[]
  /** The swatch with this id; undefined for none (or no id). */
  byId: (id: string | null | undefined) => PaletteColor | undefined
  /** The swatch a painted cell holds, by the hex the grid stores; undefined for a hex from outside the Palette. */
  byHex: (hex: string) => PaletteColor | undefined
  /** The swatch nearest `hex` (the closest, not the first in range, so slot order doesn't matter); undefined for an
   * empty Palette. */
  nearest: (hex: string) => PaletteColor | undefined
  /** The color a Project opens ready to paint with: the first built-in swatch (the first of any, if none is). */
  defaultColorId: string | undefined
  /** The swatches that have a Shift+key slot; a Palette longer than the keys has swatches without one. */
  hotkeyed: readonly PaletteColor[]
}

/** The Palette the stored ids name. `builtIns` is the set the ids are resolved against (ticket 0528 swaps it). */
export function createPalette(ids: PaletteIds, builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): Palette {
  const colors = paletteColors(ids, builtIns)
  return {
    colors,
    byId: (id) => colors.find((color) => color.id === id),
    byHex: (hex) => colors.find((color) => color.hex === hex.toLowerCase()),
    nearest: (hex) => {
      const nearest = nearestColor(colors.map((color) => color.hex), hex)
      return colors.find((color) => color.hex === nearest)
    },
    defaultColorId: (colors.find((color) => !isAddedColorId(color.id)) ?? colors[0])?.id,
    hotkeyed: colors.slice(0, PALETTE_SHORTCUTS.length),
  }
}

export type AddUsedColorOutcome = 'added' | 'known'

/** A Custom color just chosen or painted: the Palette with it in the last slot on first use. 'known' if the hex is
 * already a swatch, or isn't a color; either way `ids` is unchanged. There is no cap. */
export function addUsedColor(ids: PaletteIds, hex: string): { ids: PaletteIds; outcome: AddUsedColorOutcome; colorId?: string } {
  const normalized = normalizeHex(hex)
  if (!normalized) return { ids, outcome: 'known' }
  const known = paletteColors(ids).find((color) => color.hex === normalized)
  if (known) return { ids, outcome: 'known', colorId: known.id }
  const colorId = addedColorId(normalized)
  return { ids: [...paletteColors(ids).map((color) => color.id), colorId], outcome: 'added', colorId }
}

/** An added color taken out of the Palette (ticket 228): the ids without it, and the slot it stood in, so Undo can put
 * it back. Undefined for a built-in color or one that isn't there. */
export function removeAddedColor(ids: PaletteIds, colorId: string): { ids: PaletteIds; slot: number } | undefined {
  const all = paletteColors(ids).map((color) => color.id)
  const slot = all.indexOf(colorId)
  return slot < 0 || !isAddedColorId(colorId) ? undefined : { ids: all.filter((id) => id !== colorId), slot }
}

/** Undo of a removal: the color back in the slot it stood in (or last, when the Palette has since got shorter). */
export function restoreAddedColor(ids: PaletteIds, colorId: string, slot: number): PaletteIds {
  const all = paletteColors(ids).map((color) => color.id)
  return all.includes(colorId) ? ids : [...all.slice(0, slot), colorId, ...all.slice(slot)]
}

/** The ids of the added colors a device kept before the Palette belonged to a Project (temporary, ticket 0525), laid
 * out in the slot order it kept: the Palette that device's Projects were painted with. */
export function paletteFromDevice(added: readonly string[], order: readonly string[]): string[] {
  const kept = new Set(added.map(addedColorId))
  const placed = order.filter((id) => !isAddedColorId(id) || kept.has(id))
  const unplaced = [...defaultPaletteIds(), ...kept].filter((id) => !placed.includes(id))
  return paletteColors([...placed, ...unplaced]).map((color) => color.id)
}

/** A slot's color dragged to another slot: the ids with it taken out and put at `to`, the ones between shifting by
 * one. */
export function moveSlot(ids: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= ids.length || to < 0 || to >= ids.length) return [...ids]
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}
