// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  cellCenter,
  clampZoom,
  stepZoom,
  computeGridDimensions,
  gridHeight,
  gridWidth,
  neighborsOf,
  rowPitch,
  rowOffset,
  toMillimeters,
} from './grid'
import type { Bead } from './beads'

const cubeBead: Bead = {
  id: 'test-cube',
  brand: 'Test',
  name: 'Cube',
  size: '1.5mm',
  formFactor: 'cube',
  color: null,
  widthMm: 1.5,
  heightMm: 1.5,
}

const delicaBead: Bead = {
  id: 'test-delica',
  brand: 'Test',
  name: 'Delica',
  size: '11/0',
  formFactor: 'cylinder',
  color: null,
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

  it('counts columns in the bead width plus its per-bead correction', () => {
    const correctedBead: Bead = { ...cubeBead, widthMm: 1.5, widthCorrectionMm: 0.15 }
    // 16.5 / 1.65 = 10 columns, where the bare 1.5mm width would give 11. Rows ignore the correction.
    expect(computeGridDimensions({ widthMm: 16.5, heightMm: 15 }, correctedBead)).toEqual({
      columns: 10,
      rows: 10,
    })
  })

  it('rounds up to the next whole bead (ticket 342)', () => {
    expect(computeGridDimensions({ widthMm: 15.1, heightMm: 16 }, cubeBead)).toEqual({
      columns: 11,
      rows: 11,
    })
  })

  it('keeps an exact multiple of the bead as it is, despite floating-point noise', () => {
    // 0.3 / 0.1 is 2.9999999999999996 and 0.7 / 0.1 is 6.999999999999999: neither may round up a bead.
    const fine: Bead = { ...cubeBead, widthMm: 0.1, heightMm: 0.1 }
    expect(computeGridDimensions({ widthMm: 0.3, heightMm: 0.7 }, fine)).toEqual({ columns: 3, rows: 7 })
    expect(computeGridDimensions({ widthMm: 0.6, heightMm: 2.1 }, fine)).toEqual({ columns: 6, rows: 21 })
  })

  it('never returns fewer than one column or row', () => {
    expect(computeGridDimensions({ widthMm: 0.1, heightMm: 0.1 }, cubeBead)).toEqual({
      columns: 1,
      rows: 1,
    })
  })
})

describe('rowOffset', () => {
  it('never offsets loom rows', () => {
    expect(rowOffset('loom', 0, 20)).toBe(0)
    expect(rowOffset('loom', 1, 20)).toBe(0)
    expect(rowOffset('loom', 2, 20)).toBe(0)
  })

  it('offsets alternating peyote rows by half a cell', () => {
    expect(rowOffset('peyote', 0, 20)).toBe(0)
    expect(rowOffset('peyote', 1, 20)).toBe(10)
    expect(rowOffset('peyote', 2, 20)).toBe(0)
    expect(rowOffset('peyote', 3, 20)).toBe(10)
  })

  it('offsets alternating brick stitch rows by half a cell, the same as peyote', () => {
    expect(rowOffset('brick', 0, 20)).toBe(0)
    expect(rowOffset('brick', 1, 20)).toBe(10)
  })
})

describe('gridWidth', () => {
  it('is just columns times cell size for loom', () => {
    expect(gridWidth('loom', 10, 20)).toBe(200)
  })

  it('adds half a cell for offset techniques', () => {
    expect(gridWidth('peyote', 10, 20)).toBe(210)
    expect(gridWidth('brick', 10, 20)).toBe(210)
  })
})

describe('rowPitch', () => {
  it('is a full cell for loom and brick stitch', () => {
    expect(rowPitch('loom', 20)).toBe(20)
    expect(rowPitch('brick', 20)).toBe(20)
  })

  it('packs peyote rows tighter than a full cell, so they interlock', () => {
    expect(rowPitch('peyote', 20)).toBe(15)
  })
})

describe('gridHeight', () => {
  it('is rows times cell size for loom and brick stitch', () => {
    expect(gridHeight('loom', 10, 20)).toBe(200)
    expect(gridHeight('brick', 10, 20)).toBe(200)
  })

  it('is shorter than a straight grid for peyote, since its rows overlap', () => {
    expect(gridHeight('peyote', 10, 20)).toBe(20 + 9 * 15)
    expect(gridHeight('peyote', 10, 20)).toBeLessThan(gridHeight('loom', 10, 20))
  })

  it('is zero for an empty grid', () => {
    expect(gridHeight('loom', 0, 20)).toBe(0)
  })
})

function sorted(positions: { row: number; column: number }[]) {
  return [...positions].sort((a, b) => a.row - b.row || a.column - b.column)
}

describe('neighborsOf', () => {
  const dims = { columns: 5, rows: 5 }

  it('gives loom cells their four straight neighbors', () => {
    expect(sorted(neighborsOf('loom', dims, { row: 2, column: 2 }))).toEqual(
      sorted([
        { row: 2, column: 1 },
        { row: 2, column: 3 },
        { row: 1, column: 2 },
        { row: 3, column: 2 },
      ]),
    )
  })

  it('clips loom neighbors at the grid edges', () => {
    expect(sorted(neighborsOf('loom', dims, { row: 0, column: 0 }))).toEqual(
      sorted([
        { row: 0, column: 1 },
        { row: 1, column: 0 },
      ]),
    )
  })

  it('gives a peyote cell in an unshifted row two neighbors in each shifted adjacent row', () => {
    // row 2 is unshifted; rows 1 and 3 are shifted right by half a cell, so each overlaps columns {1,2} of row 2's column 2.
    expect(sorted(neighborsOf('peyote', dims, { row: 2, column: 2 }))).toEqual(
      sorted([
        { row: 2, column: 1 },
        { row: 2, column: 3 },
        { row: 1, column: 1 },
        { row: 1, column: 2 },
        { row: 3, column: 1 },
        { row: 3, column: 2 },
      ]),
    )
  })

  it('gives a peyote cell in a shifted row two neighbors in each unshifted adjacent row', () => {
    // row 1 is shifted right; rows 0 and 2 are unshifted, so each overlaps columns {2,3} of row 1's column 2.
    expect(sorted(neighborsOf('peyote', dims, { row: 1, column: 2 }))).toEqual(
      sorted([
        { row: 1, column: 1 },
        { row: 1, column: 3 },
        { row: 0, column: 2 },
        { row: 0, column: 3 },
        { row: 2, column: 2 },
        { row: 2, column: 3 },
      ]),
    )
  })

  it('adjacency is symmetric: if B neighbors A, A neighbors B', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      for (let row = 0; row < dims.rows; row++) {
        for (let column = 0; column < dims.columns; column++) {
          for (const neighbor of neighborsOf(technique, dims, { row, column })) {
            const back = neighborsOf(technique, dims, neighbor)
            expect(back).toContainEqual({ row, column })
          }
        }
      }
    }
  })

  it('treats brick stitch adjacency the same as peyote, since both offset rows the same way', () => {
    expect(sorted(neighborsOf('brick', dims, { row: 2, column: 2 }))).toEqual(
      sorted(neighborsOf('peyote', dims, { row: 2, column: 2 })),
    )
  })
})

describe('clampZoom', () => {
  it('leaves a zoom inside the range alone, rounded to whole percent', () => {
    expect(clampZoom(0.8)).toBe(0.8)
    expect(clampZoom(0.7916)).toBe(0.79)
  })

  it('never goes below the minimum or above the maximum', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
  })
})

describe('cellCenter', () => {
  it('puts a loom cell half a cell in from its own column and row', () => {
    expect(cellCenter('loom', { row: 0, column: 0 }, 2, 2)).toEqual({ x: 1, y: 1 })
    expect(cellCenter('loom', { row: 3, column: 4 }, 2, 2)).toEqual({ x: 9, y: 7 })
  })

  it('never staggers loom rows', () => {
    expect(cellCenter('loom', { row: 1, column: 0 }, 2, 2).x).toBe(1)
  })

  it('shifts peyote and brick odd rows by half a cell', () => {
    expect(cellCenter('peyote', { row: 1, column: 0 }, 2, 2).x).toBe(2)
    expect(cellCenter('brick', { row: 1, column: 0 }, 2, 2).x).toBe(2)
    expect(cellCenter('peyote', { row: 2, column: 0 }, 2, 2).x).toBe(1)
  })

  it('packs peyote rows at three quarters of a cell, brick and loom at a full cell', () => {
    expect(cellCenter('peyote', { row: 2, column: 0 }, 2, 2).y).toBe(1 + 2 * 1.5)
    expect(cellCenter('brick', { row: 2, column: 0 }, 2, 2).y).toBe(1 + 2 * 2)
    expect(cellCenter('loom', { row: 2, column: 0 }, 2, 2).y).toBe(1 + 2 * 2)
  })

  it('uses the bead footprint independently per axis, so a Delica cell is not square', () => {
    const center = cellCenter('loom', { row: 1, column: 1 }, 1.6, 1.3)
    expect(center.x).toBeCloseTo(2.4)
    expect(center.y).toBeCloseTo(1.95)
  })

  it('lands the last cell exactly half a cell short of the far edge the grid dimensions report', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const last = cellCenter(technique, { row: 4, column: 5 }, 1.6, 1.3)
      expect(last.x).toBeLessThan(gridWidth(technique, 6, 1.6))
      expect(last.y).toBeLessThan(gridHeight(technique, 5, 1.3))
      // The last row is even (4), so its own right edge falls short of the grid's total width by exactly the half
      // cell an offset technique's odd rows add on.
      expect(last.x + 1.6 / 2).toBeCloseTo(gridWidth(technique, 6, 1.6) - rowOffset(technique, 1, 1.6))
      expect(last.y + 1.3 / 2).toBeCloseTo(gridHeight(technique, 5, 1.3))
    }
  })
})

describe('stepZoom', () => {
  it('walks the 10% rungs from one to the next, both ways', () => {
    expect(stepZoom(1, -1)).toBe(0.9)
    expect(stepZoom(0.2, -1)).toBe(0.1)
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(0.1, 1)).toBe(0.2)
  })

  it('lands on the next rung from a level a fit, wheel or pinch left between two', () => {
    expect(stepZoom(0.43, 1)).toBe(0.5)
    expect(stepZoom(0.43, -1)).toBe(0.4)
    expect(stepZoom(0.54, -1)).toBe(0.5)
  })

  it('stays inside the Zoom range', () => {
    expect(stepZoom(0.1, -1)).toBe(0.1)
    expect(stepZoom(0.14, -1)).toBe(0.1)
    expect(stepZoom(4, 1)).toBe(4)
    expect(stepZoom(3.95, 1)).toBe(4)
  })
})
