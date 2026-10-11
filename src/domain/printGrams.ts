import type { Bead } from './beads'
import { decimalSign, groupThousands } from './formatNumber'
import type { Locale } from './locale'

/**
 * Grams on the PDF and PNG (ticket 162; printed-output.md, Beads and grams): beads are bought by the gram, so every
 * color and the Total show both. A weight is the count divided by the Bead's beads per gram, rounded **up** to 0.1 g,
 * so a buyer never comes up short; the Total is rounded up from the total count, not added up from rounded rows.
 */
export function printedGrams(count: number, bead: Pick<Bead, 'gramsPerBead'> | undefined): number | undefined {
  if (bead?.gramsPerBead === undefined) return undefined
  // The small allowance keeps an exact tenth (4800 × 0.005 = 24.000000000000004) from rounding up a whole step.
  return Math.max(0, Math.ceil(count * bead.gramsPerBead * 10 - 1e-9) / 10)
}

/** How many of the Bead make a gram, for the note under the Total: "≈ 200 Delica 11/0 a gram". */
export function beadsPerGram(bead: Pick<Bead, 'gramsPerBead'>): number | undefined {
  return bead.gramsPerBead ? Math.round(1 / bead.gramsPerBead) : undefined
}

/** "24 g", "3.9 g", "3,9 г": a trailing .0 dropped, the language's decimal sign, thousands grouped (`writing.md`). */
export function formatPrintedGrams(grams: number, locale: Locale, unit: string): string {
  const whole = Math.trunc(grams)
  const tenth = Math.round((grams - whole) * 10)
  const decimal = decimalSign(locale)
  return `${groupThousands(whole, locale)}${tenth ? `${decimal}${tenth}` : ''} ${unit}`
}
