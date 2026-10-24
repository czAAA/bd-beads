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
