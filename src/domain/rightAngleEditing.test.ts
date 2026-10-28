// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { colorAt, forEachBead, withColors, type BeadMap } from './canvas'
import { createProject } from './createProject'
import { fillArea } from './fill'
import { weaveOf } from './layerWeave'
import type { Project } from './project'
import { rotateFrame, rotateSelection } from './rotate'
import { copySelection, stampedCells, movedSelection, snapSelectionToUnits, type Selection } from './selection'

const RED = '#e63746'
const BLUE = '#2a5bd7'
const base = createProject({ technique: 'rightAngle', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** 3 Units across, 2 down: 5 lines, 4 columns, at the origin. */
const woven: Project = { ...base, frame: { ...weaveOf(base), row: 0, column: 0, rows: 5, columns: 4, beads: {} }, beads: {} }
const weave = { technique: 'rightAngle' as const }

const found = (beads: BeadMap): string[] => {
  const all: string[] = []
  forEachBead(beads, (row, column, color) => all.push(`${row},${column}:${color}`))
  return all.sort()
}
const paint = (project: Project, cells: [number, number, string][]): Project => ({
  ...project,
  beads: withColors(project.beads, cells.map(([row, column, color]) => ({ row, column, color }))),
})

describe('Rotate in Right-angle weave (ticket 483)', () => {
  const selection: Selection = { top: 0, left: 0, rows: 5, columns: 4 }

  it('turns whole Units: a horizontal bead becomes vertical and the other way round', () => {
    const project = paint(woven, [[0, 0, RED], [1, 0, BLUE]])
    const result = rotateSelection(project, selection)

    // 3 x 2 Units become 2 x 3, about the same middle.
    expect(result.selection).toEqual({ top: 0, left: 1, rows: 7, columns: 3 })
    expect(found(result.project.beads)).toEqual(['0,2:' + BLUE, '1,3:' + RED])
  })

  it('comes back to where it began after four turns, whatever the shape', () => {
    const project = paint(woven, [[0, 0, RED], [1, 0, BLUE], [2, 2, RED], [3, 3, BLUE], [4, 1, RED]])
    let turned = { project, selection }
    for (let turn = 0; turn < 4; turn++) {
      turned = rotateSelection(turned.project, turned.selection)
    }
    expect(turned.selection).toEqual(selection)
    expect(found(turned.project.beads)).toEqual(found(project.beads))
  })

  it('turns the Frame as Units, swapping its Units across and down, with its own beads', () => {
    const project: Project = { ...woven, frame: { ...weaveOf(woven), row: 10, column: 10, rows: 5, columns: 4, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) } }
    const turned = rotateFrame(project)!
    expect(turned.frame).toMatchObject({ row: 10, column: 11, rows: 7, columns: 3 })
    expect(colorAt(turned.frame!.beads, 1, 2)).toBe(RED)
  })
})

describe('Selection and Paste in Right-angle weave (ticket 483)', () => {
  it('grows a Selection to whole Units: from a line of horizontal beads to one, a Unit at least', () => {
    expect(snapSelectionToUnits(weave, { top: 1, left: 1, rows: 1, columns: 1 })).toEqual({ top: 0, left: 1, rows: 3, columns: 2 })
    expect(snapSelectionToUnits(weave, { top: 1, left: 0, rows: 2, columns: 3 })).toEqual({ top: 0, left: 0, rows: 3, columns: 3 })
    expect(snapSelectionToUnits(weave, { top: 2, left: 0, rows: 3, columns: 2 })).toEqual({ top: 2, left: 0, rows: 3, columns: 2 })
  })

  it('keeps a grown Selection inside the Frame it began in', () => {
    const frame = { row: 0, column: 0, rows: 5, columns: 4 }
    expect(snapSelectionToUnits(weave, { top: 4, left: 3, rows: 1, columns: 1 }, frame)).toEqual({ top: 2, left: 2, rows: 3, columns: 2 })
  })

  it('leaves a Technique with no Units alone', () => {
    const selection = { top: 1, left: 1, rows: 1, columns: 1 }
    expect(snapSelectionToUnits({ technique: 'loom' }, selection)).toBe(selection)
  })

  it('moves a Selection down by whole Units', () => {
    expect(movedSelection({ top: 0, left: 0, rows: 3, columns: 2 }, 3, 1, weave)).toEqual({ top: 4, left: 1, rows: 3, columns: 2 })
  })

  it('copies from a Unit\'s line and pastes keeping each bead lying as it did', () => {
    const copied = copySelection(paint(woven, [[1, 1, RED], [2, 1, BLUE]]), { top: 0, left: 0, rows: 5, columns: 4 })!
    expect(copied.anchor).toEqual({ row: 1, column: 0 })

    const cells = stampedCells(woven, copied, { row: 7, column: 5 })
    expect(cells).toEqual([{ row: 7, column: 5, color: RED }, { row: 8, column: 5, color: BLUE }])
    // Aimed one row off, it still lands on a vertical bead's line.
    expect(stampedCells(woven, copied, { row: 8, column: 5 })[0]).toMatchObject({ row: 7 })
  })
})

describe('Fill in Right-angle weave (ticket 483)', () => {
  it('spreads through beads that touch at a corner of a Unit, and stops at an empty one', () => {
    const filled = fillArea(woven, 0, 0, RED)
    expect(found(filled.beads)).toContain('1,0:' + RED)
    expect(found(filled.beads)).toContain('1,1:' + RED)
    expect(colorAt(filled.beads, 0, 3)).toBeNull()
    expect(colorAt(filled.beads, 2, 0)).toBe(RED)
  })
})
