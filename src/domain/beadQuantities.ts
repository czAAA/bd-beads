import type { Bead } from './beads'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'
import { findPaletteColorByHex } from './palette'
import type { Pattern } from './pattern'

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
 * A quantity's Estimated weight in grams (CONTEXT.md): the bead count times the Bead's average weight of one bead.
 * Derived on the spot and never stored; undefined when the Bead has no weight, so a caller hides the weights rather
 * than showing zero.
 */
export function estimatedGrams(count: number, bead: Pick<Bead, 'gramsPerBead'> | undefined): number | undefined {
  return bead?.gramsPerBead === undefined ? undefined : count * bead.gramsPerBead
}

/** Grams below this are too small to weigh and read "< 0.01 g" instead. */
const MIN_WEIGHABLE_GRAMS = 0.01
/** From here up (once rounded to two decimals it would read 10.00) the weight has one decimal. */
const ONE_DECIMAL_FROM_GRAMS = 9.995

/** "12.3 g" / "12,3 г" from 10 g up, "1.25 g" below it, and "< 0.01 g" for a color too small to weigh. The unit and decimal sign follow the app language (writing.md). */
export function formatGrams(grams: number, unit: string, locale: Locale = 'en'): string {
  const decimal = decimalSign(locale)
  if (grams < MIN_WEIGHABLE_GRAMS) {
    return `< ${String(MIN_WEIGHABLE_GRAMS).replace('.', decimal)} ${unit}`
  }
  return `${grams.toFixed(grams >= ONE_DECIMAL_FROM_GRAMS ? 1 : 2).replace('.', decimal)} ${unit}`
}
