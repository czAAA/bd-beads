// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cellCenter, clampNetSize, describeWeave, gridHeight, gridWidth, lineOfPass, neighborsOf, passCount, passLines, passOf, rowCycle, rowOffset, rowPitch } from './weave'

function sorted(positions: { row: number; column: number }[]) {
  return [...positions].sort((a, b) => a.row - b.row || a.column - b.column)
}

/** How many beads each pass weaves on a line of `length` beads, over `lines` lines. */
function passSizes(lines: number, length: number): number[] {
  const sizes = Array.from({ length: passCount({ technique: 'peyote' }, lines, 'rows') }, () => 0)
  for (let line = 0; line < lines; line += 1) {
    for (let along = 0; along < length; along += 1) {
      sizes[passOf({ technique: 'peyote' }, line, along, 'rows')] += 1
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
    expect([0, 1, 2, 3].map((lines) => passCount({ technique: 'peyote' }, lines, 'rows'))).toEqual([0, 1, 3, 5])
  })

  it('puts a pass on the line it belongs to', () => {
    expect([0, 1, 2, 3, 4].map((pass) => lineOfPass({ technique: 'peyote' }, pass, 'rows'))).toEqual([0, 1, 1, 2, 2])
  })
})

describe('loom and brick stitch passes', () => {
  it.each(['loom', 'brick'] as const)('are one whole line on %s', (technique) => {
    expect(passCount({ technique }, 5, 'rows')).toBe(5)
    expect(passOf({ technique }, 3, 4, 'rows')).toBe(3)
    expect(lineOfPass({ technique }, 3, 'rows')).toBe(3)
    expect(passLines({ technique }, 3, 'rows')).toEqual([3])
  })
})

describe('Netting passes (ticket 487)', () => {
  const weave = (netSize: number) => ({ technique: 'netting' as const, netSize })

  it('counts a row of diamonds per pass', () => {
    // A Frame of V rows of diamonds holds (V + 1)p + 1 rows of positions.
    expect([5, 9, 13].map((rows) => passCount(weave(3), rows, 'rows'))).toEqual([1, 3, 5])
    expect([7, 10, 13].map((rows) => passCount(weave(5), rows, 'rows'))).toEqual([1, 2, 3])
    expect([0, 1, 4].map((rows) => passCount(weave(3), rows, 'rows'))).toEqual([0, 0, 0])
  })

  it('weaves the first row of diamonds whole and each later one from below the row the one before ended on', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((row) => passOf(weave(3), row, 0, 'rows'))).toEqual([0, 0, 0, 0, 0, 1, 1, 2, 2])
    expect([0, 1, 2].map((pass) => passLines(weave(3), pass, 'rows'))).toEqual([[0, 1, 2, 3, 4], [5, 6], [7, 8]])
    expect([0, 1].map((pass) => passLines(weave(5), pass, 'rows'))).toEqual([[0, 1, 2, 3, 4, 5, 6], [7, 8, 9]])
  })

  it('puts the ruler marker on the first row of the diamonds a pass weaves', () => {
    expect([0, 1, 2].map((pass) => lineOfPass(weave(3), pass, 'rows'))).toEqual([0, 2, 4])
    expect([0, 1, 2].map((pass) => lineOfPass(weave(7), pass, 'rows'))).toEqual([0, 4, 8])
  })

  it('gives every row of positions to one pass of passLines', () => {
    const rows = 5 * 3 + 1
    const lines = [0, 1, 2, 3].flatMap((pass) => passLines(weave(5), pass, 'rows').map((line) => ({ line, pass })))
    expect(lines.map(({ line }) => line)).toEqual(Array.from({ length: rows }, (_row, line) => line))
    expect(lines.every(({ line, pass }) => passOf(weave(5), line, 0, 'rows') === pass)).toBe(true)
  })
})

describe('Right-angle weave passes (ticket 484)', () => {
  // A Frame of 3 lines of Units across 2 columns of Units: 7 rows and 3 columns of positions.
  it('counts a line of Units per pass, in rows and in columns', () => {
    expect([1, 3, 5, 7].map((rows) => passCount({ technique: 'rightAngle' }, rows, 'rows'))).toEqual([0, 1, 2, 3])
    expect([2, 3, 4].map((columns) => passCount({ technique: 'rightAngle' }, columns, 'columns'))).toEqual([1, 2, 3])
    expect([0, 1].map((n) => passCount({ technique: 'rightAngle' }, n, 'rows'))).toEqual([0, 0])
  })

  it('weaves the first line of Units in three rows of positions and every later one in the two below', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((row) => passOf({ technique: 'rightAngle' }, row, 0, 'rows'))).toEqual([0, 0, 0, 1, 1, 2, 2])
    expect([0, 1, 2, 3].map((pass) => passLines({ technique: 'rightAngle' }, pass, 'rows'))).toEqual([[0, 1, 2], [3, 4], [5, 6], [7, 8]])
  })

  it('weaves a column of Units in its horizontal beads and the vertical beads either side of it', () => {
    const along = (row: number) => [0, 1, 2, 3].map((column) => passOf({ technique: 'rightAngle' }, column, row, 'columns'))
    expect(along(0)).toEqual([0, 1, 2, 3])
    expect(along(1)).toEqual([0, 0, 1, 2])
    expect([0, 1, 2].map((pass) => passLines({ technique: 'rightAngle' }, pass, 'columns'))).toEqual([[0, 1], [1, 2], [2, 3]])
  })

  it('puts the ruler marker on the Unit line a pass weaves', () => {
    expect([0, 1, 2].map((pass) => lineOfPass({ technique: 'rightAngle' }, pass, 'rows'))).toEqual([0, 2, 4])
    expect([0, 1, 2].map((pass) => lineOfPass({ technique: 'rightAngle' }, pass, 'columns'))).toEqual([0, 1, 2])
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
  const bead = { widthMm: 1.6, widthCorrectionMm: 0.1, heightMm: 1.3 }
  const here = { row: 4, column: 7 }
  const dims = { columns: 10, rows: 10 }

  it.each([
    ['loom', { technique: 'loom' as const }, { frameStep: 1, shifted: false, rowPitch: 1, hasBrickBlock: false, twoPasses: false }],
    ['peyote', { technique: 'peyote' as const }, { frameStep: 2, shifted: true, rowPitch: 0.75, hasBrickBlock: false, twoPasses: true }],
    ['brick stitch', { technique: 'brick' as const }, { frameStep: 2, shifted: true, rowPitch: 1, hasBrickBlock: true, twoPasses: false }],
    ['brick stitch, Brick block 3', { technique: 'brick' as const, brickBlock: 3 }, { frameStep: 6, shifted: true, rowPitch: 1, hasBrickBlock: true, twoPasses: false }],
  ])('%s', (_name, weave, expected) => {
    const description = describeWeave(weave)
    expect(description).toMatchObject({ ...expected, switchable: true, quarterTurn: true, rowDirection: true })
    expect(description.hasPosition(here)).toBe(true)
    expect(description.orientationAt(here)).toBe('upright')
    expect(description.box(here, 2, 2)).toMatchObject({ width: 2, height: 2 })
    expect(description.turned(here)).toEqual(here)
    expect(description.mirrored(here)).toEqual(here)
    expect(description.center(here, 2, 2)).toEqual(cellCenter(weave, here, 2, 2))
    expect(description.neighbors(dims, here)).toEqual(neighborsOf(weave, dims, here))
    expect(description.passes.count(5, 'rows')).toBe(passCount(weave, 5, 'rows'))
    expect(description.passes.of(3, 1, 'rows')).toBe(passOf(weave, 3, 1, 'rows'))
    expect(description.passes.lineOf(3, 'rows')).toBe(lineOfPass(weave, 3, 'rows'))
    expect(description.stepMm(bead).across).toBeCloseTo(1.7)
    expect(description.stepMm(bead).down).toBe(rowPitch(weave.technique, 1.3))
  })
})

describe('describeWeave: Right-angle weave (ticket 482)', () => {
  const weave = { technique: 'rightAngle' as const }
  const description = describeWeave(weave)
  // A bead 20 long and 14 across: a Unit is 34 a side.
  const box = (row: number, column: number) => description.box({ row, column }, 20, 14)

  it('counts Units, steps by a whole Unit and is fixed once the Project is made', () => {
    expect(description).toMatchObject({ countsUnits: true, frameStep: 2, rowsPerUnit: 2, switchable: false, quarterTurn: false, hasBrickBlock: false })
  })

  it('lays horizontal beads lying along a line and vertical beads upright, round a hole one length square', () => {
    expect(box(0, 0)).toEqual({ x: 14, y: 0, width: 20, height: 14 })
    expect(box(1, 0)).toEqual({ x: 0, y: 14, width: 14, height: 20 })
    expect(box(1, 1)).toEqual({ x: 34, y: 14, width: 14, height: 20 })
    expect(box(2, 0)).toEqual({ x: 14, y: 34, width: 20, height: 14 })
    expect([0, 1, 2, 3].map((row) => description.orientationAt({ row, column: 0 }))).toEqual(['sideways', 'upright', 'sideways', 'upright'])
  })

  it('keeps the same pattern above row 0', () => {
    expect(box(-1, 0)).toEqual({ x: 0, y: -20, width: 14, height: 20 })
    expect(box(-2, 0)).toEqual({ x: 14, y: -34, width: 20, height: 14 })
  })

  it('has beads touching only at their corners, none overlapping', () => {
    const boxes = [0, 1, 2, 3].flatMap((row) => [0, 1, 2].map((column) => box(row, column)))
    for (const [index, a] of boxes.entries()) {
      for (const b of boxes.slice(index + 1)) {
        const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
        const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
        expect(across > 0 && down > 0).toBe(false)
      }
    }
  })

  it('finds the bead under a point, and none in a hole or a corner gap', () => {
    expect(description.positionAt(20, 5, 20, 14)).toEqual({ row: 0, column: 0 })
    expect(description.positionAt(5, 25, 20, 14)).toEqual({ row: 1, column: 0 })
    expect(description.positionAt(60, 5, 20, 14)).toEqual({ row: 0, column: 1 })
    expect(description.positionAt(24, 24, 20, 14)).toBeUndefined()
    expect(description.positionAt(5, 5, 20, 14)).toBeUndefined()
  })

  it('names the bead nearest a point in a gap', () => {
    expect(description.nearestPosition(7, 20, 20, 14)).toEqual({ row: 1, column: 0 })
    expect(description.nearestPosition(30, 8, 20, 14)).toEqual({ row: 0, column: 0 })
  })

  it('has one more vertical bead than horizontal ones on a line, so a Frame of Units takes one more column and two rows each', () => {
    expect(description.positionsOf({ columns: 3, rows: 2 })).toEqual({ columns: 4, rows: 5 })
    expect(description.unitsOf({ columns: 4, rows: 5 })).toEqual({ columns: 3, rows: 2 })
    expect(description.blockExtent(4, 5, 20, 14)).toEqual({ width: 3 * 34 + 14, height: 2 * 34 + 14 })
    const frame = { row: 0, column: 0, columns: 4, rows: 5 }
    expect(description.hasPosition({ row: 0, column: 2 }, frame)).toBe(true)
    expect(description.hasPosition({ row: 0, column: 3 }, frame)).toBe(false)
    expect(description.hasPosition({ row: 1, column: 3 }, frame)).toBe(true)
  })

  it('makes a Frame end on a whole Unit', () => {
    expect(description.snapBottom(0, 3)).toBe(4)
    expect(description.snapBottom(0, 4)).toBe(4)
    expect(description.snapBottom(4, 4)).toBe(6)
  })

  it('touches only the beads at its corners, each both ways', () => {
    expect(sorted(description.neighbors(undefined, { row: 0, column: 2 }))).toEqual(
      sorted([{ row: -1, column: 2 }, { row: -1, column: 3 }, { row: 1, column: 2 }, { row: 1, column: 3 }]),
    )
    expect(sorted(description.neighbors(undefined, { row: 1, column: 2 }))).toEqual(
      sorted([{ row: 0, column: 1 }, { row: 0, column: 2 }, { row: 2, column: 1 }, { row: 2, column: 2 }]),
    )
    for (const row of [0, 1, 2, 3]) {
      for (const column of [0, 1, 2]) {
        for (const neighbor of description.neighbors(undefined, { row, column })) {
          expect(description.neighbors(undefined, neighbor)).toContainEqual({ row, column })
        }
      }
    }
  })

  it('measures a Unit in mm as the Bead\'s length plus its width, each way', () => {
    expect(description.stepMm({ widthMm: 1.6, widthCorrectionMm: 0.1, heightMm: 1.3 })).toEqual({ across: 1.6 + 0.1 + 1.3, down: 1.6 + 0.1 + 1.3 })
  })
})

describe('describeWeave: Netting (ticket 485)', () => {
  const nets = [3, 5, 7, 9].map((netSize) => ({ netSize, p: (netSize + 1) / 2, description: describeWeave({ technique: 'netting', netSize }) }))
  const beadsIn = (description: ReturnType<typeof describeWeave>, rows: number, columns: number, top = 0, left = 0) =>
    Array.from({ length: rows * columns }, (_cell, at) => ({ row: top + Math.floor(at / columns), column: left + (at % columns) })).filter((position) => description.hasPosition(position))

  it('counts Units, steps by a whole diamond, offers no turn or row direction and is fixed once the Project is made', () => {
    for (const { p, description } of nets) {
      expect(description).toMatchObject({ countsUnits: true, frameStep: 2 * p, columnStep: 2 * p, rowsPerUnit: p, columnsPerUnit: 2 * p, switchable: false, quarterTurn: false, rowDirection: false, hasNetSize: true, hasBrickBlock: false })
      expect(description.turned({ row: 1, column: 1 })).toBeUndefined()
    }
  })

  it('reads a missing or odd-out Net size as the nearest odd one from 3 to 9', () => {
    expect([undefined, 4, 5, 8, 12, 1].map(clampNetSize)).toEqual([3, 3, 5, 7, 9, 3])
    expect(describeWeave({ technique: 'netting' })).toMatchObject({ frameStep: 4 })
  })

  it('lays a 3-bead net as a diamond tip, two edge beads, the side corners, two more and the bottom tip', () => {
    const { description } = nets[0]!
    expect(beadsIn(description, 5, 5)).toEqual([
      { row: 0, column: 2 },
      { row: 1, column: 1 },
      { row: 1, column: 3 },
      { row: 2, column: 0 },
      { row: 2, column: 4 },
      { row: 3, column: 1 },
      { row: 3, column: 3 },
      { row: 4, column: 2 },
    ])
  })

  it('lays a 5-bead net with two beads along each strand between shared beads', () => {
    const { description } = nets[1]!
    expect(beadsIn(description, 7, 7).filter(({ row }) => row <= 3)).toEqual([
      { row: 0, column: 3 },
      { row: 1, column: 2 },
      { row: 1, column: 4 },
      { row: 2, column: 1 },
      { row: 2, column: 5 },
      { row: 3, column: 0 },
      { row: 3, column: 6 },
    ])
  })

  it('holds as many beads as its Net size in each diamond, shared beads once', () => {
    for (const { netSize, p, description } of nets) {
      // A cell of the lattice (2p each way) holds two diamonds.
      expect(beadsIn(description, 2 * p, 2 * p)).toHaveLength(2 * netSize)
    }
  })

  it('repeats the same lattice a diamond across and down, and above and left of row 0', () => {
    for (const { p, description } of nets) {
      for (let row = -3; row < 6; row += 1) {
        for (let column = -3; column < 6; column += 1) {
          expect(description.hasPosition({ row, column })).toBe(description.hasPosition({ row: row + 2 * p, column: column + 2 * p }))
          expect(description.hasPosition({ row, column })).toBe(description.hasPosition({ row: row + 2 * p, column: column - 2 * p }))
        }
      }
    }
  })

  it('draws every bead round and upright where it sits, never overlapping its neighbours', () => {
    for (const { p, description } of nets) {
      const beads = beadsIn(description, 4 * p, 4 * p).map((position) => description.center(position, 20, 20))
      expect(description.orientationAt({ row: 0, column: p })).toBe('upright')
      expect(description.box({ row: 1, column: p + 1 }, 20, 20)).toEqual({ x: (p + 1) * 15, y: 15, width: 20, height: 20 })
      for (const [at, a] of beads.entries()) {
        for (const b of beads.slice(at + 1)) {
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(20)
        }
      }
    }
  })

  it('has a Frame of whole diamonds: a diamond across and down is its width plus one and its height plus one', () => {
    for (const { p, description } of nets) {
      expect(description.positionsOf({ columns: 1, rows: 1 })).toEqual({ columns: 2 * p + 1, rows: 2 * p + 1 })
      expect(description.positionsOf({ columns: 3, rows: 2 })).toEqual({ columns: 6 * p + 1, rows: 3 * p + 1 })
      expect(description.unitsOf(description.positionsOf({ columns: 3, rows: 2 }))).toEqual({ columns: 3, rows: 2 })
      expect(description.smallest).toEqual({ columns: 2 * p + 1, rows: 2 * p + 1 })
    }
  })

  it('ends a Frame on a whole diamond across and down', () => {
    const { description } = nets[0]!
    expect(description.snapBottom(0, 4)).toBe(4)
    expect(description.snapBottom(0, 5)).toBe(6)
    expect(description.snapBottom(4, 4)).toBe(8)
    expect(description.snapRight(0, 4)).toBe(4)
    expect(description.snapRight(8, 9)).toBe(12)
    expect(description.snapRight(8, 8)).toBe(12)
  })

  it('touches along the strands: four beads at a shared bead, two on a strand', () => {
    const { description } = nets[0]!
    expect(sorted(description.neighbors(undefined, { row: 1, column: 1 }))).toEqual([
      { row: 0, column: 2 },
      { row: 2, column: 0 },
    ])
    expect(sorted(description.neighbors(undefined, { row: 2, column: 0 }))).toEqual([
      { row: 1, column: -1 },
      { row: 1, column: 1 },
      { row: 3, column: -1 },
      { row: 3, column: 1 },
    ])
    expect(sorted(description.neighbors({ row: 0, column: 0, rows: 5, columns: 5 }, { row: 4, column: 2 }))).toEqual([
      { row: 3, column: 1 },
      { row: 3, column: 3 },
    ])
  })

  it('finds the bead under a point, none in a hole, and the nearest bead from a hole', () => {
    const { description } = nets[0]!
    const at = description.center({ row: 1, column: 1 }, 20, 20)
    expect(description.positionAt(at.x, at.y, 20, 20)).toEqual({ row: 1, column: 1 })
    const hole = description.center({ row: 0, column: 0 }, 20, 20)
    expect(description.hasPosition({ row: 0, column: 0 })).toBe(false)
    expect(description.positionAt(hole.x, hole.y, 20, 20)).toBeUndefined()
    expect(description.hasPosition(description.nearestPosition(hole.x, hole.y, 20, 20))).toBe(true)
  })

  it('measures a diamond in mm from the Bead, a strand step being three quarters of it', () => {
    const bead = { widthMm: 1.6, widthCorrectionMm: 0.1, heightMm: 1.3 }
    expect(nets[0]!.description.stepMm(bead).across).toBeCloseTo(4 * 0.75 * 1.7)
    expect(nets[0]!.description.stepMm(bead).down).toBeCloseTo(2 * 0.75 * 1.3)
    expect(nets[1]!.description.stepMm(bead).across).toBeCloseTo(6 * 0.75 * 1.7)
  })
})
