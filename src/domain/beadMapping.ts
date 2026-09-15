import { PALETTE, findPaletteColorByHex } from './palette'
import type { ColorBeadOverrides, Pattern } from './pattern'

/** Palette color id -> Bead id: the universal default of which real Bead a color stands for (see ADR 0002). */
export type ColorBeadDefaults = Record<string, string>

/** One line of a Pattern's shopping list: a painted color and how many beads of it the Pattern needs. */
export interface ColorQuantity {
  /** The Palette color this is, or null for a hex the Palette doesn't know (e.g. from an older imported file). */
  colorId: string | null
  hex: string
  count: number
}

/**
 * How many beads of each color the Pattern needs, counted straight off its painted cells and ordered most-needed
 * first. Unpainted cells don't count; a color painted nowhere isn't listed at all.
 */
export function computeColorQuantities(pattern: Pattern): ColorQuantity[] {
  const counts = new Map<string, number>()

  for (const row of pattern.grid) {
    for (const cell of row) {
      if (cell.color !== null) {
        counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1)
      }
    }
  }

  return [...counts.entries()]
    .map(([hex, count]) => ({ colorId: findPaletteColorByHex(hex)?.id ?? null, hex, count }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex))
}

/**
 * Every color that can be pointed at a Bead: the whole Palette, plus any color an imported Pattern was painted with
 * from outside it. Colors the Pattern doesn't use are listed too (at zero), so a Bead can be chosen for a color
 * before it is ever painted; the ones it does use come first, most-needed at the top.
 */
export function listColorMappings(pattern: Pattern | undefined): ColorQuantity[] {
  const used = pattern ? computeColorQuantities(pattern) : []
  const usedHexes = new Set(used.map((quantity) => quantity.hex))

  const unused = PALETTE.filter((color) => !usedHexes.has(color.hex)).map((color) => ({
    colorId: color.id,
    hex: color.hex,
    count: 0,
  }))

  return [...used, ...unused]
}

/**
 * Points one Palette color at a Bead, or unmaps it when given no bead, returning a new mapping rather than mutating
 * the one passed in. Shared by the global defaults and a Pattern's own overrides, which are the same shape.
 */
export function withColorBeadMapping(
  mapping: Record<string, string>,
  colorId: string,
  beadId: string | null,
): Record<string, string> {
  const { [colorId]: _removed, ...rest } = mapping

  return beadId === null ? rest : { ...rest, [colorId]: beadId }
}

/**
 * Which Bead a Palette color means for this Pattern: its own override if it has one, otherwise the global default
 * (ADR 0002). Undefined when the color has been mapped nowhere, or has no Palette identity to map.
 */
export function resolveBeadId(
  colorId: string | null,
  defaults: ColorBeadDefaults,
  overrides: ColorBeadOverrides,
): string | undefined {
  if (colorId === null) {
    return undefined
  }

  return overrides[colorId] ?? defaults[colorId]
}

/**
 * Folds the defaults from an imported file into this device's own. Local mappings win: importing fills in colors
 * this device has not mapped rather than overwriting choices already made here, the same way importing a Pattern
 * never overwrites a local one (ticket 15).
 */
export function mergeColorBeadDefaults(
  local: ColorBeadDefaults,
  incoming: ColorBeadDefaults,
): ColorBeadDefaults {
  return { ...incoming, ...local }
}
