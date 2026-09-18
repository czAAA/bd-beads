import { describe, expect, it } from 'vitest'
import {
  GRID_BORDER_PX,
  MAX_ZOOM,
  MIN_ZOOM,
  RULER_GUTTER_PX,
  canvasContentHeightPx,
  canvasContentWidthPx,
  cellCenter,
  clampZoom,
  computeFitZoom,
  computeGridDimensions,
  gridHeightPx,
  gridWidthPx,
  neighborsOf,
  rowHeightPx,
  rowOffsetPx,
  rulerLabelStep,
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

describe('rulerLabelStep', () => {
  it('labels every row/column when they are far enough apart on screen', () => {
    expect(rulerLabelStep(20, 1, 18)).toBe(1)
  })

  it('thins labels out to every 2nd, 5th, 10th... as the zoom shrinks', () => {
    expect(rulerLabelStep(20, 0.5, 18)).toBe(2)
    expect(rulerLabelStep(20, 0.25, 18)).toBe(5)
    expect(rulerLabelStep(20, 0.1, 18)).toBe(10)
  })

  it('keeps thinning past 10 rather than giving up and overlapping', () => {
    expect(rulerLabelStep(20, 0.02, 18)).toBe(50)
  })
})

describe('canvasContentPx', () => {
  it('scales the grid and its bold outline by the zoom, between two unscaled ruler gutters', () => {
    expect(canvasContentWidthPx('loom', 10, 0.5, 20)).toBe(
      RULER_GUTTER_PX * 2 + (gridWidthPx('loom', 10, 20) + GRID_BORDER_PX * 2) * 0.5,
    )
    expect(canvasContentHeightPx('loom', 10, 0.5, 20)).toBe(
      RULER_GUTTER_PX * 2 + (gridHeightPx('loom', 10, 20) + GRID_BORDER_PX * 2) * 0.5,
    )
  })

  it('leaves room for the outline on all four sides, not just the left and top', () => {
    // Without the outline counted in, the box would be 6px short and clip the right/bottom edges.
    const withOutline = canvasContentWidthPx('loom', 10, 1, 20)
    expect(withOutline - RULER_GUTTER_PX * 2 - gridWidthPx('loom', 10, 20)).toBe(GRID_BORDER_PX * 2)
  })
})

describe('computeFitZoom rounding', () => {
  it('rounds down to a whole percent, so the grid still fits at the level shown', () => {
    // 418 / 600 = 69.67%: rounding up would leave the grid a fraction of a pixel too wide for the box.
    expect(computeFitZoom({ columns: 30, rows: 4, maxWidth: 418, maxHeight: 418, cellSize: 20 })).toBe(
      0.69,
    )
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
      expect(last.x).toBeLessThan(gridWidthPx(technique, 6, 1.6))
      expect(last.y).toBeLessThan(gridHeightPx(technique, 5, 1.3))
      // The last row is even (4), so its own right edge falls short of the grid's total width by exactly the half
      // cell an offset technique's odd rows add on.
      expect(last.x + 1.6 / 2).toBeCloseTo(gridWidthPx(technique, 6, 1.6) - rowOffsetPx(technique, 1, 1.6))
      expect(last.y + 1.3 / 2).toBeCloseTo(gridHeightPx(technique, 5, 1.3))
    }
  })
})
