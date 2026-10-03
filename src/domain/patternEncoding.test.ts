// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { PALETTE } from './palette'
import { createPattern, frameGrid, normalizePattern, withFrameGrid, type Grid, type Pattern } from './pattern'
import { decodePattern, encodePattern } from './patternEncoding'

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
  const grid: Grid = frameGrid(pattern).map((cells, row) => cells.map((_cell, column) => ({ color: color(row, column) })))
  return withFrameGrid(pattern, grid)
}

/** What a Pattern's beads look like stored: the color table plus each painted row's runs (see ADR 0009, ADR 0026). */
function encodedCells(pattern: Pattern) {
  return encodePattern(pattern).encodedBeads
}

function roundTrip(pattern: Pattern): Pattern {
  return normalizePattern(decodePattern(JSON.parse(JSON.stringify(encodePattern(pattern)))))
}

describe('the encoded beads', () => {
  it('list each distinct color once, in the order the beads first use it', () => {
    const pattern = paint(makePattern(2, 2), (row, column) =>
      (row + column) % 2 === 0 ? '#ff0000' : '#00ff00',
    )

    expect(encodedCells(pattern).colors).toEqual(['#ff0000', '#00ff00'])
  })

  it('keep empty positions out of the color table', () => {
    const pattern = paint(makePattern(3, 1), (_row, column) => (column === 1 ? '#ff0000' : null))

    expect(encodedCells(pattern).colors).toEqual(['#ff0000'])
  })

  it('collapse a stretch of one color into a single run', () => {
    const pattern = paint(makePattern(40, 1), () => '#ff0000')

    expect(encodedCells(pattern).rows).toEqual({ 0: '0:1x40' })
  })

  it('write nothing at all for an empty canvas', () => {
    expect(encodedCells(makePattern(4, 3))).toEqual({ colors: [], rows: {} })
  })

  it('give each painted row its own run list, starting at its first bead', () => {
    const pattern = paint(makePattern(2, 3), () => '#ff0000')

    expect(encodedCells(pattern).rows).toEqual({ 0: '0:1x2', 1: '0:1x2', 2: '0:1x2' })
  })

  it('spend a couple of characters on a bead nothing runs into', () => {
    const pattern = paint(makePattern(3, 1), (_row, column) => `#00000${column}`)

    expect(encodedCells(pattern).rows).toEqual({ 0: '0:1,2,3' })
  })

  it('write a gap between two beads of a row as a run of empties', () => {
    const pattern = paint(makePattern(6, 1), (_row, column) => (column === 1 || column === 4 ? '#ff0000' : null))

    expect(encodedCells(pattern).rows).toEqual({ 0: '1:1,0x2,1' })
  })

  it('cost one row for a bead far from the others, however far, negative positions included', () => {
    const pattern = {
      ...makePattern(2, 2),
      beads: { [-40000]: { [-90000]: '#ff0000' }, 0: { 0: '#00ff00' } },
    }

    expect(encodedCells(pattern).rows).toEqual({ '-40000': '-90000:1', 0: '0:2' })
    expect(roundTrip(pattern)).toEqual(pattern)
  })
})

describe('encodePattern / decodePattern', () => {
  it('round-trips a painted grid', () => {
    const pattern = paint(makePattern(8, 5), (row, column) =>
      (row + column) % 3 === 0 ? PALETTE[0]!.hex : null,
    )

    expect(roundTrip(pattern)).toEqual(pattern)
  })

  it('round-trips a Custom color the Palette has never had', () => {
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
    expect({ columns: empty.frame!.columns, rows: empty.frame!.rows }).toEqual({ columns: 1, rows: 1 })

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
    // Ticket 58's Image colors is such a field, and deliberately not this encoding's color table (ADR 0011): the two
    // differ the moment a color is erased, so the encoding has to carry a field it knows nothing about, untouched.
    const base = paint(makePattern(3, 3), (row) => (row === 0 ? '#ff0000' : null))
    const pattern = { ...base, imageColors: ['#ff0000', '#00ff00'] }

    const decoded = decodePattern(JSON.parse(JSON.stringify(encodePattern(pattern))))

    expect(decoded).toEqual(pattern)
  })

  it('does not fold the grid colors into a field of their own on the Pattern', () => {
    const pattern = paint(makePattern(3, 3), () => '#ff0000')

    const encoded = encodePattern(pattern)

    // The table belongs to the encoded cells, not to the Pattern: nothing above the storage boundary should be able to
    // mistake it for a Pattern field (see ADR 0009 and ADR 0011).
    expect(Object.keys(encoded)).not.toContain('colors')
    expect(encoded.encodedBeads.colors).toEqual(['#ff0000'])
  })

  it('replaces the beads rather than storing them twice', () => {
    const encoded = encodePattern(paint(makePattern(3, 3), () => '#ff0000'))

    expect(Object.keys(encoded)).not.toContain('beads')
  })

  it('keeps the Frame, with beads outside it, through the round trip', () => {
    const pattern = {
      ...paint(makePattern(3, 3), () => '#ff0000'),
      frame: { row: 1, column: 1, columns: 2, rows: 2 },
    }

    expect(roundTrip(pattern)).toEqual(pattern)
  })

  it('still reads the grid-shaped cells an earlier build stored, as beads with a Frame the size of the grid', () => {
    const { beads: _beads, frame: _frame, ...base } = makePattern(3, 2)
    const stored = { ...base, columns: 3, rows: 2, cells: { colors: ['#ff0000', '#00ff00'], runs: '1,0x3,2,0' } }

    const read = normalizePattern(decodePattern(stored))

    expect(read.frame).toEqual({ row: 0, column: 0, columns: 3, rows: 2 })
    expect(read.beads).toEqual({ 0: { 0: '#ff0000' }, 1: { 1: '#00ff00' } })
  })
})
