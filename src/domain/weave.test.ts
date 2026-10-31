// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cellCenter, columnCycle, columnOffset, describeWeave, heldSettings, neighborsOf, positionStep, rowCycle, rowOffset, techniqueGeometry, TECHNIQUES, touchKey, weaveSettings, type Weave } from './weave'
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
  it('never offsets loom rows, nor peyote rows, whose columns are the staggered ones (ticket 0734)', () => {
    for (const technique of ['loom', 'peyote'] as const) {
      expect([0, 1, 2, 3].map((row) => rowOffset({ technique }, row, 20))).toEqual([0, 0, 0, 0])
    }
  })

  it('offsets alternating brick stitch rows by half a cell', () => {
    expect(rowOffset({ technique: 'brick' }, 0, 20)).toBe(0)
    expect(rowOffset({ technique: 'brick' }, 1, 20)).toBe(10)
  })

  it('shifts brick stitch in blocks of its Drop: N straight rows, then N shifted (tickets 477, 0691)', () => {
    const rows = (brickDrop: number) => Array.from({ length: 8 }, (_row, row) => rowOffset({ technique: 'brick', techniqueSettings: { brickDrop } }, row, 20))
    expect(rows(1)).toEqual([0, 10, 0, 10, 0, 10, 0, 10])
    expect(rows(2)).toEqual([0, 0, 10, 10, 0, 0, 10, 10])
    expect(rows(3)).toEqual([0, 0, 0, 10, 10, 10, 0, 0])
  })

  it('keeps the rhythm unbroken on rows above row 0', () => {
    const rows = Array.from({ length: 6 }, (_row, index) => rowOffset({ technique: 'brick', techniqueSettings: { brickDrop: 2 } }, index - 4, 20))
    expect(rows).toEqual([0, 0, 10, 10, 0, 0])
  })

  it('reads each Technique\'s own Drop: peyote\'s on brick stitch is ignored, as both are on loom', () => {
    expect(rowOffset({ technique: 'brick', techniqueSettings: { peyoteDrop: 3 } }, 1, 20)).toBe(10)
    expect(rowOffset({ technique: 'loom', techniqueSettings: { brickDrop: 3, peyoteDrop: 3 } }, 3, 20)).toBe(0)
  })
})

describe('columnOffset (ticket 0734)', () => {
  it('never offsets loom or brick stitch columns', () => {
    for (const technique of ['loom', 'brick'] as const) {
      expect([0, 1, 2, 3].map((column) => columnOffset({ technique }, column, 20))).toEqual([0, 0, 0, 0])
    }
  })

  it('offsets alternating peyote columns down by half a cell', () => {
    expect([0, 1, 2, 3].map((column) => columnOffset({ technique: 'peyote' }, column, 20))).toEqual([0, 10, 0, 10])
  })

  it('shifts peyote in blocks of its Drop: N columns level, then N shifted, a full bead apart (tickets 0691, 0734)', () => {
    const columns = (peyoteDrop: number) => Array.from({ length: 8 }, (_column, column) => columnOffset({ technique: 'peyote', techniqueSettings: { peyoteDrop } }, column, 20))
    expect(columns(1)).toEqual([0, 10, 0, 10, 0, 10, 0, 10])
    expect(columns(2)).toEqual([0, 0, 10, 10, 0, 0, 10, 10])
    expect(columns(3)).toEqual([0, 0, 0, 10, 10, 10, 0, 0])
    expect(cellCenter({ technique: 'peyote', techniqueSettings: { peyoteDrop: 2 } }, { row: 0, column: 2 }, 2, 2).x).toBe(cellCenter({ technique: 'peyote' }, { row: 0, column: 2 }, 2, 2).x)
  })

  it('keeps the rhythm unbroken on columns left of column 0', () => {
    const columns = Array.from({ length: 6 }, (_column, index) => columnOffset({ technique: 'peyote', techniqueSettings: { peyoteDrop: 2 } }, index - 4, 20))
    expect(columns).toEqual([0, 0, 10, 10, 0, 0])
  })

  it('reads each Technique\'s own Drop: brick stitch\'s on peyote is ignored', () => {
    expect(columnOffset({ technique: 'peyote', techniqueSettings: { brickDrop: 3 } }, 1, 20)).toBe(10)
  })
})

describe('rowCycle and columnCycle', () => {
  it('stagger rows in brick stitch alone: 2N for a Drop of N, and 1 for loom and peyote (ticket 0734)', () => {
    expect(rowCycle({ technique: 'loom' })).toBe(1)
    expect(rowCycle({ technique: 'peyote', techniqueSettings: { peyoteDrop: 4 } })).toBe(1)
    expect(rowCycle({ technique: 'brick' })).toBe(2)
    expect(rowCycle({ technique: 'brick', techniqueSettings: { brickDrop: 3 } })).toBe(6)
  })

  it('stagger columns in peyote alone: 2N for a Drop of N, and 1 for loom and brick stitch', () => {
    expect(columnCycle({ technique: 'loom' })).toBe(1)
    expect(columnCycle({ technique: 'brick', techniqueSettings: { brickDrop: 4 } })).toBe(1)
    expect(columnCycle({ technique: 'peyote', techniqueSettings: { brickDrop: 4 } })).toBe(2)
    expect(columnCycle({ technique: 'peyote', techniqueSettings: { peyoteDrop: 4 } })).toBe(8)
  })

  it('keys the way beads touch by both, so brick stitch and peyote with the same Drop differ', () => {
    expect(touchKey({ technique: 'brick' })).not.toBe(touchKey({ technique: 'peyote' }))
    expect(touchKey({ technique: 'brick', techniqueSettings: { brickDrop: 2 } })).not.toBe(touchKey({ technique: 'brick' }))
    expect(touchKey({ technique: 'loom' })).toBe(touchKey({ technique: 'loom', techniqueSettings: { brickDrop: 3 } }))
  })
})

describe('blockExtent', () => {
  it('is just columns and rows times the cell for loom', () => {
    expect(describeWeave({ technique: 'loom' }).blockExtent(10, 10, 20, 20)).toEqual({ width: 200, height: 200 })
  })

  it('adds half a cell across for brick stitch, whose rows shift', () => {
    expect(describeWeave({ technique: 'brick' }).blockExtent(10, 10, 20, 20)).toEqual({ width: 210, height: 200 })
  })

  it('adds half a cell down for peyote, whose columns shift, and nests nothing (ticket 0734)', () => {
    expect(describeWeave({ technique: 'peyote' }).blockExtent(10, 10, 20, 20)).toEqual({ width: 200, height: 210 })
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

  it('gives a brick stitch cell in an unshifted row two neighbors in each shifted adjacent row', () => {
    // row 2 is unshifted; rows 1 and 3 are shifted right by half a cell, so each overlaps columns {1,2} of row 2's column 2.
    expect(sorted(neighborsOf({ technique: 'brick' }, dims, { row: 2, column: 2 }))).toEqual(
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

  it('gives a brick stitch cell in a shifted row two neighbors in each unshifted adjacent row', () => {
    // row 1 is shifted right; rows 0 and 2 are unshifted, so each overlaps columns {2,3} of row 1's column 2.
    expect(sorted(neighborsOf({ technique: 'brick' }, dims, { row: 1, column: 2 }))).toEqual(
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

  it('gives a peyote cell in an unshifted column two neighbors in each shifted adjacent column (ticket 0734)', () => {
    // column 2 is unshifted; columns 1 and 3 sit half a cell lower, so each overlaps rows {1,2} of column 2's row 2.
    expect(sorted(neighborsOf({ technique: 'peyote' }, dims, { row: 2, column: 2 }))).toEqual(
      sorted([
        { row: 1, column: 2 },
        { row: 3, column: 2 },
        { row: 1, column: 1 },
        { row: 2, column: 1 },
        { row: 1, column: 3 },
        { row: 2, column: 3 },
      ]),
    )
  })

  it('gives a peyote cell in a shifted column two neighbors in each unshifted adjacent column', () => {
    // column 1 sits lower; columns 0 and 2 are unshifted, so each overlaps rows {2,3} of column 1's row 2.
    expect(sorted(neighborsOf({ technique: 'peyote' }, dims, { row: 2, column: 1 }))).toEqual(
      sorted([
        { row: 1, column: 1 },
        { row: 3, column: 1 },
        { row: 2, column: 0 },
        { row: 3, column: 0 },
        { row: 2, column: 2 },
        { row: 3, column: 2 },
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

  it('is peyote\'s the way brick stitch\'s is with rows and columns swapped, a Drop and all', () => {
    const turned = ({ row, column }: { row: number; column: number }) => ({ row: column, column: row })
    for (const drop of [1, 2, 3]) {
      const brick = { technique: 'brick' as const, techniqueSettings: { brickDrop: drop } }
      const peyote = { technique: 'peyote' as const, techniqueSettings: { peyoteDrop: drop } }
      for (const position of [{ row: 2, column: 5 }, { row: 3, column: 4 }, { row: 5, column: 3 }]) {
        expect(sorted(neighborsOf(peyote, undefined, position))).toEqual(sorted(neighborsOf(brick, undefined, turned(position)).map(turned)))
      }
    }
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

  it('shifts brick stitch odd rows across by half a cell, and peyote odd columns down (ticket 0734)', () => {
    expect(cellCenter({ technique: 'brick' }, { row: 1, column: 0 }, 2, 2).x).toBe(2)
    expect(cellCenter({ technique: 'brick' }, { row: 2, column: 0 }, 2, 2).x).toBe(1)
    expect(cellCenter({ technique: 'peyote' }, { row: 0, column: 1 }, 2, 2)).toEqual({ x: 3, y: 2 })
    expect(cellCenter({ technique: 'peyote' }, { row: 0, column: 2 }, 2, 2)).toEqual({ x: 5, y: 1 })
  })

  it('packs every Technique a full cell apart down its rows and across its columns: nothing nests', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      expect(cellCenter({ technique }, { row: 2, column: 0 }, 2, 2).y).toBe(1 + 2 * 2)
      expect(cellCenter({ technique }, { row: 0, column: 2 }, 2, 2).x).toBe(1 + 2 * 2)
    }
  })

  it('uses the bead footprint independently per axis, so a Delica cell is not square', () => {
    const center = cellCenter({ technique: 'loom' }, { row: 1, column: 1 }, 1.6, 1.3)
    expect(center.x).toBeCloseTo(2.4)
    expect(center.y).toBeCloseTo(1.95)
  })

  it.each([
    ['loom', 0, 0],
    ['peyote', 0, 0],
    ['brick', 0.8, 0],
  ] as const)('lands the last %s cell short of the far edges the block extent reports by what its stagger adds on', (technique, rightRoom, bottomRoom) => {
    const last = cellCenter({ technique }, { row: 4, column: 5 }, 1.6, 1.3)
    const extent = describeWeave({ technique }).blockExtent(6, 5, 1.6, 1.3)
    expect(extent.width - (last.x + 1.6 / 2)).toBeCloseTo(rightRoom)
    expect(extent.height - (last.y + 1.3 / 2)).toBeCloseTo(bottomRoom)
  })
})

describe('neighborsOf with a Drop (ticket 477)', () => {
  it('has only the bead above and below inside a block of straight rows', () => {
    const weave = { technique: 'brick' as const, techniqueSettings: { brickDrop: 2 } }
    expect(neighborsOf(weave, undefined, { row: 0, column: 3 }).filter((p) => p.row === 1)).toEqual([{ row: 1, column: 3 }])
    expect(neighborsOf(weave, undefined, { row: 1, column: 3 }).filter((p) => p.row === 2)).toEqual([{ row: 2, column: 2 }, { row: 2, column: 3 }])
  })

  it('has only the bead beside it inside a block of straight columns (ticket 0734)', () => {
    const weave = { technique: 'peyote' as const, techniqueSettings: { peyoteDrop: 2 } }
    expect(neighborsOf(weave, undefined, { row: 3, column: 0 }).filter((p) => p.column === 1)).toEqual([{ row: 3, column: 1 }])
    expect(neighborsOf(weave, undefined, { row: 3, column: 1 }).filter((p) => p.column === 2)).toEqual([{ row: 2, column: 2 }, { row: 3, column: 2 }])
  })
})

describe('describeWeave: every question a Weave answers (ticket 481)', () => {
  const bead = { widthMm: 1.6, widthCorrectionMm: 0.1, heightMm: 1.3 }
  const here = { row: 4, column: 7 }

  it.each([
    ['loom', { technique: 'loom' as const }, { rowCycle: 1, columnCycle: 1, shifted: false, staggers: 'rows', twoPasses: false, threadDirection: 'leftToRight' }, { across: 1.7, down: 1.3 }],
    ['peyote', { technique: 'peyote' as const }, { rowCycle: 1, columnCycle: 2, shifted: true, staggers: 'columns', twoPasses: true, threadDirection: 'leftToRight' }, { across: 1.7, down: 1.3 }],
    ['peyote, Drop 2', { technique: 'peyote' as const, techniqueSettings: { peyoteDrop: 2 } }, { rowCycle: 1, columnCycle: 4, shifted: true, staggers: 'columns', twoPasses: true, threadDirection: 'leftToRight' }, { across: 1.7, down: 1.3 }],
    ['brick stitch', { technique: 'brick' as const }, { rowCycle: 2, columnCycle: 1, shifted: true, staggers: 'rows', twoPasses: false, threadDirection: 'topToBottom' }, { across: 1.3, down: 1.7 }],
    ['brick stitch, Drop 3', { technique: 'brick' as const, techniqueSettings: { brickDrop: 3 } }, { rowCycle: 6, columnCycle: 1, shifted: true, staggers: 'rows', twoPasses: false, threadDirection: 'topToBottom' }, { across: 1.3, down: 1.7 }],
  ])('%s', (_name, weave, expected, step) => {
    const description = describeWeave(weave)
    expect(description).toMatchObject(expected)
    expect(description.box(here, 2, 2)).toMatchObject({ width: 2, height: 2 })
    expect(description.turned({ row: 1, column: 2 }, { rows: 5, columns: 4 })).toEqual({ row: 2, column: 3 })
    expect(description.center(here, 2, 2)).toEqual({ x: 15 + rowOffset(weave, here.row, 2), y: 9 + columnOffset(weave, here.column, 2) })
    expect(description.passes.lines(3, 'rows')).toEqual([description.passes.lineOf(3, 'rows')])
    expect(description.stepMm(bead).across).toBeCloseTo(step.across)
    expect(description.stepMm(bead).down).toBeCloseTo(step.down)
    // A Frame's first row and column are never shifted, so its corner is a whole cell per row and column (ticket 0622).
    expect(description.origin({ row: 2, column: 4 }, 2, 2)).toEqual({ x: 8, y: 4 })
  })
})

describe('the Thread direction (ticket 0734)', () => {
  const delica = { widthMm: 1.3, widthCorrectionMm: 0, heightMm: 1.6 }

  it('is fixed by the Technique: left to right on loom and peyote, top to bottom on brick stitch', () => {
    expect(TECHNIQUES.map((technique) => describeWeave({ technique }).threadDirection)).toEqual(['leftToRight', 'leftToRight', 'topToBottom'])
  })

  it('lays a bead with its length along the thread: a Delica 11/0 is taller than wide on loom and peyote, wider than tall on brick stitch', () => {
    expect(describeWeave({ technique: 'loom' }).beadMm(delica)).toEqual({ widthMm: 1.3, heightMm: 1.6 })
    expect(describeWeave({ technique: 'peyote' }).beadMm(delica)).toEqual({ widthMm: 1.3, heightMm: 1.6 })
    expect(describeWeave({ technique: 'brick' }).beadMm(delica)).toEqual({ widthMm: 1.6, heightMm: 1.3 })
  })

  it('adds the thread slack along the thread: across on loom and peyote, down on brick stitch', () => {
    const slack = { ...delica, widthCorrectionMm: 0.2 }
    expect(describeWeave({ technique: 'loom' }).stepMm(slack)).toEqual({ across: 1.5, down: 1.6 })
    expect(describeWeave({ technique: 'peyote' }).stepMm(slack)).toEqual({ across: 1.5, down: 1.6 })
    expect(describeWeave({ technique: 'brick' }).stepMm(slack)).toEqual({ across: 1.6, down: 1.5 })
  })

  it('turns a bead whose hole runs across its width the other way', () => {
    const sideways = { ...delica, widthCorrectionMm: 0.2, formFactor: { holes: { count: 1, direction: 'across' as const } } }
    expect(describeWeave({ technique: 'loom' }).beadMm(sideways)).toEqual({ widthMm: 1.8, heightMm: 1.3 })
    expect(describeWeave({ technique: 'brick' }).beadMm(sideways)).toEqual({ widthMm: 1.3, heightMm: 1.8 })
  })
})

describe('positionStep (ticket 492)', () => {
  it('is a bead across and a bead down for beads laid on rows and columns, nothing nesting (ticket 0734)', () => {
    expect(positionStep({ technique: 'loom' })).toEqual({ across: 1, down: 1 })
    expect(positionStep({ technique: 'peyote' })).toEqual({ across: 1, down: 1 })
    expect(positionStep({ technique: 'brick' })).toEqual({ across: 1, down: 1 })
  })

  it('stretches a step down by a Bead\'s cell', () => {
    expect(positionStep({ technique: 'peyote', cell: { aspect: 1.2, roundness: 0 } })).toEqual({ across: 1, down: 1.2 })
  })
})

describe('the Technique registry (ADR 0078, ticket 0621)', () => {
  const fraction = (value: number) => Number.isFinite(value) && value >= 0 && value <= 0.5

  /** What is wrong with a geometry's values for its kind; a kind no geometry has is wrong in itself. */
  function problems(geometry: GeometryRef): string[] {
    const found = fraction(geometry.roundness) ? [] : ['roundness']
    switch (geometry.kind) {
      case 'rows':
      case 'columns':
        if (!(Number.isFinite(geometry.cellAspect) && geometry.cellAspect > 0)) found.push('cellAspect')
        if (geometry.kind === 'columns' || geometry.shifted ? !(geometry.shift > 0 && geometry.shift < 1) : geometry.shift !== 0) found.push('shift')
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
    expect(describeWeave({ technique: 'brick', techniqueSettings: { brickDrop: 2 } })).not.toBe(describeWeave({ technique: 'brick' }))
    expect(describeWeave({ technique: 'loom', cell: { aspect: 0.8, roundness: 0.3 } }).cellAspect).toBe(0.8)
    expect(describeWeave({ technique: 'loom' }).cellAspect).toBe(1)
  })

  it('reads a Weave\'s settings from its map alone, each its Technique describes within its range (ticket 0625)', () => {
    expect(weaveSettings({ technique: 'brick', techniqueSettings: { brickDrop: 99 } })).toEqual({ brickDrop: 20 })
    expect(weaveSettings({ technique: 'loom', techniqueSettings: { brickDrop: 3 } })).toEqual({})
  })

  it('holds every setting a Technique describes, another Technique\'s Drop kept off it, and no setting no Technique describes (tickets 0625, 0691)', () => {
    expect(heldSettings('brick')).toEqual({ brickDrop: 1 })
    expect(heldSettings('peyote')).toEqual({ peyoteDrop: 1 })
    expect(heldSettings('loom', { brickDrop: 3, beadsPerLoop: 5 })).toEqual({ brickDrop: 3 })
    expect(heldSettings('peyote', { brickDrop: 3, peyoteDrop: 2 })).toEqual({ brickDrop: 3, peyoteDrop: 2 })
    expect(heldSettings('brick', { brickDrop: 2, peyoteDrop: 1 })).toEqual({ brickDrop: 2 })
  })
})
