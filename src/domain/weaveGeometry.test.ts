import { describe, expect, it } from 'vitest'
import { describeWeave } from './weave'

// What the drawing asks a Weave's description (ticket 0623): every answer comes from the geometry, none is rebuilt from
// a row shift and pitch by hand. Cells are 20 px across; peyote's rows sit 15 apart.

const peyote = describeWeave({ technique: 'peyote' })
const loom = describeWeave({ technique: 'loom' })

describe('rows of beads', () => {
  it('offsets every other row by its shift, and nothing else does', () => {
    expect([0, 1, 2, 3].map((row) => peyote.rowOffset(row, 20))).toEqual([0, 10, 0, 10])
    expect([0, 1, 2, 3].map((row) => describeWeave({ technique: 'brick', techniqueSettings: { brickDrop: 2 } }).rowOffset(row, 20))).toEqual([0, 0, 10, 10])
    expect([0, 1, 2, 3].map((row) => loom.rowOffset(row, 20))).toEqual([0, 0, 0, 0])
  })

  it('puts a Frame on its first bead\'s corner, and steps a bead across and a row pitch down', () => {
    expect(peyote.origin({ row: 1, column: 2 }, 20, 20)).toEqual({ x: 50, y: 15 })
    expect([peyote.origin({ row: 0, column: 1 }, 20, 20).x, peyote.origin({ row: 1, column: 0 }, 20, 20).y]).toEqual([20, 15])
  })

  it('finds the bead under a point, the nesting row below winning, and misses a rounded corner', () => {
    // Row 1 (shifted 10) starts at 15 and overlaps row 0's bottom quarter.
    expect(peyote.positionAt(15, 17, 20, 20)).toEqual({ row: 1, column: 0 })
    expect(peyote.positionAt(15, 5, 20, 20)).toEqual({ row: 0, column: 0 })
    expect(peyote.positionAt(0.5, 0.5, 20, 20, { rows: 2, columns: 2 })).toBeUndefined()
    expect(loom.positionAt(0.5, 0.5, 20, 20, { rows: 2, columns: 2 })).toEqual({ row: 0, column: 0 })
  })

  it('keeps a press to the rows and columns of a block when given one', () => {
    expect(peyote.positionAt(15, 17, 20, 20, { rows: 1, columns: 2 })).toEqual({ row: 0, column: 0 })
    expect(peyote.positionAt(45, 5, 20, 20, { rows: 1, columns: 2 })).toBeUndefined()
    expect(peyote.positionAt(-5, 20, 20, 20)).toEqual({ row: 1, column: -1 })
    expect(peyote.positionAt(-5, 20, 20, 20, { rows: 2, columns: 2 })).toBeUndefined()
  })

  it('misses a Real cell\'s own rounded corner, not the Technique\'s', () => {
    expect(describeWeave({ technique: 'loom', cell: { aspect: 1, roundness: 0.5 } }).positionAt(1, 1, 20, 20)).toBeUndefined()
  })

  it('names the bead nearest a point, counting a shifted row from its shift', () => {
    expect(peyote.nearestPosition(12, 22, 20, 20)).toEqual({ row: 1, column: 0 })
    expect(peyote.nearestPosition(8, 22, 20, 20)).toEqual({ row: 1, column: -1 })
  })

  it('sees each row\'s own columns, a shifted row\'s moved by its shift', () => {
    const seen = peyote.visible({ left: 30, right: 65, top: 0, bottom: 30 }, 20, 20)

    expect([seen.firstRow, seen.lastRow]).toEqual([-1, 2])
    expect([seen.columnsOf(0), seen.columnsOf(1)]).toEqual([{ first: 1, last: 3 }, { first: 0, last: 2 }])
  })

  it('takes a block\'s rows lattice with room for a shifted row, whichever rows it holds', () => {
    expect(peyote.blockBox({ row: 1, column: 2, rows: 1, columns: 3 }, 20, 20)).toEqual({ x: 40, y: 15, width: 70, height: 20 })
    expect(loom.blockBox({ row: 1, column: 2, rows: 2, columns: 3 }, 20, 20)).toEqual({ x: 40, y: 20, width: 60, height: 40 })
  })

  it('stops the marks a quarter bead right of a block\'s columns and half a row pitch round its rows\' middles', () => {
    expect(peyote.boundary({ row: 2, column: 1, rows: 2, columns: 3 }, 20, 20)).toEqual({ x: 25, y: 32.5, width: 60, height: 30 })
  })

  it('repeats a bead across and a cycle of rows down, at least two', () => {
    expect(loom.tile(20, 20)).toEqual({ size: { width: 20, height: 40 }, beads: [{ x: 0, y: 0, width: 20, height: 20 }, { x: 0, y: 20, width: 20, height: 20 }] })
    expect(describeWeave({ technique: 'brick', techniqueSettings: { brickDrop: 2 } }).tile(20, 20).beads.map(({ x, y }) => [x, y])).toEqual([[0, 0], [0, 20], [10, 40], [10, 60]])
  })
})
