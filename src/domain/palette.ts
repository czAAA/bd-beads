import { BEAD_CATALOG, findBead, findBrand } from './beads'
import type { ColorCatalog } from './colorCatalog'
import { normalizeHex } from './color'
import { nearestColor } from './imageColors'

export interface PaletteColor {
  id: string
  hex: string
  /** A brand's own name, the same in every language; absent, the name is the translation of `id` (`colorNames`). */
  literalName?: string
  /** The maker's catalog code of a swatch picked from the Color catalog (ticket 0538, ADR 0072); absent for a plain color. */
  code?: string
}

/** The twelve built-in colors a Palette starts from when its Bead's brand has no set of its own (see CONTEXT.md's
 * Palette entry, ticket 227, ADR 0002).
 * @internal Tests and the visual check's fixtures paint with the built-in colors. */
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

/** The hex of a maker's color family (`Blue`, `Gray`) in a Brand's colors (`brandColors`): its color of that name, so
 * a "Blue" swatch and the default blue are one color (ticket 0537); undefined for a family with no single color (`Mix`). */
export function familyHex(family: string, colors: readonly PaletteColor[]): string | undefined {
  return colors.find((color) => color.id === familyColorId(family))?.hex
}

/** The Palette color id a maker's color family is named by: `Gray` is `grey`, the rest are lowercase. */
export function familyColorId(family: string): string {
  return family.toLowerCase() === 'gray' ? 'grey' : family.toLowerCase()
}

/** A Brand's built-in colors (ADR 0078): the color families on its row, or the twelve for a Brand without a set and
 * one the catalog lacks. */
export function brandColors(brandId: string | undefined): readonly PaletteColor[] {
  return (brandId && findBrand(brandId)?.colorFamilies) || BUILT_IN_COLORS
}

/** The built-in colors a Project on this Bead starts with (ticket 0528): its Brand's set, or the twelve for a Bead the
 * catalog lacks. The same array every time, so two Beads can be compared by identity. */
export function defaultPalette(beadId: string): readonly PaletteColor[] {
  return brandColors(findBead(beadId)?.brand.id)
}

/** A built-in color by id, for the fixed artwork (Starters, the homepage) that names the colors it draws with. */
export function findBuiltInColor(id: string): PaletteColor | undefined {
  return BUILT_IN_COLORS.find((color) => color.id === id)
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

/** What a new Project's Palette is: the built-in colors, in their order (the twelve unless `builtIns` is its Bead's
 * set, see defaultPalette). */
export function defaultPaletteIds(builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): string[] {
  return builtIns.map((color) => color.id)
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
 * is a new Project's Palette. One of the twelve that the Bead's set lacks (a Project saved before ticket 0528) stays
 * in the Palette as an added color, so what was stored is what is shown. */
export function normalizePaletteIds(stored: unknown, builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): string[] {
  if (!Array.isArray(stored)) return defaultPaletteIds(builtIns)
  const ids = stored
    .filter((id): id is string => typeof id === 'string')
    .map((id) => {
      const earlier = builtIns.some((color) => color.id === id) ? undefined : BUILT_IN_COLORS.find((color) => color.id === id)
      return earlier ? addedColorId(earlier.hex) : id
    })
  return paletteColors(ids, builtIns).map((color) => color.id)
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
  /** The swatches the colour popover shows and Shift+4…0 reach (ticket 529): every slot but the ones holding one of the
   * `recents` (the pill's chips show and key those instead), in slot order, each with the slot it stands in. A Palette
   * longer than the keys has swatches without one. */
  besideRecents: (recents: readonly string[]) => { color: PaletteColor; slot: number }[]
}

/** The catalog code of each swatch that has one, by the swatch's hex (ticket 0538): a hex is a swatch's identity whether
 * it is an added color or a built-in one, so a code follows its color when a Bead change moves it between the two. */
export type PaletteCodes = Readonly<Record<string, string>>

/** The Palette the stored ids name. `builtIns` is the set the ids are resolved against: the Bead's (see defaultPalette). */
export function createPalette(ids: PaletteIds, builtIns: readonly PaletteColor[] = BUILT_IN_COLORS, codes: PaletteCodes = {}): Palette {
  const colors = paletteColors(ids, builtIns).map((color) => (codes[color.hex] ? { ...color, code: codes[color.hex] } : color))
  return {
    colors,
    byId: (id) => colors.find((color) => color.id === id),
    byHex: (hex) => colors.find((color) => color.hex === hex.toLowerCase()),
    nearest: (hex) => {
      const nearest = nearestColor(colors.map((color) => color.hex), hex)
      return colors.find((color) => color.hex === nearest)
    },
    defaultColorId: (colors.find((color) => !isAddedColorId(color.id)) ?? colors[0])?.id,
    besideRecents: (recents) =>
      colors.flatMap((color, slot) => (recents.includes(color.hex) ? [] : [{ color, slot }])),
  }
}

export type AddUsedColorOutcome = 'added' | 'known'

/** A Custom color just chosen or painted: the Palette with it in the last slot on first use. 'known' if the hex is
 * already a swatch, or isn't a color; either way `ids` is unchanged. There is no cap. */
export function addUsedColor(ids: PaletteIds, hex: string, builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): { ids: PaletteIds; outcome: AddUsedColorOutcome; colorId?: string } {
  const normalized = normalizeHex(hex)
  if (!normalized) return { ids, outcome: 'known' }
  const colors = paletteColors(ids, builtIns)
  const known = colors.find((color) => color.hex === normalized)
  if (known) return { ids, outcome: 'known', colorId: known.id }
  const colorId = addedColorId(normalized)
  return { ids: [...colors.map((color) => color.id), colorId], outcome: 'added', colorId }
}

/** An added color taken out of the Palette (ticket 228): the ids without it, and the slot it stood in, so Undo can put
 * it back. Undefined for a built-in color or one that isn't there. */
export function removeAddedColor(ids: PaletteIds, colorId: string, builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): { ids: PaletteIds; slot: number } | undefined {
  const all = paletteColors(ids, builtIns).map((color) => color.id)
  const slot = all.indexOf(colorId)
  return slot < 0 || !isAddedColorId(colorId) ? undefined : { ids: all.filter((id) => id !== colorId), slot }
}

/** Every added color taken out of the Palette at once (ticket 0532): the ids left, and each removed color with the slot
 * it stood in, in slot order, so Undo can put each back. No removals when none is added. */
export function removeAllAddedColors(ids: PaletteIds, builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): { ids: PaletteIds; removed: { colorId: string; slot: number }[] } {
  const all = paletteColors(ids, builtIns).map((color) => color.id)
  const removed = all.flatMap((colorId, slot) => (isAddedColorId(colorId) ? [{ colorId, slot }] : []))
  return { ids: all.filter((id) => !isAddedColorId(id)), removed }
}

/** Undo of a removal: the color back in the slot it stood in (or last, when the Palette has since got shorter). */
export function restoreAddedColor(ids: PaletteIds, colorId: string, slot: number, builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): PaletteIds {
  const all = paletteColors(ids, builtIns).map((color) => color.id)
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

/** The Palette of a Project as every reader asks it: its stored ids against its Bead's built-in colors (ticket 0528). */
export function projectPalette(project: { palette: PaletteIds; beadId: string; paletteCodes?: PaletteCodes }): Palette {
  return createPalette(project.palette, defaultPalette(project.beadId), project.paletteCodes)
}

/** A stored code map read back whatever it holds: only a lowercase-hex key with a non-empty string code is kept (ticket 0538). */
export function normalizePaletteCodes(stored: unknown): PaletteCodes {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {}
  const codes: Record<string, string> = {}
  for (const [key, code] of Object.entries(stored)) {
    const hex = normalizeHex(key)
    if (hex && typeof code === 'string' && code !== '') codes[hex] = code
  }
  return codes
}

/** `codes` less the swatches that are no longer in the Palette `ids`, so a code never outlives its color (ticket 0538). */
export function codesInPalette(codes: PaletteCodes, ids: PaletteIds, builtIns: readonly PaletteColor[]): PaletteCodes {
  const held = new Set(paletteColors(ids, builtIns).map((color) => color.hex))
  return Object.fromEntries(Object.entries(codes).filter(([hex]) => held.has(hex)))
}

/** The codes that stay after the Bead changes (ticket 0538, ADR 0072): a swatch keeps its code only when the new Bead's
 * catalog lists it in the new Bead's size. No catalog (or one that failed to load) keeps none. */
export function codesForBead(codes: PaletteCodes, catalog: ColorCatalog | undefined, size: string | undefined): PaletteCodes {
  if (!catalog || !size) return {}
  const listed = new Set(catalog.codes.filter((entry) => entry.sizes.includes(size)).map((entry) => entry.code))
  return Object.fromEntries(Object.entries(codes).filter(([, code]) => listed.has(code)))
}

/** Whether some Bead's set has a color with this hex. */
function isDefaultHex(hex: string): boolean {
  return BEAD_CATALOG.some((bead) => defaultPalette(bead.id).some((color) => color.hex === hex))
}

/** The default colors the maker took out of the Palette once they were added colors (ticket 0528), as hexes: the
 * previous list less those now back in the Palette, plus the added colors of any Bead's set that `before` had and
 * `after` lacks. A Bead change never promotes these again. */
export function removedDefaultsAfter(before: PaletteIds, after: PaletteIds, removed: readonly string[]): string[] {
  const kept = new Set(paletteColors(after, []).map((color) => color.hex))
  const taken = paletteColors(before, [])
    .filter((color) => !kept.has(color.hex) && isDefaultHex(color.hex))
    .map((color) => color.hex)
  return [...new Set([...removed.filter((hex) => !kept.has(hex)), ...taken])]
}

/** The Palette after the Bead changes from the built-in colors `from` to `to` (ticket 0528): `to` become the built-in
 * ones, every added color stays, and the `from` still there become added at the end, in slot order. A hex in both is
 * kept once, as a built-in; a `to` color the maker removed (`removed`) is not put back. */
export function paletteForBead(
  ids: PaletteIds,
  removed: readonly string[],
  from: readonly PaletteColor[],
  to: readonly PaletteColor[],
): string[] {
  if (from === to) return [...ids]
  const promoted = to.filter((color) => !removed.includes(color.hex))
  const promotedHexes = new Set(promoted.map((color) => color.hex))
  const current = paletteColors(ids, from).filter((color) => !promotedHexes.has(color.hex))
  const added = current.filter((color) => isAddedColorId(color.id))
  const demoted = current.filter((color) => !isAddedColorId(color.id)).map((color) => ({ id: addedColorId(color.hex) }))
  return [...promoted, ...added, ...demoted].map((color) => color.id)
}
