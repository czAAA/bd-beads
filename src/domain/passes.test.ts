import { describe, expect, it } from 'vitest'
import { lineOfPass, passCount, passOf } from './passes'

/** How many beads each pass weaves on a line of `length` beads, over `lines` lines. */
function passSizes(lines: number, length: number): number[] {
  const sizes = Array.from({ length: passCount('peyote', lines) }, () => 0)
  for (let line = 0; line < lines; line += 1) {
    for (let along = 0; along < length; along += 1) {
      sizes[passOf('peyote', line, along)] += 1
    }
  }
  return sizes
}

describe('peyote passes', () => {
  it('weaves all 7 beads, then 4, 3, 4, 3 ... on an odd line', () => {
    expect(passSizes(3, 7)).toEqual([7, 4, 3, 4, 3])
  })

  it('weaves all 8 beads, then 4 each time on an even line', () => {
    expect(passSizes(3, 8)).toEqual([8, 4, 4, 4, 4])
  })

  it('counts one pass for one line and two more for each further line', () => {
    expect([0, 1, 2, 3].map((lines) => passCount('peyote', lines))).toEqual([0, 1, 3, 5])
  })

  it('puts a pass on the line it belongs to', () => {
    expect([0, 1, 2, 3, 4].map((pass) => lineOfPass('peyote', pass))).toEqual([0, 1, 1, 2, 2])
  })
})

describe('loom and brick stitch passes', () => {
  it.each(['loom', 'brick'] as const)('are one whole line on %s', (technique) => {
    expect(passCount(technique, 5)).toBe(5)
    expect(passOf(technique, 3, 4)).toBe(3)
    expect(lineOfPass(technique, 3)).toBe(3)
  })
})
