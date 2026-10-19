// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { colorAt, forEachBead, withColors, type BeadMap } from './canvas'
import { frameLayer } from './layers'
import { createProject, fillArea, mirrorCurrent, mirroredCells, type Project } from './project'
import { copySelection, mirroredPastedCells, snapSelectionToUnits } from './selection'
import { describeWeave } from './weave'

const RED = '#e63746'
const BLUE = '#2a5bd7'
/** Net size 3 (a diamond is 4 positions across and down, 2 rows a Unit): 2 diamonds across, 1 down is 9 columns, 5 rows. */
const woven: Project = frameLayer(createProject({ technique: 'netting', netSize: 3, beadId: 'toho-cube-1.5mm', size: { width: 2, height: 1, unit: 'beads' } }))
const weave = describeWeave(woven)

const found = (beads: BeadMap): string[] => {
  const all: string[] = []
  forEachBead(beads, (row, column) => all.push(`${row},${column}`))
  return all.sort()
}
const paint = (project: Project, cells: [number, number, string][]): Project => ({
  ...project,
  beads: withColors(project.beads, cells.map(([row, column, color]) => ({ row, column, color }))),
})
const inHole = (key: string): boolean => {
  const [row, column] = key.split(',').map(Number)
  return !weave.hasPosition({ row: row!, column: column! })
}

describe('Fill in Netting (ticket 486)', () => {
  it('spreads along strands and through shared beads, and never into a hole', () => {
    const filled = fillArea(woven, 1, 1, RED)
    expect(found(filled.beads)).toHaveLength(Array.from({ length: 45 }, (_cell, at) => ({ row: Math.floor(at / 9), column: at % 9 })).filter((position) => weave.hasPosition(position)).length)
    expect(found(filled.beads).some(inHole)).toBe(false)
  })

  it('stops at a bead of another color', () => {
    const filled = fillArea(paint(woven, [[2, 4, BLUE]]), 1, 1, RED)
    expect(colorAt(filled.beads, 2, 4)).toBe(BLUE)
    expect(colorAt(filled.beads, 2, 0)).toBe(RED)
  })

  it('does nothing when it starts in a hole', () => {
    expect(fillArea(woven, 0, 0, RED)).toBe(woven)
  })
})

describe('Mirror in Netting (ticket 486)', () => {
  it('copies a bead only to places that hold a bead', () => {
    for (const axes of [{ columns: 1, rows: 0 }, { columns: 0, rows: 1 }, { columns: 2, rows: 1 }]) {
      for (const position of [{ row: 1, column: 1 }, { row: 0, column: 2 }, { row: 2, column: 4 }]) {
        expect(mirroredCells(woven, position, axes).every((cell) => weave.hasPosition(cell))).toBe(true)
      }
    }
  })

  it('folds a drawn side over without filling a hole', () => {
    const drawn = paint(woven, [[1, 1, RED], [2, 0, RED], [0, 2, RED]])
    for (const axis of ['columns', 'rows'] as const) {
      const result = mirrorCurrent(drawn, axis, 1, false)
      expect(found(result.beads).some(inHole)).toBe(false)
    }
  })

  it('folds columns onto the strand across: a diamond’s left side becomes its right', () => {
    const result = mirrorCurrent(paint(woven, [[1, 1, RED]]), 'columns', 1, false)
    expect(colorAt(result.beads, 1, 7)).toBe(RED)
  })
})

describe('Selection and Paste in Netting (ticket 486)', () => {
  it('a Selection grows to whole diamonds: from a shared-bead row to one, at least a diamond each way', () => {
    expect(snapSelectionToUnits(woven, { top: 1, left: 1, rows: 1, columns: 1 })).toEqual({ top: 0, left: 0, rows: 5, columns: 5 })
    expect(snapSelectionToUnits(woven, { top: 2, left: 2, rows: 3, columns: 3 })).toEqual({ top: 2, left: 2, rows: 5, columns: 5 })
    expect(snapSelectionToUnits(woven, { top: 0, left: 0, rows: 5, columns: 9 })).toEqual({ top: 0, left: 0, rows: 5, columns: 9 })
  })

  it('stamps a copied diamond on whole diamonds and skips the positions that hold no bead', () => {
    const block = copySelection(paint(woven, [[0, 2, RED], [1, 1, RED], [1, 3, RED], [2, 0, RED], [2, 4, RED]]), { top: 0, left: 0, rows: 5, columns: 5 })!
    // Aimed a little off the lattice: it still lands on beads only.
    const cells = mirroredPastedCells(woven, block, { row: 0, column: 3 }, { columns: 0, rows: 0 })
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.every((cell) => weave.hasPosition(cell))).toBe(true)
    expect(cells.length).toBe(5)
  })
})
