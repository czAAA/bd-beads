import { describe, expect, it } from 'vitest'
import { keptCrop, keptGrid, keptMoved, keptPulled } from './convertKeep'
import type { Grid } from './project'

const size = { columns: 10, rows: 8 }
const loom = { rowCycle: 1, columnCycle: 1 }

describe('keptPulled (ticket 0898)', () => {
  const big = { columns: 60, rows: 59 }
  const whole = { row: 0, column: 0, rows: 59, columns: 60 }

  it('moves the edges a handle holds by whole beads, the others staying put', () => {
    expect(keptPulled(whole, 'bottomRight', -26, -21, big, loom)).toEqual({ row: 0, column: 0, rows: 38, columns: 34 })
    expect(keptPulled(whole, 'left', 10, 5, big, loom)).toEqual({ row: 0, column: 10, rows: 59, columns: 50 })
    expect(keptPulled(whole, 'top', 3, 4, big, loom)).toEqual({ row: 4, column: 0, rows: 55, columns: 60 })
  })

  it('stays on the beads and keeps at least 8 beads a side', () => {
    expect(keptPulled(whole, 'topLeft', -5, -5, big, loom)).toEqual(whole)
    expect(keptPulled(whole, 'right', -100, 0, big, loom)).toEqual({ row: 0, column: 0, rows: 59, columns: 8 })
    expect(keptPulled(whole, 'topLeft', 100, 100, big, loom)).toEqual({ row: 51, column: 52, rows: 8, columns: 8 })
  })

  it('starts on a whole cycle of the stagger, so peyote and brick stitch keep their shifts', () => {
    expect(keptPulled(whole, 'top', 0, 3, big, { rowCycle: 2, columnCycle: 1 })).toEqual({ row: 2, column: 0, rows: 57, columns: 60 })
  })
})

describe('keptCrop (ticket 0898)', () => {
  it('is the picture pixels under the kept beads, held to the picture', () => {
    const picture = { width: 240, height: 236 }
    const woven = { part: { x: 0, y: 0, width: 240, height: 236 }, pixelsPerBead: { x: 4, y: 4 }, frameRow: 0, frameColumn: 0 }
    expect(keptCrop({ row: 2, column: 3, rows: 38, columns: 34 }, woven, picture)).toEqual({ x: 12, y: 8, width: 136, height: 152 })
    expect(keptCrop({ row: 50, column: 55, rows: 9, columns: 10 }, woven, picture)).toEqual({ x: 220, y: 200, width: 20, height: 36 })
  })

  it('counts from the Frame where the beads stand round a part of the picture', () => {
    const woven = { part: { x: 40, y: 20, width: 100, height: 80 }, pixelsPerBead: { x: 2, y: 2 }, frameRow: 10, frameColumn: 20 }
    expect(keptCrop({ row: 10, column: 15, rows: 8, columns: 10 }, woven, { width: 200, height: 150 })).toEqual({ x: 30, y: 20, width: 20, height: 16 })
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
