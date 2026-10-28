// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { forEachBead, withColors, type BeadMap } from './canvas'
import { layerSheet, type LayerSheet } from './layers'
import { createProject } from './createProject'
import { fillArea } from './fill'
import { copySelection, stampedCells, snapSelectionToUnits } from './selection'
import { describeWeave } from './weave'

const RED = '#e63746'
/** Net size 3 (a diamond is 4 positions across and down, 2 rows a Unit): 2 diamonds across, 1 down is 9 columns, 5 rows. */
const woven: LayerSheet = layerSheet(createProject({ technique: 'netting', netSize: 3, beadId: 'toho-cube-1.5mm', size: { width: 2, height: 1, unit: 'beads' } }), 'frame')
const weave = describeWeave(woven.weave)

const found = (beads: BeadMap): string[] => {
  const all: string[] = []
  forEachBead(beads, (row, column) => all.push(`${row},${column}`))
  return all.sort()
}
const paint = (sheet: LayerSheet, cells: [number, number, string][]): LayerSheet => ({
  ...sheet,
  beads: withColors(sheet.beads, cells.map(([row, column, color]) => ({ row, column, color }))),
})
const inHole = (key: string): boolean => {
  const [row, column] = key.split(',').map(Number)
  return !weave.hasPosition({ row: row!, column: column! })
}

describe('Fill in Netting (ticket 486)', () => {
  it('spreads along strands and through shared beads, and never into a hole', () => {
    const filled = fillArea(woven, 1, 1, RED)
    expect(found(filled)).toHaveLength(Array.from({ length: 45 }, (_cell, at) => ({ row: Math.floor(at / 9), column: at % 9 })).filter((position) => weave.hasPosition(position)).length)
    expect(found(filled).some(inHole)).toBe(false)
  })

  it('does nothing when it starts in a hole', () => {
    expect(fillArea(woven, 0, 0, RED)).toBe(woven.beads)
  })
})

describe('Selection and Paste in Netting (ticket 486)', () => {
  it('a Selection grows to whole diamonds: from a shared-bead row to one, at least a diamond each way', () => {
    expect(snapSelectionToUnits(woven.weave, { top: 1, left: 1, rows: 1, columns: 1 })).toEqual({ top: 0, left: 0, rows: 5, columns: 5 })
    expect(snapSelectionToUnits(woven.weave, { top: 2, left: 2, rows: 3, columns: 3 })).toEqual({ top: 2, left: 2, rows: 5, columns: 5 })
    expect(snapSelectionToUnits(woven.weave, { top: 0, left: 0, rows: 5, columns: 9 })).toEqual({ top: 0, left: 0, rows: 5, columns: 9 })
  })

  it('stamps a copied diamond on whole diamonds and skips the positions that hold no bead', () => {
    const block = copySelection(paint(woven, [[0, 2, RED], [1, 1, RED], [1, 3, RED], [2, 0, RED], [2, 4, RED]]), { top: 0, left: 0, rows: 5, columns: 5 })!
    // Aimed a little off the lattice: it still lands on beads only.
    const cells = stampedCells({ ...woven.weave, frame: woven.edge }, block, { row: 0, column: 3 })
    expect(cells.every((cell) => weave.hasPosition(cell))).toBe(true)
    expect(cells.length).toBe(5)
  })
})
