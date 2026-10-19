// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject, keepFinishedRows, type Project, frameGrid } from './project'
import { paintAt } from '../testUtils/layers'


function blank(columns: number, rows: number): Project {
  return createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
}

// An edit costs what it touched, not the Project's size (ticket 106): rows a stroke leaves alone are the very arrays
// the Project had. These pin that sharing, which lets a surface tell a few changed rows from a whole new grid by
// looking no further than the array, and keeps a stroke's step cheap on a Project with tens of thousands of beads.
describe('an edit shares the rows it leaves alone', () => {
  it('paintCells copies only the row it painted', () => {
    const project = blank(6, 5)

    const painted = paintAt(project, [{ row: 2, column: 3 }], '#e63746')

    expect(painted.frame!.beads[2]).not.toBe(project.frame!.beads[2])
    expect(frameGrid(painted)[2]![3]).toEqual({ color: '#e63746' })
    for (const row of [0, 1, 3, 4]) {
      expect(painted.frame!.beads[row]).toBe(project.frame!.beads[row])
    }
  })

  it('paintCells keeps the cells of the painted row that it did not touch', () => {
    const project = paintAt(blank(6, 5), [{ row: 2, column: 0 }], '#2f6fed')

    const painted = paintAt(project, [{ row: 2, column: 3 }], '#e63746')

    expect(painted.frame!.beads[2]![0]).toBe(project.frame!.beads[2]?.[0])
    expect(frameGrid(painted)[2]!.map((cell) => cell.color)).toEqual(['#2f6fed', null, null, '#e63746', null, null])
  })

  it('paintCells copies each row a mirrored stroke reaches, and no others', () => {
    const project = blank(6, 6)

    const painted = paintAt(project, [{ row: 1, column: 1 }], '#e63746', { columns: 0, rows: 1 })

    // One top-to-bottom axis: row 1 mirrors to row 4.
    expect([0, 1, 2, 3, 4, 5].map((row) => painted.frame!.beads[row] !== project.frame!.beads[row])).toEqual([false, true, false, false, true, false])
  })

  it('paintCells hands back the Project itself when nothing changes', () => {
    const project = paintAt(blank(6, 5), [{ row: 1, column: 1 }], '#e63746')

    expect(paintAt(project, [{ row: 1, column: 1 }], '#e63746')).toBe(project)
  })

  it('keepFinishedRows leaves an edit to the row being woven as it is, and shares the rest', () => {
    const before = { ...blank(6, 5), rowProgress: { direction: 'rows' as const, currentRow: 2, currentColumn: 0 } }
    const after = paintAt(before, [{ row: 3, column: 1 }], '#e63746')

    const kept = keepFinishedRows(before, after)

    expect(frameGrid(kept)[3]![1]).toEqual({ color: '#e63746' })
    expect(kept.frame!.beads[0]).toBe(before.frame!.beads[0])
    expect(kept.frame!.beads[4]).toBe(before.frame!.beads[4])
  })

  it('keepFinishedRows takes back an edit to a finished row, and says nothing changed', () => {
    const before = { ...blank(6, 5), rowProgress: { direction: 'rows' as const, currentRow: 2, currentColumn: 0 } }
    const after = paintAt(before, [{ row: 1, column: 1 }], '#e63746')

    expect(keepFinishedRows(before, after)).toBe(before)
  })

  it('keepFinishedRows takes back the finished columns of an edit, and keeps the rest of it', () => {
    const before = { ...blank(6, 4), rowProgress: { direction: 'columns' as const, currentRow: 0, currentColumn: 3 } }
    const after = paintAt(before, [{ row: 1, column: 1 }, { row: 1, column: 4 }], '#e63746')

    const kept = keepFinishedRows(before, after)

    expect(frameGrid(kept)[1]!.map((cell) => cell.color)).toEqual([null, null, null, null, '#e63746', null])
    expect(kept.frame!.beads[0]).toBe(before.frame!.beads[0])
  })

  it('keepFinishedRows leaves the edit alone while Row progress is off', () => {
    const before = blank(6, 5)
    const after = paintAt(before, [{ row: 0, column: 0 }], '#e63746')

    expect(keepFinishedRows(before, after)).toEqual(after)
  })
})
