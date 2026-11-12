import { describe, expect, it } from 'vitest'
import { findBead } from './beads'
import { FRAME_SHAPE_IDS, frameLayoutOf } from './frameShape'
import { backBeadsAt, pieceFaceOf, wholePieceOf } from './pieceFaces'
import { STARTER_BEAD_ID, starterBeadCount, starterById } from './starters'

const delica = findBead(STARTER_BEAD_ID)!
const faceBeads = (partSize: number) => starterBeadCount(starterById('kaleidocycle'), { sizes: { partSize }, useDesign: false }, delica)

describe('a Frame that is one face of a piece (ticket 0876)', () => {
  it('is a Kaleidocycle: one face of four, six of its 24 triangles', () => {
    expect(pieceFaceOf('kaleidocycle')).toEqual({ faces: 4, parts: 6, total: 24 })
  })

  it('is no other shape, and no Frame without one', () => {
    expect(FRAME_SHAPE_IDS.filter((shape) => pieceFaceOf(shape))).toEqual(['kaleidocycle'])
    expect(FRAME_SHAPE_IDS.filter((shape) => wholePieceOf({ shape }, 1))).toEqual(['kaleidocycle'])
    expect(pieceFaceOf(undefined)).toBeUndefined()
  })

  it('counts a face and the whole piece\'s triangles at the usual Part sizes', () => {
    const counts = [3, 5, 9, 10, 11, 13].map((size) => [size, faceBeads(size), wholePieceOf({ shape: 'kaleidocycle', settings: { partSize: size } }, faceBeads(size))!.triangles])
    expect(counts).toEqual([
      [3, 108, 432],
      [5, 270, 1080],
      [9, 810, 3240],
      [10, 990, 3960],
      [11, 1188, 4752],
      [13, 1638, 6552],
    ])
  })
})

describe('the beads that join a Kaleidocycle (ticket 0877, the Kali Primer)', () => {
  const whole = (faceBeads: number, partSize: number) => wholePieceOf({ shape: 'kaleidocycle', settings: { partSize } }, faceBeads)!

  it('counts the primer\'s pictures at 9 beads a side: 8 Edge Beads a side, 7 Hinge Beads a half-Hinge row, 3 tips a triangle, 8 Hinge Pins a Hinge', () => {
    const nine = whole(810, 9)
    // 6 Tetras of 6 sides, 6 Strips of two half-Hinge rows, 24 triangles, 6 Hinges (3 Mirror pairs, 3 ring joins).
    expect(nine.joins).toEqual([
      { id: 'edgeBeads', count: 288 },
      { id: 'hingeBeads', count: 84 },
      { id: 'tips', count: 72, size: '15/0' },
      { id: 'hingePins', count: 48, size: '15/0' },
    ])
    // The face's bead: the triangles, the Edge Beads and the Hinge Beads; the 15/0s apart.
    expect(nine.beads).toBe(3240 + 288 + 84)
    expect(nine.small).toBe(120)
  })

  it('grows with the triangles\' side, the tips one a corner whatever the size', () => {
    expect(whole(108, 3).joins.map(({ count }) => count)).toEqual([72, 12, 72, 12])
    expect(whole(1638, 13).joins.map(({ count }) => count)).toEqual([432, 132, 72, 72])
  })
})

describe('a Frame whose back mirrors its face (ticket 0875)', () => {
  const star = (partSize: number) => starterBeadCount(starterById('star'), { sizes: { partSize }, useDesign: false }, delica)

  it('counts a whole Star, front and back: every face bead twice, the five tips once', () => {
    expect([3, 5, 10].map(star)).toEqual([85, 245, 995])
  })

  it('takes a Star\'s tip as one bead on both sides and every other bead as two, and no other shape\'s at all', () => {
    const layout = frameLayoutOf({ shape: 'star', settings: { partSize: 5 } })!
    const counted = backBeadsAt({ shape: 'star', settings: { partSize: 5 } })!
    expect(layout.positions.filter((position) => counted(position) === 1).map(({ row, column }) => `${row}:${column}`)).toEqual(['4:4', '4:14', '4:24', '4:34', '4:44'])
    expect(FRAME_SHAPE_IDS.filter((shape) => backBeadsAt({ shape }))).toEqual(['star'])
  })
})
