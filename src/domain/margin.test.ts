import { describe, expect, it } from 'vitest'
import { colorAt, withColors, type Rect } from './canvas'
import { keepAllowedEdits } from './allowedEdits'
import { inMargin, MARGIN, mayPlace, selectionAllowed, trimToAllowed, withMargin } from './margin'
import { createProject } from './createProject'
import { withFrame } from './frame'
import type { GridPosition } from './grid'
import type { Project } from './project'

const frame: Rect = { row: 10, column: 10, rows: 4, columns: 6 }
const open = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const framed = withFrame(open, frame)

/** The Project with its Canvas beads painted as a drawing command would hand them over, before what may stay is kept. */
const rawPaint = (project: Project, positions: GridPosition[], color: string | null): Project => ({
  ...project,
  beads: withColors(project.beads, positions.map((position) => ({ ...position, color }))),
})

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
    const painted = keepAllowedEdits(framed, rawPaint(framed, stroke, '#ff0000'))
    expect(colorAt(painted.beads, 12, 10)).toBe('#ff0000')
    expect(colorAt(painted.beads, 12, 3)).toBe('#ff0000')
    expect(colorAt(painted.beads, 12, 4)).toBeNull()
    expect(colorAt(painted.beads, 12, 9)).toBeNull()
    expect(colorAt(painted.beads, 8, 3)).toBe('#ff0000')
    expect(colorAt(painted.beads, 8, 4)).toBeNull()
  })

  it('hands back the same Project when everything an edit did was in the margin', () => {
    const painted = rawPaint(framed, [{ row: 8, column: 10 }], '#ff0000')
    expect(keepAllowedEdits(framed, painted)).toBe(framed)
  })

  it('still lets Erase remove a bead in the margin', () => {
    const legacy: Project = { ...framed, beads: withColors(framed.beads, [{ row: 8, column: 10, color: '#ff0000' }]) }
    const erased = keepAllowedEdits(legacy, rawPaint(legacy, [{ row: 8, column: 10 }], null))
    expect(colorAt(erased.beads, 8, 10)).toBeNull()
  })

  it('does nothing with no Frame', () => {
    const painted = rawPaint(open, [{ row: 1, column: 1 }], '#ff0000')
    expect(keepAllowedEdits(open, painted).beads).toEqual(painted.beads)
  })
})

describe('a Piece tap keeps out of the margin (tickets 428, 433)', () => {
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
})

describe('mayPlace (ticket 501)', () => {
  it('refuses a position in the margin and allows the Frame, the Canvas beyond and erasing nowhere special', () => {
    const framed = withFrame(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' }), { row: 10, column: 10, rows: 4, columns: 6 })
    expect(mayPlace(framed, { row: 9, column: 10 })).toBe(false)
    expect(mayPlace(framed, { row: 10, column: 10 })).toBe(true)
    expect(mayPlace(framed, { row: 10 - MARGIN - 1, column: 10 })).toBe(true)
  })
})

describe('the margin of a Frame that draws shorter than the rows it names (ADR 0066)', () => {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
  const peyote = withFrame(base, { row: 0, column: 0, rows: 48, columns: 11 })
  const woven = { ...peyote, frame: { ...peyote.frame!, technique: 'peyote' as const } }

  it('hangs off what the Frame draws, so it is joined to it', () => {
    // The Frame covers 36 loom rows: the 6 below are the margin, the rows after those are free Canvas.
    expect(mayPlace(woven, { row: 36, column: 3 })).toBe(false)
    expect(mayPlace(woven, { row: 41, column: 3 })).toBe(false)
    expect(mayPlace(woven, { row: 42, column: 3 })).toBe(true)
  })

  it('never calls a Frame bead margin, whatever its position says', () => {
    expect(mayPlace(woven, { row: 40, column: 3, layer: 'frame' })).toBe(true)
  })
})
