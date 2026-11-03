import { describe, expect, it } from 'vitest'
import { NO_COLOR } from './imageConversion'
import { backgroundShare, findBackground, withoutBackground } from './convertBackground'

const pack = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b
const WALL = pack(230, 220, 200)
const SHADE = pack(214, 204, 186)
const RED = pack(200, 30, 40)

/** A grid of colors from rows of letters: w the wall, s its shade, r the subject, . nothing (a transparent pixel). */
function grid(...rows: string[]) {
  const by: Record<string, number> = { w: WALL, s: SHADE, r: RED, '.': NO_COLOR }
  return { colors: Int32Array.from(rows.join('').split('').map((letter) => by[letter]!)), columns: rows[0]!.length, rows: rows.length }
}
const found = (mask: Uint8Array, columns: number) =>
  Array.from({ length: mask.length / columns }, (_row, row) => Array.from(mask.slice(row * columns, (row + 1) * columns)).map((on) => (on ? 'x' : '-')).join(''))

describe('findBackground', () => {
  it('takes the edge’s color inward, as far as it joins up with the edge, and leaves the subject', () => {
    const at = grid('wwwww', 'wrrrw', 'wrwrw', 'wrrrw', 'wwwww')
    // The wall inside the ring of red does not join up with the edge, so it stays.
    expect(found(findBackground({ ...at, tolerance: 0 }), at.columns)).toEqual(['xxxxx', 'x---x', 'x---x', 'x---x', 'xxxxx'])
  })

  it('takes only the edge’s own colors at no tolerance, and those close to them as it widens', () => {
    const at = grid('wwwww', 'wsssw', 'wsrsw', 'wsssw', 'wwwww')
    expect(found(findBackground({ ...at, tolerance: 0 }), at.columns)).toEqual(['xxxxx', 'x---x', 'x---x', 'x---x', 'xxxxx'])
    expect(found(findBackground({ ...at, tolerance: 30 }), at.columns)).toEqual(['xxxxx', 'xxxxx', 'xx-xx', 'xxxxx', 'xxxxx'])
  })

  it('goes through the picture’s transparent places without counting them', () => {
    const at = grid('w.w', '.r.', 'w.w')
    expect(found(findBackground({ ...at, tolerance: 0 }), at.columns)).toEqual(['x-x', '---', 'x-x'])
  })

  it('finds nothing in a picture with no colors', () => {
    const at = grid('..', '..')
    expect(found(findBackground({ ...at, tolerance: 10 }), at.columns)).toEqual(['--', '--'])
  })
})

describe('backgroundShare and withoutBackground', () => {
  it('gives the share of the picture’s beads found, in whole percent, and leaves them out as no color', () => {
    const at = grid('ww..', 'wrrw', 'wwww')
    const mask = findBackground({ ...at, tolerance: 0 })
    expect(backgroundShare(at.colors, mask)).toEqual({ beads: 8, percent: 80 })
    expect(Array.from(withoutBackground(at.colors, mask).slice(4, 8))).toEqual([NO_COLOR, RED, RED, NO_COLOR])
  })
})
