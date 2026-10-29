import { describe, expect, it } from 'vitest'
import { withColors, type BeadChange } from './canvas'
import { keepAllowedEdits } from './allowedEdits'
import { createProject } from './createProject'
import { MARGIN } from './margin'
import type { Project } from './project'
import { countingBeads } from '../testUtils/countingBeads'
import { paintAt } from '../testUtils/layers'

const open = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const R = '#e63746'

/** A block of beads, `rows` by `columns`, from `row`, `column`. */
function block(row: number, column: number, rows: number, columns: number): BeadChange[] {
  return Array.from({ length: rows * columns }, (_, i) => ({ row: row + Math.floor(i / columns), column: column + (i % columns), color: R }))
}

/** One stroke step: the bead painted at `position` and kept or refused by the rules, as Edit does it. */
const step = (project: Project, row: number, column: number, color: string | null = R) => keepAllowedEdits(project, paintAt(project, [{ row, column }], color))

describe('what a drawing edit may leave', () => {
  it('does nothing with no Frame', () => {
    const painted = { ...open, beads: withColors(open.beads, [{ row: 1, column: 1, color: '#ff0000' }]) }
    expect(keepAllowedEdits(open, painted).beads).toEqual(painted.beads)
  })
})

// Ticket 0674: the work an edit does grows with what it changed, not with the Canvas, so a stroke keeps up however big
// the drawing is. Counted, not timed.
describe('the work a stroke step does', () => {
  /** A Canvas holding one named 300 × 300 Piece, its beads behind a counter, and `others` named Pieces beside it. */
  function namedSquare(others: number) {
    const others3x3 = Array.from({ length: others }, (_, i) => block(0, 400 + i * 10, 3, 3)).flat()
    const counting = countingBeads(withColors({}, [...block(0, 0, 300, 300), ...others3x3]))
    const pieceNames = [{ name: 'Square', row: 0, column: 0 }, ...Array.from({ length: others }, (_, i) => ({ name: `Dot ${i}`, row: 0, column: 400 + i * 10 }))]
    return { project: { ...open, beads: counting.beads, pieceNames }, ...counting }
  }

  it('next to a named 300 × 300 Piece reads only the rows it changed, and keeps the name where it is', () => {
    const { project, reads } = namedSquare(0)

    // Growing the Piece, recoloring it, and painting near it.
    let painted = step(project, 10, 300)
    painted = step(painted, 11, 150, '#00ff00')
    painted = step(painted, 12, 303)

    // Row 0 holds the name's own bead, looked up once a step.
    expect([...reads.rows].sort((a, b) => a - b)).toEqual([0, 10, 11, 12])
    expect(reads.beads).toBeLessThan(3 * 300 * 8)
    expect(painted.pieceNames).toEqual(project.pieceNames)
  })

  it('next to a named 300 × 300 Piece with other named Pieces about reads only the rows it changed once it has begun', () => {
    const { project, reads, reset } = namedSquare(3)
    // The first step of a stroke may look at every Piece once; the steps after it are handed what it found.
    let painted = step(project, 10, 300)
    reset()

    for (const row of [20, 21, 22]) painted = step(painted, row, 300)
    // Erasing a bead of the Piece's edge splits nothing.
    painted = step(painted, 23, 299, null)

    // Row 0 holds the names' own beads; the rest touch the beads the steps changed.
    expect([...reads.rows].sort((a, b) => a - b)).toEqual([0, 19, 20, 21, 22, 23, 24])
    expect(reads.beads).toBeLessThan(6 * 300 * 8)
    expect(painted.pieceNames).toEqual(project.pieceNames)
  })

  it('still refuses the bead that would join two named Pieces through an unnamed one, step by step', () => {
    const beads = withColors({}, [...block(0, 0, 3, 3), ...block(0, 5, 3, 3), ...block(0, 10, 3, 3)])
    let project: Project = { ...open, beads, pieceNames: [{ name: 'Left', row: 0, column: 0 }, { name: 'Right', row: 0, column: 10 }] }

    for (const column of [3, 4, 8, 9]) project = step(project, 1, column)

    // Left takes in the middle Piece; the bead at column 9 would then join Right to it, and it alone is refused.
    expect(project.beads[1]).toMatchObject({ 3: R, 4: R, 8: R })
    expect(project.beads[1]?.[9]).toBeUndefined()
    expect(project.pieceNames).toHaveLength(2)
  })

  /** A 300 × 300 Frame full of beads and a Canvas of 100 × 100 beads clear of its margin, each behind a counter. */
  function bigFramed() {
    const created = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 300, height: 300, unit: 'beads' } })
    const frame = created.frame!
    const inFrame = countingBeads(withColors({}, block(0, 0, 300, 300)))
    const onCanvas = countingBeads(withColors({}, block(frame.row, frame.column + 300 + MARGIN + 10, 100, 100)))
    const project: Project = { ...created, beads: onCanvas.beads, frame: { ...frame, beads: inFrame.beads } }
    return { project, frame, inFrame: inFrame.reads, onCanvas: onCanvas.reads }
  }

  it('in the Frame reads only the Frame rows it changed, and no Canvas row', () => {
    const { project, frame, inFrame, onCanvas } = bigFramed()

    const painted = step(project, frame.row + 5, frame.column + 7, '#00ff00')

    expect(painted.frame!.beads[5]?.[7]).toBe('#00ff00')
    expect([...inFrame.rows]).toEqual([5])
    expect(onCanvas.rows.size).toBe(0)
  })

  it('on the Canvas by the margin reads only the Canvas rows it changed, and no Frame row', () => {
    const { project, frame, inFrame, onCanvas } = bigFramed()
    const right = frame.column + frame.columns + MARGIN

    const painted = step(project, frame.row + 5, right)
    // In the margin the bead is refused, and still only its own row is read.
    const refused = step(painted, frame.row + 6, right - 1)

    expect(painted.beads[frame.row + 5]?.[right]).toBe(R)
    expect(refused).toBe(painted)
    expect([...onCanvas.rows].sort((a, b) => a - b)).toEqual([frame.row + 5, frame.row + 6])
    expect(inFrame.rows.size).toBe(0)
  })
})
