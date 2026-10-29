// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsFromColors, colorAt, withColors } from './canvas'
import { createProject } from './createProject'
import type { Project } from './project'
import type { Technique } from './weave'
import { removeLineQuestion, removeLineRefusal, removeSelectedLine as removeLineChange, selectedAreaLine } from './removeLine'
import type { Selection } from './selection'

/** A Project whose Frame sits at (10, 20) and whose own beads are numbered #00 0N0 by position, so a shift shows. */
function numbered(columns: number, rows: number, technique: Technique = 'loom'): Project {
  const base = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  const colors = Array.from({ length: rows }, (_row, r) => Array.from({ length: columns }, (_cell, c) => `#0${r}0${c}00`))
  return { ...base, frame: { technique: 'loom' as const, row: 10, column: 20, columns, rows, beads: beadsFromColors(colors) } }
}

const rowOf = (project: Project, index: number): Selection => ({ top: project.frame!.row + index, left: project.frame!.column, rows: 1, columns: project.frame!.columns })
const columnOf = (project: Project, index: number): Selection => ({ top: project.frame!.row, left: project.frame!.column + index, rows: project.frame!.rows, columns: 1 })

describe('selectedAreaLine', () => {
  it('reads a whole row or column of the Frame, and nothing else', () => {
    const project = numbered(3, 4)
    expect(selectedAreaLine(project.frame, rowOf(project, 2))).toEqual({ axis: 'row', index: 2 })
    expect(selectedAreaLine(project.frame, columnOf(project, 1))).toEqual({ axis: 'column', index: 1 })
    expect(selectedAreaLine(project.frame, { top: 10, left: 20, rows: 2, columns: 2 })).toBeUndefined()
    // A row of another width, or one that is off the Frame, is not the Frame's.
    expect(selectedAreaLine(project.frame, { top: 10, left: 20, rows: 1, columns: 2 })).toBeUndefined()
    expect(selectedAreaLine(project.frame, { top: 99, left: 20, rows: 1, columns: 3 })).toBeUndefined()
    expect(selectedAreaLine(undefined, rowOf(project, 0))).toBeUndefined()
    expect(selectedAreaLine(project.frame, undefined)).toBeUndefined()
  })
})

/** The Project after the change, or the same Project when the change did not happen. */
function removeSelectedLine(project: Project, selection: Parameters<typeof removeLineChange>[1]): Project {
  const result = removeLineChange(project, selection)
  return result.kind === 'changed' ? result.project : project
}

describe('removeSelectedLine', () => {
  it('removes the selected row and shifts the Frame\'s rows below it up', () => {
    const before = numbered(3, 4)
    const removed = removeSelectedLine(before, rowOf(before, 1))

    expect(removed.frame).toMatchObject({ row: 10, column: 20, rows: 3, columns: 3 })
    expect(colorAt(removed.frame!.beads, 0, 0)).toBe('#000000')
    expect(colorAt(removed.frame!.beads, 1, 0)).toBe('#020000')
    expect(colorAt(removed.frame!.beads, 2, 2)).toBe('#030200')
    expect(colorAt(removed.frame!.beads, 3, 0)).toBeNull()
  })

  it('removes the selected column and shifts the columns after it left', () => {
    const before = numbered(4, 3)
    const removed = removeSelectedLine(before, columnOf(before, 2))

    expect(removed.frame).toMatchObject({ row: 10, column: 20, rows: 3, columns: 3 })
    expect(colorAt(removed.frame!.beads, 0, 1)).toBe('#000100')
    expect(colorAt(removed.frame!.beads, 0, 2)).toBe('#000300')
    expect(colorAt(removed.frame!.beads, 0, 3)).toBeNull()
  })

  it('leaves every bead of the Canvas where it is', () => {
    const before = numbered(3, 4)
    const outside = withColors(before.beads, [
      { row: 12, column: 40, color: '#111111' },
      { row: 30, column: 21, color: '#222222' },
      { row: 3, column: 3, color: '#333333' },
    ])
    const removed = removeSelectedLine({ ...before, beads: outside }, rowOf(before, 0))

    expect(colorAt(removed.beads, 12, 40)).toBe('#111111')
    expect(colorAt(removed.beads, 30, 21)).toBe('#222222')
    expect(colorAt(removed.beads, 3, 3)).toBe('#333333')
  })

  it('applies to peyote and brick stitch with no pairing restriction', () => {
    for (const technique of ['peyote', 'brick'] as const) {
      const before = numbered(2, 5, technique)
      expect(removeSelectedLine(before, rowOf(before, 2)).frame!.rows).toBe(4)
    }
  })

  it('keeps the rest of the Project as it was, and bumps updatedAt', () => {
    const before = { ...numbered(3, 4), name: 'Keep me', updatedAt: 0 }
    const removed = removeSelectedLine(before, rowOf(before, 1))
    expect(removed).toMatchObject({ id: before.id, name: 'Keep me', technique: 'loom' })
    expect(removed.updatedAt).toBeGreaterThan(0)
  })

  it('hands back the same instance with no Selection, or one that is not a whole line', () => {
    const project = numbered(3, 4)
    expect(removeSelectedLine(project, undefined)).toBe(project)
    expect(removeSelectedLine(project, { top: 10, left: 20, rows: 2, columns: 2 })).toBe(project)
  })

  it('is refused for the Frame\'s only row or column', () => {
    const oneRow = numbered(3, 1)
    expect(removeLineRefusal(oneRow, rowOf(oneRow, 0))).toBe('only-line')
    expect(removeSelectedLine(oneRow, rowOf(oneRow, 0))).toBe(oneRow)
  })

  it('is not offered on a Custom frame, which has no plain rows (ADR 0079, ticket 0669)', () => {
    const plain = numbered(3, 4)
    const custom = { ...plain, frame: { ...plain.frame!, shape: 'triangle' as const, settings: { rounds: 2 } } }
    expect(removeLineRefusal(custom, rowOf(custom, 0))).toBe('no-line')
    expect(removeLineQuestion(custom, rowOf(custom, 0))).toBeUndefined()
  })
})

describe('removeSelectedLine with no Frame (ticket 313)', () => {
  /** Two Piece areas far apart: a 3×3 block at (0, 0) numbered by position, and one bead at (20, 20). */
  function unframed(): Project {
    const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
    const colors = Array.from({ length: 3 }, (_row, r) => Array.from({ length: 3 }, (_cell, c) => `#0${r}0${c}00`))
    const block = beadsFromColors(colors, { row: 0, column: 0 })
    const beads = { ...block, 20: { 20: '#ffffff' } }
    return { ...base, frame: undefined, beads }
  }

  it('cuts the Piece area\'s line, closes the gap and leaves other areas alone', () => {
    const before = unframed()
    // No Frame, no passes: nothing to ask about.
    expect(removeLineQuestion(before, { top: 1, left: 0, rows: 1, columns: 3 })).toBeUndefined()
    const removed = removeSelectedLine(before, { top: 1, left: 0, rows: 1, columns: 3 })
    expect(colorAt(removed.beads, 0, 0)).toBe('#000000')
    expect(colorAt(removed.beads, 1, 0)).toBe('#020000')
    expect(colorAt(removed.beads, 2, 0)).toBeNull()
    expect(colorAt(removed.beads, 20, 20)).toBe('#ffffff')
    expect(removed.frame).toBeUndefined()
  })

  it('removes a column the same way', () => {
    const removed = removeSelectedLine(unframed(), { top: 0, left: 0, rows: 3, columns: 1 })
    expect(colorAt(removed.beads, 0, 0)).toBe('#000100')
    expect(colorAt(removed.beads, 0, 2)).toBeNull()
  })

  it('refuses a Selection that is not a whole line of a Piece area, or a Frame-less Selection off any area', () => {
    const before = unframed()
    expect(removeLineRefusal(before, { top: 1, left: 0, rows: 1, columns: 2 })).toBe('no-line')
    expect(removeLineRefusal(before, { top: 1, left: 0, rows: 1, columns: 3 })).toBeUndefined()
    expect(removeLineRefusal(before, { top: 50, left: 0, rows: 1, columns: 3 })).toBe('no-line')
  })
})

describe('Remove row/column once rows are marked done (ticket 0647, ADR 0055)', () => {
  /** A Frame of 3 columns and 6 rows in a Technique, its rows running `rowProgress`'s way with its pointers. */
  const woven = (rowProgress: Project['rowProgress'], technique: Technique = 'loom'): Project => {
    const project = numbered(3, 6)
    return { ...project, technique, frame: { ...project.frame!, technique }, rowProgress }
  }
  const down = (currentRow: number) => ({ direction: 'rows' as const, currentRow, currentColumn: 0 })

  it('takes a row not yet woven without asking, and leaves the pointer', () => {
    const project = woven(down(4))
    expect(removeLineRefusal(project, rowOf(project, 4))).toBeUndefined()
    expect(removeLineQuestion(project, rowOf(project, 4))).toBeUndefined()
    expect(removeSelectedLine(project, rowOf(project, 4)).rowProgress).toMatchObject({ currentRow: 4 })
  })

  it('asks before a finished row, and moves the pointer back by its one pass on loom', () => {
    const project = woven(down(4))
    expect(removeLineQuestion(project, rowOf(project, 1))).toEqual({ kind: 'finished-row', row: 2, backTo: 4, shifts: false, direction: 'rows' })
    const removed = removeSelectedLine(project, rowOf(project, 1))
    expect(removed.frame).toMatchObject({ rows: 5 })
    expect(removed.rowProgress).toMatchObject({ currentRow: 3 })
  })

  it('moves the pointer back two passes for a later peyote row, one for its first, and says the rows after it shift', () => {
    // Peyote's rows 0 to 3 are done: passes 0, 1 and 2, 3 and 4, 5 and 6.
    const project = woven(down(7), 'peyote')
    expect(removeLineQuestion(project, rowOf(project, 2))).toEqual({ kind: 'finished-row', row: 3, backTo: 6, shifts: true, direction: 'rows' })
    expect(removeSelectedLine(project, rowOf(project, 2)).rowProgress).toMatchObject({ currentRow: 5 })
    expect(removeSelectedLine(project, rowOf(project, 0)).rowProgress).toMatchObject({ currentRow: 6 })
    expect(removeLineQuestion(woven(down(2), 'brick'), rowOf(project, 0))).toMatchObject({ kind: 'finished-row', shifts: true })
  })

  it('asks before a column across finished rows, which stay finished', () => {
    const project = woven(down(4))
    expect(removeLineQuestion(project, columnOf(project, 1))).toEqual({ kind: 'across-rows', rows: 4, direction: 'rows' })
    const removed = removeSelectedLine(project, columnOf(project, 1))
    expect(removed.frame).toMatchObject({ columns: 2 })
    expect(removed.rowProgress).toMatchObject({ currentRow: 4 })
  })

  it('reads rows and columns the way the rows run, from either end', () => {
    // Left to right, column 0 done: it is the finished row; a row of the grid runs across it.
    const across = woven({ direction: 'columns', currentRow: 0, currentColumn: 1 })
    expect(removeLineQuestion(across, columnOf(across, 0))).toEqual({ kind: 'finished-row', row: 1, backTo: 1, shifts: false, direction: 'columns' })
    expect(removeLineQuestion(across, rowOf(across, 0))).toEqual({ kind: 'across-rows', rows: 1, direction: 'columns' })
    // Bottom to top, the last two rows done: the bottom row is row 1, as the Progress bar counts.
    const up = woven({ direction: 'rows', reversed: true, currentRow: 0, currentColumn: 0, currentRowBack: 2 })
    expect(removeLineQuestion(up, rowOf(up, 0))).toBeUndefined()
    expect(removeLineQuestion(up, rowOf(up, 5))).toMatchObject({ kind: 'finished-row', row: 1, backTo: 2 })
    expect(removeSelectedLine(up, rowOf(up, 5)).rowProgress).toMatchObject({ currentRowBack: 1 })
  })

  it('moves back the pointer of every way whose rows run along the line, so the same beads stay finished', () => {
    const project = woven({ direction: 'columns', currentRow: 3, currentColumn: 1, currentRowBack: 2 })
    expect(removeSelectedLine(project, rowOf(project, 0)).rowProgress).toMatchObject({ currentRow: 2, currentColumn: 1, currentRowBack: 2 })
    expect(removeSelectedLine(project, rowOf(project, 5)).rowProgress).toMatchObject({ currentRow: 3, currentRowBack: 1 })
  })
})
