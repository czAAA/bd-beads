import { describe, expect, it } from 'vitest'
import {
  computeFitZoom,
  computeGridDimensions,
  gridHeightPx,
  gridWidthPx,
  rowHeightPx,
  rowOffsetPx,
  toMillimeters,
} from './grid'
import type { Bead } from './beads'

const cubeBead: Bead = {
  id: 'test-cube',
  brand: 'Test',
  name: 'Cube',
  size: '1.5mm',
  formFactor: 'cube',
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = {
  id: 'test-delica',
  brand: 'Test',
  name: 'Delica',
  size: '11/0',
  formFactor: 'cylinder',
  widthMm: 1.6,
  heightMm: 1.3,
}

describe('toMillimeters', () => {
  it('returns the value unchanged for mm', () => {
    expect(toMillimeters(15, 'mm')).toBe(15)
  })

  it('converts cm to mm', () => {
    expect(toMillimeters(1.5, 'cm')).toBe(15)
  })
})

describe('computeGridDimensions', () => {
  it('divides physical size by bead footprint to get columns and rows', () => {
    expect(computeGridDimensions({ widthMm: 15, heightMm: 15 }, cubeBead)).toEqual({
      columns: 10,
      rows: 10,
    })
  })

  it('uses the bead width for columns and bead height for rows independently', () => {
    expect(computeGridDimensions({ widthMm: 16, heightMm: 13 }, delicaBead)).toEqual({
      columns: 10,
      rows: 10,
    })
  })

  it('rounds to the nearest whole bead', () => {
    expect(computeGridDimensions({ widthMm: 17, heightMm: 17 }, cubeBead)).toEqual({
      columns: 11,
      rows: 11,
    })
  })

  it('never returns fewer than one column or row', () => {
    expect(computeGridDimensions({ widthMm: 0.1, heightMm: 0.1 }, cubeBead)).toEqual({
      columns: 1,
      rows: 1,
    })
  })
})

describe('computeFitZoom', () => {
  it('returns 100% when the grid already fits within the box', () => {
    expect(
      computeFitZoom({ columns: 10, rows: 10, maxWidth: 480, maxHeight: 480, cellSize: 20 }),
    ).toBe(1)
  })

  it('zooms out just enough to fit when the grid is wider than the box', () => {
    expect(
      computeFitZoom({ columns: 30, rows: 10, maxWidth: 480, maxHeight: 480, cellSize: 20 }),
    ).toBeCloseTo(0.8)
  })

  it('zooms out just enough to fit when the grid is taller than the box', () => {
    expect(
      computeFitZoom({ columns: 10, rows: 30, maxWidth: 480, maxHeight: 480, cellSize: 20 }),
    ).toBeCloseTo(0.8)
  })

  it('never zooms in past 100% for a grid smaller than the box', () => {
    expect(
      computeFitZoom({ columns: 2, rows: 2, maxWidth: 480, maxHeight: 480, cellSize: 20 }),
    ).toBe(1)
  })

  it('accounts for an offset technique needing an extra half-cell of width', () => {
    // 10 loom columns at 20px = 200px; peyote's shifted rows need 10px more, so it fits one fewer zoom step.
    const loomZoom = computeFitZoom({
      columns: 24,
      rows: 10,
      maxWidth: 480,
      maxHeight: 480,
      cellSize: 20,
      technique: 'loom',
    })
    const peyoteZoom = computeFitZoom({
      columns: 24,
      rows: 10,
      maxWidth: 480,
      maxHeight: 480,
      cellSize: 20,
      technique: 'peyote',
    })

    expect(loomZoom).toBe(1)
    expect(peyoteZoom).toBeLessThan(loomZoom)
  })
})

describe('rowOffsetPx', () => {
  it('never offsets loom rows', () => {
    expect(rowOffsetPx('loom', 0, 20)).toBe(0)
    expect(rowOffsetPx('loom', 1, 20)).toBe(0)
    expect(rowOffsetPx('loom', 2, 20)).toBe(0)
  })

  it('offsets alternating peyote rows by half a cell', () => {
    expect(rowOffsetPx('peyote', 0, 20)).toBe(0)
    expect(rowOffsetPx('peyote', 1, 20)).toBe(10)
    expect(rowOffsetPx('peyote', 2, 20)).toBe(0)
    expect(rowOffsetPx('peyote', 3, 20)).toBe(10)
  })

  it('offsets alternating brick stitch rows by half a cell, the same as peyote', () => {
    expect(rowOffsetPx('brick', 0, 20)).toBe(0)
    expect(rowOffsetPx('brick', 1, 20)).toBe(10)
  })
})

describe('gridWidthPx', () => {
  it('is just columns times cell size for loom', () => {
    expect(gridWidthPx('loom', 10, 20)).toBe(200)
  })

  it('adds half a cell for offset techniques', () => {
    expect(gridWidthPx('peyote', 10, 20)).toBe(210)
    expect(gridWidthPx('brick', 10, 20)).toBe(210)
  })
})

describe('rowHeightPx', () => {
  it('is a full cell for loom and brick stitch', () => {
    expect(rowHeightPx('loom', 20)).toBe(20)
    expect(rowHeightPx('brick', 20)).toBe(20)
  })

  it('packs peyote rows tighter than a full cell, so they interlock', () => {
    expect(rowHeightPx('peyote', 20)).toBe(15)
  })
})

describe('gridHeightPx', () => {
  it('is rows times cell size for loom and brick stitch', () => {
    expect(gridHeightPx('loom', 10, 20)).toBe(200)
    expect(gridHeightPx('brick', 10, 20)).toBe(200)
  })

  it('is shorter than a straight grid for peyote, since its rows overlap', () => {
    expect(gridHeightPx('peyote', 10, 20)).toBe(20 + 9 * 15)
    expect(gridHeightPx('peyote', 10, 20)).toBeLessThan(gridHeightPx('loom', 10, 20))
  })

  it('is zero for an empty grid', () => {
    expect(gridHeightPx('loom', 0, 20)).toBe(0)
  })
})
