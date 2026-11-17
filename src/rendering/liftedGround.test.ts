import { describe, expect, it } from 'vitest'
import type { BeadMap } from '../domain/canvas'
import { describeWeave } from '../domain/weave'
import type { Technique } from '../domain/weave'
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

const layerOf = (beads: BeadMap, technique: Technique = 'loom', has: GroundLayer['has'] = () => true, edge = ''): GroundLayer => ({ beads, description: describeWeave({ technique }), has, edge })

/** The lifted positions as a picture over `picture`'s size: `+` lifted. */
function liftedPicture(ground: LiftedGround, layer: GroundLayer, picture: string): string {
  const lifted = ground.update(layer)
  return picture
    .trim()
    .split('\n')
    .map((line, row) => [...line.trim()].map((mark, column) => (lifted.has(row, column) ? '+' : mark)).join(''))
    .join('\n')
}

/** A picture with a ring of empty positions round it, for the rim a bead out. */
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
  const liftedRound = (picture: string, technique: Technique = 'loom') => {
    const round = framed(picture)
    return liftedPicture(new LiftedGround(), layerOf(beadsOf(round), technique), round)
  }

  it('lifts a hole of one bead and a strip one bead wide whole', () => {
    expect(liftedRound(`
      #######
      #.#...#
      #######`)).toBe(lines(`
      +++++++++
      +#######+
      +#+#+++#+
      +#######+
      +++++++++`))
  })

  it('lifts a cut two beads across whole, and one that holds no 2 × 2 block a bead from the beads', () => {
    expect(liftedRound(`
      #####
      #...#
      #...#
      #...#
      #####`)).toBe(lines(`
      +++++++
      +#####+
      +#+++#+
      +#+++#+
      +#+++#+
      +#####+
      +++++++`))
  })

  it('keeps a larger cut open a bead in from its beads', () => {
    expect(liftedRound(`
      ######
      #....#
      #....#
      #....#
      #....#
      ######`)).toBe(lines(`
      ++++++++
      +######+
      +#++++#+
      +#+..+#+
      +#+..+#+
      +#++++#+
      +######+
      ++++++++`))
  })

  it('lifts the rim a bead round the beads outside, and leaves what lies further out alone (ticket 1036)', () => {
    const picture = `
      .......
      .......
      ..##...
      .......
      .......
      .....#.`
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(picture)), picture)).toBe(lines(`
      .......
      .++++..
      .+##+..
      .++++..
      ....+++
      ....+#+`))
  })

  it('gives two pieces two beads apart one ground between them', () => {
    expect(liftedRound(`
      #..#
      #..#`)).toBe(lines(`
      ++++++
      +#++#+
      +#++#+
      ++++++`))
  })

  it('lifts a gap one bead wide that leads out, however long, and keeps the middle of one two beads wide flat (ticket 1050)', () => {
    expect(liftedRound(`
      #...#
      #...#
      #...#
      #...#
      #...#
      #...#`)).toBe(lines(`
      +++++++
      +#+++#+
      +#+++#+
      +#+++#+
      +#+++#+
      +#+++#+
      +#+++#+
      +++++++`))
    expect(liftedRound(`
      #....#
      #....#
      #....#`)).toBe(lines(`
      +++..+++
      +#+..+#+
      +#+..+#+
      +#+..+#+
      +++..+++`))
  })

  it('lifts the positions between rims that hold no 2 × 2 block, closed in by beads or not', () => {
    // Beads three apart leave a cross of positions a bead from every bead, one wide: the owner's screenshot.
    expect(liftedRound(`
      #...#
      .....
      .....
      .....
      #...#`)).toBe(lines(`
      +++++++
      +#+++#+
      +++++++
      +++++++
      +++++++
      +#+++#+
      +++++++`))
  })

  it('lifts a gap three wide that leads out of a cut whole, and keeps the middle of one four wide flat', () => {
    const three = `
      ##...##
      #.....#
      #.....#
      #######`
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(three)), three)).toBe(lines(`
      ##+++##
      #+++++#
      #+++++#
      #######`))
    const four = `
      ##....##
      #......#
      #......#
      #......#
      ########`
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(four)), four)).toBe(lines(`
      ##+..+##
      #++..++#
      #++..++#
      #++++++#
      ########`))
  })

  it("lifts no position off the layer's edge: the rim stops at it", () => {
    const picture = `
      #...#
      #...#
      #...#
      #...#
      #####`
    const has = (row: number, column: number) => row >= 1 && column >= 0 && column < 5 && row < 5
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(picture), 'loom', has, 'from row 1'), picture)).toBe(lines(`
      #...#
      #+++#
      #+++#
      #+++#
      #####`))
  })

  it("counts positions off the layer as open: a spur of the layer's edge one position wide stays flat", () => {
    const picture = `
      .......
      ...#...
      .......
      .......`
    const has = (row: number, column: number) => (row >= 0 && row <= 2 && column >= 0 && column <= 6) || (row === 3 && column === 3)
    expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(picture), 'loom', has, 'a spur at 3,3'), picture)).toBe(lines(`
      ..+++..
      ..+#+..
      ..+++..
      .......`))
  })

  it('lifts by how beads touch in brick stitch and peyote', () => {
    for (const technique of ['brick', 'peyote'] as const) {
      const picture = `
        #####
        ##.##
        #####`
      expect(liftedPicture(new LiftedGround(), layerOf(beadsOf(picture), technique), picture)).toBe(lines(`
        #####
        ##+##
        #####`))
    }
  })

  it('lifts and lowers the positions round a bead set or taken off at once, whether it opens a cut or not', () => {
    // A cut four across keeps its middle 2 × 2 flat; a bead in it lifts the rest, and opening the cut changes nothing.
    const picture = `
      ######
      #....#
      #....#
      #....#
      #....#
      ######`
    const ground = new LiftedGround()
    const closed = beadsOf(picture)
    expect(ground.update(layerOf(closed)).has(3, 3)).toBe(false)
    const filled = withBead(closed, 2, 2, true)
    expect(ground.update(layerOf(filled)).has(3, 3)).toBe(true)
    expect(ground.update(layerOf(withBead(filled, 2, 2, false))).has(3, 3)).toBe(false)
    expect(ground.update(layerOf(withBead(closed, 0, 2, false))).has(3, 3)).toBe(false)
  })

  it('keeps flat only the 2 × 2 blocks a wall of beads leaves, and lowers them again once it is gone', () => {
    const picture = `
      ###########
      #.........#
      #.........#
      #.........#
      #.........#
      ###########`
    const ground = new LiftedGround()
    let beads = beadsOf(picture)
    expect(ground.update(layerOf(beads)).has(2, 4)).toBe(false)
    // A wall down the middle: two cuts of 4 × 4, each still keeping its middle open.
    for (let row = 1; row <= 4; row += 1) beads = withBead(beads, row, 5, true)
    const parted = ground.update(layerOf(beads))
    expect([parted.has(2, 2), parted.has(2, 3), parted.has(2, 7), parted.has(2, 8)]).toEqual([false, false, false, false])
    expect([parted.has(1, 1), parted.has(2, 4), parted.has(2, 6)]).toEqual([true, true, true])
    // A wall at column 3 too: cuts of 2 × 4 and 1 × 4 beside it, each lifted whole.
    for (let row = 1; row <= 4; row += 1) beads = withBead(beads, row, 3, true)
    expect(ground.update(layerOf(beads)).rows.get(2)).toEqual([-1, 1, 2, 4, 6, 9, 11])
    // The walls taken off again: one cut, its middle open.
    for (let row = 1; row <= 4; row += 1) beads = withBead(withBead(beads, row, 3, false), row, 5, false)
    expect(ground.update(layerOf(beads)).rows.get(2)).toEqual([-1, 1, 9, 11])
  })

  it.each(['loom', 'brick', 'peyote'] as const)('works out the same lifted positions from the edits as from scratch in %s', (technique) => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const ground = new LiftedGround()
    let beads: BeadMap = {}
    for (let step = 0; step < 1500; step += 1) {
      const [row, column] = [Math.floor(random() * 12), Math.floor(random() * 12)]
      beads = withBead(beads, row, column, random() < 0.62)
      const kept = ground.update(layerOf(beads, technique))
      const fresh = new LiftedGround().update(layerOf(beads, technique))
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
