// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { deleteAll } from './drawing'
import { isInCurrentRow, isInFinishedRow, moveToRow, keepFinishedRows, rowProgressPosition, resetRowProgress, toggleRowDirection, rowProgressOn, rowProgressStarted } from './rowProgress'
import { normalizeProject } from './storedProject'
import type { Project } from './project'
import { withFrame } from './frame'
import { BEAD_CATALOG } from './beads'
import { paintAt } from '../testUtils/layers'
import { frameGrid } from '../testUtils/frameGrid'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

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

  it('keeps a separate pointer for each direction, so coming back to one returns to the same row', () => {
    const onRowSeven = moveToRow(tallProject(), 7)
    const turn = (project: Project, times: number): Project => (times === 0 ? project : turn(toggleRowDirection(project), times - 1))

    expect(rowProgressPosition(toggleRowDirection(onRowSeven))).toEqual({ current: 0, total: 10 })

    const onColumnTwo = moveToRow(toggleRowDirection(onRowSeven), 2)

    expect(rowProgressPosition(turn(onColumnTwo, 3))).toEqual({ current: 7, total: 20 })
  })

  it('turns through top to bottom, left to right, bottom to top and right to left', () => {
    const ways = [tallProject()]
    for (let at = 0; at < 4; at += 1) ways.push(toggleRowDirection(ways[at]))

    expect(ways.map(({ rowProgress }) => [rowProgress.direction, !!rowProgress.reversed])).toEqual([
      ['rows', false],
      ['columns', false],
      ['rows', true],
      ['columns', true],
      ['rows', false],
    ])
  })

  it('weaves a bottom to top row from the Frame\'s last line, with its own pointer', () => {
    const base = withFrame(tallProject(), { row: 0, column: 0, rows: 20, columns: 10 })
    const upward = moveToRow(toggleRowDirection(toggleRowDirection(base)), 2)

    expect(rowProgressPosition(upward)).toEqual({ current: 2, total: 20 })
    expect(isInFinishedRow(upward, { layer: 'frame', row: 19, column: 3 })).toBe(true)
    expect(isInFinishedRow(upward, { layer: 'frame', row: 17, column: 3 })).toBe(false)
    expect(isInCurrentRow(upward, { layer: 'frame', row: 17, column: 3 })).toBe(true)
    expect(rowProgressStarted(upward)).toBe(true)
    expect(rowProgressPosition(toggleRowDirection(upward)).current).toBe(0)
    expect(rowProgressPosition(resetRowProgress(upward)).current).toBe(0)
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

  it('does not lock a position that names the Canvas, whatever row of the Frame its number is (ADR 0066)', () => {
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
