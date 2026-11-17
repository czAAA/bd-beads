import { describe, expect, it } from 'vitest'
import type { BeadMap } from '../domain/canvas'
import { describeWeave } from '../domain/weave'
import type { Technique } from '../domain/weave'
import { InnerCuts, type CutLayer } from './innerCuts'

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

const layerOf = (beads: BeadMap, technique: Technique = 'loom', has: CutLayer['has'] = () => true, edge = ''): CutLayer => ({ beads, description: describeWeave({ technique }), has, edge })

/** The lifted positions as a picture over `picture`'s size: `+` lifted. */
function liftedPicture(cuts: InnerCuts, layer: CutLayer, picture: string): string {
  const lifted = cuts.update(layer)
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

describe('inner cuts', () => {
  /** The lifted positions of `picture` with a ring of empty positions round it. */
  const liftedRound = (picture: string, technique: Technique = 'loom') => {
    const round = framed(picture)
    return liftedPicture(new InnerCuts(), layerOf(beadsOf(round), technique), round)
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
    expect(liftedPicture(new InnerCuts(), layerOf(beadsOf(picture)), picture)).toBe(lines(`
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

  it('leaves a gap joined to the outside unlifted where it lies a bead from every bead', () => {
    // Columns 2 to 4 are three wide, so their middle lies a bead from the beads: closed in at the top it would be lifted.
    const open = `
      ##...##
      #.....#
      #.....#
      #######`
    expect(liftedPicture(new InnerCuts(), layerOf(beadsOf(open)), open)).toBe(lines(`
      ##+.+##
      #++.++#
      #+++++#
      #######`))
    const closed = open.replace('##...##', '#######')
    expect(liftedPicture(new InnerCuts(), layerOf(beadsOf(closed)), closed)).toBe(lines(`
      #######
      #+++++#
      #+++++#
      #######`))
  })

  it('counts a gap corner to corner as leading out', () => {
    const picture = `
      ####..
      #...#.
      #...#.
      #...#.
      #####.`
    expect(liftedPicture(new InnerCuts(), layerOf(beadsOf(picture)), picture)).toBe(lines(`
      ####++
      #+++#+
      #+.+#+
      #+++#+
      #####+`))
  })

  it("counts the layer's edge as outside, and lifts no position off it: the rim stops at the edge", () => {
    const picture = `
      #...#
      #...#
      #...#
      #...#
      #####`
    const has = (row: number, column: number) => row >= 1 && column >= 0 && column < 5 && row < 5
    expect(liftedPicture(new InnerCuts(), layerOf(beadsOf(picture), 'loom', has, 'from row 1'), picture)).toBe(lines(`
      #...#
      #+.+#
      #+.+#
      #+++#
      #####`))
  })

  it('finds cuts by how beads touch in brick stitch and peyote', () => {
    for (const technique of ['brick', 'peyote'] as const) {
      const picture = `
        #####
        ##.##
        #####`
      expect(liftedPicture(new InnerCuts(), layerOf(beadsOf(picture), technique), picture)).toBe(lines(`
        #####
        ##+##
        #####`))
    }
  })

  it('opens a cut at once when an edit joins it to the outside, and closes it again', () => {
    // The middle of a cut three across lies a bead from the beads: lifted only while the cut is closed in.
    const picture = `
      #####
      #...#
      #...#
      #...#
      #####`
    const cuts = new InnerCuts()
    const closed = beadsOf(picture)
    expect(cuts.update(layerOf(closed)).has(2, 2)).toBe(true)
    const opened = withBead(closed, 0, 2, false)
    expect(cuts.update(layerOf(opened)).has(2, 2)).toBe(false)
    expect(cuts.update(layerOf(withBead(opened, 0, 2, true))).has(2, 2)).toBe(true)
  })

  it('parts a cut a bead is set across, and joins two a bead is taken off between', () => {
    const picture = `
      ###########
      #.........#
      #.........#
      #.........#
      #.........#
      ###########`
    const cuts = new InnerCuts()
    let beads = beadsOf(picture)
    expect(cuts.update(layerOf(beads)).has(2, 4)).toBe(false)
    // A wall down the middle: two cuts of 4 × 4, each still keeping its middle open.
    for (let row = 1; row <= 4; row += 1) beads = withBead(beads, row, 5, true)
    const parted = cuts.update(layerOf(beads))
    expect([parted.has(2, 2), parted.has(2, 3), parted.has(2, 7), parted.has(2, 8)]).toEqual([false, false, false, false])
    expect([parted.has(1, 1), parted.has(2, 4), parted.has(2, 6)]).toEqual([true, true, true])
    // A wall at column 3 too: cuts of 2 × 4 and 1 × 4 beside it, each lifted whole.
    for (let row = 1; row <= 4; row += 1) beads = withBead(beads, row, 3, true)
    expect(cuts.update(layerOf(beads)).rows.get(2)).toEqual([-1, 1, 2, 4, 6, 9, 11])
    // The walls taken off again: one cut, its middle open.
    for (let row = 1; row <= 4; row += 1) beads = withBead(withBead(beads, row, 3, false), row, 5, false)
    expect(cuts.update(layerOf(beads)).rows.get(2)).toEqual([-1, 1, 9, 11])
  })

  it.each(['loom', 'brick', 'peyote'] as const)('works out the same cuts from the edits as from scratch in %s', (technique) => {
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const cuts = new InnerCuts()
    let beads: BeadMap = {}
    for (let step = 0; step < 1500; step += 1) {
      const [row, column] = [Math.floor(random() * 12), Math.floor(random() * 12)]
      beads = withBead(beads, row, column, random() < 0.62)
      const kept = cuts.update(layerOf(beads, technique))
      const fresh = new InnerCuts().update(layerOf(beads, technique))
      expect([...kept.rows].sort(([a], [b]) => a - b)).toEqual([...fresh.rows].sort(([a], [b]) => a - b))
    }
  })

  it('looks only round a stroke that closes or opens no cut, however large the layer', () => {
    const size = 200
    const beads: BeadMap = {}
    for (let row = 0; row < size; row += 1) {
      beads[row] = {}
      for (let column = 0; column < size; column += 1) if (row % 4 === 0 || column % 4 === 0) beads[row]![column] = '#ff0000'
    }
    const cuts = new InnerCuts()
    cuts.update(layerOf(beads))
    const before = cuts.work
    // A stroke filling in a cut's positions, and one beside the layer.
    let stroke = beads
    for (const [row, column] of [[1, 1], [1, 2], [2, 2], [3, 3], [-2, 5], [-2, 6]] as const) stroke = withBead(stroke, row, column, true)
    cuts.update(layerOf(stroke))
    expect(cuts.work - before).toBeLessThan(400)
  })

  it('finds nothing again while the beads stay the same', () => {
    const picture = `
      ###
      #.#
      ###`
    const cuts = new InnerCuts()
    const layer = layerOf(beadsOf(picture))
    cuts.update(layer)
    const before = cuts.work
    cuts.update({ ...layer })
    expect(cuts.work).toBe(before)
  })
})
