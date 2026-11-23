// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from './beads'
import { withColors } from './canvas'
import { createProject } from './createProject'
import { snapColumn, snapRow, withFrame } from './frame'
import { beadsOfLayer, frameOf, heldWeave, withLayer } from './layerRecord'
import type { Project } from './project'
import { selectionExportProject, selectionExportable } from './selectionExport'
import type { Selection } from './selection'

const cube = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const RED = '#e63746'
const BLUE = '#2f6fed'

function canvas(technique: 'loom' | 'peyote', columns = 12, rows = 12): Project {
  return createProject({ technique, beadId: cube.id, size: { width: columns * cube.widthMm, height: rows * cube.heightMm, unit: 'mm' } })
}

const painted = (project: Project, cells: [number, number, string][]) => withLayer(project, 'canvas', { beads: withColors(beadsOfLayer(project, 'canvas'), cells.map(([row, column, color]) => ({ row, column, color }))) })

describe('selectionExportProject', () => {
  it('lays a Frame on a Canvas Selection, holding only its beads from its own first row and column', () => {
    const project = painted(canvas('loom'), [[2, 3, RED], [3, 4, BLUE], [9, 9, RED]])
    const selection: Selection = { top: 2, left: 3, rows: 3, columns: 3, layer: 'canvas' }
    const part = selectionExportProject(project, selection, 'part')!
    const frame = frameOf(part)!
    expect([frame.row, frame.column, frame.rows, frame.columns]).toEqual([2, 3, 3, 3])
    expect(beadsOfLayer(part, 'frame')).toEqual({ 0: { 0: RED }, 1: { 1: BLUE } })
    expect(frame.name).toBe('part')
  })

  it('takes a Piece only its own beads, not the others inside its rectangle', () => {
    const project = painted(canvas('loom'), [[2, 2, RED], [2, 3, RED], [3, 2, BLUE]])
    const selection: Selection = { top: 2, left: 2, rows: 2, columns: 2, layer: 'canvas', cells: [{ row: 2, column: 2 }, { row: 2, column: 3 }] }
    const part = selectionExportProject(project, selection, 'part')!
    expect(beadsOfLayer(part, 'frame')).toEqual({ 0: { 0: RED, 1: RED } })
  })

  it('cuts the Frame of a Selection on the Frame, never the Canvas under it', () => {
    const base = withFrame(painted(canvas('loom'), [[0, 0, BLUE]]), { row: 4, column: 4, rows: 6, columns: 6 })
    const project = withLayer(base, 'frame', { beads: withColors({}, [{ row: 1, column: 1, color: RED }, { row: 5, column: 5, color: RED }]) })
    const selection: Selection = { top: 5, left: 5, rows: 2, columns: 2, layer: 'frame' }
    const part = selectionExportProject(project, selection, 'part')!
    expect(beadsOfLayer(part, 'frame')).toEqual({ 0: { 0: RED } })
    expect(beadsOfLayer(part, 'canvas')).toEqual({})
  })

  it('snaps outward on peyote to a row the Weave starts on, the added row empty', () => {
    const project = painted(canvas('peyote'), [[5, 2, RED]])
    const part = selectionExportProject(project, { top: 5, left: 2, rows: 2, columns: 2, layer: 'canvas' }, 'part')!
    const frame = frameOf(part)!
    const weave = heldWeave(project, 'canvas')
    expect([frame.row, frame.column]).toEqual([snapRow(weave, 5), snapColumn(weave, 2)])
    expect(frame.row + frame.rows).toBe(7)
    expect(frame.column + frame.columns).toBe(4)
    expect(beadsOfLayer(part, 'frame')![5 - frame.row]?.[2 - frame.column]).toBe(RED)
  })

  it('is not offered on a Custom frame, and a Frame Selection outside the Frame has nothing to export', () => {
    const custom = withLayer(withFrame(canvas('loom'), { row: 2, column: 2, rows: 6, columns: 6 }), 'frame', { beads: {} })
    const shaped = { ...custom, layers: [custom.layers[0], { ...custom.layers[1]!, shape: 'triangle' }] } as unknown as Project
    expect(selectionExportable(shaped, { top: 3, left: 3, rows: 2, columns: 2, layer: 'frame' })).toBe(false)
    expect(selectionExportProject(custom, { top: 9, left: 9, rows: 2, columns: 2, layer: 'frame' }, 'part')).toBeUndefined()
  })

  it('snaps a Frame Selection on peyote through the Frame\'s own Weave', () => {
    const project = withLayer(withFrame(canvas('peyote', 16, 16), { row: 2, column: 2, rows: 10, columns: 10 }), 'frame', { beads: withColors({}, [{ row: 5, column: 5, color: RED }]) })
    const part = selectionExportProject(project, { top: 7, left: 7, rows: 3, columns: 3, layer: 'frame' }, 'part')!
    const frame = frameOf(part)!
    const weave = heldWeave(project, 'frame')!
    expect([frame.row - 2, frame.column - 2]).toEqual([snapRow(weave, 5), snapColumn(weave, 5)])
  })

  it('is offered on the Canvas', () => {
    expect(selectionExportable(canvas('loom'), { top: 0, left: 0, rows: 2, columns: 2, layer: 'canvas' })).toBe(true)
  })
})
