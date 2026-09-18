import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { computeColorQuantities } from './beadQuantities'
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
