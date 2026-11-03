import { describe, expect, it } from 'vitest'
import { NO_COLOR } from './imageConversion'
import { backgroundShare, findBackground, foundRuns, withoutBackground, type BackgroundMark } from './convertBackground'

const pack = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b
const WALL = pack(230, 220, 200)
/** The wall in shade: 5 hundredths of OKLab from the wall. */
const SHADE = pack(214, 204, 186)
const RED = pack(200, 30, 40)
const ORANGE = pack(230, 140, 60)
/** The cat's darker fur: 9 hundredths from ORANGE. */
const DARK_ORANGE = pack(200, 110, 40)
const GREY = pack(128, 128, 128)

/** A grid of colors from rows of letters: w the wall, s its shade, r the subject, o and d a cat's two oranges, g grey
 * concrete, . nothing (a transparent pixel). */
function grid(...rows: string[]) {
  const by: Record<string, number> = { w: WALL, s: SHADE, r: RED, o: ORANGE, d: DARK_ORANGE, g: GREY, '.': NO_COLOR }
  return { colors: Int32Array.from(rows.join('').split('').map((letter) => by[letter]!)), columns: rows[0]!.length, rows: rows.length }
}
const found = (mask: Uint8Array, columns: number) =>
  Array.from({ length: mask.length / columns }, (_row, row) => Array.from(mask.slice(row * columns, (row + 1) * columns)).map((on) => (on ? 'x' : '-')).join(''))

describe('findBackground', () => {
  it('takes the edge’s color inward, as far as it joins up with the edge, and leaves the subject', () => {
    const at = grid('wwwww', 'wrrrw', 'wrwrw', 'wrrrw', 'wwwww')
    // The wall inside the ring of red does not join up with the edge, so it stays.
    expect(found(findBackground({ ...at, tolerance: 2 }), at.columns)).toEqual(['xxxxx', 'x---x', 'x---x', 'x---x', 'xxxxx'])
  })

  it('takes only colors close to the edge’s at a small Tolerance, and the shade as it widens', () => {
    const at = grid('wwwww', 'wsssw', 'wsrsw', 'wsssw', 'wwwww')
    expect(found(findBackground({ ...at, tolerance: 2 }), at.columns)).toEqual(['xxxxx', 'x---x', 'x---x', 'x---x', 'xxxxx'])
    expect(found(findBackground({ ...at, tolerance: 10 }), at.columns)).toEqual(['xxxxx', 'xxxxx', 'xx-xx', 'xxxxx', 'xxxxx'])
  })

  it('leaves a subject touching the edge in a few beads: its color is no background family', () => {
    // Red touches the bottom edge in 1 of 24 border beads, under the 2% a family needs.
    const at = grid('wwwwwww', 'wwwwwww', 'wwrrrww', 'wwrrrww', 'wwrrrww', 'wwrrrww', 'wwwrwww')
    expect(found(findBackground({ ...at, tolerance: 10 }), at.columns)).toEqual(['xxxxxxx', 'xxxxxxx', 'xx---xx', 'xx---xx', 'xx---xx', 'xx---xx', 'xxx-xxx'])
  })

  it('leaves a close-up subject that fills the edge: a color more in the middle than on the border is the subject', () => {
    // The cat's orange is 8 of 24 border beads (33%) and all of the middle third: the subject, not the concrete.
    const at = grid('ggggggg', 'ggggggg', 'ggooogg', 'ggooogg', 'ggooogg', 'gooooog', 'gooooog')
    expect(found(findBackground({ ...at, tolerance: 10 }), at.columns)).toEqual(['xxxxxxx', 'xxxxxxx', 'xx---xx', 'xx---xx', 'xx---xx', 'x-----x', 'x-----x'])
  })

  it('goes through the picture’s transparent places without counting them', () => {
    const at = grid('w.w', '.r.', 'w.w')
    expect(found(findBackground({ ...at, tolerance: 2 }), at.columns)).toEqual(['x-x', '---', 'x-x'])
  })

  it('finds nothing in a picture with no colors, or none at all', () => {
    const at = grid('..', '..')
    expect(found(findBackground({ ...at, tolerance: 10 }), at.columns)).toEqual(['--', '--'])
    expect(findBackground({ colors: new Int32Array(0), columns: 0, rows: 0, tolerance: 10 })).toHaveLength(0)
  })
})

describe('findBackground with the Background tool’s marks', () => {
  // A wall with the cat's orange along the bottom edge, found with the wall.
  const at = grid('wwwwww', 'wwwwww', 'wwrrww', 'wwrrww', 'woooow', 'woooow')
  const index = (row: number, column: number) => row * at.columns + column

  it('is found as before with no marks', () => {
    expect(found(findBackground({ ...at, tolerance: 10 }), at.columns)).toEqual(['xxxxxx', 'xxxxxx', 'xx--xx', 'xx--xx', 'xxxxxx', 'xxxxxx'])
  })

  it('keeps the patch under a keep mark: the found beads joined to it within Tolerance of its color', () => {
    const marks: BackgroundMark[] = [{ kind: 'keep', beads: [index(4, 2)] }]
    expect(found(findBackground({ ...at, tolerance: 10 }, marks), at.columns)).toEqual(['xxxxxx', 'xxxxxx', 'xx--xx', 'xx--xx', 'x----x', 'x----x'])
  })

  it('makes the patch under a remove mark background, and a later mark over it wins', () => {
    const remove: BackgroundMark = { kind: 'remove', beads: [index(2, 2)] }
    expect(found(findBackground({ ...at, tolerance: 10 }, [remove]), at.columns)).toEqual(['xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx'])
    const keepAgain: BackgroundMark = { kind: 'keep', beads: [index(3, 3)] }
    expect(found(findBackground({ ...at, tolerance: 10 }, [remove, keepAgain]), at.columns)).toEqual(['xxxxxx', 'xxxxxx', 'xx--xx', 'xx--xx', 'xxxxxx', 'xxxxxx'])
  })

  it('takes a drag’s beads one by one, each in the mark’s own sense, and leaves a bead not in that state', () => {
    // A keep drag from the red (already kept, so passed over) across the cat: the cat's patch is kept once.
    const drag: BackgroundMark = { kind: 'keep', beads: [index(2, 2), index(4, 1), index(4, 4)] }
    expect(found(findBackground({ ...at, tolerance: 10 }, [drag]), at.columns)).toEqual(['xxxxxx', 'xxxxxx', 'xx--xx', 'xx--xx', 'x----x', 'x----x'])
    // The same drag the other way round removes nothing: it began on a kept bead, and the rest is already found.
    const removeDrag: BackgroundMark = { kind: 'remove', beads: [index(1, 1), index(4, 1)] }
    expect(found(findBackground({ ...at, tolerance: 10 }, [removeDrag]), at.columns)).toEqual(['xxxxxx', 'xxxxxx', 'xx--xx', 'xx--xx', 'xxxxxx', 'xxxxxx'])
  })

  it('stops a patch at twice the Tolerance: the darker fur (9 hundredths off) is its own patch at 2, one patch at 5', () => {
    const fur = grid('wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'wooddww', 'wooddww')
    const mark: BackgroundMark = { kind: 'keep', beads: [fur.columns * 5 + 1] }
    expect(found(findBackground({ ...fur, tolerance: 2 }, [mark]), fur.columns)).toEqual(['xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'x--xxxx', 'x--xxxx'])
    expect(found(findBackground({ ...fur, tolerance: 5 }, [mark]), fur.columns)).toEqual(['xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', 'x----xx', 'x----xx'])
  })

  it('ignores a mark on a place with no color or off the block', () => {
    const holed = grid('ww.', 'wrw', 'www')
    const marks: BackgroundMark[] = [{ kind: 'keep', beads: [2, 99] }]
    expect(found(findBackground({ ...holed, tolerance: 10 }, marks), holed.columns)).toEqual(['xx-', 'x-x', 'xxx'])
  })
})

describe('backgroundShare and withoutBackground', () => {
  it('gives the share of the picture’s beads found, in whole percent, and leaves them out as no color', () => {
    const at = grid('ww..', 'wrrw', 'wwww')
    const mask = findBackground({ ...at, tolerance: 2 })
    expect(backgroundShare(at.colors, mask)).toEqual({ beads: 8, percent: 80 })
    expect(Array.from(withoutBackground(at.colors, mask).slice(4, 8))).toEqual([NO_COLOR, RED, RED, NO_COLOR])
  })
})

describe('foundRuns', () => {
  const mask = (...rows: string[]) => ({ found: Uint8Array.from(rows.join('').split('').map((on) => (on === 'x' ? 1 : 0))), columns: rows[0]!.length, rows: rows.length })

  it('joins a row’s neighbouring found beads into one run, row by row', () => {
    expect(foundRuns(mask('xxxxx', 'x---x', 'xx-xx', '-----'))).toEqual([
      { row: 0, column: 0, columns: 5 },
      { row: 1, column: 0, columns: 1 },
      { row: 1, column: 4, columns: 1 },
      { row: 2, column: 0, columns: 2 },
      { row: 2, column: 3, columns: 2 },
    ])
  })

  it('gives one run for one stretch of found beads inside a row', () => {
    expect(foundRuns(mask('-xxx-'))).toEqual([{ row: 0, column: 1, columns: 3 }])
  })

  it('gives no run where nothing is found', () => {
    expect(foundRuns(mask('---', '---'))).toEqual([])
    expect(foundRuns({ found: new Uint8Array(0), columns: 0, rows: 0 })).toEqual([])
  })
})
