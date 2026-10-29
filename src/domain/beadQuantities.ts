import { gramsPerBead, type Bead } from './beads'
import { decimalSign } from './formatNumber'
import type { Locale } from './locale'
import type { Palette } from './palette'
import { forEachBead } from './canvas'
import type { Project } from './project'
import { frameGeometryOf } from './layers'
import { beadsOfLayer } from './layerRecord'

/** One line of a Project's shopping list: a painted color and how many beads of it the Project needs. */
export interface ColorQuantity {
  /** The Palette color this is, or null for a hex the Project's Palette doesn't hold (e.g. a removed swatch). */
  colorId: string | null
  hex: string
  count: number
}

// How many beads of each color the Project needs, counted off its painted cells, most-needed first. Unpainted cells and
// colors painted nowhere aren't listed. Only the Frame's beads count (ADR 0026): with no Frame there is nothing to
// count.
export function computeColorQuantities(project: Project, palette: Palette): ColorQuantity[] {
  const counts = new Map<string, number>()
  const beads = beadsOfLayer(project, 'frame')
  if (!beads) {
    return []
  }

  // Every real bead counts once: a Custom frame's are its layout's (ticket 0592).
  const geometry = frameGeometryOf(project)
  forEachBead(beads, (row, column, color) => {
    if (geometry.hasPosition({ row, column })) {
      counts.set(color, (counts.get(color) ?? 0) + 1)
    }
  })

  return [...counts.entries()]
    .map(([hex, count]) => ({ colorId: palette.byHex(hex)?.id ?? null, hex, count }))
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex))
}

// A quantity's Estimated weight in grams (CONTEXT.md): bead count times the Bead's average weight. Derived, never
// stored; undefined when the Bead has no weight, so a caller hides weights rather than showing zero.
export function estimatedGrams(count: number, bead: Pick<Bead, 'beadsPerKg'> | undefined): number | undefined {
  const grams = gramsPerBead(bead)
  return grams === undefined ? undefined : count * grams
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
