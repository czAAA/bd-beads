// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  changedPositions,
  createPattern,
  createPatternFromImage,
  deleteAll,
  fillArea,
  isInFinishedRow,
  mirrorCurrent,
  mirroredCells,
  mostRecentlyUpdated,
  moveToRow,
  normalizePattern,
  paintCells,
  keepFinishedRows,
  replaceBead,
  resolvePatternBead,
  restoreBeads,
  restoreSnapshot,
  rowProgressPosition,
  setRowProgressEnabled,
  summarizePattern,
  toggleRotated,
  toggleRowDirection,
  type Cell,
  type Pattern,
  type Technique,
  frameGrid,
  withFrame,
  withFrameGrid,
} from './pattern'
import { BEAD_CATALOG } from './beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!
const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-round-11-0')!

describe('createPattern', () => {
  it('builds a Loom pattern with an empty grid sized from the physical dimensions', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(pattern.technique).toBe('loom')
    expect(pattern.beadId).toBe(cubeBead.id)
    expect(pattern.frame!.columns).toBe(10)
    expect(pattern.frame!.rows).toBe(20)
    expect(frameGrid(pattern)).toHaveLength(20)
    expect(frameGrid(pattern)[0]).toHaveLength(10)
  })

  it('takes a size in beads as the columns and rows directly', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 12, height: 7, unit: 'beads' },
    })

    expect(pattern.frame!.columns).toBe(12)
    expect(pattern.frame!.rows).toBe(7)
    expect(frameGrid(pattern)).toHaveLength(7)
    expect(frameGrid(pattern)[0]).toHaveLength(12)
  })

  it('derives the grid once from an mm or cm size and keeps no real-world size', () => {
    const fromMm = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
    const fromCm = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 1.5, height: 3, unit: 'cm' } })

    expect(fromCm.frame!.columns).toBe(fromMm.frame!.columns)
    expect(fromCm.frame!.rows).toBe(fromMm.frame!.rows)
    expect(fromMm).not.toHaveProperty('widthMm')
    expect(fromMm).not.toHaveProperty('heightMm')
  })

  it('fills every cell with an empty (unpainted) color', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    for (const row of frameGrid(pattern)) {
      for (const cell of row) {
        expect(cell.color).toBeNull()
      }
    }
  })

  it('assigns a unique id and a createdAt timestamp', () => {
    const a = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })
    const b = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(a.id).not.toBe(b.id)
    expect(a.createdAt).toBeTypeOf('number')
  })

  it.each(['peyote', 'brick'] as const)('builds a %s pattern the same way as a loom one', (technique) => {
    const pattern = createPattern({
      technique,
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(pattern.technique).toBe(technique)
    expect(pattern.frame!.columns).toBe(10)
    expect(pattern.frame!.rows).toBe(20)
    expect(frameGrid(pattern)).toHaveLength(20)
  })

  it('throws when the bead id is not in the catalog', () => {
    expect(() =>
      createPattern({
        technique: 'loom',
        beadId: 'unknown-bead',
        size: { width: 3, height: 3, unit: 'mm' },
      }),
    ).toThrow()
  })

  it('defaults the name to the bead label when none is given', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(pattern.name).toBe('TOHO Cube 1.5mm')
  })

  it('defaults the name to the bead label when given a blank name', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      name: '   ',
    })

    expect(pattern.name).toBe('TOHO Cube 1.5mm')
  })

  it('uses the given name when one is provided', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      name: '  My Bracelet  ',
    })

    expect(pattern.name).toBe('My Bracelet')
  })

  it('has no maker name override when none is given (ticket 182)', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(pattern.makerName).toBeUndefined()
  })

  it('trims and keeps a given maker name override (ticket 182)', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      makerName: '  Bead Master  ',
    })

    expect(pattern.makerName).toBe('Bead Master')
  })

  it('has no maker name override when given a blank one (ticket 182)', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      makerName: '   ',
    })

    expect(pattern.makerName).toBeUndefined()
  })
})

describe('summarizePattern', () => {
  it('describes the pattern by its name and grid dimensions', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
      name: 'My Bracelet',
    })

    expect(summarizePattern(pattern)).toBe('My Bracelet · 10×20')
  })

  it('states no size for a canvas with no Frame: just the name', () => {
    const { frame: _frame, ...open } = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' }, name: 'Sketch' })
    expect(summarizePattern(open as Pattern)).toBe('Sketch')
  })

  it('falls back to the bead label when the pattern has no custom name', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(summarizePattern(pattern)).toBe('TOHO Cube 1.5mm · 10×20')
  })

  it('swaps the dimensions when the rotated view flag is on, describing how the Pattern currently looks', () => {
    const pattern = toggleRotated(
      createPattern({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 30, unit: 'mm' },
        name: 'My Bracelet',
      }),
    )

    expect(summarizePattern(pattern)).toBe('My Bracelet · 20×10')
  })
})


describe('restoreBeads', () => {
  it('swaps in the given beads and bumps updatedAt, without mutating the original pattern', () => {
    const pattern = { ...createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    }), updatedAt: 0 }
    const snapshot = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }).beads

    const restored = restoreBeads(pattern, snapshot)

    expect(restored.beads).toBe(snapshot)
    expect(restored.updatedAt).toBeGreaterThan(0)
    expect(frameGrid(pattern)[0]![0]!.color).toBeNull()
  })
})

describe('toggleRotated (ticket 171: all four quarter turns)', () => {
  function makePattern() {
    return createPattern({
      technique: 'peyote',
      beadId: cubeBead.id,
      size: { width: 4.5, height: 3, unit: 'mm' },
    })
  }

  it('steps the rotation one quarter turn clockwise without touching anything else — grid, dimensions, and technique all stay exactly as they were', () => {
    const pattern = paintCells(makePattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })

    const rotated = toggleRotated(pattern)

    expect(rotated.rotation).toBe(90)
    expect(rotated.beads).toBe(pattern.beads)
    expect(rotated.frame!.columns).toBe(pattern.frame!.columns)
    expect(rotated.frame!.rows).toBe(pattern.frame!.rows)
    expect(rotated.technique).toBe(pattern.technique)
  })

  it('cycles through all four positions and wraps back to upright', () => {
    const pattern = makePattern()

    expect(toggleRotated(pattern).rotation).toBe(90)
    expect(toggleRotated(toggleRotated(pattern)).rotation).toBe(180)
    expect(toggleRotated(toggleRotated(toggleRotated(pattern))).rotation).toBe(270)
    expect(toggleRotated(toggleRotated(toggleRotated(toggleRotated(pattern)))).rotation).toBe(0)
  })

  it('does not mutate the original pattern', () => {
    const pattern = makePattern()

    toggleRotated(pattern)

    expect(pattern.rotation).toBe(0)
  })
})

describe('fillArea', () => {
  function makeGridPattern(technique: Technique, grid: Cell[][]): Pattern {
    const base = createPattern({
      technique,
      beadId: cubeBead.id,
      size: { width: grid[0]!.length * 1.5, height: grid.length * 1.5, unit: 'mm' },
    })
    return withFrameGrid(base, grid)
  }

  it('repaints every cell of the clicked color reachable through same-colored neighbors', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'blue' }, { color: 'blue' }, { color: 'blue' }],
    ])

    const filled = fillArea(pattern, 0, 0, 'green')

    expect(frameGrid(filled)[0]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(frameGrid(filled)[1]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(frameGrid(filled)[2]!.map((c) => c.color)).toEqual(['blue', 'blue', 'blue'])
  })

  it('does not spill across a differently-colored boundary', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'blue' }],
    ])

    const filled = fillArea(pattern, 0, 0, 'green')

    expect(frameGrid(filled)[0]![1]!.color).toBe('blue')
    expect(frameGrid(filled)[1]![1]!.color).toBe('blue')
  })

  it('returns the same pattern instance, unchanged, when the clicked cell already has the fill color', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    expect(fillArea(pattern, 0, 0, 'red')).toBe(pattern)
  })

  it('does not mutate the original pattern', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    fillArea(pattern, 0, 0, 'green')

    expect(frameGrid(pattern)[0]![0]!.color).toBe('red')
  })

  it("connects a diagonally-offset same-color cell for Peyote that a straight Loom grid would not", () => {
    const grid: Cell[][] = [
      [{ color: null }, { color: 'red' }],
      [{ color: 'red' }, { color: null }],
    ]

    const loomFilled = fillArea(makeGridPattern('loom', grid), 0, 1, 'green')
    const peyoteFilled = fillArea(makeGridPattern('peyote', grid), 0, 1, 'green')

    // Loom: (0,1)'s only straight neighbor below is (1,1), which is unpainted, so (1,0) stays red.
    expect(frameGrid(loomFilled)[1]![0]!.color).toBe('red')
    // Peyote: row 1 is shifted right, so (0,1) overlaps (1,0) and (1,1) below it, reaching the red cell.
    expect(frameGrid(peyoteFilled)[1]![0]!.color).toBe('green')
  })
})

describe('mirroredCells', () => {
  function grid4x4() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
  }

  it('is just the cell itself when neither direction has an axis', () => {
    expect(mirroredCells(grid4x4(), { row: 1, column: 2 }, { columns: 0, rows: 0 })).toEqual([
      { row: 1, column: 2 },
    ])
  })

  it('reflects left-right across the exact center for one column axis', () => {
    expect(mirroredCells(grid4x4(), { row: 1, column: 0 }, { columns: 1, rows: 0 })).toEqual([
      { row: 1, column: 0 },
      { row: 1, column: 3 },
    ])
  })

  it('reflects top-bottom across the exact center for one row axis', () => {
    expect(mirroredCells(grid4x4(), { row: 0, column: 2 }, { columns: 0, rows: 1 })).toEqual([
      { row: 0, column: 2 },
      { row: 3, column: 2 },
    ])
  })

  it('reflects into all four quadrant counterparts when both directions have one axis', () => {
    expect(mirroredCells(grid4x4(), { row: 0, column: 0 }, { columns: 1, rows: 1 })).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 3 },
      { row: 3, column: 0 },
      { row: 3, column: 3 },
    ])
  })

  it('deduplicates down to 2 cells when a cell sits on the exact center of an odd dimension', () => {
    // A 3-column pattern: column 1 is its own horizontal mirror.
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 4.5, height: 6, unit: 'mm' },
    })

    expect(mirroredCells(pattern, { row: 0, column: 1 }, { columns: 1, rows: 1 })).toEqual([
      { row: 0, column: 1 },
      { row: 3, column: 1 },
    ])
  })

  it.each(['loom', 'peyote', 'brick'] as const)(
    'mirrors by row/column index the same way regardless of Technique (%s)',
    (technique) => {
      // The strip math only ever looks at row/column indices, never at a Technique's rendering offsets, so every
      // Technique's grid mirrors identically for the same dimensions.
      const pattern = createPattern({
        technique,
        beadId: cubeBead.id,
        size: { width: 6, height: 6, unit: 'mm' },
      })

      expect(mirroredCells(pattern, { row: 1, column: 0 }, { columns: 1, rows: 0 })).toEqual([
        { row: 1, column: 0 },
        { row: 1, column: 3 },
      ])
    },
  )

  it('covers every strip combination when both directions have more than 1 axis', () => {
    // 6 columns, 2 column-axes -> 3 column strips [0,1] [2,3] [4,5]; 1 row-axis over 4 rows -> 2 row strips.
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 9, height: 6, unit: 'mm' },
    })
    expect(pattern.frame!.columns).toBe(6)
    expect(pattern.frame!.rows).toBe(4)

    const cells = mirroredCells(pattern, { row: 0, column: 0 }, { columns: 2, rows: 1 })

    // 3 column counterparts x 2 row counterparts = 6 distinct cells.
    expect(cells).toHaveLength(6)
    expect(cells).toEqual(
      expect.arrayContaining([
        { row: 0, column: 0 },
        { row: 3, column: 0 },
      ]),
    )
  })

  it('copy mode (ticket 45) repeats the same relative cell instead of mirror-imaging, in both directions', () => {
    // 6 columns, 2 column-axes -> strips [0,1] [2,3] [4,5]; painting the first cell of strip0 copies onto the
    // first cell of strips 1 and 2 (columns 2, 4) rather than mirroring (which would land on 3 and 4).
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 9, height: 6, unit: 'mm' },
    })

    const mirrored = mirroredCells(pattern, { row: 0, column: 0 }, { columns: 2, rows: 0 })
    const copied = mirroredCells(pattern, { row: 0, column: 0 }, { columns: 2, rows: 0 }, true)

    expect(mirrored).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 3 },
      { row: 0, column: 4 },
    ])
    expect(copied).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 2 },
      { row: 0, column: 4 },
    ])
  })
})

describe('paintCells', () => {
  function makePattern(technique: Technique = 'loom') {
    return createPattern({
      technique,
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
  }

  it('paints every given position when no axis is on', () => {
    const pattern = makePattern()

    const painted = paintCells(
      pattern,
      [{ row: 0, column: 0 }, { row: 1, column: 1 }],
      '#e63746',
      { columns: 0, rows: 0 },
    )

    expect(frameGrid(painted)[0]![0]!.color).toBe('#e63746')
    expect(frameGrid(painted)[1]![1]!.color).toBe('#e63746')
    expect(frameGrid(painted)[0]![1]!.color).toBeNull()
  })

  it.each(['loom', 'peyote', 'brick'] as const)('paints every counterpart regardless of Technique (%s)', (technique) => {
    const pattern = makePattern(technique)

    const painted = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 1, rows: 0 })

    expect(frameGrid(painted)[0]![0]!.color).toBe('#e63746')
    expect(frameGrid(painted)[0]![3]!.color).toBe('#e63746')
  })

  it('paints every counterpart across every strip', () => {
    const pattern = makePattern()

    const painted = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 1, rows: 0 })

    expect(frameGrid(painted)[0]![0]!.color).toBe('#e63746')
    expect(frameGrid(painted)[0]![3]!.color).toBe('#e63746')
  })

  it('erases with a null color the same way it paints', () => {
    const pattern = paintCells(makePattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 1, rows: 0 })

    const erased = paintCells(pattern, [{ row: 0, column: 0 }], null, { columns: 1, rows: 0 })

    expect(frameGrid(erased)[0]![0]!.color).toBeNull()
    expect(frameGrid(erased)[0]![3]!.color).toBeNull()
  })

  it('returns the same Pattern instance, unchanged, when every touched cell is already that color', () => {
    const pattern = makePattern()

    expect(paintCells(pattern, [{ row: 0, column: 0 }], null, { columns: 0, rows: 0 })).toBe(pattern)
  })

  it('paints the same relative cell in every strip, unflipped, in copy mode (ticket 45)', () => {
    const pattern = makePattern() // 4 columns

    const painted = paintCells(
      pattern,
      [{ row: 0, column: 0 }],
      '#e63746',
      { columns: 1, rows: 0 },
      true,
    )

    expect(frameGrid(painted)[0]![0]!.color).toBe('#e63746')
    expect(frameGrid(painted)[0]![2]!.color).toBe('#e63746') // copy mode: same relative cell, not the mirrored (3)
    expect(frameGrid(painted)[0]![3]!.color).toBeNull()
  })

  it('does not mutate the original pattern', () => {
    const pattern = makePattern()

    paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 1, rows: 0 })

    expect(frameGrid(pattern)[0]![0]!.color).toBeNull()
  })
})

describe('mirrorCurrent ("Mirror current", ticket 46)', () => {
  function makePattern() {
    // 4 columns x 4 rows.
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
  }

  it('with axisCount 0, a blank grid stays blank (single center axis, nothing to sync)', () => {
    const blank = makePattern()

    expect(frameGrid(mirrorCurrent(blank, 'columns', 0, false))).toEqual(frameGrid(blank))
  })

  it('with axisCount 0, syncs the fuller half onto the emptier one across the center', () => {
    let painted = paintCells(makePattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    painted = paintCells(painted, [{ row: 1, column: 0 }], '#e63746', { columns: 0, rows: 0 })

    const synced = mirrorCurrent(painted, 'columns', 0, false)

    // 4 columns, axisCount 0 acts as 1 axis (2 strips of 2): [0,1] holds both painted cells and is the source,
    // copied onto [2,3] mirrored (column 2 <- column 1, column 3 <- column 0).
    expect(frameGrid(synced)[0]!.map((cell) => cell.color)).toEqual(['#e63746', null, null, '#e63746'])
    expect(frameGrid(synced)[1]!.map((cell) => cell.color)).toEqual(['#e63746', null, null, '#e63746'])
    expect(frameGrid(synced)[2]!.map((cell) => cell.color)).toEqual([null, null, null, null])
  })

  it('copies the fullest strip onto every other strip, mirrored by default, with N axes', () => {
    // 6 columns, 1 row, 2 axes -> 3 strips [0,1] [2,3] [4,5]. Paint the middle strip.
    let pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 9, height: 1.5, unit: 'mm' },
    })
    expect(pattern.frame!.columns).toBe(6)
    pattern = paintCells(pattern, [{ row: 0, column: 2 }], '#e63746', { columns: 0, rows: 0 })
    pattern = paintCells(pattern, [{ row: 0, column: 3 }], '#2f6fed', { columns: 0, rows: 0 })

    const synced = mirrorCurrent(pattern, 'columns', 2, false)

    expect(frameGrid(synced)[0]!.map((cell) => cell.color)).toEqual([
      '#2f6fed',
      '#e63746',
      '#e63746',
      '#2f6fed',
      '#2f6fed',
      '#e63746',
    ])
  })

  it('copies unflipped (same relative cell in every strip) with copy mode on', () => {
    let pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 9, height: 1.5, unit: 'mm' },
    })
    pattern = paintCells(pattern, [{ row: 0, column: 2 }], '#e63746', { columns: 0, rows: 0 })
    pattern = paintCells(pattern, [{ row: 0, column: 3 }], '#2f6fed', { columns: 0, rows: 0 })

    const synced = mirrorCurrent(pattern, 'columns', 2, true)

    expect(frameGrid(synced)[0]!.map((cell) => cell.color)).toEqual([
      '#e63746',
      '#2f6fed',
      '#e63746',
      '#2f6fed',
      '#e63746',
      '#2f6fed',
    ])
  })

  it('breaks a tie between equally-painted strips in favor of the lowest (leftmost/topmost) one', () => {
    // 6 columns, 2 axes -> strips [0,1] [2,3] [4,5]. Strip0 and strip2 each get one painted cell; strip1 stays
    // blank. Strip0 (index 0) should win the tie over strip2 (index 2).
    let pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 9, height: 1.5, unit: 'mm' },
    })
    pattern = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    pattern = paintCells(pattern, [{ row: 0, column: 4 }], '#2f6fed', { columns: 0, rows: 0 })

    const synced = mirrorCurrent(pattern, 'columns', 2, false)

    // Strip0's own cells stay exactly as painted (it's the source); strip1/strip2 both take strip0's color.
    expect(frameGrid(synced)[0]!.map((cell) => cell.color)).toEqual([
      '#e63746',
      null,
      null,
      '#e63746',
      '#e63746',
      null,
    ])
  })

  it('acts along rows the same way it acts along columns', () => {
    let pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 1.5, height: 9, unit: 'mm' },
    })
    expect(pattern.frame!.rows).toBe(6)
    pattern = paintCells(pattern, [{ row: 2, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    pattern = paintCells(pattern, [{ row: 3, column: 0 }], '#2f6fed', { columns: 0, rows: 0 })

    const synced = mirrorCurrent(pattern, 'rows', 2, false)

    expect(frameGrid(synced).map((row) => row[0]!.color)).toEqual([
      '#2f6fed',
      '#e63746',
      '#e63746',
      '#2f6fed',
      '#2f6fed',
      '#e63746',
    ])
  })

  it('does not mutate the original pattern', () => {
    let pattern = makePattern()
    pattern = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })

    mirrorCurrent(pattern, 'columns', 1, false)

    expect(frameGrid(pattern)[0]![3]!.color).toBeNull()
  })
})

describe('changedPositions ("Mirror current" hover preview, ticket 47)', () => {
  it('is empty for two identical grids', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })

    expect(changedPositions(pattern.beads, pattern.beads)).toEqual([])
  })

  it('lists exactly the cells whose color differs, and nothing else', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
    const after = paintCells(paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }), [{ row: 2, column: 1 }], '#2f6fed', { columns: 0, rows: 0 })

    expect(changedPositions(pattern.beads, after.beads)).toEqual([
      { row: 0, column: 0 },
      { row: 2, column: 1 },
    ])
  })

  it('is what mirrorCurrent + keepFinishedRows would actually change, matching the hover preview App.vue derives', () => {
    let pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
    pattern = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })

    const result = mirrorCurrent(pattern, 'columns', 1, false)

    expect(changedPositions(pattern.beads, result.beads)).toEqual([{ row: 0, column: 3 }])
  })
})

describe('mostRecentlyUpdated', () => {
  it('returns undefined for an empty list', () => {
    expect(mostRecentlyUpdated([])).toBeUndefined()
  })

  it('returns the pattern with the greatest updatedAt', () => {
    const older = { ...createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 3, unit: 'mm' } }), updatedAt: 100 }
    const newer = { ...createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 3, unit: 'mm' } }), updatedAt: 200 }

    expect(mostRecentlyUpdated([older, newer])).toBe(newer)
    expect(mostRecentlyUpdated([newer, older])).toBe(newer)
  })
})

describe('row progress', () => {
  function pattern() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
  }

  it('starts switched off, pointing at the first row', () => {
    expect(pattern().rowProgress).toEqual({
      enabled: false,
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
  })

  it('turns the overlay on and off without moving the pointer', () => {
    const started = moveToRow(pattern(), 4)

    const shown = setRowProgressEnabled(started, true)
    expect(shown.rowProgress).toEqual({ enabled: true, direction: 'rows', currentRow: 4, currentColumn: 0 })

    expect(setRowProgressEnabled(shown, false).rowProgress).toEqual({
      enabled: false,
      direction: 'rows',
      currentRow: 4,
      currentColumn: 0,
    })
  })

  it('moves the pointer forward and backward through the rows', () => {
    const atThree = moveToRow(pattern(), 3)
    expect(atThree.rowProgress.currentRow).toBe(3)
    expect(moveToRow(atThree, atThree.rowProgress.currentRow - 1).rowProgress.currentRow).toBe(2)
  })

  it('will not step past either end of the Pattern', () => {
    const first = pattern()

    expect(moveToRow(first, -1).rowProgress.currentRow).toBe(0)
    expect(moveToRow(first, first.frame!.rows + 5).rowProgress.currentRow).toBe(first.frame!.rows - 1)
  })

  it('leaves the grid alone and returns a new Pattern rather than mutating the old one', () => {
    const before = pattern()

    const after = moveToRow(before, 2)

    expect(before.rowProgress.currentRow).toBe(0)
    expect(after.beads).toBe(before.beads)
  })
})

describe('row direction', () => {
  /** 10 columns x 20 rows, so counting along the rows and down the columns give different answers. */
  function tallPattern() {
    return createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })
  }

  it('counts along the grid rows by default', () => {
    expect(rowProgressPosition(moveToRow(tallPattern(), 3))).toEqual({ current: 3, total: 20 })
  })

  it('counts and steps through the columns once rows run down them', () => {
    const downColumns = toggleRowDirection(tallPattern())

    expect(rowProgressPosition(downColumns)).toEqual({ current: 0, total: 10 })
    expect(rowProgressPosition(moveToRow(downColumns, 4))).toEqual({ current: 4, total: 10 })
    expect(rowProgressPosition(moveToRow(downColumns, 15))).toEqual({ current: 9, total: 10 })
  })

  it('keeps a separate pointer for each direction, so flipping back returns to the same row', () => {
    const onRowSeven = moveToRow(tallPattern(), 7)

    expect(rowProgressPosition(toggleRowDirection(onRowSeven))).toEqual({ current: 0, total: 10 })

    const onColumnTwo = moveToRow(toggleRowDirection(onRowSeven), 2)

    expect(rowProgressPosition(toggleRowDirection(onColumnTwo))).toEqual({ current: 7, total: 20 })
  })
})

describe('keepFinishedRows', () => {
  const NO_MIRROR = { columns: 0, rows: 0 }

  /** 10 columns x 20 rows, with the overlay on and rows 0-2 finished. */
  function onRowThree() {
    return setRowProgressEnabled(
      moveToRow(
        createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } }),
        3,
      ),
      true,
    )
  }

  it('leaves beads in finished rows as they were, keeping the edit on the current row and after', () => {
    const before = onRowThree()
    const edited = paintCells(
      before,
      [{ row: 2, column: 5 }, { row: 3, column: 5 }, { row: 9, column: 5 }],
      '#e63746',
      NO_MIRROR,
    )

    const kept = keepFinishedRows(before, edited)

    expect(frameGrid(kept)[2]![5]!.color).toBeNull()
    expect(frameGrid(kept)[3]![5]!.color).toBe('#e63746')
    expect(frameGrid(kept)[9]![5]!.color).toBe('#e63746')
  })

  it('hands back the Pattern it started from when the edit only touched finished rows, so nothing counts as changed', () => {
    const before = onRowThree()
    const edited = paintCells(before, [{ row: 0, column: 0 }, { row: 2, column: 9 }], '#e63746', NO_MIRROR)

    expect(keepFinishedRows(before, edited)).toBe(before)
  })

  it('locks the finished columns instead once rows run down them', () => {
    const before = setRowProgressEnabled(moveToRow(toggleRowDirection(onRowThree()), 2), true)
    const edited = paintCells(before, [{ row: 15, column: 1 }, { row: 15, column: 2 }], '#e63746', NO_MIRROR)

    const kept = keepFinishedRows(before, edited)

    expect(frameGrid(kept)[15]![1]!.color).toBeNull()
    expect(frameGrid(kept)[15]![2]!.color).toBe('#e63746')
  })

  it('locks nothing while the overlay is off', () => {
    const before = setRowProgressEnabled(onRowThree(), false)
    const edited = paintCells(before, [{ row: 0, column: 0 }], '#e63746', NO_MIRROR)

    expect(frameGrid(keepFinishedRows(before, edited))[0]![0]!.color).toBe('#e63746')
  })

  it('keeps the current-row half of a live-mirrored pair, dropping the half that lands on a finished row (ADR 0006)', () => {
    const before = onRowThree() // 20 rows, rows 0-2 finished; a top-bottom axis of 1 mirrors row r <-> row 19-r
    const edited = paintCells(before, [{ row: 17, column: 5 }], '#e63746', { columns: 0, rows: 1 })

    const kept = keepFinishedRows(before, edited)

    expect(frameGrid(kept)[17]![5]!.color).toBe('#e63746')
    expect(frameGrid(kept)[2]![5]!.color).toBeNull()
  })
})

describe('resolvePatternBead', () => {
  it("finds the Pattern's Bead in the catalog", () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    expect(resolvePatternBead(pattern)).toEqual(cubeBead)
  })

  it('returns undefined for a Bead the catalog no longer has (a removed custom Bead, or an unrecognized imported one)', () => {
    const pattern = {
      ...createPattern({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 15, unit: 'mm' },
      }),
      beadId: 'no-such-bead',
    }

    expect(resolvePatternBead(pattern)).toBeUndefined()
  })
})

describe('deleteAll', () => {
  /** 10 columns x 20 rows, painted, rotated, with the overlay on, rows 0-2 finished and direction turned to columns. */
  function paintedAndWoven() {
    const painted = paintCells(
      createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } }),
      [{ row: 0, column: 0 }, { row: 5, column: 5 }],
      '#e63746',
      { columns: 0, rows: 0 },
    )
    const rotated = toggleRotated(painted)
    const turned = toggleRowDirection(rotated)
    return setRowProgressEnabled(moveToRow(turned, 3), true)
  }

  it('empties every cell', () => {
    const cleared = deleteAll(paintedAndWoven())

    expect(frameGrid(cleared).every((row) => row.every((cell) => cell.color === null))).toBe(true)
  })

  it('turns Row progress off and puts both direction pointers back at the first row', () => {
    const cleared = deleteAll(paintedAndWoven())

    expect(cleared.rowProgress).toEqual({ enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('keeps name, size, Technique, Bead and rotation exactly as they were', () => {
    const before = paintedAndWoven()

    const cleared = deleteAll(before)

    expect(cleared.name).toBe(before.name)
    expect(cleared.technique).toBe(before.technique)
    expect(cleared.beadId).toBe(before.beadId)
    expect(cleared.frame!.columns).toBe(before.frame!.columns)
    expect(cleared.frame!.rows).toBe(before.frame!.rows)
    expect(cleared.rotation).toBe(before.rotation)
  })

  it('ignores the Row progress lock: clears a finished row along with the rest', () => {
    const before = paintedAndWoven() // rows 0-2 are finished
    expect(frameGrid(before)[0]![0]!.color).toBe('#e63746') // painted before the overlay locked it

    const cleared = deleteAll(before)

    expect(frameGrid(cleared)[0]![0]!.color).toBeNull()
  })

  it('bumps updatedAt', () => {
    const before = { ...paintedAndWoven(), updatedAt: 0 }

    expect(deleteAll(before).updatedAt).toBeGreaterThan(0)
  })

  it('hands back the same instance, unchanged, when the Pattern is already blank with progress off', () => {
    const fresh = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(deleteAll(fresh)).toBe(fresh)
  })
})

describe('replaceBead', () => {
  /** 4 columns x 2 rows of TOHO Round, each cell painted with a distinct color so a change to the grid is checkable. */
  function distinctlyPainted(): Pattern {
    let pattern = createPattern({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 4, height: 2, unit: 'beads' },
    })
    for (let row = 0; row < pattern.frame!.rows; row++) {
      for (let column = 0; column < pattern.frame!.columns; column++) {
        pattern = paintCells(pattern, [{ row: row, column: column }], `r${row}c${column}`, { columns: 0, rows: 0 })
      }
    }
    return pattern
  }

  it('switches the Bead id', () => {
    const replaced = replaceBead(distinctlyPainted(), cubeBead)

    expect(replaced.beadId).toBe(cubeBead.id)
  })

  it.each(BEAD_CATALOG.flatMap((from) => BEAD_CATALOG.filter((to) => to !== from).map((to) => [from, to] as const)))(
    'keeps the grid, columns, rows and every painted cell exactly as they were, from %s to %s',
    (from, to) => {
      const before = { ...distinctlyPainted(), beadId: from.id }

      const replaced = replaceBead(before, to)

      expect(replaced.frame).toBe(before.frame)
      expect(replaced.beads).toBe(before.beads)
    },
  )

  it('keeps Row progress exactly as it was', () => {
    const before = setRowProgressEnabled(moveToRow(distinctlyPainted(), 1), true)

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.rowProgress).toBe(before.rowProgress)
  })

  it('keeps name, technique and rotation exactly as they were', () => {
    const before = toggleRotated(distinctlyPainted())

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.name).toBe(before.name)
    expect(replaced.technique).toBe(before.technique)
    expect(replaced.rotation).toBe(before.rotation)
  })

  it('works on a Pattern that was created in mm too, since nothing of the mm size is kept', () => {
    const before = createPattern({ technique: 'loom', beadId: roundBead.id, size: { width: 15, height: 30, unit: 'mm' } })

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.frame!.columns).toBe(before.frame!.columns)
    expect(replaced.frame!.rows).toBe(before.frame!.rows)
  })

  it('bumps updatedAt', () => {
    const before = { ...distinctlyPainted(), updatedAt: 0 }

    expect(replaceBead(before, cubeBead).updatedAt).toBeGreaterThan(0)
  })
})

describe('restoreSnapshot', () => {
  it('restores just the grid when the undo entry carries no Row progress, leaving Row progress as it is', () => {
    const pattern = setRowProgressEnabled(moveToRow(paintCells(createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 15, unit: 'mm' } }), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }), 2), true)
    const blankBeads = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    }).beads

    const restored = restoreSnapshot(pattern, { beads: blankBeads })

    expect(restored.beads).toBe(blankBeads)
    expect(restored.rowProgress).toEqual(pattern.rowProgress)
  })

  it('restores the grid and Row progress together when the undo entry carries both', () => {
    const before = setRowProgressEnabled(moveToRow(
      createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 15, unit: 'mm' } }),
      3,
    ), true)
    const cleared = deleteAll(before)

    const restored = restoreSnapshot(cleared, { beads: before.beads, rowProgress: before.rowProgress })

    expect(restored.beads).toBe(before.beads)
    expect(restored.rowProgress).toEqual(before.rowProgress)
  })

  it('restores the Bead id when the undo entry carries it (Replace Bead, ticket 48), leaving the grid as the entry has it', () => {
    const before = createPattern({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 8, height: 4, unit: 'beads' },
    })
    const replaced = replaceBead(before, cubeBead)

    const restored = restoreSnapshot(replaced, { beads: before.beads, beadId: before.beadId })

    expect(restored.beadId).toBe(before.beadId)
    expect(restored.frame!.columns).toBe(before.frame!.columns)
    expect(restored.frame!.rows).toBe(before.frame!.rows)
    expect(restored.beads).toBe(before.beads)
  })

  it('restores the Frame when the undo entry carries it (ADR 0026)', () => {
    const before = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    const resized = withFrame(before, { row: 0, column: 0, columns: 2, rows: 5 })

    const restored = restoreSnapshot(resized, {
      beads: before.beads,
      size: { frame: before.frame, mirrorAxisCounts: { columns: 0, rows: 0 } },
    })

    expect(restored.frame!.columns).toBe(4)
    expect(restored.frame!.rows).toBe(3)
    expect(restored.beads).toBe(before.beads)
  })
})

describe('normalizePattern', () => {
  it('gives a Pattern saved as a fixed grid beads by position and a Frame the size of that grid (ADR 0026)', () => {
    const { beads: _beads, frame: _frame, ...base } = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 2, unit: 'beads' } })
    const legacy = {
      ...base,
      columns: 3,
      rows: 2,
      grid: [
        [{ color: '#f00' }, { color: null }, { color: null }],
        [{ color: null }, { color: null }, { color: '#0f0' }],
      ],
    }

    const normalized = normalizePattern(legacy)

    expect(normalized.frame).toEqual({ row: 0, column: 0, columns: 3, rows: 2 })
    expect(normalized.beads).toEqual({ 0: { 0: '#f00' }, 1: { 2: '#0f0' } })
    expect(normalized).not.toHaveProperty('grid')
    expect(normalized).not.toHaveProperty('columns')
    expect(normalized).not.toHaveProperty('rows')
  })

  it('backfills row progress and the rotation on a Pattern saved before they existed', () => {
    const { rowProgress: _rowProgress, rotation: _rotation, ...legacy } = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    const normalized = normalizePattern(legacy as Pattern)

    expect(normalized.rowProgress).toEqual({
      enabled: false,
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
    expect(normalized.rotation).toBe(0)
  })

  it('reads ticket 28\'s two-position `rotated` boolean as its nearest quarter turn (ticket 171)', () => {
    const { rotation: _rotation, ...legacy } = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    expect(normalizePattern({ ...legacy, rotated: false } as unknown as Pattern).rotation).toBe(0)
    expect(normalizePattern({ ...legacy, rotated: true } as unknown as Pattern).rotation).toBe(90)
  })

  it('drops the color-to-bead override field a Pattern saved before ticket 36 may still carry (ADR 0007)', () => {
    const legacy = {
      ...createPattern({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 15, unit: 'mm' },
      }),
      colorBeadOverrides: { red: 'miyuki-delica-11-0' },
    }

    const normalized = normalizePattern(legacy as Pattern)

    expect((normalized as unknown as { colorBeadOverrides?: unknown }).colorBeadOverrides).toBeUndefined()
  })

  it('keeps the row pointer of progress saved before row direction existed, running it along the grid rows', () => {
    const base = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const normalized = normalizePattern({
      ...base,
      rowProgress: { enabled: true, currentRow: 5 } as Pattern['rowProgress'],
    })

    expect(normalized.rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 5,
      currentColumn: 0,
    })
  })

  it('drops the stored real-world size a Pattern saved before ADR 0017 still carries, and keeps its grid', () => {
    const base = createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
    const legacy = { ...base, widthMm: 15, heightMm: 30 }

    const normalized = normalizePattern(legacy as Pattern)

    expect(normalized).not.toHaveProperty('widthMm')
    expect(normalized).not.toHaveProperty('heightMm')
    expect(normalized.frame!.columns).toBe(10)
    expect(normalized.frame!.rows).toBe(20)
    expect(normalized.beads).toBe(base.beads)
  })

  it('clamps row and column pointers that no longer fit the Pattern', () => {
    const base = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' }, // 10 columns x 20 rows
    })

    const normalized = normalizePattern({
      ...base,
      rowProgress: { enabled: true, direction: 'columns', currentRow: 999, currentColumn: 999 },
    })

    expect(normalized.rowProgress.currentRow).toBe(19)
    expect(normalized.rowProgress.currentColumn).toBe(9)
  })
})

describe('createPatternFromImage', () => {
  const converted = {
    grid: [
      [{ color: '#ff0000' }, { color: null }],
      [{ color: '#00ff00' }, { color: '#0000ff' }],
    ],
    imageColors: ['#ff0000', '#00ff00', '#0000ff'],
  }

  function fromImage(overrides: Partial<typeof converted> = {}) {
    return createPatternFromImage({
      name: 'Fox',
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' }, // 2 columns x 2 rows in 1.5mm cubes
      ...converted,
      ...overrides,
    })
  }

  it('creates an ordinary Pattern that arrives already painted', () => {
    const pattern = fromImage()

    expect(pattern.frame!.columns).toBe(2)
    expect(pattern.frame!.rows).toBe(2)
    expect(frameGrid(pattern).map((row) => row.map((cell) => cell.color))).toEqual([
      ['#ff0000', null],
      ['#00ff00', '#0000ff'],
    ])
    expect(pattern.name).toBe('Fox')
    expect(pattern.rowProgress).toEqual({ enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('saves the colors the conversion found on the Pattern', () => {
    expect(fromImage().imageColors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('keeps its own copy of the color list, so the conversion cannot change it afterwards', () => {
    const imageColors = ['#ff0000']
    const pattern = createPatternFromImage({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      grid: converted.grid,
      imageColors,
    })

    imageColors.push('#00ff00')

    expect(pattern.imageColors).toEqual(['#ff0000'])
  })

  it('fits a grid that does not match the stated size rather than contradicting its own dimensions', () => {
    const pattern = fromImage({ grid: [[{ color: '#ff0000' }, { color: '#ff0000' }, { color: '#ff0000' }]] })

    expect(frameGrid(pattern)).toEqual([
      [{ color: '#ff0000' }, { color: '#ff0000' }],
      [{ color: null }, { color: null }],
    ])
  })

  it('leaves a Pattern created any other way without Image colors at all', () => {
    const plain = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(plain.imageColors).toBeUndefined()
  })
})

describe('Image colors are frozen (ADR 0011)', () => {
  function converted(): Pattern {
    return createPatternFromImage({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      grid: [
        [{ color: '#ff0000' }, { color: '#ff0000' }],
        [{ color: '#ff0000' }, { color: '#ff0000' }],
      ],
      imageColors: ['#ff0000'],
    })
  }

  it('does not grow when a new color is painted on', () => {
    const painted = paintCells(converted(), [{ row: 0, column: 0 }], '#0000ff', { columns: 0, rows: 0 })

    expect(painted.imageColors).toEqual(['#ff0000'])
  })

  it('does not shrink when the color it recorded is erased everywhere', () => {
    const erased = paintCells(
      converted(),
      [
        { row: 0, column: 0 },
        { row: 0, column: 1 },
        { row: 1, column: 0 },
        { row: 1, column: 1 },
      ],
      null,
      { columns: 0, rows: 0 },
    )

    expect(frameGrid(erased).flat().every((cell) => cell.color === null)).toBe(true)
    expect(erased.imageColors).toEqual(['#ff0000'])
  })

  it('survives a Replace Bead', () => {
    const replaced = replaceBead(converted(), roundBead)

    expect(replaced.imageColors).toEqual(['#ff0000'])
  })

  it('survives Delete all', () => {
    expect(deleteAll(converted()).imageColors).toEqual(['#ff0000'])
  })
})

describe('Row progress on the Frame (ticket 233)', () => {
  const base = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  const framed: Pattern = { ...base, frame: { row: 10, column: 10, rows: 6, columns: 4 }, rowProgress: { ...base.rowProgress, enabled: true, currentRow: 2 } }

  it('locks the finished rows of the Frame, and nothing outside it', () => {
    expect(isInFinishedRow(framed, { row: 10, column: 10 })).toBe(true)
    expect(isInFinishedRow(framed, { row: 11, column: 13 })).toBe(true)
    expect(isInFinishedRow(framed, { row: 12, column: 10 })).toBe(false)
    // Above, left of, and below the Frame: not the weaver's rows.
    expect(isInFinishedRow(framed, { row: 3, column: 10 })).toBe(false)
    expect(isInFinishedRow(framed, { row: 10, column: 4 })).toBe(false)
    expect(isInFinishedRow(framed, { row: 11, column: 20 })).toBe(false)
  })

  it('cannot be switched on with no Frame', () => {
    const { frame: _frame, ...open } = base
    expect(setRowProgressEnabled(open, true)).toBe(open)
    expect(setRowProgressEnabled(base, true).rowProgress.enabled).toBe(true)
  })
})
