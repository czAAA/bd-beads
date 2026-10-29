// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { BUILT_IN_COLORS } from './palette'
import { createProject } from './createProject'
import { normalizeProject } from './storedProject'
import type { Grid, Project } from './project'
import { decodeEarlierProject, decodeProject, encodeProject } from './projectEncoding'
import { frameGrid, withFrameGrid } from '../testUtils/frameGrid'
import { beadsOfLayer, frameOf } from './layerRecord'
import { flatOf, sheetOf, withFields } from '../testUtils/flatFields'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

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

/** What the Canvas's beads look like stored: the color table plus each painted row's runs (see ADR 0009, ADR 0026). */
function encodedCells(project: Project) {
  return encodeProject(project).layers[0]!.encodedBeads
}

/** The same for the Frame's own beads (ADR 0066), which `paint` draws. */
function encodedFrameCells(project: Project) {
  return encodeProject(project).layers[1]!.encodedBeads
}

function roundTrip(project: Project): Project {
  return normalizeProject(decodeProject(JSON.parse(JSON.stringify(encodeProject(project)))))
}

describe('the encoded beads', () => {
  it('list each distinct color once, in the order the beads first use it', () => {
    const project = paint(makeProject(2, 2), (row, column) =>
      (row + column) % 2 === 0 ? '#ff0000' : '#00ff00',
    )

    expect(encodedFrameCells(project).colors).toEqual(['#ff0000', '#00ff00'])
  })

  it('keep empty positions out of the color table', () => {
    const project = paint(makeProject(3, 1), (_row, column) => (column === 1 ? '#ff0000' : null))

    expect(encodedFrameCells(project).colors).toEqual(['#ff0000'])
  })

  it('collapse a stretch of one color into a single run', () => {
    const project = paint(makeProject(40, 1), () => '#ff0000')

    expect(encodedFrameCells(project).rows).toEqual({ 0: '0:1x40' })
  })

  it('write nothing at all for an empty canvas', () => {
    expect(encodedCells(makeProject(4, 3))).toEqual({ colors: [], rows: {} })
    expect(encodedFrameCells(makeProject(4, 3))).toEqual({ colors: [], rows: {} })
  })

  it('give each painted row its own run list, starting at its first bead', () => {
    const project = paint(makeProject(2, 3), () => '#ff0000')

    expect(encodedFrameCells(project).rows).toEqual({ 0: '0:1x2', 1: '0:1x2', 2: '0:1x2' })
  })

  it('spend a couple of characters on a bead nothing runs into', () => {
    const project = paint(makeProject(3, 1), (_row, column) => `#00000${column}`)

    expect(encodedFrameCells(project).rows).toEqual({ 0: '0:1,2,3' })
  })

  it('write a gap between two beads of a row as a run of empties', () => {
    const project = paint(makeProject(6, 1), (_row, column) => (column === 1 || column === 4 ? '#ff0000' : null))

    expect(encodedFrameCells(project).rows).toEqual({ 0: '1:1,0x2,1' })
  })

  it('cost one row for a bead far from the others, however far, negative positions included', () => {
    const project = withFields(makeProject(2, 2), { beads: { [-40000]: { [-90000]: '#ff0000' }, 0: { 0: '#00ff00' } } })

    expect(encodedCells(project).rows).toEqual({ '-40000': '-90000:1', 0: '0:2' })
    expect(roundTrip(project)).toEqual(project)
  })
})

describe('encodeProject / decodeProject', () => {
  it('round-trips a painted grid', () => {
    const project = paint(makeProject(8, 5), (row, column) =>
      (row + column) % 3 === 0 ? BUILT_IN_COLORS[0]!.hex : null,
    )

    expect(roundTrip(project)).toEqual(project)
  })

  it('round-trips a Custom color the Palette has never had', () => {
    const custom = '#a1b2c3'
    expect(BUILT_IN_COLORS.some((color) => color.hex === custom)).toBe(false)
    const project = paint(makeProject(4, 4), (row, column) => (row === column ? custom : null))

    expect(roundTrip(project)).toEqual(project)
  })

  it('round-trips an imported Project painted entirely in hexes outside the Palette', () => {
    const imported = ['#010203', '#040506', '#070809', '#0a0b0c']
    expect(imported.every((hex) => !BUILT_IN_COLORS.some((color) => color.hex === hex))).toBe(true)
    const project = paint(makeProject(6, 6), (row, column) => imported[(row + column) % imported.length]!)

    expect(roundTrip(project)).toEqual(project)
  })

  it('round-trips a fully empty grid', () => {
    const project = makeProject(20, 20)

    expect(roundTrip(project)).toEqual(project)
  })

  it('round-trips a single-cell grid', () => {
    const empty = makeProject(1, 1)
    expect({ columns: frameOf(empty)!.columns, rows: frameOf(empty)!.rows }).toEqual({ columns: 1, rows: 1 })

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
    // The encoding has to carry a field it knows nothing about, untouched.
    const base = paint(makeProject(3, 3), (row) => (row === 0 ? '#ff0000' : null))
    const project = { ...base, futureField: { a: 1 } }

    const decoded = decodeProject(JSON.parse(JSON.stringify(encodeProject(project))))

    expect(decoded).toEqual(project)
  })

  it('does not fold the grid colors into a field of their own on the Project', () => {
    const project = paint(makeProject(3, 3), () => '#ff0000')

    const encoded = encodeProject(project)

    // The table belongs to the encoded cells, not to the Project: nothing above the storage boundary should be able to
    // mistake it for a Project field (see ADR 0009).
    expect(Object.keys(encoded)).not.toContain('colors')
    expect(encoded.layers[1]!.encodedBeads.colors).toEqual(['#ff0000'])
  })

  it('replaces the beads rather than storing them twice', () => {
    const encoded = encodeProject(paint(makeProject(3, 3), () => '#ff0000'))

    expect(Object.keys(encoded)).not.toContain('beads')
    expect(encoded.layers.every((layer) => !('beads' in layer))).toBe(true)
  })

  it('keeps the Frame, with its own beads and name, and the Canvas beads beside it, through the round trip', () => {
    const base = paint(makeProject(3, 3), () => '#ff0000')
    const project = withFields(base, {
      beads: { 9: { 9: '#00ff00' } },
      frame: { ...frameOf(base)!, row: 1, column: 1, name: 'Cherry' },
    })

    expect(roundTrip(project)).toEqual(project)
  })

  it('writes the Frame\'s beads inside the Frame, and the Canvas\'s beside it', () => {
    const encoded = encodeProject(withFields(paint(makeProject(2, 1), () => '#ff0000'), { beads: { 5: { 5: '#00ff00' } } }))

    expect(encoded.layers[0]!.encodedBeads).toEqual({ colors: ['#00ff00'], rows: { 5: '5:1' } })
    expect(encoded.layers[1]).toMatchObject({ technique: 'loom', row: 0, column: 0, rows: 1, columns: 2, encodedBeads: { colors: ['#ff0000'], rows: { 0: '0:1x2' } } })
    expect(encoded.layers[1]).not.toHaveProperty('beads')
  })

  it('still reads the grid-shaped cells an earlier build stored, as beads in a Frame the size of the grid', () => {
    const { beads: _beads, frame: _frame, ...base } = flatOf(makeProject(3, 2))
    const stored = { ...base, columns: 3, rows: 2, cells: { colors: ['#ff0000', '#00ff00'], runs: '1,0x3,2,0' } }

    const read = normalizeProject(decodeEarlierProject(stored))

    expect(sheetOf(read)).toEqual({ technique: 'loom', row: 0, column: 0, columns: 3, rows: 2, beads: { 0: { 0: '#ff0000' }, 1: { 1: '#00ff00' } } })
    expect(beadsOfLayer(read, 'canvas')).toEqual({})
  })

  it('still reads what version 3 stored: the beads inside the Frame move into it, the covered ones become Canvas beads', () => {
    const { beads: _beads, frame: _frame, ...base } = flatOf(makeProject(2, 2))
    const stored = {
      ...base,
      frame: { row: 10, column: 10, rows: 2, columns: 2 },
      encodedBeads: { colors: ['#ff0000', '#00ff00'], rows: { 10: '10:1,0,2', 40: '40:2' } },
      encodedCoveredBeads: { colors: ['#0000ff'], rows: { 11: '11:1' } },
    }

    const read = normalizeProject(decodeEarlierProject(stored))

    expect(sheetOf(read)).toEqual({ technique: 'loom', row: 10, column: 10, rows: 2, columns: 2, beads: { 0: { 0: '#ff0000' } } })
    expect(beadsOfLayer(read, 'canvas')).toEqual({ 10: { 12: '#00ff00' }, 11: { 11: '#0000ff' }, 40: { 40: '#00ff00' } })
    expect(read).not.toHaveProperty('coveredBeads')
  })
})
