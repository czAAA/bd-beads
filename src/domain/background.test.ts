// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readBackground } from './background'

describe('a stored Background (tickets 0666, 1000)', () => {
  it('reads a position of the list of three as it is, and none outside it', () => {
    expect([1, 2, 3].map((stored) => readBackground(stored))).toEqual([1, 2, 3])
    expect([0, 4, 2.5].map((stored) => readBackground(stored))).toEqual([undefined, undefined, undefined])
  })

  it('moves a position of the earlier list of five to its nearest kept one, and none outside it', () => {
    expect([1, 2, 3, 4, 5].map((stored) => readBackground(stored, true))).toEqual([1, 2, 2, 1, 3])
    expect(readBackground(6, true)).toBeUndefined()
  })

  it('never moves a Custom color', () => {
    expect(readBackground('#336699', true)).toBe('#336699')
    expect(readBackground('#336699')).toBe('#336699')
  })
})
