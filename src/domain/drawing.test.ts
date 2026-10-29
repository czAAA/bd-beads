// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { deleteAll } from './drawing'
import { moveToRow, rowProgressOf, toggleRowDirection } from './rowProgress'
import { BEAD_CATALOG } from './beads'
import type { Technique } from './weave'
import { paintAt } from '../testUtils/layers'
import { turnedClockwise } from '../testUtils/rotated'
import { frameGrid } from '../testUtils/frameGrid'
import { canvasOf, frameOf, orientationOf } from './layerRecord'
import { frameSheetOf, withLayers } from '../testUtils/layerFields'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

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

    expect(rowProgressOf(cleared)).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('keeps name, size, Technique, Bead and rotation exactly as they were', () => {
    const before = paintedAndWoven()

    const cleared = deleteAll(before)

    expect(canvasOf(cleared).name).toBe(canvasOf(before).name)
    expect(canvasOf(cleared).technique).toBe(canvasOf(before).technique)
    expect(canvasOf(cleared).beadId).toBe(canvasOf(before).beadId)
    expect(frameOf(cleared)!.columns).toBe(frameOf(before)!.columns)
    expect(frameOf(cleared)!.rows).toBe(frameOf(before)!.rows)
    expect(orientationOf(cleared)).toBe(orientationOf(before))
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

  it('drops the Frame\'s Folded beads too, even when they are all it holds (ticket 0638)', () => {
    const fresh = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 4, unit: 'beads' } })
    const folded = withLayers(fresh, { frame: { ...frameOf(fresh)!, folded: { 0: { 6: '#e63746' } } } })

    expect(frameSheetOf(deleteAll(folded))).toEqual(frameSheetOf(fresh))
  })
})
