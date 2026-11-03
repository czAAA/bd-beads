import { describe, expect, it } from 'vitest'
import { keptDrawn, keptGrid, keptMoved } from './convertKeep'
import type { Grid } from './project'

const size = { columns: 10, rows: 8 }
const loom = { rowCycle: 1, columnCycle: 1 }

describe('keptDrawn', () => {
  it('is the beads from the one a drag began on to the one it is on, either way round', () => {
    expect(keptDrawn({ row: 1, column: 2 }, { row: 4, column: 6 }, size, loom)).toEqual({ row: 1, column: 2, rows: 4, columns: 5 })
    expect(keptDrawn({ row: 4, column: 6 }, { row: 1, column: 2 }, size, loom)).toEqual({ row: 1, column: 2, rows: 4, columns: 5 })
  })

  it('stays on the beads when the drag leaves them', () => {
    expect(keptDrawn({ row: 6, column: 8 }, { row: 20, column: 30 }, size, loom)).toEqual({ row: 6, column: 8, rows: 2, columns: 2 })
    expect(keptDrawn({ row: 2, column: 2 }, { row: -5, column: -5 }, size, loom)).toEqual({ row: 0, column: 0, rows: 3, columns: 3 })
  })

  it('starts on a whole cycle of the stagger, so a staggered weave keeps its shifts', () => {
    expect(keptDrawn({ row: 3, column: 3 }, { row: 5, column: 7 }, size, { rowCycle: 2, columnCycle: 1 })).toEqual({ row: 2, column: 3, rows: 4, columns: 5 })
    expect(keptDrawn({ row: 3, column: 3 }, { row: 5, column: 7 }, size, { rowCycle: 1, columnCycle: 2 })).toEqual({ row: 3, column: 2, rows: 3, columns: 6 })
  })
})

describe('keptMoved', () => {
  it('moves the part whole, kept on the beads, by whole cycles', () => {
    const part = { row: 1, column: 1, rows: 3, columns: 4 }
    expect(keptMoved(part, 2, 1, size, loom)).toEqual({ row: 2, column: 3, rows: 3, columns: 4 })
    expect(keptMoved(part, 20, 20, size, loom)).toEqual({ row: 5, column: 6, rows: 3, columns: 4 })
    expect(keptMoved(part, 1, 1, size, { rowCycle: 2, columnCycle: 1 })).toEqual({ row: 2, column: 2, rows: 3, columns: 4 })
  })
})

describe('keptGrid', () => {
  it('is only the kept beads', () => {
    const grid: Grid = Array.from({ length: 3 }, (_row, row) => Array.from({ length: 3 }, (_cell, column) => ({ color: `${row}${column}` })))
    expect(keptGrid(grid, { row: 1, column: 1, rows: 2, columns: 1 })).toEqual([[{ color: '11' }], [{ color: '21' }]])
  })
})
