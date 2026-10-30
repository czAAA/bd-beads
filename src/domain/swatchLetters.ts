/** Swatch letters (ticket 0573; CONTEXT.md's Swatch letter): the short label each Palette color carries so a weaver can
 * tell colors apart on paper. Kept by the swatch's hex like its catalog code, so a letter follows its color through
 * reordering, a change of Bead and Undo. */
export type SwatchLetters = Readonly<Record<string, string>>

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
    if (typeof letter === 'string' && /^[A-Z]{1,3}$/.test(letter) && !taken.has(letter)) {
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

/** Whether a board drawn with these letters carries any: where it does not, its empty positions get a cross instead
 * (ticket 0719). */
export function lettersDrawn(letters: SwatchLetters | undefined): boolean {
  return !!letters && Object.values(letters).some(Boolean)
}
