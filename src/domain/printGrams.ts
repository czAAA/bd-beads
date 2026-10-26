import { gramsPerBead, type Bead } from './beads'
import { decimalSign, groupThousands } from './formatNumber'
import type { Locale } from './locale'

/** Grams on the PDF and PNG (ticket 162; printed-output.md): beads are bought by the gram. A weight is count over the
 * Bead's beads per gram, rounded **up** to 0.1 g so a buyer never comes up short; the Total is rounded up from the
 * total count, not summed from rounded rows. */
export function printedGrams(count: number, bead: Pick<Bead, 'beadsPerKg'> | undefined): number | undefined {
  const grams = gramsPerBead(bead)
  if (grams === undefined) return undefined
  // The small allowance keeps an exact tenth (4800 × 0.005 = 24.000000000000004) from rounding up a whole step.
  return Math.max(0, Math.ceil(count * grams * 10 - 1e-9) / 10)
}

/** How many of the Bead make a gram, for the note under the Total: "≈ 200 Delica 11/0 a gram". */
export function beadsPerGram(bead: Pick<Bead, 'beadsPerKg'>): number | undefined {
  return bead.beadsPerKg ? Math.round(bead.beadsPerKg / 1000) : undefined
}

/** "24 g", "3.9 g", "3,9 г": a trailing .0 dropped, the language's decimal sign, thousands grouped (`writing.md`). */
export function formatPrintedGrams(grams: number, locale: Locale, unit: string): string {
  const whole = Math.trunc(grams)
  const tenth = Math.round((grams - whole) * 10)
  const decimal = decimalSign(locale)
  return `${groupThousands(whole, locale)}${tenth ? `${decimal}${tenth}` : ''} ${unit}`
}

/** The size of the tubes the Specification counts in. */
const TUBE_GRAMS = 5
/** The spare the grams note suggests, as a factor. */
const SPARE = 1.1

/** Tubes to buy for a weight (ticket 0581): the grams with about 10% spare over a 5 g tube, rounded up, so even a color
 * under a gram is one tube. */
export function tubesToBuy(grams: number): number {
  // The small allowance keeps an exact fit (50 g × 1.1 = 55.00000000000001 → 12 tubes) from tipping over.
  return Math.max(0, Math.ceil((grams * SPARE) / TUBE_GRAMS - 1e-9))
}
