import { describe, expect, it } from 'vitest'
import { colorAt, type Frame } from './canvas'
import { keepAllowedEdits } from './allowedEdits'
import { createProject, paintCells, withFrame } from './project'
import { paintAt } from '../testUtils/layers'

const frame: Frame = { row: 10, column: 10, rows: 4, columns: 6 }
const open = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const framed = withFrame(open, frame)
const none = { columns: 0, rows: 0 }

describe('what a drawing edit may leave', () => {
  it('keeps a stroke against the Frame\'s edge: there is no margin to keep clear', () => {
    const stroke = [{ row: 9, column: 10 }, { row: 12, column: 9 }, { row: 12, column: 16 }, { row: 14, column: 12 }]
    const painted = keepAllowedEdits(framed, paintCells(framed, stroke, '#ff0000', none))
    for (const { row, column } of stroke) expect(colorAt(painted.beads, row, column)).toBe('#ff0000')
  })

  it('does nothing with no Frame', () => {
    const painted = paintCells(open, [{ row: 1, column: 1 }], '#ff0000', none)
    expect(keepAllowedEdits(open, painted).beads).toEqual(painted.beads)
  })
})

describe('Right-angle weave has no bead at the end of a horizontal line (ticket 482)', () => {
  const woven = createProject({ technique: 'rightAngle', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 1, unit: 'beads' } })

  it('takes back a bead an edit put there', () => {
    const painted = paintAt(woven, [{ row: 0, column: 2 }, { row: 1, column: 2 }], '#ff0000')
    const kept = keepAllowedEdits(woven, painted)
    expect(colorAt(kept.frame!.beads, 0, 2)).toBeNull()
    expect(colorAt(kept.frame!.beads, 1, 2)).toBe('#ff0000')
  })
})

describe('Netting has no bead in a hole (ticket 485)', () => {
  const woven = createProject({ technique: 'netting', netSize: 3, beadId: 'toho-cube-1.5mm', size: { width: 2, height: 1, unit: 'beads' } })

  it('takes back a bead an edit put in a hole, on the Frame and on the Canvas', () => {
    const painted = paintAt(woven, [{ row: 0, column: 0 }, { row: 1, column: 1 }], '#ff0000')
    const kept = keepAllowedEdits(woven, painted)
    expect(colorAt(kept.frame!.beads, 0, 0)).toBeNull()
    expect(colorAt(kept.frame!.beads, 1, 1)).toBe('#ff0000')
  })
})
