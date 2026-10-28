// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cellCenter, describeWeave, heldSettings, gridHeight, gridWidth, neighborsOf, positionStep, rowCycle, rowOffset, rowPitch, techniqueGeometry, TECHNIQUES, weaveSettings, type Weave } from './weave'
import type { GeometryRef } from './weaveGeometry'

/** A Weave's passes, as Row progress asks for them (ticket 0621). */
const passesOf = (weave: Weave) => describeWeave(weave).passes

function sorted(positions: { row: number; column: number }[]) {
  return [...positions].sort((a, b) => a.row - b.row || a.column - b.column)
}

/** How many beads each pass weaves on a line of `length` beads, over `lines` lines. */
function passSizes(lines: number, length: number): number[] {
  const sizes = Array.from({ length: passesOf({ technique: 'peyote' }).count(lines, 'rows') }, () => 0)
  for (let line = 0; line < lines; line += 1) {
    for (let along = 0; along < length; along += 1) {
      sizes[passesOf({ technique: 'peyote' }).of(line, along, 'rows')] += 1
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
    expect([0, 1, 2, 3].map((lines) => passesOf({ technique: 'peyote' }).count(lines, 'rows'))).toEqual([0, 1, 3, 5])
  })

  it('puts a pass on the line it belongs to', () => {
    expect([0, 1, 2, 3, 4].map((pass) => passesOf({ technique: 'peyote' }).lineOf(pass, 'rows'))).toEqual([0, 1, 1, 2, 2])
  })
})

describe('loom and brick stitch passes', () => {
  it.each(['loom', 'brick'] as const)('are one whole line on %s', (technique) => {
    expect(passesOf({ technique }).count(5, 'rows')).toBe(5)
    expect(passesOf({ technique }).of(3, 4, 'rows')).toBe(3)
    expect(passesOf({ technique }).lineOf(3, 'rows')).toBe(3)
    expect(passesOf({ technique }).lines(3, 'rows')).toEqual([3])
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
    const rows = (brickBlock: number) => Array.from({ length: 8 }, (_row, row) => rowOffset({ technique: 'brick', techniqueSettings: { brickBlock } }, row, 20))
    expect(rows(1)).toEqual([0, 10, 0, 10, 0, 10, 0, 10])
    expect(rows(2)).toEqual([0, 0, 10, 10, 0, 0, 10, 10])
    expect(rows(3)).toEqual([0, 0, 0, 10, 10, 10, 0, 0])
  })

  it('keeps the rhythm unbroken on rows above row 0', () => {
    const rows = Array.from({ length: 6 }, (_row, index) => rowOffset({ technique: 'brick', techniqueSettings: { brickBlock: 2 } }, index - 4, 20))
    expect(rows).toEqual([0, 0, 10, 10, 0, 0])
  })

  it('ignores the Brick block on loom and peyote', () => {
    expect(rowOffset({ technique: 'peyote', techniqueSettings: { brickBlock: 3 } }, 1, 20)).toBe(10)
    expect(rowOffset({ technique: 'loom', techniqueSettings: { brickBlock: 3 } }, 3, 20)).toBe(0)
  })
})

describe('rowCycle', () => {
  it('is 1 for loom, 2 for peyote and 2N for brick stitch with a Brick block of N', () => {
    expect(rowCycle({ technique: 'loom' })).toBe(1)
    expect(rowCycle({ technique: 'peyote', techniqueSettings: { brickBlock: 4 } })).toBe(2)
    expect(rowCycle({ technique: 'brick' })).toBe(2)
    expect(rowCycle({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })).toBe(6)
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
  const dims = { row: 0, column: 0, columns: 5, rows: 5 }

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
    const weave = { technique: 'brick' as const, techniqueSettings: { brickBlock: 2 } }
    expect(neighborsOf(weave, undefined, { row: 0, column: 3 }).filter((p) => p.row === 1)).toEqual([{ row: 1, column: 3 }])
    expect(neighborsOf(weave, undefined, { row: 1, column: 3 }).filter((p) => p.row === 2)).toEqual([{ row: 2, column: 2 }, { row: 2, column: 3 }])
  })
})

describe('describeWeave: every question a Weave answers (ticket 481)', () => {
  const bead = { widthMm: 1.6, widthCorrectionMm: 0.1, heightMm: 1.3 }
  const here = { row: 4, column: 7 }

  it.each([
    ['loom', { technique: 'loom' as const }, { frameStep: 1, shifted: false, rowPitch: 1, twoPasses: false }],
    ['peyote', { technique: 'peyote' as const }, { frameStep: 2, shifted: true, rowPitch: 0.75, twoPasses: true }],
    ['brick stitch', { technique: 'brick' as const }, { frameStep: 2, shifted: true, rowPitch: 1, twoPasses: false }],
    ['brick stitch, Brick block 3', { technique: 'brick' as const, techniqueSettings: { brickBlock: 3 } }, { frameStep: 6, shifted: true, rowPitch: 1, twoPasses: false }],
  ])('%s', (_name, weave, expected) => {
    const description = describeWeave(weave)
    expect(description).toMatchObject(expected)
    expect(description.box(here, 2, 2)).toMatchObject({ width: 2, height: 2 })
    expect(description.turned({ row: 1, column: 2 }, { rows: 5, columns: 4 })).toEqual({ row: 2, column: 3 })
    expect(description.center(here, 2, 2)).toEqual({ x: 15 + rowOffset(weave, here.row, 2), y: 1 + 8 * description.rowPitch })
    expect(description.passes.lines(3, 'rows')).toEqual([description.passes.lineOf(3, 'rows')])
    expect(description.stepMm(bead).across).toBeCloseTo(1.7)
    expect(description.stepMm(bead).down).toBe(rowPitch(weave.technique, 1.3))
    // A Frame's first row is never shifted, so its corner is a whole row pitch down per row (ticket 0622).
    expect(description.origin({ row: 2, column: 3 }, 2, 2)).toEqual({ x: 6, y: 4 * description.rowPitch })
  })
})

describe('positionStep (ticket 492)', () => {
  it('is a bead across and a row pitch down for beads laid on rows', () => {
    expect(positionStep({ technique: 'loom' })).toEqual({ across: 1, down: 1 })
    expect(positionStep({ technique: 'peyote' })).toEqual({ across: 1, down: 0.75 })
    expect(positionStep({ technique: 'brick' })).toEqual({ across: 1, down: 1 })
  })

  it('stretches a step down by a Real bead\'s cell', () => {
    expect(positionStep({ technique: 'peyote', cell: { aspect: 1.2, roundness: 0 } })).toEqual({ across: 1, down: 1.2 * 0.75 })
  })
})

describe('the Technique registry (ADR 0078, ticket 0621)', () => {
  const fraction = (value: number) => Number.isFinite(value) && value >= 0 && value <= 0.5
  const step = (value: number) => Number.isFinite(value) && value > 0 && value <= 1

  /** What is wrong with a geometry's values for its kind; a kind no geometry has is wrong in itself. */
  function problems(geometry: GeometryRef): string[] {
    const found = fraction(geometry.roundness) ? [] : ['roundness']
    switch (geometry.kind) {
      case 'rows':
        if (!step(geometry.rowPitch)) found.push('rowPitch')
        if (!(Number.isFinite(geometry.cellAspect) && geometry.cellAspect > 0)) found.push('cellAspect')
        if (geometry.shifted ? !(geometry.shift > 0 && geometry.shift < 1) : geometry.shift !== 0) found.push('shift')
        if (!['one', 'twoAfterFirst'].includes(geometry.passes)) found.push('passes')
        if (!(Number.isInteger(geometry.block) && geometry.block >= 1)) found.push('block')
        return found
      default:
        return [`unknown kind ${(geometry as { kind: string }).kind}`]
    }
  }

  it('gives every Technique a known geometry kind with valid values', () => {
    expect(TECHNIQUES.flatMap((technique) => problems(techniqueGeometry(technique)).map((problem) => `${technique}: ${problem}`))).toEqual([])
  })

  it('offers loom, peyote and brick stitch, in that order (ticket 0644)', () => {
    expect(TECHNIQUES).toEqual(['loom', 'peyote', 'brick'])
  })

  it('builds a Weave\'s description once, and another for other settings or another Bead', () => {
    for (const technique of TECHNIQUES) {
      expect(describeWeave({ technique })).toBe(describeWeave({ technique }))
    }
    expect(describeWeave({ technique: 'brick', techniqueSettings: { brickBlock: 2 } })).not.toBe(describeWeave({ technique: 'brick' }))
    expect(describeWeave({ technique: 'loom', cell: { aspect: 0.8, roundness: 0.3 } }).cellAspect).toBe(0.8)
    expect(describeWeave({ technique: 'loom' }).cellAspect).toBe(1)
  })

  it('reads a Weave\'s settings from its map alone, each its Technique describes within its range (ticket 0625)', () => {
    expect(weaveSettings({ technique: 'brick', techniqueSettings: { brickBlock: 99 } })).toEqual({ brickBlock: 20 })
    expect(weaveSettings({ technique: 'loom', techniqueSettings: { brickBlock: 3 } })).toEqual({})
  })

  it('holds every setting a Technique describes, a Brick block kept off brick stitch, and no setting no Technique describes (ticket 0625)', () => {
    expect(heldSettings('brick')).toEqual({ brickBlock: 1 })
    expect(heldSettings('loom', { brickBlock: 3, beadsPerLoop: 5 })).toEqual({ brickBlock: 3 })
    expect(heldSettings('peyote')).toEqual({})
  })
})
