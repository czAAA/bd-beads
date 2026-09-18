import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { PALETTE } from './palette'
import { createPattern, type Grid, type Pattern } from './pattern'
import { decodePattern, encodeGrid, encodePattern } from './patternEncoding'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** A Pattern of an exact grid size: 1.5mm cubes, so millimetres map one-to-one onto cells at 1.5mm each. */
function makePattern(columns: number, rows: number): Pattern {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: columns * 1.5, height: rows * 1.5, unit: 'mm' },
  })
}

function paint(pattern: Pattern, color: (row: number, column: number) => string | null): Pattern {
  const grid: Grid = pattern.grid.map((cells, row) =>
    cells.map((_cell, column) => ({ color: color(row, column) })),
  )
  return { ...pattern, grid }
}

function roundTrip(pattern: Pattern): Pattern {
  return decodePattern(JSON.parse(JSON.stringify(encodePattern(pattern))))
}

describe('encodeGrid', () => {
  it('lists each distinct colour once, in the order the cells first use it', () => {
    const grid: Grid = [
      [{ color: '#ff0000' }, { color: '#00ff00' }],
      [{ color: '#00ff00' }, { color: '#ff0000' }],
    ]

    expect(encodeGrid(grid).colors).toEqual(['#ff0000', '#00ff00'])
  })

  it('keeps empty cells out of the colour table', () => {
    const grid: Grid = [[{ color: null }, { color: '#ff0000' }, { color: null }]]

    expect(encodeGrid(grid).colors).toEqual(['#ff0000'])
  })

  it('collapses a stretch of one colour into a single run', () => {
    const grid: Grid = [Array.from({ length: 40 }, () => ({ color: '#ff0000' }))]

    expect(encodeGrid(grid).runs).toBe('1x40')
  })

  it('writes a whole empty grid as one run of empties', () => {
    const grid: Grid = Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ({ color: null })))

    expect(encodeGrid(grid)).toEqual({ colors: [], runs: '0x12' })
  })

  it('runs across row ends, since cells are encoded in row-major order', () => {
    const grid: Grid = Array.from({ length: 3 }, () => Array.from({ length: 2 }, () => ({ color: '#ff0000' })))

    expect(encodeGrid(grid).runs).toBe('1x6')
  })
})

describe('encodePattern / decodePattern', () => {
  it('round-trips a painted grid', () => {
    const pattern = paint(makePattern(8, 5), (row, column) =>
      (row + column) % 3 === 0 ? PALETTE[0]!.hex : null,
    )

    expect(roundTrip(pattern)).toEqual(pattern)
  })

  it('round-trips a Custom colour the Palette has never had', () => {
    const custom = '#a1b2c3'
    expect(PALETTE.some((color) => color.hex === custom)).toBe(false)
    const pattern = paint(makePattern(4, 4), (row, column) => (row === column ? custom : null))

    expect(roundTrip(pattern)).toEqual(pattern)
  })

  it('round-trips an imported Pattern painted entirely in hexes outside the Palette', () => {
    const imported = ['#010203', '#040506', '#070809', '#0a0b0c']
    expect(imported.every((hex) => !PALETTE.some((color) => color.hex === hex))).toBe(true)
    const pattern = paint(makePattern(6, 6), (row, column) => imported[(row + column) % imported.length]!)

    expect(roundTrip(pattern)).toEqual(pattern)
  })

  it('round-trips a fully empty grid', () => {
    const pattern = makePattern(20, 20)

    expect(roundTrip(pattern)).toEqual(pattern)
  })

  it('round-trips a single-cell grid', () => {
    const empty = makePattern(1, 1)
    expect({ columns: empty.columns, rows: empty.rows }).toEqual({ columns: 1, rows: 1 })

    expect(roundTrip(empty)).toEqual(empty)
    const painted = paint(empty, () => '#ff00ff')
    expect(roundTrip(painted)).toEqual(painted)
  })

  it('round-trips a grid where every neighbouring cell differs', () => {
    const hexes = ['#111111', '#222222', '#333333', '#444444', '#555555']
    const pattern = paint(makePattern(9, 7), (row, column) => hexes[(row * 9 + column) % hexes.length]!)

    expect(roundTrip(pattern)).toEqual(pattern)
  })

  it('never loses to the plain-JSON grid, even on a worst-case grid', () => {
    const hexes = ['#111111', '#222222', '#333333', '#444444', '#555555']
    const pattern = paint(makePattern(60, 90), (row, column) => hexes[(row * 60 + column) % hexes.length]!)

    expect(JSON.stringify(encodePattern(pattern)).length).toBeLessThan(JSON.stringify(pattern).length)
  })

  it('leaves every non-grid field exactly as it was, including one added after this encoding', () => {
    // Ticket 58's Image colors is such a field, and deliberately not this encoding's colour table (ADR 0011): the two
    // differ the moment a colour is erased, so the encoding has to carry a field it knows nothing about, untouched.
    const base = paint(makePattern(3, 3), (row) => (row === 0 ? '#ff0000' : null))
    const pattern = { ...base, imageColors: ['#ff0000', '#00ff00'] }

    const decoded = decodePattern(JSON.parse(JSON.stringify(encodePattern(pattern))))

    expect(decoded).toEqual(pattern)
  })

  it('does not fold the grid colours into a field of their own on the Pattern', () => {
    const pattern = paint(makePattern(3, 3), () => '#ff0000')

    const encoded = encodePattern(pattern)

    // The table belongs to the encoded grid, not to the Pattern: nothing above the storage boundary should be able to
    // mistake it for a Pattern field (see ADR 0009 and ADR 0011).
    expect(Object.keys(encoded)).not.toContain('colors')
    expect(encoded.cells.colors).toEqual(['#ff0000'])
  })
})
