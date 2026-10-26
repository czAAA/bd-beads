// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  createProject,
  createProjectFromImage,
  deleteAll,
  isInCurrentRow,
  isInFinishedRow,
  mostRecentlyUpdated,
  moveToRow,
  normalizeProject,
  rotateCanvas,
  keepFinishedRows,
  replaceBead,
  setPalette,
  shownLetters,
  withLetters,
  resolveProjectBead,
  restoreBeads,
  restoreSnapshot,
  snapshotOf,
  rowProgressPosition,
  summarizeProject,
  resetRowProgress,
  toggleRowDirection,
  type Cell,
  type Project,
  type Technique,
  frameGrid,
  withFrame,
  beadColorAt,
  hasProjectBeads,
  projectCell,
  projectColors,
  sameBeads,
  withFrameGrid,
  rowProgressOn,
  rowProgressStarted,
  canvasWeave,
  frameWeave,
  withTechnique,
  withFrameTechnique,
} from './project'
import { BEAD_CATALOG } from './beads'
import { BUILT_IN_COLORS, addedColorId, addUsedColor, projectPalette } from './palette'
import { describeWeave } from './weave'
import { estimatedSizeMm } from './projectSize'
import { changedPositions } from './canvas'
import { fillAt, paintAt } from '../testUtils/layers'
import { turnedClockwise } from '../testUtils/rotated'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('createProject Brick block (ticket 477)', () => {
  const input = { technique: 'brick' as const, beadId: 'toho-cube-1.5mm' }

  it('stores a Brick block above 1, clamped to 20, and nothing for 1', () => {
    expect(createProject({ ...input, brickBlock: 3 }).brickBlock).toBe(3)
    expect(createProject({ ...input, brickBlock: 99 }).brickBlock).toBe(20)
    expect(createProject({ ...input, brickBlock: 1 })).not.toHaveProperty('brickBlock')
    expect(createProject(input)).not.toHaveProperty('brickBlock')
  })
})

describe('createProject', () => {
  it('builds a Loom project with an empty grid sized from the physical dimensions', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(project.technique).toBe('loom')
    expect(project.beadId).toBe(cubeBead.id)
    expect(project.frame!.columns).toBe(10)
    expect(project.frame!.rows).toBe(20)
    expect(frameGrid(project)).toHaveLength(20)
    expect(frameGrid(project)[0]).toHaveLength(10)
  })

  it('takes a size in beads as the columns and rows directly', () => {
    const project = createProject({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 12, height: 7, unit: 'beads' },
    })

    expect(project.frame!.columns).toBe(12)
    expect(project.frame!.rows).toBe(7)
    expect(frameGrid(project)).toHaveLength(7)
    expect(frameGrid(project)[0]).toHaveLength(12)
  })

  it('derives the grid once from an mm or cm size and keeps no real-world size', () => {
    const fromMm = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
    const fromCm = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 1.5, height: 3, unit: 'cm' } })

    expect(fromCm.frame!.columns).toBe(fromMm.frame!.columns)
    expect(fromCm.frame!.rows).toBe(fromMm.frame!.rows)
    expect(fromMm).not.toHaveProperty('widthMm')
    expect(fromMm).not.toHaveProperty('heightMm')
  })

  it('fills every cell with an empty (unpainted) color', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    for (const row of frameGrid(project)) {
      for (const cell of row) {
        expect(cell.color).toBeNull()
      }
    }
  })

  it('assigns a unique id and a createdAt timestamp', () => {
    const a = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })
    const b = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(a.id).not.toBe(b.id)
    expect(a.createdAt).toBeTypeOf('number')
  })

  it.each(['peyote', 'brick'] as const)('builds a %s project the same way as a loom one', (technique) => {
    const project = createProject({
      technique,
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(project.technique).toBe(technique)
    expect(project.frame!.columns).toBe(10)
    expect(project.frame!.rows).toBe(20)
    expect(frameGrid(project)).toHaveLength(20)
  })

  it('throws when the bead id is not in the catalog', () => {
    expect(() =>
      createProject({
        technique: 'loom',
        beadId: 'unknown-bead',
        size: { width: 3, height: 3, unit: 'mm' },
      }),
    ).toThrow()
  })

  it('defaults the name to the bead label when none is given', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(project.name).toBe('TOHO Cube 1.5mm')
  })

  it('defaults the name to the bead label when given a blank name', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      name: '   ',
    })

    expect(project.name).toBe('TOHO Cube 1.5mm')
  })

  it('uses the given name when one is provided', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      name: '  My Bracelet  ',
    })

    expect(project.name).toBe('My Bracelet')
  })

  it('has no maker name override when none is given (ticket 182)', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
    })

    expect(project.makerName).toBeUndefined()
  })

  it('trims and keeps a given maker name override (ticket 182)', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      makerName: '  Bead Master  ',
    })

    expect(project.makerName).toBe('Bead Master')
  })

  it('has no maker name override when given a blank one (ticket 182)', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' },
      makerName: '   ',
    })

    expect(project.makerName).toBeUndefined()
  })
})

describe('summarizeProject', () => {
  it('describes the project by its name and grid dimensions', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
      name: 'My Bracelet',
    })

    expect(summarizeProject(project)).toBe('My Bracelet · 10×20')
  })

  it('states no size for a canvas with no Frame: just the name', () => {
    const { frame: _frame, ...open } = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' }, name: 'Sketch' })
    expect(summarizeProject(open as Project)).toBe('Sketch')
  })

  it('falls back to the bead label when the project has no custom name', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(summarizeProject(project)).toBe('TOHO Cube 1.5mm · 10×20')
  })

  it('swaps the dimensions when the rotated view flag is on, describing how the Project currently looks', () => {
    const project = turnedClockwise(
      createProject({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 30, unit: 'mm' },
        name: 'My Bracelet',
      }),
    )

    expect(summarizeProject(project)).toBe('My Bracelet · 20×10')
  })
})


describe('restoreBeads', () => {
  it('swaps in the given beads and bumps updatedAt, without mutating the original project', () => {
    const project = { ...createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    }), updatedAt: 0 }
    const snapshot = paintAt(project, [{ row: 0, column: 0 }], '#e63746').beads

    const restored = restoreBeads(project, snapshot)

    expect(restored.beads).toBe(snapshot)
    expect(restored.updatedAt).toBeGreaterThan(0)
    expect(frameGrid(project)[0]![0]!.color).toBeNull()
  })
})

describe('fillArea', () => {
  function makeGridProject(technique: Technique, grid: Cell[][]): Project {
    const base = createProject({
      technique,
      beadId: cubeBead.id,
      size: { width: grid[0]!.length * 1.5, height: grid.length * 1.5, unit: 'mm' },
    })
    return withFrameGrid(base, grid)
  }

  it('repaints every cell of the clicked color reachable through same-colored neighbors', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'red' }, { color: 'blue' }],
      [{ color: 'blue' }, { color: 'blue' }, { color: 'blue' }],
    ])

    const filled = fillAt(project, 0, 0, 'green')

    expect(frameGrid(filled)[0]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(frameGrid(filled)[1]!.map((c) => c.color)).toEqual(['green', 'green', 'blue'])
    expect(frameGrid(filled)[2]!.map((c) => c.color)).toEqual(['blue', 'blue', 'blue'])
  })

  it('does not spill across a differently-colored boundary', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'blue' }],
      [{ color: 'red' }, { color: 'blue' }],
    ])

    const filled = fillAt(project, 0, 0, 'green')

    expect(frameGrid(filled)[0]![1]!.color).toBe('blue')
    expect(frameGrid(filled)[1]![1]!.color).toBe('blue')
  })

  it('returns the same project instance, unchanged, when the clicked cell already has the fill color', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    expect(fillAt(project, 0, 0, 'red')).toBe(project)
  })

  it('does not mutate the original project', () => {
    const project = makeGridProject('loom', [
      [{ color: 'red' }, { color: 'red' }],
      [{ color: 'red' }, { color: 'red' }],
    ])

    fillAt(project, 0, 0, 'green')

    expect(frameGrid(project)[0]![0]!.color).toBe('red')
  })

  it("connects a diagonally-offset same-color cell for Peyote that a straight Loom grid would not", () => {
    const grid: Cell[][] = [
      [{ color: null }, { color: 'red' }],
      [{ color: 'red' }, { color: null }],
    ]

    const loomFilled = fillAt(makeGridProject('loom', grid), 0, 1, 'green')
    const peyoteFilled = fillAt(makeGridProject('peyote', grid), 0, 1, 'green')

    // Loom: (0,1)'s only straight neighbor below is (1,1), which is unpainted, so (1,0) stays red.
    expect(frameGrid(loomFilled)[1]![0]!.color).toBe('red')
    // Peyote: row 1 is shifted right, so (0,1) overlaps (1,0) and (1,1) below it, reaching the red cell.
    expect(frameGrid(peyoteFilled)[1]![0]!.color).toBe('green')
  })
})

describe('paintCells', () => {
  function makeProject(technique: Technique = 'loom') {
    return createProject({
      technique,
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
  }

  it.each(['loom', 'peyote', 'brick'] as const)('paints every given position, whatever the Technique (%s)', (technique) => {
    const project = makeProject(technique)

    const painted = paintAt(project, [{ row: 0, column: 0 }, { row: 1, column: 1 }], '#e63746')

    expect(frameGrid(painted)[0]![0]!.color).toBe('#e63746')
    expect(frameGrid(painted)[1]![1]!.color).toBe('#e63746')
    expect(frameGrid(painted)[0]![1]!.color).toBeNull()
  })

  it('erases with a null color the same way it paints', () => {
    const project = paintAt(makeProject(), [{ row: 0, column: 0 }], '#e63746')

    const erased = paintAt(project, [{ row: 0, column: 0 }], null)

    expect(frameGrid(erased)[0]![0]!.color).toBeNull()
  })

  it('returns the same Project instance, unchanged, when every touched cell is already that color', () => {
    const project = makeProject()

    expect(paintAt(project, [{ row: 0, column: 0 }], null)).toBe(project)
  })

  it('does not mutate the original project', () => {
    const project = makeProject()

    paintAt(project, [{ row: 0, column: 0 }], '#e63746')

    expect(frameGrid(project)[0]![0]!.color).toBeNull()
  })
})

describe('changedPositions', () => {
  it('is empty for two identical grids', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })

    expect(changedPositions(project.frame!.beads, project.frame!.beads)).toEqual([])
  })

  it('lists exactly the cells whose color differs, and nothing else', () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 6, height: 6, unit: 'mm' },
    })
    const after = paintAt(paintAt(project, [{ row: 0, column: 0 }], '#e63746'), [{ row: 2, column: 1 }], '#2f6fed')

    expect(changedPositions(project.frame!.beads, after.frame!.beads)).toEqual([
      { row: 0, column: 0 },
      { row: 2, column: 1 },
    ])
  })
})

describe('mostRecentlyUpdated', () => {
  it('returns undefined for an empty list', () => {
    expect(mostRecentlyUpdated([])).toBeUndefined()
  })

  it('returns the project with the greatest updatedAt', () => {
    const older = { ...createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 3, unit: 'mm' } }), updatedAt: 100 }
    const newer = { ...createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 3, unit: 'mm' } }), updatedAt: 200 }

    expect(mostRecentlyUpdated([older, newer])).toBe(newer)
    expect(mostRecentlyUpdated([newer, older])).toBe(newer)
  })
})

describe('row progress', () => {
  function project() {
    return createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
  }

  it('starts on with the Frame its size makes, pointing at the first row (ticket 426)', () => {
    expect(project().rowProgress).toEqual({
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
  })

  it('is on exactly when there is a Frame, and a Frame set or removed carries the pointer with it (ticket 426)', () => {
    const started = moveToRow(project(), 4)
    expect(started.rowProgress).toEqual({ direction: 'rows', currentRow: 4, currentColumn: 0 })

    const removed = withFrame(started, undefined)
    expect(rowProgressOn(removed)).toBe(false)
    expect(removed.rowProgress).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })

    const back = withFrame(removed, { row: 0, column: 0, columns: 2, rows: 2 })
    expect(back.rowProgress).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('moves the pointer forward and backward through the rows', () => {
    const atThree = moveToRow(project(), 3)
    expect(atThree.rowProgress.currentRow).toBe(3)
    expect(moveToRow(atThree, atThree.rowProgress.currentRow - 1).rowProgress.currentRow).toBe(2)
  })

  it('will not step past either end of the Project; one past the last pass is every pass done (ticket 411)', () => {
    const first = project()

    expect(moveToRow(first, -1).rowProgress.currentRow).toBe(0)
    expect(moveToRow(first, first.frame!.rows + 5).rowProgress.currentRow).toBe(first.frame!.rows)
  })

  it('counts every pass done as the whole track, on loom, brick stitch and peyote, in both directions (ticket 411)', () => {
    for (const technique of ['loom', 'brick', 'peyote'] as const) {
      for (const direction of ['rows', 'columns'] as const) {
        const base = createProject({ technique, beadId: cubeBead.id, size: { width: 6, height: 8, unit: 'beads' } })
        const turned = direction === 'columns' ? toggleRowDirection(base) : base
        const open = rowProgressPosition(turned)
        const done = moveToRow(turned, open.total)
        expect(rowProgressPosition(done)).toEqual({ current: open.total, total: open.total })
        expect(rowProgressPosition(moveToRow(turned, open.total - 1)).current).toBeLessThan(open.total)
      }
    }
  })

  it('has no current pass once every pass is done, so nothing is marked', () => {
    const woven = project()
    const done = moveToRow(woven, woven.frame!.rows)
    expect(isInCurrentRow(done, { row: 0, column: 0 })).toBe(false)
    expect(isInFinishedRow(done, { row: woven.frame!.rows - 1, column: 0 })).toBe(true)
  })

  it('is started only while on with a pass done (ticket 411)', () => {
    const woven = project()
    expect(rowProgressStarted(woven)).toBe(false)
    expect(rowProgressStarted(moveToRow(woven, 1))).toBe(true)
    const { frame: _frame, ...unframed } = moveToRow(woven, 1)
    expect(rowProgressStarted(unframed)).toBe(false)
    // The pointer of the other direction counts too.
    expect(rowProgressStarted(moveToRow(toggleRowDirection(woven), 1))).toBe(true)
  })

  it('leaves the grid alone and returns a new Project rather than mutating the old one', () => {
    const before = project()

    const after = moveToRow(before, 2)

    expect(before.rowProgress.currentRow).toBe(0)
    expect(after.beads).toBe(before.beads)
  })
})

describe('row direction', () => {
  /** 10 columns x 20 rows, so counting along the rows and down the columns give different answers. */
  function tallProject() {
    return createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })
  }

  it('counts along the grid rows by default', () => {
    expect(rowProgressPosition(moveToRow(tallProject(), 3))).toEqual({ current: 3, total: 20 })
  })

  it('counts and steps through the columns once rows run down them', () => {
    const downColumns = toggleRowDirection(tallProject())

    expect(rowProgressPosition(downColumns)).toEqual({ current: 0, total: 10 })
    expect(rowProgressPosition(moveToRow(downColumns, 4))).toEqual({ current: 4, total: 10 })
    expect(rowProgressPosition(moveToRow(downColumns, 15))).toEqual({ current: 10, total: 10 })
  })

  it('keeps a separate pointer for each direction, so flipping back returns to the same row', () => {
    const onRowSeven = moveToRow(tallProject(), 7)

    expect(rowProgressPosition(toggleRowDirection(onRowSeven))).toEqual({ current: 0, total: 10 })

    const onColumnTwo = moveToRow(toggleRowDirection(onRowSeven), 2)

    expect(rowProgressPosition(toggleRowDirection(onColumnTwo))).toEqual({ current: 7, total: 20 })
  })
})

describe('keepFinishedRows', () => {
  
  /** 10 columns x 20 rows, with the overlay on and rows 0-2 finished. */
  function onRowThree() {
    return moveToRow(
        createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } }),
        3,
      )
  }

  it('leaves beads in finished rows as they were, keeping the edit on the current row and after', () => {
    const before = onRowThree()
    const edited = paintAt(
      before,
      [{ row: 2, column: 5 }, { row: 3, column: 5 }, { row: 9, column: 5 }],
      '#e63746',
    )

    const kept = keepFinishedRows(before, edited)

    expect(frameGrid(kept)[2]![5]!.color).toBeNull()
    expect(frameGrid(kept)[3]![5]!.color).toBe('#e63746')
    expect(frameGrid(kept)[9]![5]!.color).toBe('#e63746')
  })

  it('hands back the Project it started from when the edit only touched finished rows, so nothing counts as changed', () => {
    const before = onRowThree()
    const edited = paintAt(before, [{ row: 0, column: 0 }, { row: 2, column: 9 }], '#e63746')

    expect(keepFinishedRows(before, edited)).toBe(before)
  })

  it('locks the finished columns instead once rows run down them', () => {
    const before = moveToRow(toggleRowDirection(onRowThree()), 2)
    const edited = paintAt(before, [{ row: 15, column: 1 }, { row: 15, column: 2 }], '#e63746')

    const kept = keepFinishedRows(before, edited)

    expect(frameGrid(kept)[15]![1]!.color).toBeNull()
    expect(frameGrid(kept)[15]![2]!.color).toBe('#e63746')
  })

  it('locks nothing without a Frame', () => {
    const { frame: _frame, ...unframed } = onRowThree()
    const before = unframed as Project
    const edited = paintAt(before, [{ row: 0, column: 0 }], '#e63746')

    expect(frameGrid(keepFinishedRows(before, edited))[0]![0]!.color).toBe('#e63746')
  })
})

describe('resolveProjectBead', () => {
  it("finds the Project's Bead in the catalog", () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    expect(resolveProjectBead(project)).toEqual(cubeBead)
  })

  it('returns undefined for a Bead the catalog no longer has (a removed custom Bead, or an unrecognized imported one)', () => {
    const project = {
      ...createProject({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 15, unit: 'mm' },
      }),
      beadId: 'no-such-bead',
      bead: undefined,
    }

    expect(resolveProjectBead(project)).toBeUndefined()
  })
})

describe('deleteAll', () => {
  /** 10 columns x 20 rows, painted, rotated, with the overlay on, rows 0-2 finished and direction turned to columns. */
  function paintedAndWoven() {
    const painted = paintAt(
      createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } }),
      [{ row: 0, column: 0 }, { row: 5, column: 5 }],
      '#e63746',
    )
    const rotated = turnedClockwise(painted)
    const turned = toggleRowDirection(rotated)
    return moveToRow(turned, 3)
  }

  it('empties every cell', () => {
    const cleared = deleteAll(paintedAndWoven())

    expect(frameGrid(cleared).every((row) => row.every((cell) => cell.color === null))).toBe(true)
  })

  it('puts both direction pointers back at the first row, Row progress staying on with the Frame', () => {
    const cleared = deleteAll(paintedAndWoven())

    expect(cleared.rowProgress).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
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

  it('hands back the same instance, unchanged, when the Project is already blank with progress off', () => {
    const fresh = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    expect(deleteAll(fresh)).toBe(fresh)
  })
})

describe('a Project\'s default colors follow its Bead (ticket 0528)', () => {
  const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
  const input = { technique: 'loom', size: { width: 4, height: 2, unit: 'beads' } } as const
  const tealId = addedColorId('#2fb6ae')

  it('starts a new Project on its Bead\'s built-in colors', () => {
    expect(createProject({ ...input, beadId: delica.id }).palette).toHaveLength(16)
    expect(createProject({ ...input, beadId: roundBead.id }).palette).toHaveLength(12)
  })

  it('moves the Palette with the Bead and leaves every painted cell as it was', () => {
    const before = paintAt(createProject({ ...input, beadId: roundBead.id }), [{ row: 0, column: 0 }], '#2fb6ae')
    const after = replaceBead(before, delica)
    expect(after.palette).toHaveLength(16 + 1)
    expect(after.palette).toContain(tealId)
    expect(after.beads).toBe(before.beads)
  })

  it('undoes the Bead and the Palette together', () => {
    const before = createProject({ ...input, beadId: roundBead.id })
    const after = replaceBead(before, delica)
    const undone = restoreSnapshot(after, snapshotOf(before))
    expect(undone.beadId).toBe(roundBead.id)
    expect(undone.palette).toEqual(before.palette)
  })

  it('goes A to B to A with no duplicates and the same built-in colors', () => {
    const start = createProject({ ...input, beadId: roundBead.id })
    const back = replaceBead(replaceBead(start, delica), roundBead)
    expect(back.palette.slice(0, 12)).toEqual(start.palette)
    expect(new Set(back.palette).size).toBe(back.palette.length)
  })

  it('does not bring back an old default the maker removed on the way', () => {
    const away = replaceBead(createProject({ ...input, beadId: roundBead.id }), delica)
    const removed = setPalette(away, away.palette.filter((id) => id !== tealId))
    expect(removed.removedDefaults).toEqual(['#2fb6ae'])
    const back = replaceBead(removed, roundBead)
    expect(back.palette).not.toContain('teal')
    expect(back.palette).not.toContain(tealId)
  })

  it('remembers a removal in the undo snapshot, so Undo brings the color and the memory back', () => {
    const away = replaceBead(createProject({ ...input, beadId: roundBead.id }), delica)
    const removed = setPalette(away, away.palette.filter((id) => id !== tealId))
    const undone = restoreSnapshot(removed, snapshotOf(away))
    expect(undone.palette).toContain(tealId)
    expect(undone.removedDefaults).toBeUndefined()
  })

  it('opens a Project stored with the twelve on a Delica bead with the same colors shown', () => {
    const stored = { ...createProject({ ...input, beadId: delica.id }), palette: BUILT_IN_COLORS.map((color) => color.id) }
    const opened = normalizeProject(stored)
    expect(opened.palette).toHaveLength(12)
    expect(opened.palette).toContain(tealId)
  })
})

describe('replaceBead', () => {
  /** 4 columns x 2 rows of TOHO Round, each cell painted with a distinct color so a change to the grid is checkable. */
  function distinctlyPainted(): Project {
    let project = createProject({
      technique: 'loom',
      beadId: roundBead.id,
      size: { width: 4, height: 2, unit: 'beads' },
    })
    for (let row = 0; row < project.frame!.rows; row++) {
      for (let column = 0; column < project.frame!.columns; column++) {
        project = paintAt(project, [{ row: row, column: column }], `r${row}c${column}`)
      }
    }
    return project
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
    const before = moveToRow(distinctlyPainted(), 1)

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.rowProgress).toBe(before.rowProgress)
  })

  it('keeps name, technique and rotation exactly as they were', () => {
    const before = turnedClockwise(distinctlyPainted())

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.name).toBe(before.name)
    expect(replaced.technique).toBe(before.technique)
    expect(replaced.rotation).toBe(before.rotation)
  })

  it('works on a Project that was created in mm too, since nothing of the mm size is kept', () => {
    const before = createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 15, height: 30, unit: 'mm' } })

    const replaced = replaceBead(before, cubeBead)

    expect(replaced.frame!.columns).toBe(before.frame!.columns)
    expect(replaced.frame!.rows).toBe(before.frame!.rows)
  })

  it('bumps updatedAt', () => {
    const before = { ...distinctlyPainted(), updatedAt: 0 }

    expect(replaceBead(before, cubeBead).updatedAt).toBeGreaterThan(0)
  })
})

describe('snapshotOf and restoreSnapshot', () => {
  it('put back everything an Edit can change: the grid, Row progress, the Bead and the Frame', () => {
    const before = moveToRow(createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 8, height: 4, unit: 'beads' } }), 3)
    const snapshot = snapshotOf(before)
    const changed = withFrame(replaceBead(deleteAll(before), cubeBead), { row: 0, column: 0, columns: 2, rows: 5 })

    const restored = restoreSnapshot(changed, snapshot)

    expect(restored.beads).toBe(before.beads)
    expect(restored.rowProgress).toEqual(before.rowProgress)
    expect(restored.beadId).toBe(before.beadId)
    expect(restored.frame).toEqual(before.frame)
  })

  it('restore a Project that had no Frame', () => {
    const before = withFrame(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } }), undefined)
    const framed = withFrame(before, { row: 0, column: 0, columns: 2, rows: 5 })

    expect(restoreSnapshot(framed, snapshotOf(before)).frame).toBeUndefined()
  })
})

describe('the Frame in an undo entry (ADR 0066)', () => {
  it('is put back with its own beads by Undo, and gone again when the entry had none', () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    const drawn = { ...base, frame: { ...base.frame!, beads: { 1: { 1: '#abcdef' } } } }
    const none = { ...base, frame: undefined }

    expect(restoreSnapshot(base, snapshotOf(drawn)).frame?.beads).toEqual({ 1: { 1: '#abcdef' } })
    expect(restoreSnapshot(drawn, snapshotOf(none)).frame).toBeUndefined()
  })

  it('goes empty with Delete all, the Canvas with it', () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    const drawn = { ...base, beads: { 9: { 9: '#111111' } }, frame: { ...base.frame!, beads: { 1: { 1: '#abcdef' } } } }

    const cleared = deleteAll(drawn)

    expect(cleared.beads).toEqual({})
    expect(cleared.frame).toMatchObject({ rows: 3, columns: 4, beads: {} })
  })
})

describe('normalizeProject', () => {
  it('gives a Project saved as a fixed grid beads by position and a Frame the size of that grid (ADR 0026)', () => {
    const { beads: _beads, frame: _frame, ...base } = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 2, unit: 'beads' } })
    const legacy = {
      ...base,
      columns: 3,
      rows: 2,
      grid: [
        [{ color: '#f00' }, { color: null }, { color: null }],
        [{ color: null }, { color: null }, { color: '#0f0' }],
      ],
    }

    const normalized = normalizeProject(legacy)

    expect(normalized.frame).toEqual({ technique: 'loom', row: 0, column: 0, columns: 3, rows: 2, beads: { 0: { 0: '#f00' }, 1: { 2: '#0f0' } } })
    expect(normalized.beads).toEqual({})
    expect(normalized).not.toHaveProperty('grid')
    expect(normalized).not.toHaveProperty('columns')
    expect(normalized).not.toHaveProperty('rows')
  })

  it('keeps a turned canvas through a save and load, and turns on from there (ticket 471)', () => {
    const turned = rotateCanvas(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } }))
    const loaded = normalizeProject(JSON.parse(JSON.stringify(turned)))
    expect(loaded.rotation).toBe(90)
    expect(rotateCanvas(rotateCanvas(rotateCanvas(loaded))).rotation).toBe(0)
  })

  it('backfills row progress and the rotation on a Project saved before they existed', () => {
    const { rowProgress: _rowProgress, rotation: _rotation, ...legacy } = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    const normalized = normalizeProject(legacy as Project)

    expect(normalized.rowProgress).toEqual({
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
    expect(normalized.rotation).toBe(0)
  })

  it('reads ticket 28\'s two-position `rotated` boolean as its nearest quarter turn (ticket 171)', () => {
    const { rotation: _rotation, ...legacy } = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })

    expect(normalizeProject({ ...legacy, rotated: false } as unknown as Project).rotation).toBe(0)
    expect(normalizeProject({ ...legacy, rotated: true } as unknown as Project).rotation).toBe(90)
  })

  it('drops the color-to-bead override field a Project saved before ticket 36 may still carry (ADR 0007)', () => {
    const legacy = {
      ...createProject({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 15, unit: 'mm' },
      }),
      colorBeadOverrides: { red: 'miyuki-delica-11-0' },
    }

    const normalized = normalizeProject(legacy as Project)

    expect((normalized as unknown as { colorBeadOverrides?: unknown }).colorBeadOverrides).toBeUndefined()
  })

  it('keeps the row pointer of progress saved before row direction existed, running it along the grid rows', () => {
    const base = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const normalized = normalizeProject({
      ...base,
      rowProgress: { currentRow: 5 } as Project['rowProgress'],
    })

    expect(normalized.rowProgress).toEqual({
      direction: 'rows',
      currentRow: 5,
      currentColumn: 0,
    })
  })

  it('drops the stored real-world size a Project saved before ADR 0026 still carries, and keeps its grid', () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
    const legacy = { ...base, widthMm: 15, heightMm: 30 }

    const normalized = normalizeProject(legacy as Project)

    expect(normalized).not.toHaveProperty('widthMm')
    expect(normalized).not.toHaveProperty('heightMm')
    expect(normalized.frame!.columns).toBe(10)
    expect(normalized.frame!.rows).toBe(20)
    expect(normalized.beads).toBe(base.beads)
  })

  it('clamps row and column pointers that no longer fit the Project', () => {
    const base = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' }, // 10 columns x 20 rows
    })

    const normalized = normalizeProject({
      ...base,
      rowProgress: { direction: 'columns', currentRow: 999, currentColumn: 999 },
    })

    expect(normalized.rowProgress.currentRow).toBe(20)
    expect(normalized.rowProgress.currentColumn).toBe(10)
  })
})

describe('createProjectFromImage', () => {
  const converted = {
    grid: [
      [{ color: '#ff0000' }, { color: null }],
      [{ color: '#00ff00' }, { color: '#0000ff' }],
    ],
  }

  function fromImage(overrides: Partial<typeof converted> = {}) {
    return createProjectFromImage({
      name: 'Fox',
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 3, height: 3, unit: 'mm' }, // 2 columns x 2 rows in 1.5mm cubes
      ...converted,
      ...overrides,
    })
  }

  it('creates an ordinary Project that arrives already painted', () => {
    const project = fromImage()

    expect(project.frame!.columns).toBe(2)
    expect(project.frame!.rows).toBe(2)
    expect(frameGrid(project).map((row) => row.map((cell) => cell.color))).toEqual([
      ['#ff0000', null],
      ['#00ff00', '#0000ff'],
    ])
    expect(project.name).toBe('Fox')
    expect(project.rowProgress).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('fits a grid that does not match the stated size rather than contradicting its own dimensions', () => {
    const project = fromImage({ grid: [[{ color: '#ff0000' }, { color: '#ff0000' }, { color: '#ff0000' }]] })

    expect(frameGrid(project)).toEqual([
      [{ color: '#ff0000' }, { color: '#ff0000' }],
      [{ color: null }, { color: null }],
    ])
  })
})

describe('Row progress on the Frame (ticket 233)', () => {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  const framed: Project = { ...base, frame: { technique: 'loom' as const, row: 10, column: 10, rows: 6, columns: 4, beads: {} }, rowProgress: { ...base.rowProgress, currentRow: 2 } }

  it('names the current row of the Frame, and nothing outside it (ticket 352)', () => {
    expect(isInCurrentRow(framed, { row: 12, column: 10 })).toBe(true)
    expect(isInCurrentRow(framed, { row: 12, column: 13 })).toBe(true)
    expect(isInCurrentRow(framed, { row: 11, column: 10 })).toBe(false)
    expect(isInCurrentRow(framed, { row: 13, column: 10 })).toBe(false)
    expect(isInCurrentRow(framed, { row: 12, column: 20 })).toBe(false)
    const { frame: _frame, ...unframed } = framed
    expect(isInCurrentRow(unframed, { row: 12, column: 10 })).toBe(false)
    const columnWise: Project = { ...framed, rowProgress: { ...framed.rowProgress, direction: 'columns', currentColumn: 1 } }
    expect(isInCurrentRow(columnWise, { row: 15, column: 11 })).toBe(true)
    expect(isInCurrentRow(columnWise, { row: 15, column: 12 })).toBe(false)
  })

  it('does not lock a position that names the Canvas, whatever row of the Frame its number is (ADR 0070)', () => {
    expect(isInFinishedRow(framed, { row: 10, column: 10, layer: 'canvas' })).toBe(false)
    expect(isInCurrentRow(framed, { row: 10, column: 10, layer: 'canvas' })).toBe(false)
  })

  it('locks the finished rows of the Frame, and nothing outside it', () => {
    expect(isInFinishedRow(framed, { row: 10, column: 10 })).toBe(true)
    expect(isInFinishedRow(framed, { row: 11, column: 13 })).toBe(true)
    expect(isInFinishedRow(framed, { row: 12, column: 10 })).toBe(false)
    // Above, left of, and below the Frame: not the weaver's rows.
    expect(isInFinishedRow(framed, { row: 3, column: 10 })).toBe(false)
    expect(isInFinishedRow(framed, { row: 10, column: 4 })).toBe(false)
    expect(isInFinishedRow(framed, { row: 11, column: 20 })).toBe(false)
  })

  it('is on exactly when there is a Frame (ticket 434)', () => {
    const { frame: _frame, ...open } = base
    expect(rowProgressOn(base)).toBe(true)
    expect(rowProgressOn(open as Project)).toBe(false)
    expect(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' }).frame).toBeUndefined()
  })

  it('opens with Row progress on for a Frame whatever an old file stored, and never carries the flag on (tickets 426, 434)', () => {
    const { frame: _frame, ...open } = base
    const stored = (project: Project, enabled: boolean) => ({ ...project, rowProgress: { ...project.rowProgress, enabled, decided: true } })
    const fromOffFile = normalizeProject(stored(base, false) as Project)
    expect(rowProgressOn(fromOffFile)).toBe(true)
    expect(fromOffFile.rowProgress).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
    const fromFramelessFile = normalizeProject(stored(open as Project, true) as Project)
    expect(rowProgressOn(fromFramelessFile)).toBe(false)
    expect(fromFramelessFile.rowProgress).not.toHaveProperty('enabled')
  })

  it('turns on with a Frame set and off with it removed, passes cleared, without any flag to set (ticket 434)', () => {
    const { frame: _frame, ...open } = base
    const framedNow = withFrame(open as Project, { row: 0, column: 0, rows: 3, columns: 3 })
    expect(rowProgressOn(framedNow)).toBe(true)
    const removed = withFrame(moveToRow(framedNow, 2), undefined)
    expect(rowProgressOn(removed)).toBe(false)
    expect(removed.rowProgress.currentRow).toBe(0)
    expect(deleteAll(framedNow).rowProgress).not.toHaveProperty('enabled')
  })
})

describe('peyote passes (ticket 347)', () => {
  /** 3 columns x 7 rows, the reporter's example. */
  function peyote(direction: 'rows' | 'columns', pass: number) {
    const project = createProject({ technique: 'peyote', beadId: cubeBead.id, size: { width: 4.5, height: 10.5, unit: 'mm' } })
    const down = direction === 'columns' ? toggleRowDirection(project) : project
    return moveToRow(down, pass)
  }

  /** Which beads of the 3 x 7 Frame are finished with the pointer on `pass`, as "row,column". */
  function finished(project: ReturnType<typeof peyote>): string[] {
    const beads: string[] = []
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        if (isInFinishedRow(project, { row, column })) beads.push(`${row},${column}`)
      }
    }
    return beads
  }

  it('counts one pass for the first line and two for each later one', () => {
    expect(rowProgressPosition(peyote('columns', 0)).total).toBe(5)
    expect(rowProgressPosition(peyote('rows', 0)).total).toBe(13)
  })

  it('finishes the first column whole, then every other bead of the next one', () => {
    expect(finished(peyote('columns', 1))).toHaveLength(7)
    // Pass 2 weaves column 1's beads on even rows: 4 of them, then pass 3 the 3 on odd rows.
    expect(finished(peyote('columns', 2)).filter((bead) => bead.endsWith(',1'))).toEqual(['0,1', '2,1', '4,1', '6,1'])
    expect(finished(peyote('columns', 3)).filter((bead) => bead.endsWith(',1'))).toHaveLength(7)
  })

  it('does the same along the rows', () => {
    expect(finished(peyote('rows', 1))).toHaveLength(3)
    expect(finished(peyote('rows', 2)).filter((bead) => bead.startsWith('1,'))).toEqual(['1,0', '1,2'])
  })
})

describe('Right-angle weave Row progress (ticket 484)', () => {
  /** A Frame of 2 columns by 3 lines of Units: 3 columns by 7 rows of positions. */
  function rightAngle(direction: 'rows' | 'columns', pass: number) {
    const project = createProject({ technique: 'rightAngle', beadId: cubeBead.id, size: { width: 2, height: 3, unit: 'beads' } })
    return moveToRow(direction === 'columns' ? toggleRowDirection(project) : project, pass)
  }

  /** Which positions of the Frame are finished (or current, with `isInCurrentRow`), as "row,column"; a hole counts. */
  function marked(project: ReturnType<typeof rightAngle>, test: typeof isInFinishedRow): string[] {
    const { rows, columns } = project.frame!
    return Array.from({ length: rows * columns }, (_, index) => ({ row: Math.floor(index / columns), column: index % columns }))
      .filter((position) => test(project, position))
      .map(({ row, column }) => `${row},${column}`)
  }

  it('counts lines of Units, down the rows and across the columns', () => {
    expect(rowProgressPosition(rightAngle('rows', 0))).toEqual({ current: 0, total: 3 })
    expect(rowProgressPosition(rightAngle('columns', 0))).toEqual({ current: 0, total: 2 })
  })

  it('weaves the first line of Units in three rows of positions, and each later one in the two below', () => {
    expect(marked(rightAngle('rows', 0), isInCurrentRow).map((bead) => bead.split(',')[0])).toEqual(['0', '0', '0', '1', '1', '1', '2', '2', '2'])
    expect(marked(rightAngle('rows', 1), isInCurrentRow).map((bead) => bead.split(',')[0])).toEqual(['3', '3', '3', '4', '4', '4'])
  })

  it('finishes every line of Units above the pointer, shared row included', () => {
    expect(marked(rightAngle('rows', 0), isInFinishedRow)).toEqual([])
    expect(marked(rightAngle('rows', 1), isInFinishedRow)).toHaveLength(9)
    expect(marked(rightAngle('rows', 2), isInFinishedRow).every((bead) => Number(bead.split(',')[0]) <= 4)).toBe(true)
  })

  it('weaves a column of Units in its horizontal beads and the vertical beads either side of it', () => {
    expect(marked(rightAngle('columns', 0), isInCurrentRow)).toEqual(['0,0', '1,0', '1,1', '2,0', '3,0', '3,1', '4,0', '5,0', '5,1', '6,0'])
    expect(marked(rightAngle('columns', 1), isInCurrentRow)).toEqual(['0,1', '1,2', '2,1', '3,2', '4,1', '5,2', '6,1'])
  })
})

describe('Netting Row progress (ticket 487)', () => {
  /** A Frame of 2 columns by 3 rows of diamonds at Net size 3: 5 columns by 9 rows of positions. */
  function netting(pass: number) {
    return moveToRow(createProject({ technique: 'netting', beadId: cubeBead.id, size: { width: 2, height: 3, unit: 'beads' } }), pass)
  }

  /** The rows of the Frame's positions, holes left out, that `test` holds for. */
  function rowsMarked(project: ReturnType<typeof netting>, test: typeof isInFinishedRow): number[] {
    const { rows, columns } = project.frame!
    return Array.from({ length: rows * columns }, (_, index) => ({ row: Math.floor(index / columns), column: index % columns }))
      .filter((position) => describeWeave(project).hasPosition(position) && test(project, position))
      .map(({ row }) => row)
  }

  it('weaves the first row of diamonds whole, shared beads included, and each later one its lower sides', () => {
    expect(new Set(rowsMarked(netting(0), isInCurrentRow))).toEqual(new Set([0, 1, 2, 3, 4]))
    expect(new Set(rowsMarked(netting(1), isInCurrentRow))).toEqual(new Set([5, 6]))
    expect(new Set(rowsMarked(netting(2), isInCurrentRow))).toEqual(new Set([7, 8]))
  })

  it('finishes every row of diamonds before the pointer', () => {
    expect(rowsMarked(netting(0), isInFinishedRow)).toEqual([])
    expect(Math.max(...rowsMarked(netting(1), isInFinishedRow))).toBe(4)
    expect(Math.max(...rowsMarked(netting(2), isInFinishedRow))).toBe(6)
  })

  it('reads a stored column direction as rows', () => {
    const toggled = toggleRowDirection(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 2, height: 3, unit: 'beads' } }))
    const stored = { ...toggled, technique: 'netting' as const, frame: { ...toggled.frame!, technique: 'netting' as const } }
    expect(normalizeProject(stored).rowProgress.direction).toBe('rows')
  })

  it('stays on rows: Turn row direction does nothing', () => {
    const project = netting(1)
    expect(toggleRowDirection(project)).toBe(project)
  })
})

describe('resetRowProgress (ticket 455)', () => {
  it('takes both pointers back to the first row, keeping the direction and the beads', () => {
    const project = toggleRowDirection({ ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 5, unit: 'beads' } }), frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: {} } })
    const woven = moveToRow(project, 2)
    expect(rowProgressStarted(woven)).toBe(true)
    const reset = resetRowProgress(woven)
    expect(reset.rowProgress).toEqual({ direction: 'columns', currentRow: 0, currentColumn: 0 })
    expect(reset.beads).toBe(woven.beads)
    expect(rowProgressStarted(reset)).toBe(false)
  })
})

describe('the Frame as its own sheet (ADR 0066)', () => {
  const sheet = () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    return { ...base, frame: { ...base.frame!, row: 10, column: 10, beads: { 0: { 0: '#111111' }, 2: { 3: '#222222' } } }, beads: { 10: { 10: '#999999' }, 50: { 50: '#333333' } } }
  }

  it('shows the Frame\'s bead where it lies over the Canvas, and the Canvas\'s elsewhere', () => {
    const project = sheet()
    expect(beadColorAt(project, 10, 10)).toBe('#111111')
    expect(beadColorAt(project, 11, 10)).toBeNull()
    expect(beadColorAt(project, 50, 50)).toBe('#333333')
  })

  it('resizes with the beads staying where they are on the Canvas, dropping those outside, and leaves the Canvas alone', () => {
    const project = sheet()
    const moved = withFrame(project, { row: 9, column: 9, rows: 3, columns: 4 })
    expect(moved.frame!.beads).toEqual({ 1: { 1: '#111111' } })
    expect(moved.beads).toBe(project.beads)
  })

  it('removes the Frame\'s beads with it', () => {
    const removed = withFrame(sheet(), undefined)
    expect(removed.frame).toBeUndefined()
    expect(removed.beads).toEqual(sheet().beads)
  })

  it('knows a bead on either layer, and every color of both', () => {
    const project = sheet()
    expect(hasProjectBeads(project)).toBe(true)
    expect(hasProjectBeads({ ...project, beads: {}, frame: { ...project.frame!, beads: {} } })).toBe(false)
    expect(hasProjectBeads({ ...project, beads: {} })).toBe(true)
    expect(projectColors(project).sort()).toEqual(['#111111', '#222222', '#333333', '#999999'])
  })

  it('tells two states of a Project apart by the beads of either layer, not by which object holds them', () => {
    const project = sheet()
    expect(sameBeads(project, { ...project, beads: { ...project.beads }, frame: { ...project.frame!, beads: { ...project.frame!.beads } } })).toBe(true)
    expect(sameBeads(project, { ...project, beads: {} })).toBe(false)
    expect(sameBeads(project, { ...project, frame: { ...project.frame!, beads: {} } })).toBe(false)
  })
})

describe('a Frame woven in its own Technique (ticket 492)', () => {
  const canvasLoom = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  /** A loom Canvas with a peyote Frame of 4 × 6 at (10, 10). */
  const peyoteOnLoom = (): Project => {
    const base = canvasLoom()
    return { ...base, frame: { ...base.frame!, technique: 'peyote', row: 10, column: 10 } }
  }

  it('is made in the Technique the Project was made in, and its Weave is the Frame\'s own', () => {
    const brick = createProject({ technique: 'brick', brickBlock: 3, beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
    expect(brick.frame).toMatchObject({ technique: 'brick', brickBlock: 3 })
    expect(frameWeave(peyoteOnLoom())).toEqual({ technique: 'peyote' })
    expect(canvasWeave(peyoteOnLoom())).toEqual({ technique: 'loom' })
  })

  it('counts a Canvas with no Frame in the Canvas\'s own Weave', () => {
    const { frame: _frame, ...open } = peyoteOnLoom()
    expect(frameWeave(open)).toEqual({ technique: 'loom' })
  })

  it('counts its rows, passes and size in its own Weave: peyote\'s first line takes one pass and every later one two', () => {
    const project = { ...peyoteOnLoom(), rowProgress: { direction: 'rows' as const, currentRow: 1, currentColumn: 0 } }
    expect(rowProgressPosition(project).total).toBe(11)
    // Row 0 is pass 0, done; row 1 is pass 1 on its even positions and pass 2 on its odd.
    expect(isInFinishedRow(project, { row: 10, column: 10 })).toBe(true)
    expect(isInFinishedRow(project, { row: 11, column: 10 })).toBe(false)
    expect(isInCurrentRow(project, { row: 11, column: 10 })).toBe(true)
  })

  it('is the Frame\'s own Weave that Turn row direction asks: a Netting Frame on a loom Canvas stays on rows', () => {
    const base = peyoteOnLoom()
    const netting = { ...base, frame: { ...base.frame!, technique: 'netting' as const } }
    expect(toggleRowDirection(netting)).toBe(netting)
    expect(toggleRowDirection({ ...base, frame: { ...base.frame!, technique: 'loom' as const } }).rowProgress.direction).toBe('columns')
  })

  it('switches the Canvas without touching the Frame, and the Frame without touching the Canvas', () => {
    const peyote = withTechnique(canvasLoom(), 'peyote')
    expect(peyote.technique).toBe('peyote')
    expect(peyote.frame?.technique).toBe('loom')
    const framePeyote = withFrameTechnique(canvasLoom(), 'peyote')
    expect(framePeyote.technique).toBe('loom')
    expect(framePeyote.frame?.technique).toBe('peyote')
  })

  it('keeps the Frame\'s Weave when it is resized, and gives a new one the Canvas\'s', () => {
    const resized = withFrame(peyoteOnLoom(), { row: 10, column: 10, rows: 8, columns: 4 })
    expect(resized.frame?.technique).toBe('peyote')
    const { frame: _frame, ...open } = withTechnique(peyoteOnLoom(), 'brick')
    expect(withFrame(open, { row: 0, column: 0, rows: 4, columns: 4 }).frame?.technique).toBe('brick')
  })

  it('moves its corner on the Canvas by as far as its own rows went, to the nearest position', () => {
    // Four rows of peyote (3/4 of a bead each) are three Canvas rows: dragging the top edge up by 4 moves the corner up 3.
    const grown = withFrame(peyoteOnLoom(), { row: 6, column: 10, rows: 10, columns: 4 })
    expect(grown.frame).toMatchObject({ row: 7, rows: 10 })
    // Alike, it is exactly the rectangle asked for.
    const alike = withFrame(withTechnique(peyoteOnLoom(), 'peyote'), { row: 6, column: 10, rows: 10, columns: 4 })
    expect(alike.frame).toMatchObject({ row: 6, rows: 10 })
  })

  it('reads a Frame stored without a Weave of its own as woven like the Project, and an unreadable one the same', () => {
    const base = withTechnique(canvasLoom(), 'brick')
    const { technique: _technique, ...bare } = base.frame!
    expect(normalizeProject({ ...base, brickBlock: 2, frame: bare as never }).frame).toMatchObject({ technique: 'brick', brickBlock: 2 })
    expect(normalizeProject({ ...base, frame: { ...base.frame!, technique: 'sideways' as never } }).frame?.technique).toBe('brick')
  })

  it('keeps a Frame\'s own Weave when it is read back', () => {
    expect(normalizeProject(peyoteOnLoom()).frame?.technique).toBe('peyote')
  })
})

describe('a Project carries a copy of its Bead (ticket 534, ADR 0072)', () => {
  const made = () => createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 10, height: 10, unit: 'beads' } })
  const retired = { ...cubeBead, id: 'old-maker/cube/2mm', widthMm: 2, heightMm: 2, retired: true }

  it('saves the copy without the retired flag', () => {
    expect(made().bead).toEqual(cubeBead)
    expect(replaceBead(made(), retired).bead).not.toHaveProperty('retired')
  })

  it('draws and sizes a Bead the catalog has dropped from the Project’s own copy', () => {
    const project = { ...made(), beadId: retired.id, bead: retired, beadShape: 'real' as const }
    const opened = normalizeProject(project)

    expect(resolveProjectBead(opened)).toMatchObject({ id: retired.id, widthMm: 2 })
    expect(projectCell(opened)).toBeDefined()
    expect(estimatedSizeMm(opened.frame!, resolveProjectBead(opened)!).widthMm).toBe(20)
  })

  it('keeps the Project’s numbers when the catalog’s Bead of that id changes, until it is replaced', () => {
    const older = normalizeProject({ ...made(), bead: { ...cubeBead, widthMm: 2, heightMm: 2 } })

    expect(estimatedSizeMm(older.frame!, resolveProjectBead(older)!).widthMm).toBe(20)
    expect(estimatedSizeMm(replaceBead(older, cubeBead).frame!, resolveProjectBead(replaceBead(older, cubeBead))!).widthMm).toBe(15)
  })

  it('gives a Project with no copy the catalog’s Bead, read through the alias map, and lets an unknown id stay unknown', () => {
    const { bead: _copy, ...without } = { ...made(), beadId: 'toho-cube-1.5mm' }
    expect(normalizeProject(without)).toMatchObject({ beadId: 'toho/cube/1.5mm', bead: cubeBead })

    const { bead: _gone, ...unknown } = { ...made(), beadId: 'no-such-bead' }
    expect(resolveProjectBead(normalizeProject(unknown))).toBeUndefined()
  })

  it('falls back to the catalog when the stored copy is not a Bead', () => {
    expect(normalizeProject({ ...made(), bead: { id: 3 } as never }).bead).toEqual(cubeBead)
  })

  it('puts the copy back with Undo of a Replace Bead', () => {
    const before = made()
    const replaced = replaceBead(before, retired)
    expect(restoreSnapshot(replaced, snapshotOf(before)).bead).toEqual(cubeBead)
  })
})

describe('a swatch keeps its catalog code (ticket 0538)', () => {
  const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
  const delica15 = { ...delica, id: 'miyuki/delica/15-0', size: '15/0' }
  const catalog = {
    id: 'miyuki-delica',
    codes: [
      { code: 'DB1', family: ['Blue'], finish: 'opaque' as const, wording: 'Opaque', sizes: ['11/0', '15/0'] },
      { code: 'DB2', family: ['Red'], finish: 'opaque' as const, wording: 'Opaque', sizes: ['11/0'] },
    ],
  }
  const input = { technique: 'loom', beadId: delica.id, size: { width: 4, height: 2, unit: 'beads' } } as const
  const blue = addedColorId('#123456')
  const red = addedColorId('#654321')
  const coded = () => {
    const project = createProject(input)
    return setPalette(project, [...project.palette, blue, red], { '#123456': 'DB1', '#654321': 'DB2' })
  }

  it('is saved with the Project and gone with its swatch', () => {
    const project = coded()
    expect(project.paletteCodes).toEqual({ '#123456': 'DB1', '#654321': 'DB2' })
    expect(setPalette(project, project.palette.filter((id) => id !== red)).paletteCodes).toEqual({ '#123456': 'DB1' })
  })

  it('keeps the codes the new Bead lists in its size and drops the rest', () => {
    expect(replaceBead(coded(), delica15, catalog).paletteCodes).toEqual({ '#123456': 'DB1' })
  })

  it('clears them all for a Bead with no catalog, and Undo puts them back', () => {
    const project = coded()
    const toho = replaceBead(project, roundBead)
    expect(toho.paletteCodes).toBeUndefined()
    expect(restoreSnapshot(toho, snapshotOf(project)).paletteCodes).toEqual(project.paletteCodes)
  })

  it('does not bring back a default removed on the way, and a coded swatch that becomes a default keeps its code', () => {
    const start = createProject({ ...input, beadId: roundBead.id })
    const teal = setPalette(start, [...start.palette, addedColorId('#e6d5b8')], { '#e6d5b8': 'DB1' })
    const away = replaceBead(teal, delica, catalog)
    expect(away.palette).toContain('beige')
    expect(away.paletteCodes).toEqual({ '#e6d5b8': 'DB1' })
    const removed = setPalette(away, away.palette.filter((id) => id !== 'beige'))
    expect(removed.paletteCodes).toBeUndefined()
    expect(replaceBead(removed, roundBead).palette).not.toContain('beige')
  })

  it('reads a Project saved without codes unchanged, and ignores unreadable ones', () => {
    const plain = createProject(input)
    expect(normalizeProject(plain).paletteCodes).toBeUndefined()
    const odd = normalizeProject({ ...coded(), paletteCodes: { '#123456': 'DB1', nope: 'X', '#654321': 7 } } as never)
    expect(odd.paletteCodes).toEqual({ '#123456': 'DB1' })
  })
})

describe('Swatch letters (ticket 0573)', () => {
  const input = { technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 2, unit: 'beads' } } as const
  const hexOf = (project: Project, id: string) => projectPalette(project).byId(id)!.hex

  it('gives every Palette color a letter in Palette order, A first', () => {
    const project = createProject(input)
    const palette = projectPalette(project)
    expect(project.paletteLetters![palette.colors[0]!.hex]).toBe('A')
    expect(project.paletteLetters![palette.colors[1]!.hex]).toBe('B')
    expect(Object.keys(project.paletteLetters!)).toHaveLength(palette.colors.length)
  })

  it('gives a new color the lowest unused letter and never changes another color\'s letter when one is deleted or moved', () => {
    const start = createProject(input)
    const white = hexOf(start, 'white')
    const withAdded = setPalette(start, addUsedColor(start.palette, '#123456').ids)
    const added = withAdded.paletteLetters!['#123456']!
    const deleted = setPalette(withAdded, withAdded.palette.filter((id) => id !== 'black'))
    expect(deleted.paletteLetters![white]).toBe(start.paletteLetters![white])
    expect(deleted.paletteLetters!['#123456']).toBe(added)
    const moved = setPalette(deleted, [...deleted.palette].reverse())
    expect(moved.paletteLetters).toEqual(deleted.paletteLetters)
    const readded = setPalette(moved, addUsedColor(moved.palette, '#654321').ids)
    expect(readded.paletteLetters!['#654321']).toBe('A')
  })

  it('gives a Project saved before letters its letters in Palette order when opened, and keeps Letters off', () => {
    const { paletteLetters: _letters, ...old } = createProject(input)
    const opened = normalizeProject(old)
    expect(opened.paletteLetters![hexOf(opened, opened.palette[0]!)]).toBe('A')
    expect(opened.letters).toBeUndefined()
  })

  it('keeps stored letters and the Letters choice through opening and through Undo', () => {
    const start = withLetters(createProject(input), true)
    const changed = setPalette(start, addUsedColor(start.palette, '#123456').ids)
    expect(normalizeProject(JSON.parse(JSON.stringify(changed)))).toMatchObject({ letters: true, paletteLetters: changed.paletteLetters })
    expect(restoreSnapshot(changed, snapshotOf(start)).paletteLetters).toEqual(start.paletteLetters)
  })

  it('turns Letters on and off, off being unsaved, and shows letters only while it is on', () => {
    const project = createProject(input)
    expect(shownLetters(project)).toBeUndefined()
    const on = withLetters(project, true)
    expect(shownLetters(on)).toBe(on.paletteLetters)
    expect('letters' in withLetters(on, false)).toBe(false)
  })
})
