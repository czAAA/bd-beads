import { describe, expect, it } from 'vitest'
import { beadsFromColors, withColors } from './canvas'
import { pieceAreasOf, piecesOf } from './pieces'

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
    const apart = place([0, 0], [0, 5])
    const joined = withColors(apart, [1, 2, 3, 4].map((column) => ({ row: 0, column, color: R })))
    expect(pieceAreasOf(apart, 'loom')).toHaveLength(2)
    expect(pieceAreasOf(joined, 'loom')).toHaveLength(1)
    expect(pieceAreasOf(withColors(joined, [2, 3].map((column) => ({ row: 0, column, color: null }))), 'loom')).toHaveLength(2)
  })

  it('works at negative positions', () => {
    expect(piecesOf(place([-3, -4], [-2, -3]), 'loom')).toEqual([{ row: -3, column: -4, rows: 2, columns: 2, beads: 2 }])
  })

  it('gives the same array back for the same beads, so a repaint that changes nothing costs nothing', () => {
    const beads = beadsFromColors([[R, R], [null, R]])
    expect(piecesOf(beads, 'loom')).toBe(piecesOf(beads, 'loom'))
  })
})

describe('piece areas', () => {
  const ring = (top: number, left: number, size: number): [number, number][] => {
    const at: [number, number][] = []
    for (let i = 0; i < size; i += 1) {
      at.push([top, left + i], [top + size - 1, left + i], [top + i, left], [top + i, left + size - 1])
    }
    return at
  }

  it('is empty for an empty canvas', () => {
    expect(pieceAreasOf({}, 'loom')).toEqual([])
  })

  it('draws one area for a big Piece with smaller Pieces inside its rectangle', () => {
    // A hollow 7x7 ring with a plus shape inside that touches nothing.
    const beads = place(...ring(0, 0, 7), [2, 3], [3, 2], [3, 3], [3, 4], [4, 3])
    expect(piecesOf(beads, 'loom')).toHaveLength(2)
    expect(pieceAreasOf(beads, 'loom')).toEqual([{ row: 0, column: 0, rows: 7, columns: 7 }])
  })

  it('merges transitively when a joined area grows to reach another', () => {
    // An L Piece with two beads inside its rectangle; (3, 5) touches that rectangle by a corner and grows it, then (4, 0) touches the grown one only.
    const beads = place([0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [2, 0], [0, 0], [0, 2], [3, 5], [4, 0])
    expect(pieceAreasOf(beads, 'loom')).toEqual([{ row: 0, column: 0, rows: 5, columns: 6 }])
  })

  it('keeps Pieces with two empty beads between them apart', () => {
    const l: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]
    expect(pieceAreasOf(place(...l, [0, 5]), 'loom')).toHaveLength(2)
    expect(pieceAreasOf(place(...l, [-3, 3]), 'loom')).toHaveLength(2)
  })

  it('joins Pieces with one empty bead between them, by a side or diagonally', () => {
    const l: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]
    expect(pieceAreasOf(place(...l, [0, 4]), 'loom')).toEqual([{ row: 0, column: 0, rows: 3, columns: 5 }])
    expect(pieceAreasOf(place(...l, [-2, 4]), 'loom')).toEqual([{ row: -2, column: 0, rows: 5, columns: 5 }])
  })

  it('makes one area of beads in a triangle, each one bead from the next', () => {
    const beads = place([0, 0], [0, 2], [2, 1])
    expect(piecesOf(beads, 'loom')).toHaveLength(3)
    expect(pieceAreasOf(beads, 'loom')).toEqual([{ row: 0, column: 0, rows: 3, columns: 3 }])
  })

  it('joins a Piece whose rectangle touches another by a side or a corner, though no beads touch', () => {
    const l: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]
    expect(pieceAreasOf(place(...l, [0, 3]), 'loom')).toEqual([{ row: 0, column: 0, rows: 3, columns: 4 }])
    expect(pieceAreasOf(place(...l, [-1, 3]), 'loom')).toEqual([{ row: -1, column: 0, rows: 4, columns: 4 }])
  })

  it('uses the same margin on peyote and brick stitch, the half-bead shift not keeping nearby Pieces apart', () => {
    for (const technique of ['peyote', 'brick'] as const) {
      expect(pieceAreasOf(place([0, -1], [1, 0]), technique)).toHaveLength(1)
      expect(pieceAreasOf(place([0, 0], [0, 2]), technique)).toHaveLength(1)
      expect(pieceAreasOf(place([0, 0], [0, 3]), technique)).toHaveLength(2)
      expect(pieceAreasOf(place([0, 0], [3, 0]), technique)).toHaveLength(2)
    }
  })

  it('re-forms as beads are painted and erased', () => {
    const apart = place([0, 0], [0, 5])
    const joined = withColors(apart, [1, 2, 3, 4].map((column) => ({ row: 0, column, color: R })))
    expect(pieceAreasOf(apart, 'loom')).toHaveLength(2)
    expect(pieceAreasOf(joined, 'loom')).toHaveLength(1)
    expect(pieceAreasOf(withColors(joined, [2, 3].map((column) => ({ row: 0, column, color: null }))), 'loom')).toHaveLength(2)
  })

  it('gives the same array for the same beads', () => {
    const beads = place([0, 0])
    expect(pieceAreasOf(beads, 'loom')).toBe(pieceAreasOf(beads, 'loom'))
  })
})
