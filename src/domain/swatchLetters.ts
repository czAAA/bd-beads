/** Swatch letters (ticket 0573; CONTEXT.md's Swatch letter): the short label each Palette color carries so a weaver can
 * tell colors apart on paper. Kept by the swatch's hex like its catalog code, so a letter follows its color through
 * reordering, a change of Bead and Undo. */
export type SwatchLetters = Readonly<Record<string, string>>

/** What a Swatch letter is: one to three of A to Z (the lettering reaches three past 702 colors). */
const LETTER = /^[A-Z]{1,3}$/

/** The most letters a maker types for one color (ticket 1092): two, which the lettering itself reaches at 27 colors. */
export const TYPED_LETTER_LENGTH = 2

/** What a maker typed as a Swatch letter (ticket 1092): its letters A to Z in upper case, the first two. A digit is
 * dropped, as the Word chart writes a count before a letter (`2C`). Empty when nothing is left. */
export function typedLetter(text: string): string {
  return text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, TYPED_LETTER_LENGTH)
}

/** The letters with the color `hex` given `letter` (ticket 1092). A color that has that letter trades it for this
 * color's (`swapped` says which and what it got), so no two share one. Undefined when nothing changes: a color the
 * Palette lacks, not a letter, or the one it has. */
export function withLetter(letters: SwatchLetters, hex: string, letter: string): { letters: SwatchLetters; swapped?: { hex: string; letter: string } } | undefined {
  const own = letters[hex]
  if (own === undefined || own === letter || !LETTER.test(letter)) return undefined
  const other = Object.keys(letters).find((key) => letters[key] === letter)
  return { letters: { ...letters, [hex]: letter, ...(other ? { [other]: own } : {}) }, ...(other ? { swapped: { hex: other, letter: own } } : {}) }
}

/** The letter of the nth color: A to Z, then AA, AB… (AZ, then BA…).
 * @internal Its test checks the lettering past Z. */
export function letterAt(index: number): string {
  let letter = ''
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letter = String.fromCharCode(65 + ((rest - 1) % 26)) + letter
  }
  return letter
}

/** The lowest letter no color in `taken` has.
 * @internal Its test checks which letter a new color takes. */
export function lowestFreeLetter(taken: ReadonlySet<string>): string {
  let index = 0
  while (taken.has(letterAt(index))) index += 1
  return letterAt(index)
}

/** The letters of a Palette whose swatches have these `hexes`, in slot order. A color keeps the letter it had in `kept`
 * (when it is a letter and no other color has it); one without gets the lowest unused letter. A color that left the
 * Palette loses its letter, which then counts as unused. Reordering or deleting never changes another color's letter. */
export function lettersFor(hexes: readonly string[], kept: unknown): SwatchLetters {
  const stored = typeof kept === 'object' && kept !== null && !Array.isArray(kept) ? (kept as Record<string, unknown>) : {}
  const letters: Record<string, string> = {}
  const taken = new Set<string>()
  for (const hex of hexes) {
    const letter = stored[hex]
    if (typeof letter === 'string' && LETTER.test(letter) && !taken.has(letter)) {
      letters[hex] = letter
      taken.add(letter)
    }
  }
  for (const hex of hexes) {
    if (letters[hex] === undefined) {
      const letter = lowestFreeLetter(taken)
      letters[hex] = letter
      taken.add(letter)
    }
  }
  return letters
}
