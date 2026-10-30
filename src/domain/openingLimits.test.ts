import { describe, expect, it } from 'vitest'
import { knownBeadCount, PIECE_WALK_LIMIT, tooManyToWalk } from './openingLimits'
import { countingBeads } from '../testUtils/countingBeads'

/** `rows` rows of `columns` beads. */
function block(rows: number, columns: number) {
  return Object.fromEntries(Array.from({ length: rows }, (_row, row) => [row, Object.fromEntries(Array.from({ length: columns }, (_cell, column) => [column, '#000']))]))
}

describe('a layer too big to walk (ticket 0716)', () => {
  it('is one past PIECE_WALK_LIMIT beads', () => {
    expect(tooManyToWalk(block(250, 1000))).toBe(false)
    expect(tooManyToWalk({ ...block(250, 1000), 999: { 0: '#000' } })).toBe(true)
  })

  it('is seen without listing the rows past the limit', () => {
    const { beads, reads } = countingBeads(block(500, 1000))

    expect(tooManyToWalk(beads)).toBe(true)
    expect(reads.rows.size).toBe(PIECE_WALK_LIMIT / 1000 + 1)
  })
})

describe('a layer counted again after an edit (ticket 0716)', () => {
  it('is counted from the last by the rows the edit changed', () => {
    const { beads: before, reads, reset } = countingBeads(block(100, 1000))
    expect(tooManyToWalk(before)).toBe(false)
    const after = { ...before, 0: { ...before[0], 1000: '#000' } }
    reset()

    expect(tooManyToWalk(after)).toBe(false)
    expect([...reads.rows]).toEqual([0])
  })

  it('sees an edit take a layer over the limit, and back under it', () => {
    const under = block(250, 1000)
    expect(tooManyToWalk(under)).toBe(false)
    const over = { ...under, 250: { 0: '#000' } }
    expect(tooManyToWalk(over)).toBe(true)
    const { 250: _gone, ...again } = over
    expect(tooManyToWalk(again)).toBe(false)
  })

  it('is counted from a count known on decoding, and from a set counted before another (ticket 0731)', () => {
    const { beads: decoded, reads, reset } = countingBeads(block(250, 1000))
    knownBeadCount(decoded, 250_000)
    expect(tooManyToWalk({ ...decoded, 0: { ...decoded[0], 1000: '#000' } })).toBe(true)
    expect([...reads.rows]).toEqual([0])

    expect(tooManyToWalk(block(10, 10))).toBe(false)
    expect(tooManyToWalk(decoded)).toBe(false)
    reset()
    expect(tooManyToWalk({ ...decoded, 1: { ...decoded[1], 1000: '#000' } })).toBe(true)
    expect([...reads.rows]).toEqual([1])
  })
})
