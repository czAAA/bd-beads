import { findPaletteColorByHex } from './palette'
import type { Pattern } from './pattern'

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
 * Which Bead a Palette color means for this Pattern: its own override if it has one, otherwise the global default
 * (ADR 0002). Undefined when the color has been mapped nowhere, or has no Palette identity to map.
 */
export function resolveBeadId(
  colorId: string | null,
  defaults: ColorBeadDefaults,
  pattern: Pattern,
): string | undefined {
  if (colorId === null) {
    return undefined
  }

  return pattern.colorBeadOverrides[colorId] ?? defaults[colorId]
}
