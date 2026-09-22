import { describe, expect, it } from 'vitest'
import type { Technique } from '../domain/grid'
import { beadAt } from './hitTest'

const pattern = (technique: Technique, columns: number, rows: number, rotated = false) => ({ technique, columns, rows, rotated })

describe('beadAt on loom', () => {
  const loom = pattern('loom', 4, 3)

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

  it('is on no bead outside the Pattern', () => {
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
  const peyote = pattern('peyote', 3, 4)

  it('finds the beads of a shifted row half a bead across, and nothing in the gap beside it', () => {
    expect(beadAt(peyote, { x: 15, y: 25 }, 1)).toEqual({ row: 1, column: 0 })
    // Row 1 starts 10px in: to its left there is no bead.
    expect(beadAt(peyote, { x: 5, y: 25 }, 1)).toBeUndefined()
    // ...and it ends 10px short of the Pattern's width.
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
    const wide = pattern('peyote', 3, 1)
    expect(beadAt(wide, { x: 20.5, y: 0.5 }, 1)).toBeUndefined()
    expect(beadAt(wide, { x: 39.5, y: 0.5 }, 1)).toBeUndefined()
    expect(beadAt(wide, { x: 20.5, y: 19.5 }, 1)).toBeUndefined()
    expect(beadAt(wide, { x: 39.5, y: 19.5 }, 1)).toBeUndefined()
    expect(beadAt(wide, { x: 30, y: 0.5 }, 1)).toEqual({ row: 0, column: 1 })
    expect(beadAt(wide, { x: 20.5, y: 10 }, 1)).toEqual({ row: 0, column: 1 })
  })

  it('reaches to the edge of the rounding: a point just inside the corner arc is on the bead', () => {
    const wide = pattern('peyote', 1, 1)
    // The arc's centre is (6, 6) with radius 6: (1.8, 1.8) is 4.2 from each axis, 5.94 from the centre.
    expect(beadAt(wide, { x: 1.8, y: 1.8 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(wide, { x: 1.7, y: 1.7 }, 1)).toBeUndefined()
  })
})

describe('beadAt on brick stitch', () => {
  const brick = pattern('brick', 3, 3)

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

describe('beadAt when the Pattern is rotated', () => {
  it('turns a quarter clockwise: the grid\'s top-left bead is at the displayed top-right', () => {
    const loom = pattern('loom', 4, 3, true)

    // Displayed 60 wide (the rows) and 80 tall (the columns).
    expect(beadAt(loom, { x: 50, y: 10 }, 1)).toEqual({ row: 0, column: 0 })
    expect(beadAt(loom, { x: 50, y: 70 }, 1)).toEqual({ row: 0, column: 3 })
    expect(beadAt(loom, { x: 10, y: 10 }, 1)).toEqual({ row: 2, column: 0 })
    expect(beadAt(loom, { x: 5, y: 70 }, 1)).toEqual({ row: 2, column: 3 })
  })

  it('takes the zoom into account as well', () => {
    const loom = pattern('loom', 4, 3, true)

    expect(beadAt(loom, { x: 100, y: 20 }, 2)).toEqual({ row: 0, column: 0 })
    expect(beadAt(loom, { x: 10, y: 140 }, 2)).toEqual({ row: 2, column: 3 })
  })

  it('keeps peyote\'s shift and packing: they belong to the Pattern, not to the screen', () => {
    const peyote = pattern('peyote', 3, 4, true)

    // Unrotated, (15, 25) is row 1 column 0. Turned, that grid point is (height − y, x) = (65 − 25, 15).
    expect(beadAt(peyote, { x: 40, y: 15 }, 1)).toEqual({ row: 1, column: 0 })
    // And the gap beside the shifted row is a gap turned too.
    expect(beadAt(peyote, { x: 40, y: 5 }, 1)).toBeUndefined()
  })

  it('is on no bead outside the turned Pattern', () => {
    const loom = pattern('loom', 4, 3, true)

    expect(beadAt(loom, { x: 60.5, y: 10 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: 10, y: 80 }, 1)).toBeUndefined()
    expect(beadAt(loom, { x: -1, y: 10 }, 1)).toBeUndefined()
  })
})
