import { describe, expect, it, vi } from 'vitest'
import { withColors, type BeadMap } from './canvas'
import { pieceAreasOf } from './pieceAreas'
import { piecesOf } from './pieces'
import { countingBeads } from '../testUtils/countingBeads'

const R = '#e63746'
const place = (...at: [number, number][]) => withColors({}, at.map(([row, column]) => ({ row, column, color: R })))

describe('piece areas', () => {
  const ring = (top: number, left: number, size: number): [number, number][] => {
    const at: [number, number][] = []
    for (let i = 0; i < size; i += 1) {
      at.push([top, left + i], [top + size - 1, left + i], [top + i, left], [top + i, left + size - 1])
    }
    return at
  }

  it('is empty for an empty canvas', () => {
    expect(pieceAreasOf({}, { technique: 'loom' })).toEqual([])
  })

  it('draws one area for a big Piece with smaller Pieces inside its rectangle', () => {
    // A hollow 7x7 ring with a plus shape inside that touches nothing.
    const beads = place(...ring(0, 0, 7), [2, 3], [3, 2], [3, 3], [3, 4], [4, 3])
    expect(piecesOf(beads, { technique: 'loom' })).toHaveLength(2)
    expect(pieceAreasOf(beads, { technique: 'loom' })).toEqual([{ row: 0, column: 0, rows: 7, columns: 7 }])
  })

  it('merges transitively when a joined area grows to reach another', () => {
    // An L Piece with two beads inside its rectangle; (3, 5) touches that rectangle by a corner and grows it, then (4, 0) touches the grown one only.
    const beads = place([0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [2, 0], [0, 0], [0, 2], [3, 5], [4, 0])
    expect(pieceAreasOf(beads, { technique: 'loom' })).toEqual([{ row: 0, column: 0, rows: 5, columns: 6 }])
  })

  it('keeps Pieces with two empty beads between them apart', () => {
    const l: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]
    expect(pieceAreasOf(place(...l, [0, 5]), { technique: 'loom' })).toHaveLength(2)
    expect(pieceAreasOf(place(...l, [-3, 3]), { technique: 'loom' })).toHaveLength(2)
  })

  it('joins Pieces with one empty bead between them, by a side or diagonally', () => {
    const l: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]
    expect(pieceAreasOf(place(...l, [0, 4]), { technique: 'loom' })).toEqual([{ row: 0, column: 0, rows: 3, columns: 5 }])
    expect(pieceAreasOf(place(...l, [-2, 4]), { technique: 'loom' })).toEqual([{ row: -2, column: 0, rows: 5, columns: 5 }])
  })

  it('makes one area of beads in a triangle, each one bead from the next', () => {
    const beads = place([0, 0], [0, 2], [2, 1])
    expect(piecesOf(beads, { technique: 'loom' })).toHaveLength(3)
    expect(pieceAreasOf(beads, { technique: 'loom' })).toEqual([{ row: 0, column: 0, rows: 3, columns: 3 }])
  })

  it('joins a Piece whose rectangle touches another by a side or a corner, though no beads touch', () => {
    const l: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]
    expect(pieceAreasOf(place(...l, [0, 3]), { technique: 'loom' })).toEqual([{ row: 0, column: 0, rows: 3, columns: 4 }])
    expect(pieceAreasOf(place(...l, [-1, 3]), { technique: 'loom' })).toEqual([{ row: -1, column: 0, rows: 4, columns: 4 }])
  })

  it('uses the same margin on peyote and brick stitch, the half-bead shift not keeping nearby Pieces apart', () => {
    for (const technique of ['peyote', 'brick'] as const) {
      expect(pieceAreasOf(place([0, -1], [1, 0]), { technique })).toHaveLength(1)
      expect(pieceAreasOf(place([0, 0], [0, 2]), { technique })).toHaveLength(1)
      expect(pieceAreasOf(place([0, 0], [0, 3]), { technique })).toHaveLength(2)
      expect(pieceAreasOf(place([0, 0], [3, 0]), { technique })).toHaveLength(2)
    }
  })

  it('re-forms as beads are painted and erased', () => {
    const apart = place([0, 0], [0, 5])
    const joined = withColors(apart, [1, 2, 3, 4].map((column) => ({ row: 0, column, color: R })))
    expect(pieceAreasOf(apart, { technique: 'loom' })).toHaveLength(2)
    expect(pieceAreasOf(joined, { technique: 'loom' })).toHaveLength(1)
    expect(pieceAreasOf(withColors(joined, [2, 3].map((column) => ({ row: 0, column, color: null }))), { technique: 'loom' })).toHaveLength(2)
  })

  it('keeps Pieces two empty beads apart on peyote apart, whichever is met first (ticket 0731)', () => {
    // The block's ring reaches the lone bead through the row shift; the lone bead's ring doesn't reach the block.
    const block: [number, number][] = [[-3, -3], [-3, -2], [-2, -3], [-2, -2]]
    expect(pieceAreasOf(place(...block, [0, 0]), { technique: 'peyote' })).toHaveLength(2)
  })

  it('gives the same array for the same beads', () => {
    const beads = place([0, 0])
    expect(pieceAreasOf(beads, { technique: 'loom' })).toBe(pieceAreasOf(beads, { technique: 'loom' }))
  })
})

describe('piece areas carried through an edit (ticket 0731)', () => {
  type Weave = Parameters<typeof pieceAreasOf>[1]
  /** A few thousand beads read: a touched 20 × 20 block and its neighbours, against a layer of 250,000. */
  const FEW_READS = 10_000
  const weaves: [string, Weave][] = [
    ['loom', { technique: 'loom' }],
    ['peyote', { technique: 'peyote' }],
    ['brick', { technique: 'brick' }],
  ]
  /** The areas of `beads` from a module that has counted nothing before, so nothing can be carried. */
  const walkedAfresh = async (beads: BeadMap, weave: Weave) => (vi.resetModules(), (await import('./pieceAreas')).pieceAreasOf(beads, weave))
  const set = (beads: BeadMap, at: [number, number][], color: string | null = R) => withColors(beads, at.map(([row, column]) => ({ row, column, color })))

  describe.each(weaves)('on %s', (_, weave) => {
    /** Two blocks a bead too far apart to join, a bead inside the first block's ring, and a lone bead far off. */
    const start = () => {
      const at: [number, number][] = []
      for (let row = 0; row < 5; row += 1) for (const column of [0, 1, 2, 3, 4, 8, 9, 10]) if (row === 0 || row === 4 || column === 0 || column === 4 || column > 4) at.push([row, column])
      return place(...at, [2, 2], [20, 20])
    }

    it('follows a join, a split, a Piece emptied whole, an Undo and a Redo as a fresh walk counts them', async () => {
      const first = start()
      pieceAreasOf(first, weave)
      const joined = set(first, [[2, 5], [2, 6], [2, 7]])
      expect(pieceAreasOf(joined, weave)).toEqual(await walkedAfresh(joined, weave))
      const split = set(joined, [[2, 6]], null)
      expect(pieceAreasOf(split, weave)).toEqual(await walkedAfresh(split, weave))
      const emptied = set(split, [[20, 20], [2, 2]], null)
      expect(pieceAreasOf(emptied, weave)).toEqual(await walkedAfresh(emptied, weave))
      const ringOpened = set(emptied, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [0, 3], [0, 4]], null)
      expect(pieceAreasOf(ringOpened, weave)).toEqual(await walkedAfresh(ringOpened, weave))
      expect(pieceAreasOf(joined, weave)).toEqual(await walkedAfresh(joined, weave))
      expect(pieceAreasOf(split, weave)).toEqual(await walkedAfresh(split, weave))
    })

    it('follows a Paste that empties and paints at once, and a change of color alone', async () => {
      const first = start()
      pieceAreasOf(first, weave)
      const pasted = withColors(first, [
        ...[0, 1, 2, 3, 4].map((row) => ({ row, column: 9, color: null })),
        ...[14, 15, 16].map((column) => ({ row: 18, column, color: R })),
        { row: 19, column: 18, color: R },
      ])
      expect(pieceAreasOf(pasted, weave)).toEqual(await walkedAfresh(pasted, weave))
      const recolored = set(pasted, [[0, 0], [20, 20]], '#000000')
      expect(pieceAreasOf(recolored, weave)).toBe(pieceAreasOf(pasted, weave))
    })

    it('matches a fresh walk after every one of many random edits', async () => {
      let seed = 7
      // The generator's high bits: its low ones repeat within a few draws.
      const random = (below: number) => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31), Math.floor((seed / 2 ** 31) * below))
      let beads: BeadMap = {}
      for (let step = 0; step < 60; step += 1) {
        const count = 1 + random(12)
        const changes = Array.from({ length: count }, () => ({ row: random(16), column: random(16), color: random(3) === 0 ? null : R }))
        beads = withColors(beads, changes)
        expect(pieceAreasOf(beads, weave)).toEqual(await walkedAfresh(beads, weave))
      }
    })
  })

  it('reads on the order of the touched Pieces’ beads for a one-bead edit on a 250,000-bead layer, not the layer', () => {
    // 625 solid 20 × 20 blocks three beads apart.
    const blocks: BeadMap = {}
    for (let row = 0; row < 575; row += 1) {
      if (row % 23 >= 20) continue
      blocks[row] = {}
      for (let column = 0; column < 575; column += 1) if (column % 23 < 20) blocks[row]![column] = R
    }
    const { beads: layer, reads, reset } = countingBeads(blocks)
    const weave: Weave = { technique: 'loom' }
    pieceAreasOf(layer, weave)

    const painted = set(layer, [[100, 20]])
    reset()
    expect(pieceAreasOf(painted, weave)).toHaveLength(625)
    expect(reads.beads).toBeLessThan(FEW_READS)

    const emptied = set(painted, [[30, 30]], null)
    reset()
    expect(pieceAreasOf(emptied, weave)).toHaveLength(625)
    expect(reads.beads).toBeLessThan(FEW_READS)
  })

  it('reads round the emptied beads, not the Piece, when a Piece of 250,000 beads stays whole and its edge moves in', () => {
    const solid: BeadMap = { [-1]: { 250: R } }
    for (let row = 0; row < 500; row += 1) {
      solid[row] = {}
      for (let column = 0; column < 500; column += 1) solid[row]![column] = R
    }
    const { beads: layer, reads, reset } = countingBeads(solid)
    const weave: Weave = { technique: 'loom' }
    pieceAreasOf(layer, weave)

    const holed = set(layer, [[250, 250], [250, 251]], null)
    reset()
    expect(pieceAreasOf(holed, weave)).toEqual([{ row: -1, column: 0, rows: 501, columns: 500 }])
    expect(reads.beads).toBeLessThan(FEW_READS)

    const trimmed = set(holed, [[-1, 250]], null)
    reset()
    expect(pieceAreasOf(trimmed, weave)).toEqual([{ row: 0, column: 0, rows: 500, columns: 500 }])
    expect(reads.beads).toBeLessThan(FEW_READS)
  })
})
