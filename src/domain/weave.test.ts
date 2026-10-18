// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cellCenter, describeWeave, gridHeight, gridWidth, lineOfPass, neighborsOf, passCount, passOf, rowCycle, rowOffset, rowPitch } from './weave'

function sorted(positions: { row: number; column: number }[]) {
  return [...positions].sort((a, b) => a.row - b.row || a.column - b.column)
}

/** How many beads each pass weaves on a line of `length` beads, over `lines` lines. */
function passSizes(lines: number, length: number): number[] {
  const sizes = Array.from({ length: passCount('peyote', lines) }, () => 0)
  for (let line = 0; line < lines; line += 1) {
    for (let along = 0; along < length; along += 1) {
      sizes[passOf('peyote', line, along)] += 1
    }
  }
  return sizes
}

describe('peyote passes', () => {
  it('weaves all 7 beads, then 4, 3, 4, 3 ... on an odd line', () => {
    expect(passSizes(3, 7)).toEqual([7, 4, 3, 4, 3])
  })

  it('weaves all 8 beads, then 4 each time on an even line', () => {
    expect(passSizes(3, 8)).toEqual([8, 4, 4, 4, 4])
  })

  it('counts one pass for one line and two more for each further line', () => {
    expect([0, 1, 2, 3].map((lines) => passCount('peyote', lines))).toEqual([0, 1, 3, 5])
  })

  it('puts a pass on the line it belongs to', () => {
    expect([0, 1, 2, 3, 4].map((pass) => lineOfPass('peyote', pass))).toEqual([0, 1, 1, 2, 2])
  })
})

describe('loom and brick stitch passes', () => {
  it.each(['loom', 'brick'] as const)('are one whole line on %s', (technique) => {
    expect(passCount(technique, 5)).toBe(5)
    expect(passOf(technique, 3, 4)).toBe(3)
    expect(lineOfPass(technique, 3)).toBe(3)
  })
})


describe('rowOffset', () => {
  it('never offsets loom rows', () => {
    expect(rowOffset({ technique: 'loom' }, 0, 20)).toBe(0)
    expect(rowOffset({ technique: 'loom' }, 1, 20)).toBe(0)
    expect(rowOffset({ technique: 'loom' }, 2, 20)).toBe(0)
  })

  it('offsets alternating peyote rows by half a cell', () => {
    expect(rowOffset({ technique: 'peyote' }, 0, 20)).toBe(0)
    expect(rowOffset({ technique: 'peyote' }, 1, 20)).toBe(10)
    expect(rowOffset({ technique: 'peyote' }, 2, 20)).toBe(0)
    expect(rowOffset({ technique: 'peyote' }, 3, 20)).toBe(10)
  })

  it('offsets alternating brick stitch rows by half a cell, the same as peyote', () => {
    expect(rowOffset({ technique: 'brick' }, 0, 20)).toBe(0)
    expect(rowOffset({ technique: 'brick' }, 1, 20)).toBe(10)
  })

  it('shifts brick stitch in blocks of the Brick block: N straight rows, then N shifted (ticket 477)', () => {
    const rows = (brickBlock: number) => Array.from({ length: 8 }, (_row, row) => rowOffset({ technique: 'brick', brickBlock }, row, 20))
    expect(rows(1)).toEqual([0, 10, 0, 10, 0, 10, 0, 10])
    expect(rows(2)).toEqual([0, 0, 10, 10, 0, 0, 10, 10])
    expect(rows(3)).toEqual([0, 0, 0, 10, 10, 10, 0, 0])
  })

  it('keeps the rhythm unbroken on rows above row 0', () => {
    const rows = Array.from({ length: 6 }, (_row, index) => rowOffset({ technique: 'brick', brickBlock: 2 }, index - 4, 20))
    expect(rows).toEqual([0, 0, 10, 10, 0, 0])
  })

  it('ignores the Brick block on loom and peyote', () => {
    expect(rowOffset({ technique: 'peyote', brickBlock: 3 }, 1, 20)).toBe(10)
    expect(rowOffset({ technique: 'loom', brickBlock: 3 }, 3, 20)).toBe(0)
  })
})

describe('rowCycle', () => {
  it('is 1 for loom, 2 for peyote and 2N for brick stitch with a Brick block of N', () => {
    expect(rowCycle({ technique: 'loom' })).toBe(1)
    expect(rowCycle({ technique: 'peyote', brickBlock: 4 })).toBe(2)
    expect(rowCycle({ technique: 'brick' })).toBe(2)
    expect(rowCycle({ technique: 'brick', brickBlock: 3 })).toBe(6)
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

describe('neighborsOf', () => {
  const dims = { columns: 5, rows: 5 }

  it('gives loom cells their four straight neighbors', () => {
    expect(sorted(neighborsOf({ technique: 'loom' }, dims, { row: 2, column: 2 }))).toEqual(
      sorted([
        { row: 2, column: 1 },
        { row: 2, column: 3 },
        { row: 1, column: 2 },
        { row: 3, column: 2 },
      ]),
    )
  })

  it('clips loom neighbors at the grid edges', () => {
    expect(sorted(neighborsOf({ technique: 'loom' }, dims, { row: 0, column: 0 }))).toEqual(
      sorted([
        { row: 0, column: 1 },
        { row: 1, column: 0 },
      ]),
    )
  })

  it('gives a peyote cell in an unshifted row two neighbors in each shifted adjacent row', () => {
    // row 2 is unshifted; rows 1 and 3 are shifted right by half a cell, so each overlaps columns {1,2} of row 2's column 2.
    expect(sorted(neighborsOf({ technique: 'peyote' }, dims, { row: 2, column: 2 }))).toEqual(
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
    expect(sorted(neighborsOf({ technique: 'peyote' }, dims, { row: 1, column: 2 }))).toEqual(
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
          for (const neighbor of neighborsOf({ technique }, dims, { row, column })) {
            const back = neighborsOf({ technique }, dims, neighbor)
            expect(back).toContainEqual({ row, column })
          }
        }
      }
    }
  })

  it('treats brick stitch adjacency the same as peyote, since both offset rows the same way', () => {
    expect(sorted(neighborsOf({ technique: 'brick' }, dims, { row: 2, column: 2 }))).toEqual(
      sorted(neighborsOf({ technique: 'peyote' }, dims, { row: 2, column: 2 })),
    )
  })
})

describe('cellCenter', () => {
  it('puts a loom cell half a cell in from its own column and row', () => {
    expect(cellCenter({ technique: 'loom' }, { row: 0, column: 0 }, 2, 2)).toEqual({ x: 1, y: 1 })
    expect(cellCenter({ technique: 'loom' }, { row: 3, column: 4 }, 2, 2)).toEqual({ x: 9, y: 7 })
  })

  it('never staggers loom rows', () => {
    expect(cellCenter({ technique: 'loom' }, { row: 1, column: 0 }, 2, 2).x).toBe(1)
  })

  it('shifts peyote and brick odd rows by half a cell', () => {
    expect(cellCenter({ technique: 'peyote' }, { row: 1, column: 0 }, 2, 2).x).toBe(2)
    expect(cellCenter({ technique: 'brick' }, { row: 1, column: 0 }, 2, 2).x).toBe(2)
    expect(cellCenter({ technique: 'peyote' }, { row: 2, column: 0 }, 2, 2).x).toBe(1)
  })

  it('packs peyote rows at three quarters of a cell, brick and loom at a full cell', () => {
    expect(cellCenter({ technique: 'peyote' }, { row: 2, column: 0 }, 2, 2).y).toBe(1 + 2 * 1.5)
    expect(cellCenter({ technique: 'brick' }, { row: 2, column: 0 }, 2, 2).y).toBe(1 + 2 * 2)
    expect(cellCenter({ technique: 'loom' }, { row: 2, column: 0 }, 2, 2).y).toBe(1 + 2 * 2)
  })

  it('uses the bead footprint independently per axis, so a Delica cell is not square', () => {
    const center = cellCenter({ technique: 'loom' }, { row: 1, column: 1 }, 1.6, 1.3)
    expect(center.x).toBeCloseTo(2.4)
    expect(center.y).toBeCloseTo(1.95)
  })

  it('lands the last cell exactly half a cell short of the far edge the grid dimensions report', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const last = cellCenter({ technique }, { row: 4, column: 5 }, 1.6, 1.3)
      expect(last.x).toBeLessThan(gridWidth(technique, 6, 1.6))
      expect(last.y).toBeLessThan(gridHeight(technique, 5, 1.3))
      // The last row is even (4), so its own right edge falls short of the grid's total width by exactly the half
      // cell an offset technique's odd rows add on.
      expect(last.x + 1.6 / 2).toBeCloseTo(gridWidth(technique, 6, 1.6) - rowOffset({ technique }, 1, 1.6))
      expect(last.y + 1.3 / 2).toBeCloseTo(gridHeight(technique, 5, 1.3))
    }
  })
})

describe('neighborsOf with a Brick block (ticket 477)', () => {
  it('has only the bead above and below inside a block of straight rows', () => {
    const weave = { technique: 'brick' as const, brickBlock: 2 }
    expect(neighborsOf(weave, undefined, { row: 0, column: 3 }).filter((p) => p.row === 1)).toEqual([{ row: 1, column: 3 }])
    expect(neighborsOf(weave, undefined, { row: 1, column: 3 }).filter((p) => p.row === 2)).toEqual([{ row: 2, column: 2 }, { row: 2, column: 3 }])
  })
})

describe('describeWeave: every question a Weave answers (ticket 481)', () => {
  it.each([
    ['loom', { technique: 'loom' as const }, { frameStep: 1, shifted: false, rowPitch: 1, roundness: 0, hasBrickBlock: false }],
    ['peyote', { technique: 'peyote' as const }, { frameStep: 2, shifted: true, rowPitch: 0.75, roundness: 0.22, hasBrickBlock: false }],
    ['brick stitch', { technique: 'brick' as const }, { frameStep: 2, shifted: true, rowPitch: 1, roundness: 0, hasBrickBlock: true }],
    ['brick stitch, Brick block 3', { technique: 'brick' as const, brickBlock: 3 }, { frameStep: 6, shifted: true, rowPitch: 1, roundness: 0, hasBrickBlock: true }],
  ])('%s', (_name, weave, expected) => {
    const weaveDescription = describeWeave(weave)
    expect(weaveDescription).toMatchObject({ ...expected, switchable: true, quarterTurn: true, rowDirection: true })
    expect(weaveDescription.hasPosition({ row: 4, column: 7 })).toBe(true)
    expect(weaveDescription.orientationAt({ row: 4, column: 7 })).toBe('upright')
    expect(weaveDescription.extent).toEqual({ width: 1, height: 1 })
  })
})
