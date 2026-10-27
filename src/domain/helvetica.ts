/** The standard Helvetica and Helvetica-Bold advance widths the PDF's built-in fonts carry (Adobe core 14 AFM), in
 * 1/1000 em, for the capitals and digits a chart page sets: a PDF viewer lays the glyphs out itself, so centring a
 * letter needs its width here (ticket 0585, ADR 0043). */
export type HelveticaFace = 'regular' | 'bold'

const CAPITALS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const REGULAR = [667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611]
const BOLD = [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611]
const DIGIT = 556

/** Helvetica's cap height, in em: a capital sits this far above its baseline. */
export const HELVETICA_CAP_HEIGHT = 0.718

/** The width of `value` set in `face` at `size`, in the unit of `size`. Anything but a capital or digit counts as a digit. */
export function helveticaWidth(value: string, face: HelveticaFace, size: number): number {
  const table = face === 'bold' ? BOLD : REGULAR
  let units = 0
  for (const character of value) {
    const at = CAPITALS.indexOf(character)
    units += at === -1 ? DIGIT : table[at]!
  }
  return (units * size) / 1000
}
