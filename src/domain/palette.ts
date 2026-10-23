export interface PaletteColor {
  id: string
  hex: string
}

/** The twelve built-in colors (see CONTEXT.md's Palette entry), independent of the bead catalog; Custom colors that
 * were used join them (ticket 227, ADR 0002). */
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

/** Shift+1..9 and Shift+0 (tickets 88, 529): the physical key (`KeyboardEvent.code`; shifted `.key`
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
]

/** The first keys, Shift+1…3, pick the recent colors, not Palette slots (ticket 529). */
export const RECENT_SHORTCUTS = 3

/** The slots of `palette` the colour popover shows and Shift+4…0 reach: every slot but the ones holding one of the
 * `recents` (the pill's chips, which show and key those colors instead), in slot order. */
export function slotsBesideRecents(palette: readonly PaletteColor[], recents: readonly string[]): number[] {
  const slots: number[] = []
  palette.forEach((color, slot) => {
    if (!recents.includes(color.hex)) slots.push(slot)
  })
  return slots
}

/** The Palette color a painted cell holds, looked up by the hex the grid stores; undefined for a hex from outside
 * the Palette. */
export function findPaletteColorByHex(hex: string): PaletteColor | undefined {
  return PALETTE.find((color) => color.hex === hex)
}

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

/** What a new Project's Palette is: the twelve built-in colors, in their order. */
export function defaultPaletteIds(): string[] {
  return PALETTE.map((color) => color.id)
}

/** The hex an added swatch's id stands for; undefined for anything that isn't one. */
function addedColorHex(colorId: string): string | undefined {
  return isAddedColorId(colorId) ? normalizeHex(`#${colorId.slice(ADDED_PREFIX.length)}`) : undefined
}

/** The swatches a stored Palette names, in its order: an id that is neither built-in nor an added color's is dropped, a
 * repeated one counts once, and a built-in color it leaves out follows (the twelve are never missing). */
export function paletteColors(ids: PaletteIds): PaletteColor[] {
  const placed = new Set<string>()
  const colors: PaletteColor[] = []
  for (const id of ids) {
    const color = findPaletteColor(id) ?? paletteColorForAdded(id)
    if (color && !placed.has(color.id)) {
      placed.add(color.id)
      colors.push(color)
    }
  }
  return [...colors, ...PALETTE.filter((color) => !placed.has(color.id))]
}

function paletteColorForAdded(id: string): PaletteColor | undefined {
  const hex = addedColorHex(id)
  return hex ? { id: addedColorId(hex), hex } : undefined
}

/** A stored Palette read back whatever it holds (see paletteColors), as the ids to keep. */
export function normalizePaletteIds(stored: unknown): string[] {
  const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
  return paletteColors(ids).map((color) => color.id)
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
