// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsFromColors, colorAt, withColors } from './canvas'
import { createProject, moveToRow, setRowProgressEnabled, type Project, type Technique } from './project'
import { removeLineRefusal, removeSelectedLine, selectedFrameLine } from './removeLine'
import type { Selection } from './selection'

/** A Project whose Frame sits at (10, 20) and whose beads are numbered #00 0N0 by position, so a shift shows. */
function numbered(columns: number, rows: number, technique: Technique = 'loom'): Project {
  const base = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
  const frame = { row: 10, column: 20, columns, rows }
  const colors = Array.from({ length: rows }, (_row, r) => Array.from({ length: columns }, (_cell, c) => `#0${r}0${c}00`))
  return { ...base, frame, beads: beadsFromColors(colors, frame) }
}

const rowOf = (project: Project, index: number): Selection => ({ top: project.frame!.row + index, left: project.frame!.column, rows: 1, columns: project.frame!.columns })
const columnOf = (project: Project, index: number): Selection => ({ top: project.frame!.row, left: project.frame!.column + index, rows: project.frame!.rows, columns: 1 })

describe('selectedFrameLine', () => {
  it('reads a whole row or column of the Frame, and nothing else', () => {
    const project = numbered(3, 4)
    expect(selectedFrameLine(project.frame, rowOf(project, 2))).toEqual({ axis: 'row', index: 2 })
    expect(selectedFrameLine(project.frame, columnOf(project, 1))).toEqual({ axis: 'column', index: 1 })
    expect(selectedFrameLine(project.frame, { top: 10, left: 20, rows: 2, columns: 2 })).toBeUndefined()
    // A row of another width, or one that is off the Frame, is not the Frame's.
    expect(selectedFrameLine(project.frame, { top: 10, left: 20, rows: 1, columns: 2 })).toBeUndefined()
    expect(selectedFrameLine(project.frame, { top: 99, left: 20, rows: 1, columns: 3 })).toBeUndefined()
    expect(selectedFrameLine(undefined, rowOf(project, 0))).toBeUndefined()
    expect(selectedFrameLine(project.frame, undefined)).toBeUndefined()
  })
})

describe('removeSelectedLine', () => {
  it('removes the selected row and shifts the Frame\'s rows below it up', () => {
    const before = numbered(3, 4)
    const removed = removeSelectedLine(before, rowOf(before, 1))

    expect(removed.frame).toEqual({ row: 10, column: 20, rows: 3, columns: 3 })
    expect(colorAt(removed.beads, 10, 20)).toBe('#000000')
    expect(colorAt(removed.beads, 11, 20)).toBe('#020000')
    expect(colorAt(removed.beads, 12, 22)).toBe('#030200')
    expect(colorAt(removed.beads, 13, 20)).toBeNull()
  })

  it('removes the selected column and shifts the columns after it left', () => {
    const before = numbered(4, 3)
    const removed = removeSelectedLine(before, columnOf(before, 2))

    expect(removed.frame).toEqual({ row: 10, column: 20, rows: 3, columns: 3 })
    expect(colorAt(removed.beads, 10, 21)).toBe('#000100')
    expect(colorAt(removed.beads, 10, 22)).toBe('#000300')
    expect(colorAt(removed.beads, 10, 23)).toBeNull()
  })

  it('leaves every bead outside the Frame where it is', () => {
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

  it('is refused with no Frame', () => {
    const { frame: _frame, ...open } = numbered(3, 4)
    expect(removeLineRefusal(open as Project, { top: 10, left: 20, rows: 1, columns: 3 })).toBe('no-line')
  })

  it('is refused while Row progress is on', () => {
    const woven = setRowProgressEnabled(numbered(3, 4), true)
    expect(removeLineRefusal(woven, rowOf(woven, 0))).toBe('locked')
    expect(removeSelectedLine(woven, rowOf(woven, 0))).toBe(woven)
  })

  it('is refused for the Frame\'s only row or column', () => {
    const oneRow = numbered(3, 1)
    expect(removeLineRefusal(oneRow, rowOf(oneRow, 0))).toBe('only-line')
    expect(removeSelectedLine(oneRow, rowOf(oneRow, 0))).toBe(oneRow)
  })

  it('clamps Row progress\'s pointers onto a row that still exists', () => {
    const before = { ...moveToRow(setRowProgressEnabled(numbered(3, 4), true), 3) }
    const off: Project = { ...before, rowProgress: { ...before.rowProgress, enabled: false } }
    expect(removeSelectedLine(off, rowOf(off, 0)).rowProgress.currentRow).toBe(2)
  })
})
