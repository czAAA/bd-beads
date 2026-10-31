import { describe, expect, it } from 'vitest'
import { beadsFromColors, withColors } from './canvas'
import { numericKey, piecesInSteps, piecesOf } from './pieces'

const R = '#e63746'
const place = (...at: [number, number][]) => withColors({}, at.map(([row, column]) => ({ row, column, color: R })))

describe('pieces', () => {
  it('is empty for an empty canvas', () => {
    expect(piecesOf({}, { technique: 'loom' })).toEqual([])
  })

  it('joins beads that touch by a side or, on loom, a corner', () => {
    const beads = place([0, 0], [0, 1], [1, 2], [5, 5])

    expect(piecesOf(beads, { technique: 'loom' })).toEqual([
      { row: 0, column: 0, rows: 2, columns: 3, beads: 3 },
      { row: 5, column: 5, rows: 1, columns: 1, beads: 1 },
    ])
  })

  it('keeps beads apart that only share an empty gap', () => {
    expect(piecesOf(place([0, 0], [0, 2]), { technique: 'loom' })).toHaveLength(2)
    expect(piecesOf(place([0, 0], [2, 0]), { technique: 'loom' })).toHaveLength(2)
  })

  it('knows which beads touch on brick stitch, where a row sits half a bead across', () => {
    // Row 1 is shifted half a bead right, so (1, 0) touches (0, 0) and (0, 1) but not (0, -1).
    expect(piecesOf(place([0, 0], [1, 0]), { technique: 'brick' })).toHaveLength(1)
    expect(piecesOf(place([0, 1], [1, 0]), { technique: 'brick' })).toHaveLength(1)
    expect(piecesOf(place([0, -1], [1, 0]), { technique: 'brick' })).toHaveLength(2)
    // The same two beads on loom touch by a corner: (0, -1) and (1, 0).
    expect(piecesOf(place([0, -1], [1, 0]), { technique: 'loom' })).toHaveLength(1)
  })

  it('knows which beads touch on peyote, where a column sits half a bead down (ticket 0734)', () => {
    // Column 1 is shifted half a bead down, so (0, 1) touches (0, 0) and (-1, 0) but not (1, 0).
    expect(piecesOf(place([0, 0], [0, 1]), { technique: 'peyote' })).toHaveLength(1)
    expect(piecesOf(place([-1, 1], [0, 0]), { technique: 'peyote' })).toHaveLength(1)
    expect(piecesOf(place([1, 1], [0, 0]), { technique: 'peyote' })).toHaveLength(2)
  })

  it('merges two pieces when a bead is painted between them, and splits them when it is erased', () => {
    const apart = place([0, 0], [0, 5])
    const joined = withColors(apart, [1, 2, 3, 4].map((column) => ({ row: 0, column, color: R })))
    expect(piecesOf(apart, { technique: 'loom' })).toHaveLength(2)
    expect(piecesOf(joined, { technique: 'loom' })).toHaveLength(1)
    expect(piecesOf(withColors(joined, [2, 3].map((column) => ({ row: 0, column, color: null }))), { technique: 'loom' })).toHaveLength(2)
  })

  it('works at negative positions', () => {
    expect(piecesOf(place([-3, -4], [-2, -3]), { technique: 'loom' })).toEqual([{ row: -3, column: -4, rows: 2, columns: 2, beads: 2 }])
  })

  it('gives the same array back for the same beads, so a repaint that changes nothing costs nothing', () => {
    const beads = beadsFromColors([[R, R], [null, R]])
    expect(piecesOf(beads, { technique: 'loom' })).toBe(piecesOf(beads, { technique: 'loom' }))
  })
})

describe('pieces with a Drop (ticket 477)', () => {
  const block2 = { technique: 'brick' as const, techniqueSettings: { brickDrop: 2 } }

  it('joins straight rows by the bead above only, and shifted rows by the two they overlap', () => {
    expect(piecesOf(place([0, 0], [1, 1]), block2)).toHaveLength(2)
    expect(piecesOf(place([0, 0], [1, 0]), block2)).toHaveLength(1)
    expect(piecesOf(place([1, 0], [2, 0]), block2)).toHaveLength(1)
    expect(piecesOf(place([1, 0], [2, 1]), block2)).toHaveLength(2)
  })

  it('does not hand back a cached answer made for another Drop', () => {
    const beads = place([1, 0], [2, 1])
    expect(piecesOf(beads, { technique: 'brick' })).toHaveLength(1)
    expect(piecesOf(beads, block2)).toHaveLength(2)
  })
})

describe('the Pieces walked a step at a time (ticket 0716)', () => {
  /** Two solid blocks 60,000 beads in all, apart, and a name on the second. */
  function twoBlocks() {
    const beads: Record<number, Record<number, string>> = {}
    for (let row = 0; row < 200; row += 1) {
      beads[row] = {}
      for (let column = 0; column < 150; column += 1) beads[row]![column] = R
      for (let column = 200; column < 350; column += 1) beads[row]![column] = R
    }
    return beads
  }

  it('stops more than once on a big layer and ends with what a walk at once finds, and the Piece each anchor is on', () => {
    const beads = twoBlocks()
    const walk = piecesInSteps(beads, { technique: 'loom' }, [{ row: 5, column: 210 }, { row: 5, column: 160 }])
    let stops = 0
    let step = walk.next()
    while (!step.done) {
      stops += 1
      step = walk.next()
    }

    expect(stops).toBeGreaterThan(2)
    expect(step.value.pieces).toEqual([
      { row: 0, column: 0, rows: 200, columns: 150, beads: 30_000 },
      { row: 0, column: 200, rows: 200, columns: 150, beads: 30_000 },
    ])
    expect(step.value.anchored.get(numericKey({ row: 5, column: 210 }))).toBe(step.value.pieces[1])
    expect(step.value.anchored.has(numericKey({ row: 5, column: 160 }))).toBe(false)
    expect(piecesOf(beads, { technique: 'loom' })).toBe(step.value.pieces)
  })
})
