import { describe, expect, it } from 'vitest'
import { colorAt, withColors, type BeadMap, type Frame } from './canvas'
import { clearMargin, inMargin, keepAllowedEdits, MARGIN, withMargin } from './margin'
import { createProject, paintCells, withFrame, type Project } from './project'
import { rotateProject } from './rotate'

const frame: Frame = { row: 10, column: 10, rows: 4, columns: 6 }
const open = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const framed = withFrame(open, frame)
const none = { columns: 0, rows: 0 }

function count(beads: BeadMap): number {
  return Object.values(beads).reduce((sum, row) => sum + Object.keys(row).length, 0)
}

describe('the keep-out margin', () => {
  it('is the 3 positions all round the Frame, outside its line', () => {
    expect(MARGIN).toBe(3)
    expect(inMargin(frame, { row: 7, column: 10 })).toBe(true)
    expect(inMargin(frame, { row: 6, column: 10 })).toBe(false)
    expect(inMargin(frame, { row: 14 + 2, column: 16 + 2 })).toBe(true)
    expect(inMargin(frame, { row: 11, column: 11 })).toBe(false)
    expect(inMargin(undefined, { row: 7, column: 10 })).toBe(false)
    expect(withMargin(frame)).toEqual({ row: 7, column: 7, rows: 10, columns: 12 })
  })

  it('stops Paint writing into it, and a stroke across it paints only the allowed beads', () => {
    const positions = [6, 7, 8, 9, 10, 11].map((column) => ({ row: 8, column }))
    const stroke = [{ row: 12, column: 6 }, { row: 12, column: 7 }, { row: 12, column: 9 }, { row: 12, column: 10 }, ...positions]
    const painted = keepAllowedEdits(framed, paintCells(framed, stroke, '#ff0000', none))
    expect(colorAt(painted.beads, 12, 10)).toBe('#ff0000')
    expect(colorAt(painted.beads, 12, 6)).toBe('#ff0000')
    expect(colorAt(painted.beads, 12, 7)).toBeNull()
    expect(colorAt(painted.beads, 12, 9)).toBeNull()
    expect(colorAt(painted.beads, 8, 6)).toBe('#ff0000')
    expect(colorAt(painted.beads, 8, 7)).toBeNull()
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

  it('moves a Piece in the margin clear whole, losing no bead', () => {
    const beads = withColors(framed.beads, [
      { row: 12, column: 11, color: '#00ff00' },
      { row: 8, column: 10, color: '#ff0000' },
      { row: 8, column: 11, color: '#ff0000' },
    ])
    const { project, moved } = clearMargin({ ...framed, beads })
    expect(moved).toBe(1)
    expect(count(project.beads)).toBe(3)
    expect(colorAt(project.beads, 12, 11)).toBe('#00ff00')
    for (let row = 0; row < 30; row += 1) {
      for (let column = 0; column < 30; column += 1) {
        expect(inMargin(frame, { row, column }) && colorAt(project.beads, row, column) !== null).toBe(false)
      }
    }
  })

  it('leaves the same Project when nothing is in the margin', () => {
    expect(clearMargin(framed)).toEqual({ project: framed, moved: 0 })
  })

  it('keeps it clear on Rotate: a Piece right against the turned Frame moves, none is lost', () => {
    const square = withFrame(open, { row: 0, column: 0, rows: 4, columns: 4 })
    const beads = withColors(square.beads, [{ row: 0, column: 0, color: '#00ff00' }, { row: 5, column: 1, color: '#ff0000' }])
    const rotated = rotateProject({ ...square, beads })!
    expect(count(rotated.project.beads)).toBe(2)
    expect(rotated.moved).toBe(1)
    expect(clearMargin(rotated.project).moved).toBe(0)
  })
})
