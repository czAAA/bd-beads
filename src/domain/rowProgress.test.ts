// @vitest-environment node
import { frameIdIn, FRAME_ID } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { turnedWithFrame } from './rowWays'
import { withPictureTurned } from '../testUtils/layerFields'
import { createProject } from './createProject'
import { deleteAll } from './drawing'
import { finishedRowsHold, finishedRowsOf, passLine, rowPassesOf, isInCurrentRow, isInFinishedRow, keepFinishedRows, moveToRow, resetRowProgress, rowProgressOf, rowProgressOn, rowProgressPosition, rowProgressStarted, seenWayOf, stepLines, toggleRowDirection, turnRowDirectionTo } from './rowProgress'
import { changeFrame } from './changeFrame'
import { normalizeProject } from './storedProject'
import type { Project } from './project'
import { withFrame } from '../testUtils/withFrame'
import { BEAD_CATALOG } from './beads'
import { paintAt } from '../testUtils/layers'
import { frameGrid } from '../testUtils/frameGrid'
import { beadsOfLayer, frameOf } from './layerRecord'
import { withFrameSheet } from './frameSheet'
import { withLayers } from '../testUtils/layerFields'
import { type RowProgress } from './project'

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
    expect(rowProgressOf(project(), frameIdIn(project()))).toEqual({ way: 'down' })
  })

  it('is on exactly when there is a Frame, and a Frame set or removed carries the pointer with it (ticket 426)', () => {
    const started = moveToRow(project(), 4, frameIdIn(project()))
    expect(rowProgressOf(started, frameIdIn(started))).toEqual({ way: 'down', down: 4 })

    const removed = withFrame(started, undefined, frameIdIn(started))
    expect(rowProgressOn(removed, frameIdIn(removed))).toBe(false)
    expect(rowProgressOf(removed, frameIdIn(removed))).toEqual({ way: 'down' })

    const back = withFrame(removed, { row: 0, column: 0, columns: 2, rows: 2 }, frameIdIn(removed))
    expect(rowProgressOf(back, frameIdIn(back))).toEqual({ way: 'down' })
  })

  it('moves the pointer forward and backward through the rows', () => {
    const atThree = moveToRow(project(), 3, frameIdIn(project()))
    expect((rowProgressOf(atThree, frameIdIn(atThree)).down ?? 0)).toBe(3)
    expect(rowProgressOf(moveToRow(atThree, (rowProgressOf(atThree, frameIdIn(atThree)).down ?? 0) - 1, frameIdIn(atThree)), frameIdIn(moveToRow(atThree, (rowProgressOf(atThree, frameIdIn(atThree)).down ?? 0) - 1, frameIdIn(atThree)))).down).toBe(2)
  })

  it('will not step past either end of the Project; one past the last pass is every pass done (ticket 411)', () => {
    const first = project()

    expect((rowProgressOf(moveToRow(first, -1, frameIdIn(first)), frameIdIn(first)).down ?? 0)).toBe(0)
    expect(rowProgressOf(moveToRow(first, frameOf(first)!.rows + 5, frameIdIn(first)), frameIdIn(first)).down).toBe(frameOf(first)!.rows)
  })

  it('counts every pass done as the whole track, on loom, brick stitch and peyote, in both directions (ticket 411)', () => {
    for (const technique of ['loom', 'brick', 'peyote'] as const) {
      for (const direction of ['rows', 'columns'] as const) {
        const base = createProject({ technique, beadId: cubeBead.id, size: { width: 6, height: 8, unit: 'beads' } })
        const turned = direction === 'columns' ? toggleRowDirection(base, frameIdIn(base)) : base
        const open = rowProgressPosition(turned, frameIdIn(turned))
        const done = moveToRow(turned, open.total, frameIdIn(turned))
        expect(rowProgressPosition(done, frameIdIn(done))).toEqual({ current: open.total, total: open.total })
        expect(rowProgressPosition(moveToRow(turned, open.total - 1, frameIdIn(turned)), frameIdIn(turned)).current).toBeLessThan(open.total)
      }
    }
  })

  it('has no current pass once every pass is done, so nothing is marked', () => {
    const woven = project()
    const done = moveToRow(woven, frameOf(woven)!.rows, frameIdIn(woven))
    expect(isInCurrentRow(done, { row: 0, column: 0 }, frameIdIn(done))).toBe(false)
    expect(isInFinishedRow(done, { row: frameOf(woven)!.rows - 1, column: 0 }, frameIdIn(done))).toBe(true)
  })

  it('answers for many positions at once as it does for each, a pass at a time on peyote too (ticket 0675)', () => {
    for (const technique of ['loom', 'peyote'] as const) {
      const placed = createProject({ technique, beadId: cubeBead.id, size: { width: 4, height: 6, unit: 'beads' } })
      const woven = moveToRow(withLayers(placed, { frame: { ...frameOf(placed)!, row: 2, column: 3 } }), 3, frameIdIn(placed))
      const finished = finishedRowsOf(woven, frameIdIn(woven))
      const positions = Array.from({ length: 10 * 9 }, (_, index) => ({ row: Math.floor(index / 9), column: index % 9 }))
      const expected = positions.filter((position) => isInFinishedRow(woven, position, frameIdIn(woven)))
      expect(expected.length).toBeGreaterThan(0)
      expect(positions.filter(finished)).toEqual(expected)
      expect(finished({ row: 2, column: 3, layer: 'canvas' })).toBe(false)
      expect(finishedRowsOf(moveToRow(woven, 0, frameIdIn(woven)), frameIdIn(woven))({ row: 2, column: 3 })).toBe(false)
    }
  })

  it('tells finished and current beads for many positions at once as it does for each (ticket 0676)', () => {
    for (const technique of ['loom', 'peyote'] as const) {
      const placed = createProject({ technique, beadId: cubeBead.id, size: { width: 4, height: 6, unit: 'beads' } })
      const woven = moveToRow(withLayers(placed, { frame: { ...frameOf(placed)!, row: 2, column: 3 } }), 3, frameIdIn(placed))
      const passes = rowPassesOf(woven, frameIdIn(woven))
      const positions = Array.from({ length: 10 * 9 }, (_, index) => ({ row: Math.floor(index / 9), column: index % 9 }))
      const expected = positions.map((position) => (isInFinishedRow(woven, position, frameIdIn(woven)) ? 'finished' : isInCurrentRow(woven, position, frameIdIn(woven)) ? 'current' : undefined))
      expect(expected).toContain('finished')
      expect(expected).toContain('current')
      expect(positions.map(({ row, column }) => passes(row, column))).toEqual(expected)
      expect(passes(-1, -1)).toBeUndefined()
    }
  })

  it('is started only while on with a pass done (ticket 411)', () => {
    const woven = project()
    expect(rowProgressStarted(woven, frameIdIn(woven))).toBe(false)
    expect(rowProgressStarted(moveToRow(woven, 1, frameIdIn(woven)), frameIdIn(woven))).toBe(true)
    const unframed = withFrameSheet(moveToRow(woven, 1, frameIdIn(woven)), undefined, { frame: frameIdIn(woven) })
    expect(rowProgressStarted(unframed, frameIdIn(unframed))).toBe(false)
    // The pointer of the other direction counts too.
    expect(rowProgressStarted(moveToRow(toggleRowDirection(woven, frameIdIn(woven)), 1, frameIdIn(woven)), frameIdIn(moveToRow(toggleRowDirection(woven, frameIdIn(woven)), 1, frameIdIn(woven))))).toBe(true)
  })

  it('leaves the grid alone and returns a new Project rather than mutating the old one', () => {
    const before = project()

    const after = moveToRow(before, 2, frameIdIn(before))

    expect((rowProgressOf(before, frameIdIn(before)).down ?? 0)).toBe(0)
    expect(beadsOfLayer(after, 'canvas')).toBe(beadsOfLayer(before, 'canvas'))
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
    expect(rowProgressPosition(moveToRow(tallProject(), 3, frameIdIn(tallProject())), frameIdIn(moveToRow(tallProject(), 3, frameIdIn(tallProject()))))).toEqual({ current: 3, total: 20 })
  })

  it('counts and steps through the columns once rows run down them', () => {
    const downColumns = toggleRowDirection(tallProject(), frameIdIn(tallProject()))

    expect(rowProgressPosition(downColumns, frameIdIn(downColumns))).toEqual({ current: 0, total: 10 })
    expect(rowProgressPosition(moveToRow(downColumns, 4, frameIdIn(downColumns)), frameIdIn(downColumns))).toEqual({ current: 4, total: 10 })
    expect(rowProgressPosition(moveToRow(downColumns, 15, frameIdIn(downColumns)), frameIdIn(downColumns))).toEqual({ current: 10, total: 10 })
  })

  it('keeps a separate pointer for each direction, so coming back to one returns to the same row', () => {
    const onRowSeven = moveToRow(tallProject(), 7, frameIdIn(tallProject()))
    const turn = (project: Project, times: number): Project => (times === 0 ? project : turn(toggleRowDirection(project, frameIdIn(project)), times - 1))

    expect(rowProgressPosition(toggleRowDirection(onRowSeven, frameIdIn(onRowSeven)), frameIdIn(onRowSeven))).toEqual({ current: 0, total: 10 })

    const onColumnTwo = moveToRow(toggleRowDirection(onRowSeven, frameIdIn(onRowSeven)), 2, frameIdIn(onRowSeven))

    expect(rowProgressPosition(turn(onColumnTwo, 3), frameIdIn(onColumnTwo))).toEqual({ current: 7, total: 20 })
  })

  it('turns through top to bottom, left to right, bottom to top and right to left', () => {
    const ways = [tallProject()]
    for (let at = 0; at < 4; at += 1) ways.push(toggleRowDirection(ways[at], frameIdIn(ways[at])))

    expect(ways.map((way) => rowProgressOf(way, frameIdIn(way)).way)).toEqual(['down', 'right', 'up', 'left', 'down'])
  })

  describe('turned straight to a way chosen from the list (ticket 0973, UX-060)', () => {
    it('points the rows that way, and choosing the way left puts its count back as it was', () => {
      const onRowSix = moveToRow(tallProject(), 6, frameIdIn(tallProject()))
      const upward = turnRowDirectionTo(onRowSix, 'up', frameIdIn(onRowSix))

      expect(seenWayOf(upward, frameIdIn(upward))).toBe('up')
      expect(rowProgressPosition(upward, frameIdIn(upward))).toEqual({ current: 0, total: 20 })
      expect(rowProgressPosition(turnRowDirectionTo(upward, 'down', frameIdIn(upward)), frameIdIn(upward))).toEqual({ current: 6, total: 20 })
      expect(seenWayOf(turnRowDirectionTo(onRowSix, 'right', frameIdIn(onRowSix)), frameIdIn(onRowSix))).toBe('right')
      expect(seenWayOf(turnRowDirectionTo(onRowSix, 'left', frameIdIn(onRowSix)), frameIdIn(onRowSix))).toBe('left')
    })

    it('leaves the Project as it is for the way the rows run already', () => {
      const project = tallProject()
      expect(turnRowDirectionTo(project, 'down', frameIdIn(project))).toBe(project)
    })

    it('reads the way as the Frame lies on a turned Frame', () => {
      const project = tallProject()
      // Its own rows turned a quarter with it: right to left as seen (ticket 1185).
      const turned = withLayers(withFrameSheet(project, { ...frameOf(project)!, quarterTurns: 1 }, { frame: frameIdIn(project) }), { rowProgress: turnedWithFrame(rowProgressOf(project, frameIdIn(project)), 1) })
      expect(seenWayOf(turned, frameIdIn(turned))).toBe('left')

      const chosen = turnRowDirectionTo(turned, 'down', frameIdIn(turned))
      expect(seenWayOf(chosen, frameIdIn(chosen))).toBe('down')
      expect(turnRowDirectionTo(turned, 'left', frameIdIn(turned))).toBe(turned)
    })
  })

  it('weaves a bottom to top row from the Frame\'s last line, with its own pointer', () => {
    const base = withFrame(tallProject(), { row: 0, column: 0, rows: 20, columns: 10 }, frameIdIn(tallProject()))
    const upward = moveToRow(toggleRowDirection(toggleRowDirection(base, frameIdIn(base)), frameIdIn(base)), 2, frameIdIn(toggleRowDirection(toggleRowDirection(base, frameIdIn(base)), frameIdIn(base))))

    expect(rowProgressPosition(upward, frameIdIn(upward))).toEqual({ current: 2, total: 20 })
    expect(isInFinishedRow(upward, { layer: FRAME_ID, row: 19, column: 3 }, frameIdIn(upward))).toBe(true)
    expect(isInFinishedRow(upward, { layer: FRAME_ID, row: 17, column: 3 }, frameIdIn(upward))).toBe(false)
    expect(isInCurrentRow(upward, { layer: FRAME_ID, row: 17, column: 3 }, frameIdIn(upward))).toBe(true)
    expect(rowProgressStarted(upward, frameIdIn(upward))).toBe(true)
    expect(rowProgressPosition(toggleRowDirection(upward, frameIdIn(upward)), frameIdIn(upward)).current).toBe(0)
    expect(rowProgressPosition(resetRowProgress(upward, frameIdIn(upward)), frameIdIn(upward)).current).toBe(0)
  })
})

describe('keepFinishedRows', () => {
  
  /** 10 columns x 20 rows, with the overlay on and rows 0-2 finished. */
  function onRowThree() {
    const made = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
    return moveToRow(made, 3, frameIdIn(made))
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
    const before = moveToRow(toggleRowDirection(onRowThree(), frameIdIn(onRowThree())), 2, frameIdIn(toggleRowDirection(onRowThree(), frameIdIn(onRowThree()))))
    const edited = paintAt(before, [{ row: 15, column: 1 }, { row: 15, column: 2 }], '#e63746')

    const kept = keepFinishedRows(before, edited)

    expect(frameGrid(kept)[15]![1]!.color).toBeNull()
    expect(frameGrid(kept)[15]![2]!.color).toBe('#e63746')
  })

  it('locks nothing without a Frame', () => {
    const unframed = withFrameSheet(onRowThree(), undefined, { frame: frameIdIn(onRowThree()) })
    const before = unframed as Project
    const edited = paintAt(before, [{ row: 0, column: 0 }], '#e63746')

    expect(frameGrid(keepFinishedRows(before, edited))[0]![0]!.color).toBe('#e63746')
  })
})

describe('finishedRowsHold (ticket 0848)', () => {
  const before = moveToRow(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } }), 3, frameIdIn(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })))

  it('says so when rows marked done take back some of an edit', () => {
    expect(finishedRowsHold(before, paintAt(before, [{ row: 2, column: 5 }, { row: 3, column: 5 }], '#e63746'))).toBe(true)
    expect(finishedRowsHold(before, paintAt(before, [{ row: 0, column: 0 }], '#e63746'))).toBe(true)
  })

  it('stays quiet for an edit that keeps off them, or changes nothing', () => {
    expect(finishedRowsHold(before, paintAt(before, [{ row: 3, column: 5 }], '#e63746'))).toBe(false)
    expect(finishedRowsHold(before, paintAt(before, [{ row: 0, column: 0 }], null))).toBe(false)
    expect(finishedRowsHold(before, before)).toBe(false)
  })
})

describe('Row progress on the Frame (ticket 233)', () => {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  const framed: Project = withLayers(base, { frame: { technique: 'loom' as const, row: 10, column: 10, rows: 6, columns: 4, beads: {} }, rowProgress: { way: 'down', down: 2 } })

  it('names the current row of the Frame, and nothing outside it (ticket 352)', () => {
    expect(isInCurrentRow(framed, { row: 2, column: 0 }, frameIdIn(framed))).toBe(true)
    expect(isInCurrentRow(framed, { row: 2, column: 3 }, frameIdIn(framed))).toBe(true)
    expect(isInCurrentRow(framed, { row: 1, column: 0 }, frameIdIn(framed))).toBe(false)
    expect(isInCurrentRow(framed, { row: 3, column: 0 }, frameIdIn(framed))).toBe(false)
    expect(isInCurrentRow(framed, { row: 2, column: 10 }, frameIdIn(framed))).toBe(false)
    const unframed = withFrameSheet(framed, undefined, { frame: frameIdIn(framed) })
    expect(isInCurrentRow(unframed, { row: 2, column: 0 }, frameIdIn(unframed))).toBe(false)
    const columnWise: Project = withLayers(framed, { rowProgress: { ...rowProgressOf(framed, frameIdIn(framed)), way: 'right', right: 1 } })
    expect(isInCurrentRow(columnWise, { row: 5, column: 1 }, frameIdIn(columnWise))).toBe(true)
    expect(isInCurrentRow(columnWise, { row: 5, column: 2 }, frameIdIn(columnWise))).toBe(false)
  })

  it('does not lock a position that names the Canvas, whatever row of the Frame its number is (ADR 0066)', () => {
    expect(isInFinishedRow(framed, { row: 0, column: 0, layer: 'canvas' }, frameIdIn(framed))).toBe(false)
    expect(isInCurrentRow(framed, { row: 0, column: 0, layer: 'canvas' }, frameIdIn(framed))).toBe(false)
  })

  it('locks the finished rows of the Frame, and nothing outside it', () => {
    expect(isInFinishedRow(framed, { row: 0, column: 0 }, frameIdIn(framed))).toBe(true)
    expect(isInFinishedRow(framed, { row: 1, column: 3 }, frameIdIn(framed))).toBe(true)
    expect(isInFinishedRow(framed, { row: 2, column: 0 }, frameIdIn(framed))).toBe(false)
    // Above, left of, and below the Frame: not the weaver's rows.
    expect(isInFinishedRow(framed, { row: -7, column: 0 }, frameIdIn(framed))).toBe(false)
    expect(isInFinishedRow(framed, { row: 0, column: -6 }, frameIdIn(framed))).toBe(false)
    expect(isInFinishedRow(framed, { row: 1, column: 10 }, frameIdIn(framed))).toBe(false)
  })

  it('is on exactly when there is a Frame (ticket 434)', () => {
    const open = withFrameSheet(base, undefined, { frame: frameIdIn(base) })
    expect(rowProgressOn(base, frameIdIn(base))).toBe(true)
    expect(rowProgressOn(open as Project, frameIdIn(open as Project))).toBe(false)
    expect(frameOf(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' }))).toBeUndefined()
  })

  it('opens with Row progress on for a Frame whatever an old file stored, and never carries the flag on (tickets 426, 434)', () => {
    const open = withFrameSheet(base, undefined, { frame: frameIdIn(base) })
    const stored = (project: Project, enabled: boolean) => (withLayers(project, { rowProgress: { ...rowProgressOf(project, frameIdIn(project)), enabled, decided: true } as RowProgress }))
    const fromOffFile = normalizeProject(stored(base, false) as Project)
    expect(rowProgressOn(fromOffFile, frameIdIn(fromOffFile))).toBe(true)
    expect(rowProgressOf(fromOffFile, frameIdIn(fromOffFile))).toEqual({ way: 'down' })
    const fromFramelessFile = normalizeProject(stored(open as Project, true) as Project)
    expect(rowProgressOn(fromFramelessFile, frameIdIn(fromFramelessFile))).toBe(false)
    expect(rowProgressOf(fromFramelessFile, frameIdIn(fromFramelessFile))).not.toHaveProperty('enabled')
  })

  it('turns on with a Frame set and off with it removed, passes cleared, without any flag to set (ticket 434)', () => {
    const open = withFrameSheet(base, undefined, { frame: frameIdIn(base) })
    const framedNow = withFrame(open as Project, { row: 0, column: 0, rows: 3, columns: 3 }, frameIdIn(open as Project))
    expect(rowProgressOn(framedNow, frameIdIn(framedNow))).toBe(true)
    const removed = withFrame(moveToRow(framedNow, 2, frameIdIn(framedNow)), undefined, frameIdIn(framedNow))
    expect(rowProgressOn(removed, frameIdIn(removed))).toBe(false)
    expect((rowProgressOf(removed, frameIdIn(removed)).down ?? 0)).toBe(0)
    expect(rowProgressOf(deleteAll(framedNow), frameIdIn(framedNow))).not.toHaveProperty('enabled')
  })
})

describe('peyote passes (ticket 347)', () => {
  /** 3 columns x 7 rows, the reporter's example. */
  function peyote(direction: 'rows' | 'columns', pass: number) {
    const project = withLayers(createProject({ technique: 'peyote', beadId: cubeBead.id, size: { width: 4.5, height: 10.5, unit: 'mm' } }), { ownProgress: {} })
    const down = direction === 'columns' ? toggleRowDirection(project, frameIdIn(project)) : project
    return moveToRow(down, pass, frameIdIn(down))
  }

  /** Which beads of the 3 x 7 Frame are finished with the pointer on `pass`, as "row,column". */
  function finished(project: ReturnType<typeof peyote>): string[] {
    const beads: string[] = []
    for (let row = 0; row < 7; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        if (isInFinishedRow(project, { row, column }, frameIdIn(project))) beads.push(`${row},${column}`)
      }
    }
    return beads
  }

  it('counts one pass for the first line and two for each later one', () => {
    expect(rowProgressPosition(peyote('columns', 0), frameIdIn(peyote('columns', 0))).total).toBe(5)
    expect(rowProgressPosition(peyote('rows', 0), frameIdIn(peyote('rows', 0))).total).toBe(13)
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

  it('steps through the passes on the column-staggered grid as weavers do: a row at a time, its level columns then its shifted ones (tickets 0734, 1154)', () => {
    // The thread runs along a row whose beads sit in staggered columns: at a Drop of 2 a pass picks up the two beads of a pair.
    const dropped = (pass: number) => {
      const project = withLayers(createProject({ technique: 'peyote', techniqueSettings: { peyoteDrop: 2 }, beadId: cubeBead.id, size: { width: 6, height: 10.5, unit: 'mm' } }), { ownProgress: {} })
      return moveToRow(project, pass, frameIdIn(project))
    }
    const row1 = (project: ReturnType<typeof dropped>) =>
      [0, 1, 2, 3].filter((column) => isInFinishedRow(project, { row: 1, column }, frameIdIn(project))).map((column) => `1,${column}`)

    expect(rowProgressPosition(dropped(0), frameIdIn(dropped(0))).total).toBe(13)
    expect(row1(dropped(1))).toEqual([])
    expect(row1(dropped(2))).toEqual(['1,0', '1,1'])
    expect(row1(dropped(3))).toEqual(['1,0', '1,1', '1,2', '1,3'])
  })
})

describe('resetRowProgress (ticket 455)', () => {
  it('takes both pointers back to the first row, keeping the direction and the beads', () => {
    const project = toggleRowDirection(withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 5, unit: 'beads' } }), { frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: {} } }), frameIdIn(withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 5, unit: 'beads' } }), { frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: {} } })))
    const woven = moveToRow(project, 2, frameIdIn(project))
    expect(rowProgressStarted(woven, frameIdIn(woven))).toBe(true)
    const reset = resetRowProgress(woven, frameIdIn(woven))
    expect(rowProgressOf(reset, frameIdIn(reset))).toEqual({ way: 'right' })
    expect(beadsOfLayer(reset, 'canvas')).toBe(beadsOfLayer(woven, 'canvas'))
    expect(rowProgressStarted(reset, frameIdIn(reset))).toBe(false)
  })
})

describe('passLine (ticket 0849)', () => {
  it('names the ruler line of the pass where a line takes two passes, on peyote only (ticket 0849, F-04-03)', () => {
    // A new peyote Project's Canvas is turned a quarter: looked at upright first.
    const peyote = withLayers(createProject({ technique: 'peyote', beadId: cubeBead.id, size: { width: 6, height: 8, unit: 'beads' } }), { orientation: 0, ownProgress: {} })
    const lines = frameOf(peyote)!.rows
    expect(rowProgressPosition(peyote, frameIdIn(peyote)).total).toBe(1 + (lines - 1) * 2)
    // Pass 1 is the first line; passes 2 and 3 the second; pass 4 the third.
    expect(passLine(peyote, frameIdIn(peyote))).toEqual({ line: 1, lines })
    expect(passLine(moveToRow(peyote, 1, frameIdIn(peyote)), frameIdIn(peyote))).toEqual({ line: 2, lines })
    expect(passLine(moveToRow(peyote, 2, frameIdIn(peyote)), frameIdIn(peyote))).toEqual({ line: 2, lines })
    expect(passLine(moveToRow(peyote, 3, frameIdIn(peyote)), frameIdIn(peyote))).toEqual({ line: 3, lines })
    // Counted as the rulers number them: from the top and the left as seen, whichever way the rows run (ticket 1165).
    const upward = toggleRowDirection(toggleRowDirection(peyote, frameIdIn(peyote)), frameIdIn(peyote))
    expect(passLine(upward, frameIdIn(upward))).toEqual({ line: lines, lines })
    expect(passLine(moveToRow(upward, 3, frameIdIn(upward)), frameIdIn(upward))).toEqual({ line: lines - 2, lines })
    const columns = frameOf(peyote)!.columns
    const leftward = toggleRowDirection(upward, frameIdIn(upward))
    expect(passLine(moveToRow(leftward, 1, frameIdIn(leftward)), frameIdIn(leftward))).toEqual({ line: columns - 1, lines: columns })
    // A Canvas turned half round shows the rows the other way up, and a quarter turn their first one at the right.
    expect(passLine(withPictureTurned(peyote, 180), frameIdIn(peyote))).toEqual({ line: lines, lines })
    expect(passLine(withPictureTurned(upward, 180), frameIdIn(upward))).toEqual({ line: 1, lines })
    expect(passLine(withPictureTurned(peyote, 90), frameIdIn(peyote))).toEqual({ line: lines, lines })
    expect(passLine(withPictureTurned(peyote, 270), frameIdIn(peyote))).toEqual({ line: 1, lines })
    // A Frame lying a quarter round shows its first row at the right: its own rows are counted as seen too.
    const lying = withLayers(withFrameSheet(peyote, { ...frameOf(peyote)!, quarterTurns: 1 }, { frame: frameIdIn(peyote) }), { rowProgress: turnedWithFrame(rowProgressOf(peyote, frameIdIn(peyote)), 1) })
    expect(passLine(lying, frameIdIn(lying))).toEqual({ line: lines, lines })
    expect(passLine(withPictureTurned(lying, 180), frameIdIn(lying))).toEqual({ line: 1, lines })
    // None once every pass is done, and none where a pass is a whole line.
    expect(passLine(moveToRow(peyote, rowProgressPosition(peyote, frameIdIn(peyote)).total, frameIdIn(peyote)), frameIdIn(moveToRow(peyote, rowProgressPosition(peyote, frameIdIn(peyote)).total, frameIdIn(peyote))))).toBeUndefined()
    expect(passLine(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 6, height: 8, unit: 'beads' } }), frameIdIn(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 6, height: 8, unit: 'beads' } })))).toBeUndefined()
  })
})

describe('stepLines (ticket 1038)', () => {
  const frame = (technique: 'loom' | 'peyote') => withLayers(createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: 20, height: 30, unit: 'beads' } }), { ownProgress: {} })
  const step = (project: Project, from: number, to: number) => stepLines(moveToRow(project, to, frameIdIn(project)), rowProgressOf(moveToRow(project, from, frameIdIn(project)), frameIdIn(project)), frameIdIn(project))

  it('names the lines of the passes a step crossed, the one it left and the one it reached, either way', () => {
    expect(step(frame('loom'), 12, 13)).toEqual({ direction: 'rows', lines: [12, 13] })
    expect(step(frame('loom'), 16, 12)).toEqual({ direction: 'rows', lines: [12, 13, 14, 15, 16] })
  })

  it('names a line once where two passes are its halves (peyote), and none past the last pass', () => {
    expect(step(frame('peyote'), 23, 24)).toEqual({ direction: 'rows', lines: [12] })
    const { total } = rowProgressPosition(frame('loom'), frameIdIn(frame('loom')))
    expect(step(frame('loom'), total - 1, total)).toEqual({ direction: 'rows', lines: [total - 1] })
  })

  it('names columns where the rows run down the Frame', () => {
    expect(step(toggleRowDirection(frame('loom'), frameIdIn(frame('loom'))), 4, 5)).toEqual({ direction: 'columns', lines: [4, 5] })
  })

  it('names none where the way turned, which changes every pass', () => {
    const project = moveToRow(frame('loom'), 12, frameIdIn(frame('loom')))
    expect(stepLines(toggleRowDirection(project, frameIdIn(project)), rowProgressOf(project, frameIdIn(project)), frameIdIn(project))).toBeUndefined()
  })

  it('names none for a Custom frame, whose passes are rounds, not lines', () => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 60, height: 60, unit: 'beads' } }), undefined, { frame: frameIdIn(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 60, height: 60, unit: 'beads' } })) })
    const placed = changeFrame(open, { custom: { shape: 'triangle', size: 10, centre: { row: 30, column: 30 } } }, frameIdIn(open))
    if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
    expect(step(placed.project, 2, 3)).toBeUndefined()
  })
})
