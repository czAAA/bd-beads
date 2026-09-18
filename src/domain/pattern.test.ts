import { describe, expect, it } from 'vitest'
import {
  changedCells,
  createPattern,
  deleteAll,
  fillArea,
  mirrorCurrent,
  mirroredCells,
  mostRecentlyUpdated,
  moveToRow,
  normalizePattern,
  paintCells,
  keepFinishedRows,
  previewReplaceBead,
  replaceBead,
  resolvePatternBead,
  restoreGrid,
  restoreSnapshot,
  rowProgressPosition,
  setRowProgressEnabled,
  summarizePattern,
  toggleRotated,
  toggleRowDirection,
  type Cell,
  type Pattern,
  type Technique,
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
    expect(pattern.columns).toBe(10)
    expect(pattern.rows).toBe(20)
    expect(pattern.grid).toHaveLength(20)
    expect(pattern.grid[0]).toHaveLength(10)
  })

  it('fills every cell with an empty (unpainted) color', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    for (const row of pattern.grid) {
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
    expect(pattern.columns).toBe(10)
    expect(pattern.rows).toBe(20)
    expect(pattern.grid).toHaveLength(20)
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

describe('restoreGrid', () => {
  it('swaps in the given grid and bumps updatedAt, without mutating the original pattern', () => {
    const pattern = { ...createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    }), updatedAt: 0 }
    const snapshot = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }).grid

    const restored = restoreGrid(pattern, snapshot)

    expect(restored.grid).toBe(snapshot)
    expect(restored.updatedAt).toBeGreaterThan(0)
    expect(pattern.grid[0]![0]!.color).toBeNull()
  })
})

describe('toggleRotated', () => {
  function makePattern() {
    return createPattern({
      technique: 'peyote',
      beadId: cubeBead.id,
      size: { width: 4.5, height: 3, unit: 'mm' },
    })
  }

  it('flips the rotated flag without touching anything else — grid, dimensions, and technique all stay exactly as they were', () => {
    const pattern = paintCells(makePattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })

    const rotated = toggleRotated(pattern)

    expect(rotated.rotated).toBe(true)
    expect(rotated.grid).toBe(pattern.grid)
    expect(rotated.columns).toBe(pattern.columns)
    expect(rotated.rows).toBe(pattern.rows)
    expect(rotated.widthMm).toBe(pattern.widthMm)
    expect(rotated.heightMm).toBe(pattern.heightMm)
    expect(rotated.technique).toBe(pattern.technique)
  })

  it('toggles back off on a second call', () => {
    const pattern = makePattern()

    expect(toggleRotated(toggleRotated(pattern)).rotated).toBe(false)
  })

  it('does not mutate the original pattern', () => {
    const pattern = makePattern()

    toggleRotated(pattern)

    expect(pattern.rotated).toBe(false)
  })
})

describe('fillArea', () => {
  function makeGridPattern(technique: Technique, grid: Cell[][]): Pattern {
    const base = createPattern({
      technique,
      beadId: cubeBead.id,
      size: { width: grid[0]!.length * 1.5, height: grid.length * 1.5, unit: 'mm' },
    })
    return { ...base, grid }
  }

  it('repaints every cell of the clicked color reachable through same-colored neighbors', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'blue' }, { color: 'blue' }, { color: 'blue' }],
    ])

    const filled = fillArea(pattern, 0, 0, 'green')

    expect(filled.grid[0]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(filled.grid[1]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(filled.grid[2]!.map((c) => c.color)).toEqual(['blue', 'blue', 'blue'])
  })

  it('does not spill across a differently-colored boundary', () => {
    const pattern = makeGridPattern('loom', [
      [{ color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'blue' }],
    ])

    const filled = fillArea(pattern, 0, 0, 'green')

    expect(filled.grid[0]![1]!.color).toBe('blue')
    expect(filled.grid[1]![1]!.color).toBe('blue')
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

    expect(pattern.grid[0]![0]!.color).toBe('red')
  })

  it("connects a diagonally-offset same-color cell for Peyote that a straight Loom grid would not", () => {
    const grid: Cell[][] = [
      [{ color: null }, { color: 'red' }],
      [{ color: 'red' }, { color: null }],
    ]

    const loomFilled = fillArea(makeGridPattern('loom', grid), 0, 1, 'green')
    const peyoteFilled = fillArea(makeGridPattern('peyote', grid), 0, 1, 'green')

    // Loom: (0,1)'s only straight neighbor below is (1,1), which is unpainted, so (1,0) stays red.
    expect(loomFilled.grid[1]![0]!.color).toBe('red')
    // Peyote: row 1 is shifted right, so (0,1) overlaps (1,0) and (1,1) below it, reaching the red cell.
    expect(peyoteFilled.grid[1]![0]!.color).toBe('green')
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
    expect(pattern.columns).toBe(6)
    expect(pattern.rows).toBe(4)

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

    expect(painted.grid[0]![0]!.color).toBe('#e63746')
    expect(painted.grid[1]![1]!.color).toBe('#e63746')
    expect(painted.grid[0]![1]!.color).toBeNull()
  })

  it.each(['loom', 'peyote', 'brick'] as const)('paints every counterpart regardless of Technique (%s)', (technique) => {
    const pattern = makePattern(technique)

    const painted = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 1, rows: 0 })

    expect(painted.grid[0]![0]!.color).toBe('#e63746')
    expect(painted.grid[0]![3]!.color).toBe('#e63746')
  })

  it('paints every counterpart across every strip', () => {
    const pattern = makePattern()

    const painted = paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 1, rows: 0 })

    expect(painted.grid[0]![0]!.color).toBe('#e63746')
    expect(painted.grid[0]![3]!.color).toBe('#e63746')
  })

  it('erases with a null color the same way it paints', () => {
    const pattern = paintCells(makePattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 1, rows: 0 })

    const erased = paintCells(pattern, [{ row: 0, column: 0 }], null, { columns: 1, rows: 0 })

    expect(erased.grid[0]![0]!.color).toBeNull()
    expect(erased.grid[0]![3]!.color).toBeNull()
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

    expect(painted.grid[0]![0]!.color).toBe('#e63746')
    expect(painted.grid[0]![2]!.color).toBe('#e63746') // copy mode: same relative cell, not the mirrored (3)
    expect(painted.grid[0]![3]!.color).toBeNull()
  })

  it('does not mutate the original pattern', () => {
    const pattern = makePattern()

    paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 1, rows: 0 })

    expect(pattern.grid[0]![0]!.color).toBeNull()
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

    expect(mirrorCurrent(blank, 'columns', 0, false).grid).toEqual(blank.grid)
  })

  it('with axisCount 0, syncs the fuller half onto the emptier one across the center', () => {
    let painted = paintCells(makePattern(), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    painted = paintCells(painted, [{ row: 1, column: 0 }], '#e63746', { columns: 0, rows: 0 })

    const synced = mirrorCurrent(painted, 'columns', 0, false)

    // 4 columns, axisCount 0 acts as 1 axis (2 strips of 2): [0,1] holds both painted cells and is the source,
    // copied onto [2,3] mirrored (column 2 <- column 1, column 3 <- column 0).
    expect(synced.grid[0]!.map((cell) => cell.color)).toEqual(['#e63746', null, null, '#e63746'])
    expect(synced.grid[1]!.map((cell) => cell.color)).toEqual(['#e63746', null, null, '#e63746'])
    expect(synced.grid[2]!.map((cell) => cell.color)).toEqual([null, null, null, null])
  })

  it('copies the fullest strip onto every other strip, mirrored by default, with N axes', () => {
    // 6 columns, 1 row, 2 axes -> 3 strips [0,1] [2,3] [4,5]. Paint the middle strip.
    let pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 9, height: 1.5, unit: 'mm' },
    })
    expect(pattern.columns).toBe(6)
    pattern = paintCells(pattern, [{ row: 0, column: 2 }], '#e63746', { columns: 0, rows: 0 })
    pattern = paintCells(pattern, [{ row: 0, column: 3 }], '#2f6fed', { columns: 0, rows: 0 })

    const synced = mirrorCurrent(pattern, 'columns', 2, false)

    expect(synced.grid[0]!.map((cell) => cell.color)).toEqual([
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

    expect(synced.grid[0]!.map((cell) => cell.color)).toEqual([
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
    expect(synced.grid[0]!.map((cell) => cell.color)).toEqual([
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
    expect(pattern.rows).toBe(6)
    pattern = paintCells(pattern, [{ row: 2, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    pattern = paintCells(pattern, [{ row: 3, column: 0 }], '#2f6fed', { columns: 0, rows: 0 })

    const synced = mirrorCurrent(pattern, 'rows', 2, false)

    expect(synced.grid.map((row) => row[0]!.color)).toEqual([
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

    expect(pattern.grid[0]![3]!.color).toBeNull()
  })
})

describe('changedCells ("Mirror current" hover preview, ticket 47)', () => {
  it('is empty for two identical grids', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })

    expect(changedCells(pattern.grid, pattern.grid)).toEqual([])
  })

  it('lists exactly the cells whose color differs, and nothing else', () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
    const after = paintCells(paintCells(pattern, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }), [{ row: 2, column: 1 }], '#2f6fed', { columns: 0, rows: 0 })

    expect(changedCells(pattern.grid, after.grid)).toEqual([
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

    expect(changedCells(pattern.grid, result.grid)).toEqual([{ row: 0, column: 3 }])
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
    expect(moveToRow(first, first.rows + 5).rowProgress.currentRow).toBe(first.rows - 1)
  })

  it('leaves the grid alone and returns a new Pattern rather than mutating the old one', () => {
    const before = pattern()

    const after = moveToRow(before, 2)

    expect(before.rowProgress.currentRow).toBe(0)
    expect(after.grid).toBe(before.grid)
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

    expect(kept.grid[2]![5]!.color).toBeNull()
    expect(kept.grid[3]![5]!.color).toBe('#e63746')
    expect(kept.grid[9]![5]!.color).toBe('#e63746')
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

    expect(kept.grid[15]![1]!.color).toBeNull()
    expect(kept.grid[15]![2]!.color).toBe('#e63746')
  })

  it('locks nothing while the overlay is off', () => {
    const before = setRowProgressEnabled(onRowThree(), false)
    const edited = paintCells(before, [{ row: 0, column: 0 }], '#e63746', NO_MIRROR)

    expect(keepFinishedRows(before, edited).grid[0]![0]!.color).toBe('#e63746')
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

    expect(cleared.grid.every((row) => row.every((cell) => cell.color === null))).toBe(true)
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
    expect(cleared.widthMm).toBe(before.widthMm)
    expect(cleared.heightMm).toBe(before.heightMm)
    expect(cleared.columns).toBe(before.columns)
    expect(cleared.rows).toBe(before.rows)
    expect(cleared.rotated).toBe(before.rotated)
  })

  it('ignores the Row progress lock: clears a finished row along with the rest', () => {
    const before = paintedAndWoven() // rows 0-2 are finished
    expect(before.grid[0]![0]!.color).toBe('#e63746') // painted before the overlay locked it

    const cleared = deleteAll(before)

    expect(cleared.grid[0]![0]!.color).toBeNull()
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

describe('previewReplaceBead', () => {
  it('computes the grid size the given Bead would produce at the Pattern\'s current real-world size', () => {
    // 8.8mm x 4.4mm at Round (2.2mm) is a 4x2 grid.
    const pattern = createPattern({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 8.8, height: 4.4, unit: 'mm' },
    })

    // Same real-world size at Cube (1.5mm): round(8.8/1.5)=6, round(4.4/1.5)=3.
    expect(previewReplaceBead(pattern, cubeBead)).toEqual({ columns: 6, rows: 3 })
  })
})

describe('replaceBead', () => {
  /** 4 columns x 2 rows (Round, 2.2mm, at 8.8mm x 4.4mm), each cell painted with a distinct color so the resize's cell mapping is checkable. */
  function distinctlyPainted(): Pattern {
    let pattern = createPattern({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 8.8, height: 4.4, unit: 'mm' },
    })
    for (let row = 0; row < pattern.rows; row++) {
      for (let column = 0; column < pattern.columns; column++) {
        pattern = paintCells(pattern, [{ row: row, column: column }], `r${row}c${column}`, { columns: 0, rows: 0 })
      }
    }
    return pattern
  }

  it('switches the Bead id', () => {
    const replaced = replaceBead(distinctlyPainted(), cubeBead)

    expect(replaced.beadId).toBe(cubeBead.id)
  })

  it('keeps the real-world size fixed and recomputes columns/rows from the new footprint', () => {
    const before = distinctlyPainted()

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.widthMm).toBe(before.widthMm)
    expect(replaced.heightMm).toBe(before.heightMm)
    expect(replaced).toEqual(expect.objectContaining({ columns: 6, rows: 3 }))
  })

  it('rescales existing colors onto the new grid by proportional nearest-cell resampling, not cropping', () => {
    const replaced = replaceBead(distinctlyPainted(), cubeBead)

    const colors = replaced.grid.map((row) => row.map((cell) => cell.color))
    expect(colors).toEqual([
      ['r0c0', 'r0c0', 'r0c1', 'r0c2', 'r0c2', 'r0c3'],
      ['r0c0', 'r0c0', 'r0c1', 'r0c2', 'r0c2', 'r0c3'],
      ['r1c0', 'r1c0', 'r1c1', 'r1c2', 'r1c2', 'r1c3'],
    ])
  })

  it('resets Row progress to its just-created state', () => {
    const before = setRowProgressEnabled(moveToRow(distinctlyPainted(), 1), true)

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.rowProgress).toEqual({ enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('keeps name, technique and rotation exactly as they were', () => {
    const before = toggleRotated(distinctlyPainted())

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.name).toBe(before.name)
    expect(replaced.technique).toBe(before.technique)
    expect(replaced.rotated).toBe(before.rotated)
  })

  it('bumps updatedAt', () => {
    const before = { ...distinctlyPainted(), updatedAt: 0 }

    expect(replaceBead(before, cubeBead).updatedAt).toBeGreaterThan(0)
  })
})

describe('restoreSnapshot', () => {
  it('restores just the grid when the undo entry carries no Row progress, leaving Row progress as it is', () => {
    const pattern = setRowProgressEnabled(moveToRow(paintCells(createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 15, unit: 'mm' } }), [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 }), 2), true)
    const blankGrid = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    }).grid

    const restored = restoreSnapshot(pattern, { grid: blankGrid })

    expect(restored.grid).toBe(blankGrid)
    expect(restored.rowProgress).toEqual(pattern.rowProgress)
  })

  it('restores the grid and Row progress together when the undo entry carries both', () => {
    const before = setRowProgressEnabled(moveToRow(
      createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 15, unit: 'mm' } }),
      3,
    ), true)
    const cleared = deleteAll(before)

    const restored = restoreSnapshot(cleared, { grid: before.grid, rowProgress: before.rowProgress })

    expect(restored.grid).toBe(before.grid)
    expect(restored.rowProgress).toEqual(before.rowProgress)
  })

  it('restores the Bead id and grid dimensions when the undo entry carries them (Replace Bead, ticket 48)', () => {
    const before = createPattern({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 8.8, height: 4.4, unit: 'mm' },
    })
    const replaced = replaceBead(before, cubeBead)

    const restored = restoreSnapshot(replaced, {
      grid: before.grid,
      rowProgress: before.rowProgress,
      bead: { beadId: before.beadId, columns: before.columns, rows: before.rows, mirrorAxisCounts: { columns: 0, rows: 0 } },
    })

    expect(restored.beadId).toBe(before.beadId)
    expect(restored.columns).toBe(before.columns)
    expect(restored.rows).toBe(before.rows)
    expect(restored.grid).toBe(before.grid)
  })
})

describe('normalizePattern', () => {
  it('backfills row progress and the rotated view flag on a Pattern saved before they existed', () => {
    const { rowProgress: _rowProgress, rotated: _rotated, ...legacy } = createPattern({
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
    expect(normalized.rotated).toBe(false)
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
