import { describe, expect, it } from 'vitest'
import type { Rotation, Technique } from '../domain/grid'
import { beadAt, beadAtOpen, cellAtOpen } from './hitTest'

const project = (technique: Technique, columns: number, rows: number, rotation: Rotation = 0) => ({ technique, columns, rows, rotation })

describe('beadAt on loom', () => {
  const loom = project('loom', 4, 3)

  it('finds the bead under a point, bead by bead', () => {
    expect(beadAt(loom, { x: 10, y: 10 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(loom, { x: 50, y: 10 }, 1)).toEqual({ row: 0, column: 2 })
    expect(beadAt(loom, { x: 70, y: 50 }, 1)).toEqual({ row: 2, column: 3 })
  })

  it('takes a bead\'s top and left edges as on it and its bottom and right edges as the next one\'s', () => {
    expect(beadAt(loom, { x: 20, y: 0 }, 1)).toEqual({ row: 0, column: 1 })
    expect(beadAt(loom, { x: 19.99, y: 19.99 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(loom, { x: 0, y: 20 }, 1)).toEqual({ row: 1, column: 0 })
  })

  it('is on no bead outside the Project', () => {
    expect(beadAt(loom, { x: -1, y: 10 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: 10, y: -1 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: 80, y: 10 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: 10, y: 60 }, 1)).toBeUndefined()
  })

  it('follows the zoom: the same bead however big it is on screen', () => {
    expect(beadAt(loom, { x: 25, y: 15 }, 0.5)).toEqual({ row: 1, column: 2 })
    expect(beadAt(loom, { x: 100, y: 100 }, 2)).toEqual({ row: 2, column: 2 })
    expect(beadAt(loom, { x: 190, y: 150 }, 3)).toEqual({ row: 2, column: 3 })
  })
})

describe('beadAt on peyote', () => {
  const peyote = project('peyote', 3, 4)

  it('finds the beads of a shifted row half a bead across, and nothing in the gap beside it', () => {
    expect(beadAt(peyote, { x: 15, y: 25 }, 1)).toEqual({ row: 1, column: 0 })
    // Row 1 starts 10px in: to its left there is no bead.
    expect(beadAt(peyote, { x: 5, y: 25 }, 1)).toBeUndefined()
    // ...and it ends 10px short of the Project's width.
    expect(beadAt(peyote, { x: 75, y: 25 }, 1)).toBeUndefined()
    expect(beadAt(peyote, { x: 65, y: 25 }, 1)).toEqual({ row: 1, column: 2 })
  })

  it('packs rows 15px apart: each row\'s beads start a row-pitch below the last', () => {
    expect(beadAt(peyote, { x: 10, y: 5 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(peyote, { x: 10, y: 40 }, 1)).toEqual({ row: 2, column: 0 })
    expect(beadAt(peyote, { x: 25, y: 55 }, 1)).toEqual({ row: 3, column: 0 })
  })

  it('gives the overlap of two nested rows to the one drawn later', () => {
    // 17px down is the bottom of row 0 and the top of row 1; the shifted row 1 is drawn over row 0.
    expect(beadAt(peyote, { x: 40, y: 17 }, 1)).toEqual({ row: 1, column: 1 })
  })

  it('lets the row underneath show through a later row\'s rounded corner', () => {
    // The very corner of row 1's bead at (30, 15) is cut away: the point is row 0's, under it.
    expect(beadAt(peyote, { x: 30.5, y: 15.5 }, 1)).toEqual({ row: 0, column: 1 })
    // The same bead a few px in from that corner is its own.
    expect(beadAt(peyote, { x: 34, y: 19 }, 1)).toEqual({ row: 1, column: 1 })
  })

  it('cuts all four corners of a bead, and only the corners', () => {
    // Row 0, column 1 spans x 20..40, y 0..20, with nothing over or beside it that would answer instead.
    const wide = project('peyote', 3, 1)
    expect(beadAt(wide, { x: 20.5, y: 0.5 }, 1)).toBeUndefined()
    expect(beadAt(wide, { x: 39.5, y: 0.5 }, 1)).toBeUndefined()
    expect(beadAt(wide, { x: 20.5, y: 19.5 }, 1)).toBeUndefined()
    expect(beadAt(wide, { x: 39.5, y: 19.5 }, 1)).toBeUndefined()
    expect(beadAt(wide, { x: 30, y: 0.5 }, 1)).toEqual({ row: 0, column: 1 })
    expect(beadAt(wide, { x: 20.5, y: 10 }, 1)).toEqual({ row: 0, column: 1 })
  })

  it('reaches to the edge of the rounding: a point just inside the corner arc is on the bead', () => {
    const wide = project('peyote', 1, 1)
    // The arc's centre is (4.4, 4.4) with radius 4.4 (22% of the bead): (1.3, 1.3) is 4.38 from the centre, (1.2, 1.2) 4.53.
    expect(beadAt(wide, { x: 1.3, y: 1.3 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(wide, { x: 1.2, y: 1.2 }, 1)).toBeUndefined()
  })
})

describe('beadAt on brick stitch', () => {
  const brick = project('brick', 3, 3)

  it('is a bead row 21px apart: the seam between two rows is on no bead', () => {
    expect(beadAt(brick, { x: 15, y: 19.9 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(brick, { x: 15, y: 20.5 }, 1)).toBeUndefined()
    expect(beadAt(brick, { x: 15, y: 21 }, 1)).toEqual({ row: 1, column: 0 })
    expect(beadAt(brick, { x: 15, y: 42 }, 1)).toEqual({ row: 2, column: 0 })
  })

  it('staggers every other row half a bead, and rounds no corners', () => {
    expect(beadAt(brick, { x: 5, y: 25 }, 1)).toBeUndefined()
    expect(beadAt(brick, { x: 10.5, y: 21.5 }, 1)).toEqual({ row: 1, column: 0 })
    expect(beadAt(brick, { x: 0.5, y: 0.5 }, 1)).toEqual({ row: 0, column: 0 })
  })
})

describe('beadAt when the Project is rotated a quarter clockwise (90°)', () => {
  it('turns a quarter clockwise: the grid\'s top-left bead is at the displayed top-right', () => {
    const loom = project('loom', 4, 3, 90)

    // Displayed 60 wide (the rows) and 80 tall (the columns).
    expect(beadAt(loom, { x: 50, y: 10 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(loom, { x: 50, y: 70 }, 1)).toEqual({ row: 0, column: 3 })
    expect(beadAt(loom, { x: 10, y: 10 }, 1)).toEqual({ row: 2, column: 0 })
    expect(beadAt(loom, { x: 5, y: 70 }, 1)).toEqual({ row: 2, column: 3 })
  })

  it('takes the zoom into account as well', () => {
    const loom = project('loom', 4, 3, 90)

    expect(beadAt(loom, { x: 100, y: 20 }, 2)).toEqual({ row: 0, column: 0 })
    expect(beadAt(loom, { x: 10, y: 140 }, 2)).toEqual({ row: 2, column: 3 })
  })

  it('keeps peyote\'s shift and packing: they belong to the Project, not to the screen', () => {
    const peyote = project('peyote', 3, 4, 90)

    // Unrotated, (15, 25) is row 1 column 0. Turned, that grid point is (height − y, x) = (65 − 25, 15).
    expect(beadAt(peyote, { x: 40, y: 15 }, 1)).toEqual({ row: 1, column: 0 })
    // And the gap beside the shifted row is a gap turned too.
    expect(beadAt(peyote, { x: 40, y: 5 }, 1)).toBeUndefined()
  })

  it('is on no bead outside the turned Project', () => {
    const loom = project('loom', 4, 3, 90)

    expect(beadAt(loom, { x: 60.5, y: 10 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: 10, y: 80 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: -1, y: 10 }, 1)).toBeUndefined()
  })
})

describe('beadAt when the Project is upside down (180°, ticket 171)', () => {
  it('turns the grid\'s top-left bead to the displayed bottom-right, and the top-right to the bottom-left', () => {
    const loom = project('loom', 4, 3, 180)

    // Still 80 wide, 60 tall: 180° doesn't swap the axes, only reverses both.
    expect(beadAt(loom, { x: 70, y: 50 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(loom, { x: 10, y: 50 }, 1)).toEqual({ row: 0, column: 3 })
  })

  it('is on no bead outside the turned Project', () => {
    const loom = project('loom', 4, 3, 180)

    expect(beadAt(loom, { x: 80.5, y: 10 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: 10, y: -1 }, 1)).toBeUndefined()
  })
})

describe('beadAt when the Project is rotated a quarter counterclockwise (270°, ticket 171)', () => {
  it('turns the grid\'s top-left bead to the displayed bottom-left, and the top-right to the top-left', () => {
    const loom = project('loom', 4, 3, 270)

    // Displayed 60 wide (the rows) and 80 tall (the columns), the other way round from 90°.
    expect(beadAt(loom, { x: 10, y: 70 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(loom, { x: 10, y: 10 }, 1)).toEqual({ row: 0, column: 3 })
    expect(beadAt(loom, { x: 50, y: 70 }, 1)).toEqual({ row: 2, column: 0 })
  })

  it('is on no bead outside the turned Project', () => {
    const loom = project('loom', 4, 3, 270)

    expect(beadAt(loom, { x: -1, y: 10 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: 10, y: 80.5 }, 1)).toBeUndefined()
  })
})

describe('beadAtOpen and cellAtOpen: the open canvas has no edge', () => {
  it('find a bead at negative positions and a long way off', () => {
    expect(beadAtOpen({ technique: 'loom', rotation: 0 }, { x: -30, y: -50 }, 1)).toEqual({ row: -3, column: -2 })
    expect(beadAtOpen({ technique: 'loom', rotation: 0 }, { x: 1_000_010, y: 4_000_010 }, 1)).toEqual({ row: 200_000, column: 50_000 })
  })

  it('work at any zoom and turn', () => {
    expect(beadAtOpen({ technique: 'loom', rotation: 0 }, { x: 70, y: 30 }, 2)).toEqual({ row: 0, column: 1 })
    // Turned a quarter, displayed (x, y) is grid (y, -x): the bead at displayed (-25, 45) is grid (45, 25).
    expect(beadAtOpen({ technique: 'loom', rotation: 90 }, { x: -25, y: 45 }, 1)).toEqual({ row: 1, column: 2 })
  })

  it('cellAtOpen names the nearest bead even between beads, which beadAtOpen leaves out', () => {
    const brick = { technique: 'brick' as const, rotation: 0 as const }
    expect(beadAtOpen(brick, { x: 10, y: 20.5 }, 1)).toBeUndefined()
    expect(cellAtOpen(brick, { x: 10, y: 20.5 }, 1)).toEqual({ row: 1, column: 0 })
  })
})
