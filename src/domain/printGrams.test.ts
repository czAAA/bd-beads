import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { beadsPerGram, formatPrintedGrams, printedGrams, tubesToBuy } from './printGrams'

const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
const round = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('grams on the printed output (ticket 162; printed-output.md)', () => {
  it('is the count divided by beads per gram, rounded up to 0.1 g', () => {
    expect(printedGrams(4800, delica)).toBe(24)
    expect(printedGrams(777, delica)).toBe(3.9)
    expect(printedGrams(761, delica)).toBe(3.9)
    expect(printedGrams(1, delica)).toBe(0.1)
    expect(printedGrams(0, delica)).toBe(0)
  })

  it('has none for a Bead with no weight', () => {
    expect(printedGrams(100, { beadsPerKg: undefined })).toBeUndefined()
    expect(printedGrams(100, undefined)).toBeUndefined()
  })

  it('drops a trailing .0 and writes the language\'s decimal sign, a no-break space before the unit', () => {
    expect(formatPrintedGrams(24, 'en', 'g')).toBe('24 g')
    expect(formatPrintedGrams(3.9, 'en', 'g')).toBe('3.9 g')
    expect(formatPrintedGrams(3.9, 'ru', 'г')).toBe('3,9 г')
    expect(formatPrintedGrams(1200.5, 'en', 'g')).toBe('1 200.5 g')
  })

  it('rounds each color and the Total up on their own counts', () => {
    const rows = [761, 761].map((count) => printedGrams(count, delica)!)
    expect(rows).toEqual([3.9, 3.9])
    expect(printedGrams(761 * 2, delica)).toBe(7.7)
  })

  it('says how many beads make a gram, for the note', () => {
    expect(beadsPerGram(delica)).toBe(200)
    expect(beadsPerGram(round)).toBe(110)
    expect(beadsPerGram({ beadsPerKg: undefined })).toBeUndefined()
  })
})

describe('tubes to buy (ticket 0581)', () => {
  it('is the grams with 10% spare over 5 g tubes, rounded up', () => {
    expect(tubesToBuy(24)).toBe(6)
    expect(tubesToBuy(3.9)).toBe(1)
    expect(tubesToBuy(4.6)).toBe(2)
    expect(tubesToBuy(10)).toBe(3)
  })

  it('is one tube for a color under a gram and does not tip over on an exact fit', () => {
    expect(tubesToBuy(0.1)).toBe(1)
    expect(tubesToBuy(50)).toBe(11)
    expect(tubesToBuy(0)).toBe(0)
  })
})
