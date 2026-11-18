import { describe, expect, it } from 'vitest'
import type { BeadMap } from '../domain/canvas'
import { LiftedGround, type GroundLayer } from './liftedGround'

/** Beads from a picture: `#` a bead, anything else none, row 0 the first line. */
function beadsOf(picture: string): BeadMap {
  const beads: BeadMap = {}
  picture
    .trim()
    .split('\n')
    .forEach((line, row) => {
      ;[...line.trim()].forEach((mark, column) => {
        if (mark !== '#') return
        beads[row] ??= {}
        beads[row]![column] = '#ff0000'
      })
    })
  return beads
}

const layerOf = (beads: BeadMap, has: GroundLayer['has'] = () => true, edge = ''): GroundLayer => ({ beads, has, edge })

/** The lifted positions as a picture over `picture`'s size: `+` lifted. */
function liftedPicture(ground: LiftedGround, layer: GroundLayer, picture: string): string {
  const lifted = ground.update(layer)
  return picture
    .trim()
    .split('\n')
    .map((line, row) => [...line.trim()].map((mark, column) => (lifted.has(row, column) ? '+' : mark)).join(''))
    .join('\n')
}

/** A picture with a ring of empty positions round it, where nothing is lifted. */
const framed = (picture: string) => {
  const rows = lines(picture).split('\n')
  const empty = '.'.repeat(rows[0]!.length + 2)
  return [empty, ...rows.map((line) => `.${line}.`), empty].join('\n')
}

const lines = (picture: string) => picture.trim().split('\n').map((line) => line.trim()).join('\n')

/** Sets or takes off one bead, keeping every other row as it was, as a stroke step does. */
function withBead(beads: BeadMap, row: number, column: number, bead: boolean): BeadMap {
  const stored = { ...beads[row] }
  if (bead) stored[column] = '#00ff00'
  else delete stored[column]
  return { ...beads, [row]: stored }
}

describe('lifted ground', () => {
  /** The lifted positions of `picture` with a ring of empty positions round it. */
  const liftedRound = (picture: string) => {
    const round = framed(picture)
    return liftedPicture(new LiftedGround(), layerOf(beadsOf(round)), round)
  }

  it('lifts a hole of one bead and a strip one bead wide whole, and nothing round the beads outside', () => {
    expect(liftedRound(`
      #######
      #.#...#
      #######`)).toBe(lines(`
      .........
      .#######.
      .#+#+++#.
      .#######.
      .........`))
  })

  it('lifts a cut one bead wide whole, round a corner too', () => {
    expect(liftedRound(`
      #####
      #...#
      #.#.#
      #...#
      #####`)).toBe(lines(`
      .......
      .#####.
      .#+++#.
      .#+#+#.
      .#+++#.
      .#####.
      .......`))
  })

  it('keeps a cut two beads across or more flat, up to its beads', () => {
    for (const cut of [2, 3, 4]) {
      const wall = '#'.repeat(cut + 2)
      const open = `#${'.'.repeat(cut)}#`
      const picture = [wall, ...Array.from({ length: cut }, () => open), wall].join('\n')
      expect(liftedRound(picture)).toBe(framed(picture))
    }
  })

  it('gives two pieces one bead apart one ground between them, and leaves two beads apart flat', () => {
    expect(liftedRound(`
      #.#
      #.#`)).toBe(lines(`
      .....
      .#+#.
      .#+#.
      .....`))
    expect(liftedRound(`
      #..#
      #..#`)).toBe(lines(`
      ......
      .#..#.
      .#..#.
      ......`))
  })

  it('lifts a gap one bead wide that leads out, however long, and keeps one two beads wide flat (ticket 1050)', () => {
    expect(liftedRound(`
      #.#
      #.#
      #.#
      #.#
      #.#
      #.#`)).toBe(lines(`
      .....
      .#+#.
      .#+#.
      .#+#.
      .#+#.
      .#+#.
      .#+#.
      .....`))
    const two = `
      #..#
      #..#
      #..#`
    expect(liftedRound(two)).toBe(framed(two))
  })

  it('lifts every position of a checkered piece that lies between its beads, and none outside them', () => {
    expect(liftedRound(`
      #.#.#
      .....
      #.#.#
      .....
      #.#.#`)).toBe(lines(`
      .......
      .#+#+#.
      .+++++.
      .#+#+#.
      .+++++.
      .#+#+#.
      .......`))
  })

  it('leaves the step of a stair and the corner between two beads that touch by a corner flat', () => {
    const stair = `
      #..
      ##.
      ###`
    expect(liftedRound(stair)).toBe(framed(stair))
    const corners = `
      #.
      .#`
    expect(liftedRound(corners)).toBe(framed(corners))
  })

  it('lifts a gap one wide that leads out of a cut one wide, and keeps one two wide flat', () => {
    const one = `
      ##.##
      #...#
      #####`
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(one)), one)).toBe(lines(`
      ##+##
      #+++#
      #####`))
    const two = `
      ##..##
      #....#
      #....#
      ######`
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(two)), two)).toBe(lines(two))
  })

  it("lifts no position off the layer's edge", () => {
    const picture = `
      #.#
      #.#
      #.#
      ###`
    const has = (row: number, column: number) => row >= 1 && column >= 0 && column < 3 && row < 4
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(picture), has, 'from row 1'), picture)).toBe(lines(`
      #.#
      #+#
      #+#
      ###`))
  })

  it("counts positions off the layer as open: a strip one position wide between the beads and the layer's edge stays flat", () => {
    const picture = `
      #.
      #.
      #.`
    const has = (row: number, column: number) => row >= 0 && row <= 2 && column >= 0 && column <= 1
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(picture), has, 'two columns'), picture)).toBe(lines(picture))
  })

  it('lifts and lowers the positions round a bead set or taken off at once, whether it opens a cut or not', () => {
    // A cut four across lies flat; a bead in it leaves gaps one wide beside it, which opening the cut keeps lifted.
    const picture = `
      ######
      #....#
      #....#
      #....#
      #....#
      ######`
    const ground = new LiftedGround()
    const closed = beadsOf(picture)
    expect(ground.update(layerOf(closed)).has(2, 1)).toBe(false)
    const filled = withBead(closed, 2, 2, true)
    expect(ground.update(layerOf(filled)).has(2, 1)).toBe(true)
    expect(ground.update(layerOf(withBead(filled, 2, 2, false))).has(2, 1)).toBe(false)
    const opened = ground.update(layerOf(withBead(filled, 0, 2, false)))
    expect([opened.has(2, 1), opened.has(1, 2), opened.has(0, 2)]).toEqual([true, true, true])
  })

  it('lifts the strip one wide that walls of beads leave, and lowers it again once they are gone', () => {
    const picture = `
      ###########
      #.........#
      #.........#
      #.........#
      #.........#
      ###########`
    const ground = new LiftedGround()
    let beads = beadsOf(picture)
    expect(ground.update(layerOf(beads)).rows.size).toBe(0)
    // A wall down the middle: two cuts of 4 × 4, both flat.
    for (let row = 1; row <= 4; row += 1) beads = withBead(beads, row, 5, true)
    expect(ground.update(layerOf(beads)).rows.size).toBe(0)
    // A wall at column 3 too: a cut of 2 × 4, flat, and one of 1 × 4 beside it, lifted whole.
    for (let row = 1; row <= 4; row += 1) beads = withBead(beads, row, 3, true)
    expect([...ground.update(layerOf(beads)).rows].sort(([a], [b]) => a - b)).toEqual([[1, [4]], [2, [4]], [3, [4]], [4, [4]]])
    // The walls taken off again: one cut, flat.
    for (let row = 1; row <= 4; row += 1) beads = withBead(withBead(beads, row, 3, false), row, 5, false)
    expect(ground.update(layerOf(beads)).rows.size).toBe(0)
  })

  it('works out the same lifted positions from the edits as from scratch', () => {
    // Positions off the layer, a corner and a spur, count as open space round a gap in both.
    const has: GroundLayer['has'] = (row, column) => !(row < 3 && column > 8) && !(row === 9 && column === 0)
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const ground = new LiftedGround()
    let beads: BeadMap = {}
    for (let step = 0; step < 1500; step += 1) {
      const [row, column] = [Math.floor(random() * 12), Math.floor(random() * 12)]
      beads = withBead(beads, row, column, random() < 0.62)
      const kept = ground.update(layerOf(beads, has, 'corner and spur'))
      const fresh = new LiftedGround().update(layerOf(beads, has, 'corner and spur'))
      expect([...kept.rows].sort(([a], [b]) => a - b)).toEqual([...fresh.rows].sort(([a], [b]) => a - b))
    }
  })

  it('looks only round a stroke, however large the layer', () => {
    const size = 200
    const beads: BeadMap = {}
    for (let row = 0; row < size; row += 1) {
      beads[row] = {}
      for (let column = 0; column < size; column += 1) if (row % 4 === 0 || column % 4 === 0) beads[row]![column] = '#ff0000'
    }
    const ground = new LiftedGround()
    ground.update(layerOf(beads))
    const before = ground.work
    // A stroke filling in a cut's positions, and one beside the layer.
    let stroke = beads
    for (const [row, column] of [[1, 1], [1, 2], [2, 2], [3, 3], [-2, 5], [-2, 6]] as const) stroke = withBead(stroke, row, column, true)
    ground.update(layerOf(stroke))
    expect(ground.work - before).toBeLessThan(400)
  })

  it('finds nothing again while the beads stay the same', () => {
    const picture = `
      ###
      #.#
      ###`
    const ground = new LiftedGround()
    const layer = layerOf(beadsOf(picture))
    ground.update(layer)
    const before = ground.work
    ground.update({ ...layer })
    expect(ground.work).toBe(before)
  })
})
