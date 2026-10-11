// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { PALETTE } from './palette'
import { createProject, frameGrid, normalizeProject, withFrameGrid, type Grid, type Project } from './project'
import { decodeProject, encodeProject } from './projectEncoding'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** A Project of an exact grid size: 1.5mm cubes, so millimetres map one-to-one onto cells at 1.5mm each. */
function makeProject(columns: number, rows: number): Project {
  return createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: columns * 1.5, height: rows * 1.5, unit: 'mm' },
  })
}

function paint(project: Project, color: (row: number, column: number) => string | null): Project {
  const grid: Grid = frameGrid(project).map((cells, row) => cells.map((_cell, column) => ({ color: color(row, column) })))
  return withFrameGrid(project, grid)
}

/** What a Project's beads look like stored: the color table plus each painted row's runs (see ADR 0009, ADR 0026). */
function encodedCells(project: Project) {
  return encodeProject(project).encodedBeads
}

function roundTrip(project: Project): Project {
  return normalizeProject(decodeProject(JSON.parse(JSON.stringify(encodeProject(project)))))
}

describe('the encoded beads', () => {
  it('list each distinct color once, in the order the beads first use it', () => {
    const project = paint(makeProject(2, 2), (row, column) =>
      (row + column) % 2 === 0 ? '#ff0000' : '#00ff00',
    )

    expect(encodedCells(project).colors).toEqual(['#ff0000', '#00ff00'])
  })

  it('keep empty positions out of the color table', () => {
    const project = paint(makeProject(3, 1), (_row, column) => (column === 1 ? '#ff0000' : null))

    expect(encodedCells(project).colors).toEqual(['#ff0000'])
  })

  it('collapse a stretch of one color into a single run', () => {
    const project = paint(makeProject(40, 1), () => '#ff0000')

    expect(encodedCells(project).rows).toEqual({ 0: '0:1x40' })
  })

  it('write nothing at all for an empty canvas', () => {
    expect(encodedCells(makeProject(4, 3))).toEqual({ colors: [], rows: {} })
  })

  it('give each painted row its own run list, starting at its first bead', () => {
    const project = paint(makeProject(2, 3), () => '#ff0000')

    expect(encodedCells(project).rows).toEqual({ 0: '0:1x2', 1: '0:1x2', 2: '0:1x2' })
  })

  it('spend a couple of characters on a bead nothing runs into', () => {
    const project = paint(makeProject(3, 1), (_row, column) => `#00000${column}`)

    expect(encodedCells(project).rows).toEqual({ 0: '0:1,2,3' })
  })

  it('write a gap between two beads of a row as a run of empties', () => {
    const project = paint(makeProject(6, 1), (_row, column) => (column === 1 || column === 4 ? '#ff0000' : null))

    expect(encodedCells(project).rows).toEqual({ 0: '1:1,0x2,1' })
  })

  it('cost one row for a bead far from the others, however far, negative positions included', () => {
    const project = {
      ...makeProject(2, 2),
      beads: { [-40000]: { [-90000]: '#ff0000' }, 0: { 0: '#00ff00' } },
    }

    expect(encodedCells(project).rows).toEqual({ '-40000': '-90000:1', 0: '0:2' })
    expect(roundTrip(project)).toEqual(project)
  })
})

describe('encodeProject / decodeProject', () => {
  it('round-trips a painted grid', () => {
    const project = paint(makeProject(8, 5), (row, column) =>
      (row + column) % 3 === 0 ? PALETTE[0]!.hex : null,
    )

    expect(roundTrip(project)).toEqual(project)
  })

  it('round-trips a Custom color the Palette has never had', () => {
    const custom = '#a1b2c3'
    expect(PALETTE.some((color) => color.hex === custom)).toBe(false)
    const project = paint(makeProject(4, 4), (row, column) => (row === column ? custom : null))

    expect(roundTrip(project)).toEqual(project)
  })

  it('round-trips an imported Project painted entirely in hexes outside the Palette', () => {
    const imported = ['#010203', '#040506', '#070809', '#0a0b0c']
    expect(imported.every((hex) => !PALETTE.some((color) => color.hex === hex))).toBe(true)
    const project = paint(makeProject(6, 6), (row, column) => imported[(row + column) % imported.length]!)

    expect(roundTrip(project)).toEqual(project)
  })

  it('round-trips a fully empty grid', () => {
    const project = makeProject(20, 20)

    expect(roundTrip(project)).toEqual(project)
  })

  it('round-trips a single-cell grid', () => {
    const empty = makeProject(1, 1)
    expect({ columns: empty.frame!.columns, rows: empty.frame!.rows }).toEqual({ columns: 1, rows: 1 })

    expect(roundTrip(empty)).toEqual(empty)
    const painted = paint(empty, () => '#ff00ff')
    expect(roundTrip(painted)).toEqual(painted)
  })

  it('round-trips a grid where every neighbouring cell differs', () => {
    const hexes = ['#111111', '#222222', '#333333', '#444444', '#555555']
    const project = paint(makeProject(9, 7), (row, column) => hexes[(row * 9 + column) % hexes.length]!)

    expect(roundTrip(project)).toEqual(project)
  })

  it('never loses to the plain-JSON grid, even on a worst-case grid', () => {
    const hexes = ['#111111', '#222222', '#333333', '#444444', '#555555']
    const project = paint(makeProject(60, 90), (row, column) => hexes[(row * 60 + column) % hexes.length]!)

    expect(JSON.stringify(encodeProject(project)).length).toBeLessThan(JSON.stringify(project).length)
  })

  it('leaves every non-grid field exactly as it was, including one added after this encoding', () => {
    // Ticket 58's Image colors is such a field, and deliberately not this encoding's color table (ADR 0011): the two
    // differ the moment a color is erased, so the encoding has to carry a field it knows nothing about, untouched.
    const base = paint(makeProject(3, 3), (row) => (row === 0 ? '#ff0000' : null))
    const project = { ...base, imageColors: ['#ff0000', '#00ff00'] }

    const decoded = decodeProject(JSON.parse(JSON.stringify(encodeProject(project))))

    expect(decoded).toEqual(project)
  })

  it('does not fold the grid colors into a field of their own on the Project', () => {
    const project = paint(makeProject(3, 3), () => '#ff0000')

    const encoded = encodeProject(project)

    // The table belongs to the encoded cells, not to the Project: nothing above the storage boundary should be able to
    // mistake it for a Project field (see ADR 0009 and ADR 0011).
    expect(Object.keys(encoded)).not.toContain('colors')
    expect(encoded.encodedBeads.colors).toEqual(['#ff0000'])
  })

  it('replaces the beads rather than storing them twice', () => {
    const encoded = encodeProject(paint(makeProject(3, 3), () => '#ff0000'))

    expect(Object.keys(encoded)).not.toContain('beads')
  })

  it('keeps the Frame, with beads outside it, through the round trip', () => {
    const project = {
      ...paint(makeProject(3, 3), () => '#ff0000'),
      frame: { row: 1, column: 1, columns: 2, rows: 2 },
    }

    expect(roundTrip(project)).toEqual(project)
  })

  it('still reads the grid-shaped cells an earlier build stored, as beads with a Frame the size of the grid', () => {
    const { beads: _beads, frame: _frame, ...base } = makeProject(3, 2)
    const stored = { ...base, columns: 3, rows: 2, cells: { colors: ['#ff0000', '#00ff00'], runs: '1,0x3,2,0' } }

    const read = normalizeProject(decodeProject(stored))

    expect(read.frame).toEqual({ row: 0, column: 0, columns: 3, rows: 2 })
    expect(read.beads).toEqual({ 0: { 0: '#ff0000' }, 1: { 1: '#00ff00' } })
  })
})
