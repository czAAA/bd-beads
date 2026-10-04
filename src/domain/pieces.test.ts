import { describe, expect, it } from 'vitest'
import { beadsFromColors, withColors } from './canvas'
import { piecesOf } from './pieces'

const R = '#e63746'
const place = (...at: [number, number][]) => withColors({}, at.map(([row, column]) => ({ row, column, color: R })))

describe('pieces', () => {
  it('is empty for an empty canvas', () => {
    expect(piecesOf({}, 'loom')).toEqual([])
  })

  it('joins beads that touch by a side or, on loom, a corner', () => {
    const beads = place([0, 0], [0, 1], [1, 2], [5, 5])

    expect(piecesOf(beads, 'loom')).toEqual([
      { row: 0, column: 0, rows: 2, columns: 3, beads: 3 },
      { row: 5, column: 5, rows: 1, columns: 1, beads: 1 },
    ])
  })

  it('keeps beads apart that only share an empty gap', () => {
    expect(piecesOf(place([0, 0], [0, 2]), 'loom')).toHaveLength(2)
    expect(piecesOf(place([0, 0], [2, 0]), 'loom')).toHaveLength(2)
  })

  it('knows which beads nest on peyote and brick stitch, where a row sits half a bead across', () => {
    // Row 1 is shifted half a bead right, so (1, 0) touches (0, 0) and (0, 1) but not (0, -1).
    expect(piecesOf(place([0, 0], [1, 0]), 'peyote')).toHaveLength(1)
    expect(piecesOf(place([0, 1], [1, 0]), 'peyote')).toHaveLength(1)
    expect(piecesOf(place([0, -1], [1, 0]), 'peyote')).toHaveLength(2)
    // The same two beads on loom touch by a corner: (0, -1) and (1, 0).
    expect(piecesOf(place([0, -1], [1, 0]), 'loom')).toHaveLength(1)
  })

  it('merges two pieces when a bead is painted between them, and splits them when it is erased', () => {
    const apart = place([0, 0], [0, 2])
    const joined = withColors(apart, [{ row: 0, column: 1, color: R }])
    const split = withColors(joined, [{ row: 0, column: 1, color: null }])

    expect(piecesOf(apart, 'loom')).toHaveLength(2)
    expect(piecesOf(joined, 'loom')).toEqual([{ row: 0, column: 0, rows: 1, columns: 3, beads: 3 }])
    expect(piecesOf(split, 'loom')).toHaveLength(2)
  })

  it('works at negative positions', () => {
    expect(piecesOf(place([-3, -4], [-2, -3]), 'loom')).toEqual([{ row: -3, column: -4, rows: 2, columns: 2, beads: 2 }])
  })

  it('gives the same array back for the same beads, so a repaint that changes nothing costs nothing', () => {
    const beads = beadsFromColors([[R, R], [null, R]])
    expect(piecesOf(beads, 'loom')).toBe(piecesOf(beads, 'loom'))
  })
})
