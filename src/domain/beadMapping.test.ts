import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import {
  computeColorQuantities,
  listColorMappings,
  mergeColorBeadDefaults,
  resolveBeadId,
} from './beadMapping'
import { PALETTE } from './palette'
import { createPattern, paintCell, setColorBeadOverride, type Pattern } from './pattern'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!
const delicaBead = BEAD_CATALOG.find((bead) => bead.id === 'miyuki-delica-11-0')!

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
    (pattern, [row, column, color]) => paintCell(pattern, row, column, color),
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

describe('resolveBeadId', () => {
  const defaults = { red: cubeBead.id }

  it('uses the global default when the Pattern says nothing else', () => {
    expect(resolveBeadId('red', defaults, blankPattern().colorBeadOverrides)).toBe(cubeBead.id)
  })

  it('prefers the Pattern\'s own override over the global default', () => {
    const overridden = setColorBeadOverride(blankPattern(), 'red', delicaBead.id)

    expect(resolveBeadId('red', defaults, overridden.colorBeadOverrides)).toBe(delicaBead.id)
  })

  it('overriding one Pattern leaves the global default, and other Patterns, untouched', () => {
    setColorBeadOverride(blankPattern(), 'red', delicaBead.id)

    expect(resolveBeadId('red', defaults, blankPattern().colorBeadOverrides)).toBe(cubeBead.id)
    expect(defaults.red).toBe(cubeBead.id)
  })

  it('resolves to no bead for a color with neither an override nor a default', () => {
    expect(resolveBeadId('green', defaults, blankPattern().colorBeadOverrides)).toBeUndefined()
  })

  it('resolves to no bead for a color that has no palette identity to map', () => {
    expect(resolveBeadId(null, defaults, blankPattern().colorBeadOverrides)).toBeUndefined()
  })
})

describe('listColorMappings', () => {
  it('offers every Palette color a Bead, even with no Pattern open', () => {
    expect(listColorMappings(undefined).map((row) => row.colorId)).toEqual(
      PALETTE.map((color) => color.id),
    )
  })

  it('offers a Bead for a Palette color the Pattern has not been painted with yet', () => {
    const rows = listColorMappings(painted([[0, 0, RED]]))

    expect(rows.find((row) => row.colorId === 'green')).toEqual({
      colorId: 'green',
      hex: PALETTE.find((color) => color.id === 'green')!.hex,
      count: 0,
    })
  })

  it('puts the colors the Pattern actually needs first, most-needed at the top', () => {
    const rows = listColorMappings(
      painted([
        [0, 0, BLUE],
        [1, 0, RED],
        [1, 1, RED],
      ]),
    )

    expect(rows.slice(0, 2)).toEqual([
      { colorId: 'red', hex: RED, count: 2 },
      { colorId: 'blue', hex: BLUE, count: 1 },
    ])
    expect(rows.slice(2).every((row) => row.count === 0)).toBe(true)
  })

  it('lists each Palette color exactly once, painted or not', () => {
    const ids = listColorMappings(painted([[0, 0, RED]])).map((row) => row.colorId)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(PALETTE.length)
  })

  it('keeps a color painted from outside the Palette in the list, alongside the Palette itself', () => {
    const rows = listColorMappings(painted([[0, 0, '#123456']]))

    expect(rows).toHaveLength(PALETTE.length + 1)
    expect(rows[0]).toEqual({ colorId: null, hex: '#123456', count: 1 })
  })
})

describe('mergeColorBeadDefaults', () => {
  it('fills in colors this device has not mapped', () => {
    expect(mergeColorBeadDefaults({ red: cubeBead.id }, { blue: delicaBead.id })).toEqual({
      red: cubeBead.id,
      blue: delicaBead.id,
    })
  })

  it('keeps this device\'s own choice for a color the file also maps', () => {
    expect(mergeColorBeadDefaults({ red: cubeBead.id }, { red: delicaBead.id })).toEqual({
      red: cubeBead.id,
    })
  })
})
