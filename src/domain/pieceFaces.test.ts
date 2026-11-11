import { describe, expect, it } from 'vitest'
import { findBead } from './beads'
import { FRAME_SHAPE_IDS } from './frameShape'
import { frameLayoutOf } from './frameShape'
import { backBeadsAt, pieceFaceOf, wholePieceBeads } from './pieceFaces'
import { STARTER_BEAD_ID, starterBeadCount, starterById } from './starters'

const delica = findBead(STARTER_BEAD_ID)!
const faceBeads = (partSize: number) => starterBeadCount(starterById('kaleidocycle'), { sizes: { partSize }, useDesign: false }, delica)

describe('a Frame that is one face of a piece (ticket 0876)', () => {
  it('is a Kaleidocycle: one face of four, six of its 24 triangles', () => {
    expect(pieceFaceOf('kaleidocycle')).toEqual({ faces: 4, parts: 6, total: 24 })
  })

  it('is no other shape, and no Frame without one', () => {
    expect(FRAME_SHAPE_IDS.filter((shape) => pieceFaceOf(shape))).toEqual(['kaleidocycle'])
    expect(pieceFaceOf(undefined)).toBeUndefined()
  })

  it('counts a face and the whole piece at the usual Part sizes, triangles only', () => {
    const face = pieceFaceOf('kaleidocycle')!
    const counts = [3, 5, 9, 10, 11, 13].map((size) => [size, faceBeads(size), wholePieceBeads(face, faceBeads(size))])
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

describe('a Frame whose back mirrors its face (ticket 0875)', () => {
  const star = (partSize: number) => starterBeadCount(starterById('star'), { sizes: { partSize }, useDesign: false }, delica)

  it('counts a whole Star, front and back: every face bead twice, the five tips once', () => {
    expect([3, 5, 10].map(star)).toEqual([85, 245, 995])
  })

  it('takes a Star\'s tip as one bead on both sides and every other bead as two, and no other shape\'s at all', () => {
    const layout = frameLayoutOf({ shape: 'star', settings: { partSize: 5 } })!
    const counted = backBeadsAt(layout)!
    expect(layout.positions.filter((position) => counted(position) === 1).map(({ row, column }) => `${row}:${column}`)).toEqual(['4:4', '4:14', '4:24', '4:34', '4:44'])
    expect(FRAME_SHAPE_IDS.filter((shape) => backBeadsAt(frameLayoutOf({ shape })))).toEqual(['star'])
  })
})
