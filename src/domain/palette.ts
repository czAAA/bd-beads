import { BEAD_CATALOG, colorCatalogOf, findBead, findBrand } from './beads'
import { BLACK_WHITE_BALANCE, channelsOf, contrastRatio, normalizeHex, relativeLuminance } from './color'
import { defaultFamilyOf, namedDefaults } from './defaultColors'
import { nearestColor } from './imageColors'

export interface PaletteColor {
  id: string
  hex: string
  /** A brand's own name, the same in every language; absent, the name is the translation of `id` (`colorNames`). */
  literalName?: string
  /** The maker's catalog code of a swatch picked from the Color catalog (ticket 0538, ADR 0072); absent for a plain color. */
  code?: string
  /** The Color catalog its code is from (ADR 0103): the section the swatch is in. Absent with no code: Custom colors. */
  catalog?: string
  /** The color family a catalog's default color stands for (ticket 1070), which names it ("Red · 45"); absent for the
   * generic family colors, whose id is their family. */
  family?: string
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

/** The color family a built-in color is of (ticket 1070): a default color's own, or a generic color's id. */
export function familyOf(color: Pick<PaletteColor, 'id' | 'family'>): string {
  return color.family ?? color.id
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

const DEFAULT_PREFIX = 'default-'

/** The id a catalog's default color is known by (ticket 1070): its hex, as an added color's is, so a stored Palette
 * still knows the color once the Bead's default colors are others; never a family id, which a generic color has. */
function catalogDefaultId(hex: string): string {
  return `${DEFAULT_PREFIX}${hex.slice(1)}`
}

const catalogDefaults = new Map<string, readonly PaletteColor[]>()

/** A Bead's default colors (tickets 0528, 1070, ADR 0100): its catalog's codes for its size, one per color family in the
 * Brand's order, with their measured colors; else its Brand's generic family colors, or the twelve for a Bead the
 * catalog lacks. The same array every time, so two Beads can be compared by identity. */
export function defaultPalette(beadId: string): readonly PaletteColor[] {
  const bead = findBead(beadId)
  const named = namedDefaults(beadId)
  const catalog = colorCatalogOf(beadId)
  if (!bead || !named || !catalog) return brandColors(bead?.brand.id)
  let colors = catalogDefaults.get(bead.id)
  if (!colors) {
    colors = brandColors(bead.brand.id).flatMap((family) => {
      const pick = named[family.id]
      return pick ? [{ id: catalogDefaultId(pick.hex), hex: pick.hex, code: pick.code, catalog, family: family.id }] : []
    })
    catalogDefaults.set(bead.id, colors)
  }
  return colors
}

/** A built-in color by id.
 * @internal Tests name the built-in colors they check by id; the Homepage's drawn examples that did went with 0797. */
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

/** The first keys, Shift+1…3, pick the recent colors (ticket 529); the keys after them, Shift+4…0, pick the first
 * Palette slots, a recent one included, so a slot's key never changes with what was used (ticket 0865). */
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

/** A Project's Palette as it is held (ticket 0525, ADR 0002, 0103): the id of every swatch in slot order, its default
 * colors and the added ones alike, each section's swatches together. */
export type PaletteIds = readonly string[]

/** What a new Project's Palette is: the built-in colors, in their order (the twelve unless `builtIns` is its Bead's
 * set, see defaultPalette). */
export function defaultPaletteIds(builtIns: readonly PaletteColor[] = BUILT_IN_COLORS): string[] {
  return builtIns.map((color) => color.id)
}

/** A swatch's catalog code with the Color catalog it is from (ADR 0103): the section it puts the swatch in. */
export interface PaletteCode {
  catalog: string
  code: string
}

/** The catalog code of each swatch that has one, by the swatch's hex (ticket 0538, ADR 0103): a hex names one swatch,
 * one code and one section, as beads store only their hex. */
export type PaletteCodes = Readonly<Record<string, PaletteCode>>

/** The codes the coded `colors` carry, by hex: a Bead's default colors' as a new Project's Palette holds them. */
export function codesOfColors(colors: readonly PaletteColor[]): PaletteCodes {
  return Object.fromEntries(colors.flatMap((color) => (color.code && color.catalog ? [[color.hex, { catalog: color.catalog, code: color.code }]] : [])))
}

/** The section a Custom color is in (ADR 0103): every swatch without a catalog code. */
export const CUSTOM_COLORS = 'custom'

/** The names of the Color catalogs, which are the makers' own and so the same in every language (copy/colors.md). */
const CATALOG_NAMES: Readonly<Record<string, string>> = { toho: 'TOHO', 'miyuki-delica': 'Miyuki Delica', 'miyuki-round': 'Miyuki Round' }

/** A Color catalog's name as a section's label and a code's words show it ("TOHO code 341", ticket 1226); a catalog this
 * build has no name for shows its id. */
export function catalogName(catalog: string): string {
  return CATALOG_NAMES[catalog] ?? catalog
}

/** The section a swatch is in (ADR 0103): its code's Color catalog, or Custom colors. */
function sectionOf(color: Pick<PaletteColor, 'catalog'>): string {
  return color.catalog ?? CUSTOM_COLORS
}

/** One section of the Palette (ADR 0103): a Color catalog's swatches, or the Custom colors, in slot order. */
interface PaletteSection {
  id: string
  colors: readonly PaletteColor[]
}

/** Every generic color by id: the twelve and each Brand's color families, a shared id having one hex (a test checks). */
const GENERIC_COLORS: readonly PaletteColor[] = [...BUILT_IN_COLORS, ...BEAD_CATALOG.flatMap((bead) => bead.brand.colorFamilies ?? [])]

/** The hex a swatch id stands for, whatever Bead the Project is in: an added or default color's own, or a generic
 * color's; undefined for an id that is none of these. */
function hexOfId(id: string): string | undefined {
  const prefix = [ADDED_PREFIX, DEFAULT_PREFIX].find((each) => id.startsWith(each))
  if (prefix) return normalizeHex(`#${id.slice(prefix.length)}`)
  return GENERIC_COLORS.find((color) => color.id === id)?.hex
}

/** The swatch an id names with its code (ADR 0103): a default color is known by its catalog's code, which names its
 * family; one whose family its catalog no longer has is an added color of its hex. */
function swatchOf(id: string, codes: PaletteCodes): PaletteColor | undefined {
  const hex = hexOfId(id)
  if (!hex) return undefined
  const coded = codes[hex]
  const code = coded ? { code: coded.code, catalog: coded.catalog } : {}
  if (!id.startsWith(DEFAULT_PREFIX)) return { id, hex, ...code }
  const family = coded && defaultFamilyOf(coded.catalog, coded.code, hex)
  return family ? { id, hex, ...code, family } : { id: addedColorId(hex), hex, ...code }
}

/** `colors` with each section's together (ADR 0103), the sections in the order their first swatch stands in. */
function inSections(colors: readonly PaletteColor[]): PaletteSection[] {
  const sections = new Map<string, PaletteColor[]>()
  for (const color of colors) sections.set(sectionOf(color), [...(sections.get(sectionOf(color)) ?? []), color])
  return [...sections].map(([id, held]) => ({ id, colors: held }))
}

/** The swatches a Palette's ids name, in its order, each section's together (ADR 0103): an id that names no color is
 * dropped, and a hex that repeats counts once, as it names one swatch. */
export function paletteColors(ids: PaletteIds, codes: PaletteCodes = {}): PaletteColor[] {
  const placed = new Set<string>()
  const colors = ids.flatMap((id) => {
    const color = swatchOf(id, codes)
    if (!color || placed.has(color.hex)) return []
    placed.add(color.hex)
    return [color]
  })
  return inSections(colors).flatMap((section) => section.colors)
}

/** A Project's Palette as every reader asks it (ticket 0530): the swatches in slot order and the questions about them.
 * Built from the held ids and codes alone (ADR 0103), so no layer's Bead changes it. */
export interface Palette {
  colors: readonly PaletteColor[]
  /** The swatches in their sections (ADR 0103), in order: only those holding a color. */
  sections: readonly PaletteSection[]
  /** The swatch with this id; undefined for none (or no id). */
  byId: (id: string | null | undefined) => PaletteColor | undefined
  /** The swatch a painted cell holds, by the hex the grid stores; undefined for a hex from outside the Palette. */
  byHex: (hex: string) => PaletteColor | undefined
  /** The swatch nearest `hex` (the closest, not the first in range, so slot order doesn't matter); undefined for an
   * empty Palette. */
  nearest: (hex: string) => PaletteColor | undefined
  /** The color a Project opens ready to paint with: the first built-in swatch (the first of any, if none is). */
  defaultColorId: string | undefined
}

/** The Palette the held ids and codes name (ADR 0103). */
export function createPalette(ids: PaletteIds, codes: PaletteCodes = {}): Palette {
  const colors = paletteColors(ids, codes)
  return {
    colors,
    sections: inSections(colors),
    byId: (id) => colors.find((color) => color.id === id),
    byHex: (hex) => colors.find((color) => color.hex === hex.toLowerCase()),
    nearest: (hex) => {
      const nearest = nearestColor(colors.map((color) => color.hex), hex)
      return colors.find((color) => color.hex === nearest)
    },
    defaultColorId: (colors.find((color) => !isAddedColorId(color.id)) ?? colors[0])?.id,
  }
}

/** The least a new Project's first color keeps against its Background: WCAG's 3:1 for a meaningful mark. */
const START_COLOR_CONTRAST = 3

/** The color families a new Project starts painting with (ticket 0838), first choice first: gold on a dark Background
 * (yellow where the Palette has no gold, as the twelve), red on a light one; a family's default color (ticket 1070). */
const START_COLORS = { dark: ['gold', 'yellow'], light: ['red'] } as const

/** The swatch a new Project starts painting with on its Background's hex (ticket 0838): the gold family's default color
 * on a dark one, the red family's on a light one (ticket 1070), so the first bead shows; where neither is there or stands
 * 3:1 off it (a Custom color close to it), the swatch that stands off it most. Undefined for an empty Palette. */
export function startColorId(palette: Palette, background: string): string | undefined {
  const under = channelsOf(background)
  const contrast = (color: PaletteColor) => contrastRatio(channelsOf(color.hex), under)
  const look = relativeLuminance(under) < BLACK_WHITE_BALANCE ? 'dark' : 'light'
  const ofFamily = (family: string) => palette.colors.find((color) => !isAddedColorId(color.id) && familyOf(color) === family)
  const picked = START_COLORS[look]
    .map(ofFamily)
    .find((color) => color !== undefined && contrast(color) >= START_COLOR_CONTRAST)
  if (picked) return picked.id
  return palette.colors.reduce<PaletteColor | undefined>((best, color) => (!best || contrast(color) > contrast(best) ? color : best), undefined)?.id
}

/** The nearest hex `taken` lacks (ADR 0103): one step off in one channel, blue first, so the swatch looks the same. */
function nudgedHex(hex: string, taken: ReadonlySet<string>): string {
  const { r, g, b } = channelsOf(hex)
  const toHex = (channels: number[]) => `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`
  for (let step = 1; step <= 255; step++) {
    for (const channel of [2, 1, 0]) {
      for (const by of [step, -step]) {
        const channels = [r, g, b]
        channels[channel]! += by
        const candidate = toHex(channels)
        if (channels[channel]! >= 0 && channels[channel]! <= 255 && !taken.has(candidate)) return candidate
      }
    }
  }
  // Unreached: a Palette would need every hex 255 steps round this one taken.
  return hex
}

export type AddUsedColorOutcome = 'added' | 'known'

/** A color chosen or painted, or a code from any Bead's catalog (ADR 0103): the Palette with it last in its section, and
 * the code it joins with; 'known', `ids` unchanged, when the Palette holds the hex (for a code, that code) or it's no
 * color. A code whose hex another swatch holds is nudged one step and `nudgedFrom` names that swatch (ticket 1226). */
export function addUsedColor(ids: PaletteIds, hex: string, codes: PaletteCodes = {}, code?: PaletteCode): { ids: PaletteIds; outcome: AddUsedColorOutcome; colorId?: string; codes: PaletteCodes; nudgedFrom?: PaletteColor } {
  const normalized = normalizeHex(hex)
  if (!normalized) return { ids, outcome: 'known', codes: {} }
  const colors = paletteColors(ids, codes)
  const known = colors.find((color) => (code ? color.code === code.code && color.catalog === code.catalog : color.hex === normalized))
  if (known) return { ids, outcome: 'known', colorId: known.id, codes: {} }
  const held = new Set(colors.map((color) => color.hex))
  const nudgedFrom = colors.find((color) => color.hex === normalized)
  const swatchHex = nudgedFrom ? nudgedHex(normalized, held) : normalized
  const colorId = addedColorId(swatchHex)
  const joined = code ? { [swatchHex]: code } : {}
  return { ids: paletteColors([...colors.map((color) => color.id), colorId], { ...codes, ...joined }).map((color) => color.id), outcome: 'added', colorId, codes: joined, ...(nudgedFrom ? { nudgedFrom } : {}) }
}

/** A color taken out of the Palette (ticket 228), a default one too (ticket 1226): the ids without it, and the slot it
 * stood in, so Undo can put it back. Undefined for one that isn't there. */
export function removeColor(ids: PaletteIds, colorId: string): { ids: PaletteIds; slot: number } | undefined {
  const slot = ids.indexOf(colorId)
  return slot < 0 ? undefined : { ids: ids.filter((id) => id !== colorId), slot }
}

/** The colors `leaves` picks taken out of the Palette at once: the ids left, and each removed color with the slot it
 * stood in, in slot order, so Undo can put each back. */
function removeColorsWhere(ids: PaletteIds, leaves: (colorId: string) => boolean): { ids: PaletteIds; removed: { colorId: string; slot: number }[] } {
  const removed = ids.flatMap((colorId, slot) => (leaves(colorId) ? [{ colorId, slot }] : []))
  return { ids: ids.filter((id) => !leaves(id)), removed }
}

/** A whole section taken out of the Palette (ADR 0103, ticket 0532 for Custom colors): its default colors and added ones
 * alike. No removals for a section the Palette doesn't show. */
export function removeSection(ids: PaletteIds, codes: PaletteCodes, section: string): { ids: PaletteIds; removed: { colorId: string; slot: number }[] } {
  const leaving = new Set(paletteColors(ids, codes).filter((color) => sectionOf(color) === section).map((color) => color.id))
  return removeColorsWhere(ids, (colorId) => leaving.has(colorId))
}

/** A section moved `by` places among the Palette's sections (ticket 1226): the ids with each section's swatches together
 * in the new order. The same ids when the section isn't shown or has nowhere to go. */
export function moveSection(ids: PaletteIds, codes: PaletteCodes, section: string, by: number): PaletteIds {
  const sections = createPalette(ids, codes).sections
  const from = sections.findIndex((held) => held.id === section)
  const to = from + by
  if (from < 0 || to < 0 || to >= sections.length || by === 0) return ids
  const order = [...sections]
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved!)
  return order.flatMap((held) => held.colors.map((color) => color.id))
}

/** Undo of a removal: the color back in the slot it stood in (or last, when the Palette has since got shorter). */
export function restoreColor(ids: PaletteIds, colorId: string, slot: number): PaletteIds {
  return ids.includes(colorId) ? ids : [...ids.slice(0, slot), colorId, ...ids.slice(slot)]
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

/** The Palette of a Project as every reader asks it: its own ids and codes, whatever its layers' Beads (ADR 0103). */
export function projectPalette(project: { palette: PaletteIds; paletteCodes?: PaletteCodes }): Palette {
  return createPalette(project.palette, project.paletteCodes)
}

/** `codes` less the swatches that are no longer in the Palette `ids`, so a code never outlives its color (ticket 0538). */
export function codesInPalette(codes: PaletteCodes, ids: PaletteIds): PaletteCodes {
  const held = new Set(paletteColors(ids, codes).map((color) => color.hex))
  return Object.fromEntries(Object.entries(codes).filter(([hex]) => held.has(hex)))
}

/** One section as file version 16 stores it (ADR 0103): its Color catalog, absent for Custom colors, and its swatches'
 * ids in slot order; their codes are kept beside, by hex. */
export interface StoredPaletteSection {
  catalog?: string
  colors: string[]
}

/** A Palette as a file stores it (ADR 0103): its sections in order and each swatch's code by hex. */
export function storedPalette(ids: PaletteIds, codes: PaletteCodes = {}): { palette: StoredPaletteSection[]; paletteCodes?: Record<string, string> } {
  const sections = createPalette(ids, codes).sections
  const palette = sections.map(({ id, colors }) => ({ ...(id === CUSTOM_COLORS ? {} : { catalog: id }), colors: colors.map((color) => color.id) }))
  const stored = Object.fromEntries(sections.flatMap((section) => section.colors.flatMap((color) => (color.code ? [[color.hex, color.code]] : []))))
  return { palette, ...(Object.keys(stored).length > 0 ? { paletteCodes: stored } : {}) }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** A stored Palette read back whatever it holds (ADR 0103), as the ids and codes to keep: file version 16's sections, or
 * an older flat list, which the Bead of the layer it was woven in (`earlierBeadId`) sorts into sections. */
export function readStoredPalette(stored: unknown, storedCodes: unknown, earlierBeadId: string): { ids: string[]; codes: PaletteCodes } {
  const read = Array.isArray(stored) && stored.some(isRecord) ? readSections(stored, storedCodes) : readEarlierPalette(stored, storedCodes, earlierBeadId)
  return { ids: paletteColors(read.ids, read.codes).map((color) => color.id), codes: codesInPalette(read.codes, read.ids) }
}

/** Version 16's sections: each swatch's code is its section's catalog's; what is not a section or an id is dropped. */
function readSections(stored: readonly unknown[], storedCodes: unknown): { ids: string[]; codes: PaletteCodes } {
  const named = isRecord(storedCodes) ? storedCodes : {}
  const codes: Record<string, PaletteCode> = {}
  const ids = stored.filter(isRecord).flatMap(({ catalog, colors }) => {
    const held = Array.isArray(colors) ? colors.filter((id): id is string => typeof id === 'string') : []
    for (const hex of held.map(hexOfId)) {
      const code = hex && named[hex]
      if (hex && typeof catalog === 'string' && catalog && typeof code === 'string' && code) codes[hex] = { catalog, code }
    }
    return held
  })
  return { ids, codes }
}

/** The hex a built-in id the Bead's set lacks stood for: a generic color's (a Project saved before ticket 0528 or 1070),
 * or a catalog default color's, by its id; undefined for any other id. */
function earlierBuiltInHex(id: string): string | undefined {
  if (id.startsWith(DEFAULT_PREFIX)) return normalizeHex(`#${id.slice(DEFAULT_PREFIX.length)}`)
  return GENERIC_COLORS.find((color) => color.id === id)?.hex
}

/** A Palette saved before its sections (ADR 0103), resolved against the Bead it was woven in: a built-in color its set
 * lacks stays as an added color (tickets 0528, 1070), every code, the defaults' too, joins that Bead's catalog (with none,
 * a Custom color), and a missing or unreadable Palette is that Bead's default colors. */
function readEarlierPalette(stored: unknown, storedCodes: unknown, beadId: string): { ids: string[]; codes: PaletteCodes } {
  const builtIns = defaultPalette(beadId)
  const ids = !Array.isArray(stored)
    ? defaultPaletteIds(builtIns)
    : stored.flatMap((id) => {
        if (typeof id !== 'string') return []
        const earlier = builtIns.some((color) => color.id === id) ? undefined : earlierBuiltInHex(id)
        return [earlier ? addedColorId(earlier) : id]
      })
  const catalog = colorCatalogOf(beadId)
  // A Project held in memory (not a file) is read here too, so a code that already names its catalog keeps it.
  const named = Object.entries(isRecord(storedCodes) ? storedCodes : {}).flatMap(([key, held]) => {
    const hex = normalizeHex(key)
    const code = typeof held === 'string' ? catalog && { catalog, code: held } : isRecord(held) && held
    return hex && code && typeof code.catalog === 'string' && typeof code.code === 'string' && code.code !== '' ? [[hex, { catalog: code.catalog, code: code.code }] as const] : []
  })
  return { ids, codes: { ...codesOfColors(builtIns), ...Object.fromEntries(named) } }
}
