import { describe, expect, it } from 'vitest'
import { colorAt, withColors, type Frame } from './canvas'
import { clampOutOfMargin, inMargin, keepAllowedEdits, MARGIN, mayPlace, selectionAllowed, trimToAllowed, withMargin } from './margin'
import { createProject, paintCells, withFrame, type Project } from './project'
import { paintAt } from '../testUtils/layers'

const frame: Frame = { row: 10, column: 10, rows: 4, columns: 6 }
const open = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const framed = withFrame(open, frame)
const none = { columns: 0, rows: 0 }

describe('the keep-out margin', () => {
  it('is the 6 positions all round the Frame, outside its line', () => {
    expect(MARGIN).toBe(6)
    expect(inMargin(frame, { row: 4, column: 10 })).toBe(true)
    expect(inMargin(frame, { row: 3, column: 10 })).toBe(false)
    expect(inMargin(frame, { row: 14 + 2, column: 16 + 2 })).toBe(true)
    expect(inMargin(frame, { row: 11, column: 11 })).toBe(false)
    expect(inMargin(undefined, { row: 7, column: 10 })).toBe(false)
    expect(withMargin(frame)).toEqual({ row: 4, column: 4, rows: 16, columns: 18 })
  })

  it('stops Paint writing into it, and a stroke across it paints only the allowed beads', () => {
    const positions = [3, 4, 5, 6, 7, 8].map((column) => ({ row: 8, column }))
    const stroke = [{ row: 12, column: 3 }, { row: 12, column: 4 }, { row: 12, column: 9 }, { row: 12, column: 10 }, ...positions]
    const painted = keepAllowedEdits(framed, paintCells(framed, stroke, '#ff0000', none))
    expect(colorAt(painted.beads, 12, 10)).toBe('#ff0000')
    expect(colorAt(painted.beads, 12, 3)).toBe('#ff0000')
    expect(colorAt(painted.beads, 12, 4)).toBeNull()
    expect(colorAt(painted.beads, 12, 9)).toBeNull()
    expect(colorAt(painted.beads, 8, 3)).toBe('#ff0000')
    expect(colorAt(painted.beads, 8, 4)).toBeNull()
  })

  it('hands back the same Project when everything an edit did was in the margin', () => {
    const painted = paintCells(framed, [{ row: 8, column: 10 }], '#ff0000', none)
    expect(keepAllowedEdits(framed, painted)).toBe(framed)
  })

  it('still lets Erase remove a bead in the margin', () => {
    const legacy: Project = { ...framed, beads: withColors(framed.beads, [{ row: 8, column: 10, color: '#ff0000' }]) }
    const erased = keepAllowedEdits(legacy, paintCells(legacy, [{ row: 8, column: 10 }], null, none))
    expect(colorAt(erased.beads, 8, 10)).toBeNull()
  })

  it('does nothing with no Frame', () => {
    const painted = paintCells(open, [{ row: 1, column: 1 }], '#ff0000', none)
    expect(keepAllowedEdits(open, painted).beads).toEqual(painted.beads)
  })
})

describe('clampOutOfMargin (ticket 428)', () => {
  it('leaves a cell outside the margin, and any cell without a Frame, alone', () => {
    expect(clampOutOfMargin(frame, { row: 11, column: 11 }, { row: 12, column: 12 })).toEqual({ row: 12, column: 12 })
    expect(clampOutOfMargin(undefined, { row: 0, column: 0 }, { row: 7, column: 10 })).toEqual({ row: 7, column: 10 })
  })

  it('pulls a drag begun inside the Frame back to the Frame\'s own edge', () => {
    expect(clampOutOfMargin(frame, { row: 11, column: 11 }, { row: 8, column: 12 })).toEqual({ row: 10, column: 12 })
    expect(clampOutOfMargin(frame, { row: 11, column: 11 }, { row: 16, column: 18 })).toEqual({ row: 13, column: 15 })
  })

  it('holds a drag begun inside the Frame to the Frame, even past the margin', () => {
    expect(clampOutOfMargin(frame, { row: 11, column: 11 }, { row: 40, column: 2 })).toEqual({ row: 13, column: 10 })
  })

  it('pulls a drag begun outside the margin back to the margin\'s outer edge', () => {
    expect(clampOutOfMargin(frame, { row: 2, column: 2 }, { row: 8, column: 8 })).toEqual({ row: 3, column: 8 })
    expect(clampOutOfMargin(frame, { row: 30, column: 30 }, { row: 15, column: 17 })).toEqual({ row: 20, column: 17 })
  })
})

describe('a Selection never covers the margin (ticket 428)', () => {
  it('allows a Selection wholly inside the Frame or wholly clear of the band, and nothing else (ticket 433)', () => {
    expect(selectionAllowed(frame, { top: 10, left: 10, rows: 4, columns: 6 })).toBe(true)
    expect(selectionAllowed(frame, { top: 11, left: 11, rows: 1, columns: 1 })).toBe(true)
    expect(selectionAllowed(frame, { top: 0, left: 0, rows: 3, columns: 3 })).toBe(true)
    expect(selectionAllowed(frame, { top: 0, left: 0, rows: 4, columns: 4 })).toBe(true)
    expect(selectionAllowed(frame, { top: 5, left: 11, rows: 6, columns: 2 })).toBe(false)
    expect(selectionAllowed(frame, { top: 0, left: 0, rows: 5, columns: 5 })).toBe(false)
    expect(selectionAllowed(frame, { top: 8, left: 8, rows: 1, columns: 1 })).toBe(false)
    expect(selectionAllowed(frame, { top: 0, left: 0, rows: 40, columns: 40 })).toBe(true)
    expect(selectionAllowed(frame, { top: 4, left: 4, rows: 16, columns: 18 })).toBe(true)
    expect(selectionAllowed(frame, { top: 5, left: 4, rows: 16, columns: 18 })).toBe(false)
    expect(selectionAllowed(frame, { top: 0, left: 0, rows: 40, columns: 15 })).toBe(false)
    expect(selectionAllowed(undefined, { top: 8, left: 8, rows: 1, columns: 1 })).toBe(true)
  })

  it('trims a rectangle to the side of the anchor, and refuses an anchor in the margin', () => {
    const wide = { top: 0, left: 10, rows: 30, columns: 3 }
    expect(trimToAllowed(frame, wide, { row: 1, column: 11 })).toEqual({ top: 0, left: 10, rows: 4, columns: 3 })
    expect(trimToAllowed(frame, wide, { row: 20, column: 11 })).toEqual({ top: 20, left: 10, rows: 10, columns: 3 })
    expect(trimToAllowed(frame, { top: 11, left: 11, rows: 2, columns: 2 }, { row: 11, column: 11 })).toEqual({ top: 11, left: 11, rows: 2, columns: 2 })
    expect(trimToAllowed(frame, wide, { row: 8, column: 11 })).toBeUndefined()
  })

  it('refuses a drag that begins in the margin by returning the anchor', () => {
    expect(clampOutOfMargin(frame, { row: 8, column: 11 }, { row: 12, column: 12 })).toEqual({ row: 8, column: 11 })
  })

  it('stops a drag from outside before the margin instead of crossing the Frame', () => {
    // from above the margin to the far side of the Frame: held at the margin's outer edge above it
    expect(clampOutOfMargin(frame, { row: 2, column: 12 }, { row: 20, column: 12 })).toEqual({ row: 3, column: 12 })
    // from a corner across the whole Frame: the clamp keeps the larger rectangle
    const end = clampOutOfMargin(frame, { row: 2, column: 2 }, { row: 30, column: 30 })
    expect(selectionAllowed(frame, { top: 2, left: 2, rows: end.row - 1, columns: end.column - 1 })).toBe(true)
  })

  it('lets a drag from outside go all the way across the Frame and its margin to take it in whole', () => {
    expect(clampOutOfMargin(frame, { row: 2, column: 2 }, { row: 30, column: 30 })).toEqual({ row: 30, column: 30 })
    expect(clampOutOfMargin(frame, { row: 30, column: 30 }, { row: 2, column: 2 })).toEqual({ row: 2, column: 2 })
    // across in one direction only still cuts through the margin, so it is held back
    expect(clampOutOfMargin(frame, { row: 2, column: 12 }, { row: 30, column: 12 })).toEqual({ row: 3, column: 12 })
  })
})

describe('Right-angle weave has no bead at the end of a horizontal line (ticket 482)', () => {
  const woven = createProject({ technique: 'rightAngle', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 1, unit: 'beads' } })

  it('refuses to place one there and leaves the vertical beads', () => {
    expect(mayPlace(woven, { row: 0, column: 2 })).toBe(false)
    expect(mayPlace(woven, { row: 0, column: 1 })).toBe(true)
    expect(mayPlace(woven, { row: 1, column: 2 })).toBe(true)
  })

  it('takes back a bead an edit put there', () => {
    const painted = paintAt(woven, [{ row: 0, column: 2 }, { row: 1, column: 2 }], '#ff0000')
    const kept = keepAllowedEdits(woven, painted)
    expect(colorAt(kept.frame!.beads, 0, 2)).toBeNull()
    expect(colorAt(kept.frame!.beads, 1, 2)).toBe('#ff0000')
  })
})

describe('Netting has no bead in a hole (ticket 485)', () => {
  const woven = createProject({ technique: 'netting', netSize: 3, beadId: 'toho-cube-1.5mm', size: { width: 2, height: 1, unit: 'beads' } })

  it('refuses to place one there and leaves the beads of the mesh', () => {
    expect(mayPlace(woven, { row: 1, column: 1 })).toBe(true)
    expect(mayPlace(woven, { row: 0, column: 0 })).toBe(false)
    expect(mayPlace(woven, { row: 2, column: 2 })).toBe(false)
  })

  it('takes back a bead an edit put in a hole, on the Frame and on the Canvas', () => {
    const painted = paintAt(woven, [{ row: 0, column: 0 }, { row: 1, column: 1 }], '#ff0000')
    const kept = keepAllowedEdits(woven, painted)
    expect(colorAt(kept.frame!.beads, 0, 0)).toBeNull()
    expect(colorAt(kept.frame!.beads, 1, 1)).toBe('#ff0000')
  })
})
