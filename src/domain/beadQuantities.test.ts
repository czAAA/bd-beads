// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { computeColorQuantities, estimatedGrams, formatGrams } from './beadQuantities'
import { createPattern, paintCells, type Pattern } from './pattern'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

const RED = '#e63746'
const BLUE = '#2f6fed'

function blankPattern(): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

function painted(cells: [row: number, column: number, color: string][]): Pattern {
  return cells.reduce(
    (pattern, [row, column, color]) => paintCells(pattern, [{ row: row, column: column }], color, { columns: 0, rows: 0 }),
    blankPattern(),
  )
}

describe('computeColorQuantities', () => {
  it('finds nothing to buy for an unpainted Pattern', () => {
    expect(computeColorQuantities(blankPattern())).toEqual([])
  })

  it('counts how many beads each painted color needs', () => {
    const quantities = computeColorQuantities(
      painted([
        [0, 0, RED],
        [0, 1, RED],
        [1, 0, BLUE],
      ]),
    )

    expect(quantities).toEqual([
      { colorId: 'red', hex: RED, count: 2 },
      { colorId: 'blue', hex: BLUE, count: 1 },
    ])
  })

  it('lists the most-needed color first', () => {
    const quantities = computeColorQuantities(
      painted([
        [0, 0, BLUE],
        [1, 0, RED],
        [1, 1, RED],
      ]),
    )

    expect(quantities.map((quantity) => quantity.colorId)).toEqual(['red', 'blue'])
  })

  it('still counts a color that is not in the Palette, flagging that it has no palette identity', () => {
    const quantities = computeColorQuantities(painted([[0, 0, '#123456']]))

    expect(quantities).toEqual([{ colorId: null, hex: '#123456', count: 1 }])
  })
})

describe('estimatedGrams', () => {
  it.each([
    ['toho-cube-1.5mm', 100, 1.08],
    ['toho-round-11-0', 100, 0.91],
    ['miyuki-delica-11-0', 100, 0.5],
  ])('multiplies the count by the average weight of a %s bead', (id, count, expected) => {
    expect(estimatedGrams(count, BEAD_CATALOG.find((bead) => bead.id === id))).toBeCloseTo(expected, 10)
  })

  it('is undefined for a Bead with no weight, or no Bead at all', () => {
    expect(estimatedGrams(100, { gramsPerBead: undefined })).toBeUndefined()
    expect(estimatedGrams(100, undefined)).toBeUndefined()
  })
})

describe('formatGrams', () => {
  it('uses two decimals below 10 g and one from 10 g up', () => {
    expect(formatGrams(1.2345, 'g')).toBe('1.23 g')
    expect(formatGrams(9.99, 'g')).toBe('9.99 g')
    expect(formatGrams(10, 'g')).toBe('10.0 g')
    expect(formatGrams(12.34, 'g')).toBe('12.3 g')
  })

  it('never shows 10.00 for a value that rounds up to ten', () => {
    expect(formatGrams(9.996, 'g')).toBe('10.0 g')
  })

  it('says "< 0.01 g" for a color too small to weigh, and shows 0.01 g from there', () => {
    expect(formatGrams(0.0099, 'g')).toBe('< 0.01 g')
    expect(formatGrams(0.005, 'g')).toBe('< 0.01 g')
    expect(formatGrams(0.01, 'g')).toBe('0.01 g')
  })

  it('takes the unit label from the caller', () => {
    expect(formatGrams(2, 'г')).toBe('2.00 г')
    expect(formatGrams(0.001, 'г')).toBe('< 0.01 г')
  })

  it('uses the Russian decimal comma (writing.md, Numbers) when locale is ru', () => {
    expect(formatGrams(2, 'г', 'ru')).toBe('2,00 г')
    expect(formatGrams(12.34, 'г', 'ru')).toBe('12,3 г')
    expect(formatGrams(0.001, 'г', 'ru')).toBe('< 0,01 г')
  })
})
