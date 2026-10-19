import type { Bead } from './beads'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'
import { findPaletteColorByHex } from './palette'
import { forEachBead } from './canvas'
import type { Project } from './project'
import { describeWeave } from './weave'

/** One line of a Project's shopping list: a painted color and how many beads of it the Project needs. */
export interface ColorQuantity {
  /** The Palette color this is, or null for a hex the Palette doesn't know (e.g. from an older imported file). */
  colorId: string | null
  hex: string
  count: number
}

// How many beads of each color the Project needs, counted off its painted cells, most-needed first. Unpainted cells and
// colors painted nowhere aren't listed. Only the Frame's beads count (ADR 0026): with no Frame there is nothing to
// count.
export function computeColorQuantities(project: Project): ColorQuantity[] {
  const counts = new Map<string, number>()
  if (!project.frame) {
    return []
  }

  const weave = describeWeave(project.frame)
  // Every real bead counts once; the empty end of a Right-angle weave line is no bead (ticket 482).
  forEachBead(project.frame.beads, (row, column, color) => {
    if (weave.hasPosition({ row, column }, { ...project.frame!, row: 0, column: 0 })) {
      counts.set(color, (counts.get(color) ?? 0) + 1)
    }
  })

  return [...counts.entries()]
    .map(([hex, count]) => ({ colorId: findPaletteColorByHex(hex)?.id ?? null, hex, count }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex))
}

// A quantity's Estimated weight in grams (CONTEXT.md): bead count times the Bead's average weight. Derived, never
// stored; undefined when the Bead has no weight, so a caller hides weights rather than showing zero.
export function estimatedGrams(count: number, bead: Pick<Bead, 'gramsPerBead'> | undefined): number | undefined {
  return bead?.gramsPerBead === undefined ? undefined : count * bead.gramsPerBead
}

/** Grams below this are too small to weigh and read "< 0.01 g" instead. */
const MIN_WEIGHABLE_GRAMS = 0.01
/** From here up (once rounded to two decimals it would read 10.00) the weight has one decimal. */
const ONE_DECIMAL_FROM_GRAMS = 9.995

/** "12.3 g" / "12,3 г" from 10 g up, "1.25 g" below it, and "< 0.01 g" for a color too small to weigh. The unit and
 * decimal sign follow the app language (writing.md). */
export function formatGrams(grams: number, unit: string, locale: Locale = 'en'): string {
  const decimal = decimalSign(locale)
  if (grams < MIN_WEIGHABLE_GRAMS) {
    return `< ${String(MIN_WEIGHABLE_GRAMS).replace('.', decimal)} ${unit}`
  }
  return `${grams.toFixed(grams >= ONE_DECIMAL_FROM_GRAMS ? 1 : 2).replace('.', decimal)} ${unit}`
}
