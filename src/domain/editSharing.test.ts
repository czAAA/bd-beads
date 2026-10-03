// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createPattern, keepFinishedRows, paintCells, type Pattern, frameGrid } from './pattern'

const NO_MIRROR = { columns: 0, rows: 0 }

function blank(columns: number, rows: number): Pattern {
  return createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
}

/**
 * An edit costs what it touched, not the size of the Pattern (ticket 106): the rows a stroke leaves alone are the very
 * arrays the Pattern already had. Nothing observable changes; these pin the sharing, which is what lets a surface tell a
 * few changed rows from a whole new grid by looking no further than the array, and what keeps a stroke's step cheap on
 * a Pattern with tens of thousands of beads.
 */
describe('an edit shares the rows it leaves alone', () => {
  it('paintCells copies only the row it painted', () => {
    const pattern = blank(6, 5)

    const painted = paintCells(pattern, [{ row: 2, column: 3 }], '#e63746', NO_MIRROR)

    expect(painted.beads[2]).not.toBe(pattern.beads[2])
    expect(frameGrid(painted)[2]![3]).toEqual({ color: '#e63746' })
    for (const row of [0, 1, 3, 4]) {
      expect(painted.beads[row]).toBe(pattern.beads[row])
    }
  })

  it('paintCells keeps the cells of the painted row that it did not touch', () => {
    const pattern = paintCells(blank(6, 5), [{ row: 2, column: 0 }], '#2f6fed', NO_MIRROR)

    const painted = paintCells(pattern, [{ row: 2, column: 3 }], '#e63746', NO_MIRROR)

    expect(painted.beads[2]![0]).toBe(pattern.beads[2]?.[0])
    expect(frameGrid(painted)[2]!.map((cell) => cell.color)).toEqual(['#2f6fed', null, null, '#e63746', null, null])
  })

  it('paintCells copies each row a mirrored stroke reaches, and no others', () => {
    const pattern = blank(6, 6)

    const painted = paintCells(pattern, [{ row: 1, column: 1 }], '#e63746', { columns: 0, rows: 1 })

    // One top-to-bottom axis: row 1 mirrors to row 4.
    expect([0, 1, 2, 3, 4, 5].map((row) => painted.beads[row] !== pattern.beads[row])).toEqual([false, true, false, false, true, false])
  })

  it('paintCells hands back the Pattern itself when nothing changes', () => {
    const pattern = paintCells(blank(6, 5), [{ row: 1, column: 1 }], '#e63746', NO_MIRROR)

    expect(paintCells(pattern, [{ row: 1, column: 1 }], '#e63746', NO_MIRROR)).toBe(pattern)
  })

  it('keepFinishedRows leaves an edit to the row being woven as it is, and shares the rest', () => {
    const before = { ...blank(6, 5), rowProgress: { enabled: true, direction: 'rows' as const, currentRow: 2, currentColumn: 0 } }
    const after = paintCells(before, [{ row: 3, column: 1 }], '#e63746', NO_MIRROR)

    const kept = keepFinishedRows(before, after)

    expect(frameGrid(kept)[3]![1]).toEqual({ color: '#e63746' })
    expect(kept.beads[0]).toBe(before.beads[0])
    expect(kept.beads[4]).toBe(before.beads[4])
  })

  it('keepFinishedRows takes back an edit to a finished row, and says nothing changed', () => {
    const before = { ...blank(6, 5), rowProgress: { enabled: true, direction: 'rows' as const, currentRow: 2, currentColumn: 0 } }
    const after = paintCells(before, [{ row: 1, column: 1 }], '#e63746', NO_MIRROR)

    expect(keepFinishedRows(before, after)).toBe(before)
  })

  it('keepFinishedRows takes back the finished columns of an edit, and keeps the rest of it', () => {
    const before = { ...blank(6, 4), rowProgress: { enabled: true, direction: 'columns' as const, currentRow: 0, currentColumn: 3 } }
    const after = paintCells(before, [{ row: 1, column: 1 }, { row: 1, column: 4 }], '#e63746', NO_MIRROR)

    const kept = keepFinishedRows(before, after)

    expect(frameGrid(kept)[1]!.map((cell) => cell.color)).toEqual([null, null, null, null, '#e63746', null])
    expect(kept.beads[0]).toBe(before.beads[0])
  })

  it('keepFinishedRows leaves the edit alone while Row progress is off', () => {
    const before = blank(6, 5)
    const after = paintCells(before, [{ row: 0, column: 0 }], '#e63746', NO_MIRROR)

    expect(keepFinishedRows(before, after)).toEqual(after)
  })
})
