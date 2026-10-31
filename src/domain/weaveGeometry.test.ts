import { describe, expect, it } from 'vitest'
import { describeWeave } from './weave'

// What the drawing asks a Weave's description (ticket 0623): every answer comes from the geometry, none is rebuilt from
// a shift by hand. Cells are 20 px across and tall. Brick stitch's rows are the staggered ones, peyote's columns (ticket 0734).

const brick = describeWeave({ technique: 'brick' })
const peyote = describeWeave({ technique: 'peyote' })
const loom = describeWeave({ technique: 'loom' })

describe('rows of beads (loom and brick stitch)', () => {
  it('offsets every other row by its shift, and nothing else does', () => {
    expect([0, 1, 2, 3].map((row) => brick.rowOffset(row, 20))).toEqual([0, 10, 0, 10])
    expect([0, 1, 2, 3].map((row) => describeWeave({ technique: 'brick', techniqueSettings: { brickDrop: 2 } }).rowOffset(row, 20))).toEqual([0, 0, 10, 10])
    expect([0, 1, 2, 3].map((row) => loom.rowOffset(row, 20))).toEqual([0, 0, 0, 0])
    expect([0, 1, 2, 3].map((row) => brick.columnOffset(row, 20))).toEqual([0, 0, 0, 0])
  })

  it('puts a Frame on its first bead\'s corner, and steps a bead across and a bead down', () => {
    expect(brick.origin({ row: 1, column: 2 }, 20, 20)).toEqual({ x: 50, y: 20 })
    expect([brick.origin({ row: 0, column: 1 }, 20, 20).x, brick.origin({ row: 1, column: 0 }, 20, 20).y]).toEqual([20, 20])
  })

  it('finds the bead under a point, a shifted row\'s moved by its shift', () => {
    expect(brick.positionAt(15, 25, 20, 20)).toEqual({ row: 1, column: 0 })
    expect(brick.positionAt(15, 5, 20, 20)).toEqual({ row: 0, column: 0 })
    expect(loom.positionAt(0.5, 0.5, 20, 20, { rows: 2, columns: 2 })).toEqual({ row: 0, column: 0 })
  })

  it('keeps a press to the rows and columns of a block when given one', () => {
    expect(brick.positionAt(15, 25, 20, 20, { rows: 1, columns: 2 })).toBeUndefined()
    expect(brick.positionAt(45, 5, 20, 20, { rows: 1, columns: 2 })).toBeUndefined()
    expect(brick.positionAt(5, 25, 20, 20)).toEqual({ row: 1, column: -1 })
    expect(brick.positionAt(5, 25, 20, 20, { rows: 2, columns: 2 })).toBeUndefined()
  })

  it('misses a Bead\'s cell\'s own rounded corner, not the Technique\'s', () => {
    expect(describeWeave({ technique: 'loom', cell: { aspect: 1, roundness: 0.5 } }).positionAt(1, 1, 20, 20)).toBeUndefined()
  })

  it('names the bead nearest a point, counting a shifted row from its shift', () => {
    expect(brick.nearestPosition(12, 22, 20, 20)).toEqual({ row: 1, column: 0 })
    expect(brick.nearestPosition(8, 22, 20, 20)).toEqual({ row: 1, column: -1 })
  })

  it('sees each row\'s own columns, a shifted row\'s moved by its shift', () => {
    const seen = brick.visible({ left: 30, right: 65, top: 0, bottom: 30 }, 20, 20)

    expect([seen.firstRow, seen.lastRow]).toEqual([-1, 1])
    expect([seen.columnsOf(0), seen.columnsOf(1)]).toEqual([{ first: 1, last: 3 }, { first: 0, last: 2 }])
  })

  it('takes a block\'s rows lattice with room for a shifted row, whichever rows it holds', () => {
    expect(brick.blockBox({ row: 1, column: 2, rows: 1, columns: 3 }, 20, 20)).toEqual({ x: 40, y: 20, width: 70, height: 20 })
    expect(loom.blockBox({ row: 1, column: 2, rows: 2, columns: 3 }, 20, 20)).toEqual({ x: 40, y: 20, width: 60, height: 40 })
  })

  it('stops the marks a quarter bead right of a block\'s columns and at the edges of its rows', () => {
    expect(brick.boundary({ row: 2, column: 1, rows: 2, columns: 3 }, 20, 20)).toEqual({ x: 25, y: 40, width: 60, height: 40 })
  })

  it('repeats a bead across and a cycle of rows down, at least two', () => {
    expect(loom.tile(20, 20)).toEqual({ size: { width: 20, height: 40 }, beads: [{ x: 0, y: 0, width: 20, height: 20 }, { x: 0, y: 20, width: 20, height: 20 }] })
    expect(describeWeave({ technique: 'brick', techniqueSettings: { brickDrop: 2 } }).tile(20, 20).beads.map(({ x, y }) => [x, y])).toEqual([[0, 0], [0, 20], [10, 40], [10, 60]])
  })

  it('floods along rows, a shifted row reaching the two columns of the row beside it', () => {
    expect(loom.spans.along).toBe('row')
    expect(brick.spans.along).toBe('row')
    expect([brick.spans.reach(0, 1), brick.spans.reach(1, 0), brick.spans.reach(1, 2)]).toEqual([[-1, 0], [0, 1], [0, 1]])
    expect(loom.spans.reach(0, 1)).toEqual([0, 0])
  })
})

describe('columns of beads (peyote, ticket 0734)', () => {
  it('offsets every other column down by its shift, and nothing else does', () => {
    expect([0, 1, 2, 3].map((column) => peyote.columnOffset(column, 20))).toEqual([0, 10, 0, 10])
    expect([0, 1, 2, 3].map((column) => describeWeave({ technique: 'peyote', techniqueSettings: { peyoteDrop: 2 } }).columnOffset(column, 20))).toEqual([0, 0, 10, 10])
    expect([0, 1, 2, 3].map((row) => peyote.rowOffset(row, 20))).toEqual([0, 0, 0, 0])
  })

  it('puts a Frame on its first bead\'s corner, and steps a full bead across and down', () => {
    expect(peyote.origin({ row: 1, column: 2 }, 20, 20)).toEqual({ x: 40, y: 20 })
    expect(peyote.origin({ row: 0, column: 1 }, 20, 20)).toEqual({ x: 20, y: 10 })
    expect(peyote.origin({ row: 1, column: 0 }, 20, 20).y).toBe(20)
  })

  it('finds the bead under a point, a shifted column\'s moved by its shift, and misses a rounded corner', () => {
    expect(peyote.positionAt(30, 15, 20, 20)).toEqual({ row: 0, column: 1 })
    expect(peyote.positionAt(30, 5, 20, 20)).toEqual({ row: -1, column: 1 })
    expect(peyote.positionAt(10, 35, 20, 20)).toEqual({ row: 1, column: 0 })
    expect(peyote.positionAt(0.5, 0.5, 20, 20, { rows: 2, columns: 2 })).toBeUndefined()
  })

  it('keeps a press to the rows and columns of a block when given one', () => {
    expect(peyote.positionAt(30, 5, 20, 20, { rows: 2, columns: 2 })).toBeUndefined()
    expect(peyote.positionAt(30, 35, 20, 20, { rows: 1, columns: 2 })).toBeUndefined()
    expect(peyote.positionAt(50, 10, 20, 20, { rows: 2, columns: 2 })).toBeUndefined()
    expect(peyote.positionAt(30, 35, 20, 20, { rows: 2, columns: 2 })).toEqual({ row: 1, column: 1 })
  })

  it('names the bead nearest a point, counting a shifted column from its shift', () => {
    expect(peyote.nearestPosition(30, 35, 20, 20)).toEqual({ row: 1, column: 1 })
    expect(peyote.nearestPosition(30, 15, 20, 20)).toEqual({ row: 0, column: 1 })
    expect(peyote.nearestPosition(10, 25, 20, 20)).toEqual({ row: 1, column: 0 })
  })

  it('sees the columns a stretch of grid reaches, and rows enough for a shifted column\'s lower beads', () => {
    const seen = peyote.visible({ left: 30, right: 65, top: 0, bottom: 30 }, 20, 20)

    expect([seen.firstRow, seen.lastRow]).toEqual([-1, 1])
    expect([seen.columnsOf(0), seen.columnsOf(5)]).toEqual([{ first: 1, last: 3 }, { first: 1, last: 3 }])
  })

  it('takes a block\'s lattice with room for a shifted column, whichever columns it holds', () => {
    expect(peyote.blockBox({ row: 1, column: 2, rows: 1, columns: 3 }, 20, 20)).toEqual({ x: 40, y: 20, width: 60, height: 30 })
  })

  it('stops the marks half a bead either side of a block\'s columns and a quarter bead below its rows', () => {
    expect(peyote.boundary({ row: 2, column: 1, rows: 2, columns: 3 }, 20, 20)).toEqual({ x: 20, y: 45, width: 60, height: 40 })
  })

  it('repeats a cycle of columns across and a bead down, at least two', () => {
    expect(peyote.tile(20, 20).size).toEqual({ width: 40, height: 20 })
    expect(peyote.tile(20, 20).beads.map(({ x, y }) => [x, y])).toEqual([[0, 0], [20, 10]])
    expect(describeWeave({ technique: 'peyote', techniqueSettings: { peyoteDrop: 2 } }).tile(20, 20).beads.map(({ x, y }) => [x, y])).toEqual([[0, 0], [20, 0], [40, 10], [60, 10]])
  })

  it('floods down columns, a shifted column reaching the two rows of the column beside it', () => {
    expect(peyote.spans.along).toBe('column')
    expect([peyote.spans.reach(0, 1), peyote.spans.reach(1, 0), peyote.spans.reach(1, 2)]).toEqual([[-1, 0], [0, 1], [0, 1]])
  })
})
