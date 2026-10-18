// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsFromColors, forEachBead, withColors, type BeadMap } from './canvas'
import { namedPieces, withPieceName } from './pieceNames'
import { createProject, type Project } from './project'
import { coveredByRotation, rotateFrame, rotateSelection, rotatedSelection } from './rotate'
import type { Selection } from './selection'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })

function withBeads(beads: BeadMap, extra: Partial<Project> = {}): Project {
  return { ...base, beads, frame: { row: 0, column: 0, rows: 40, columns: 40 }, ...extra }
}

/** A 2 x 3 Selection at (10, 10) holding:  A B C / D . F  */
const SELECTION: Selection = { top: 10, left: 10, rows: 2, columns: 3 }
const SELECTION_BEADS = beadsFromColors(
  [
    ['#aa0000', '#bb0000', '#cc0000'],
    ['#dd0000', null, '#ff0000'],
  ],
  { row: 10, column: 10 },
)

function positionsOf(beads: BeadMap): string[] {
  const found: string[] = []
  forEachBead(beads, (row, column, color) => found.push(`${row},${column}:${color}`))
  return found.sort()
}

describe('rotateSelection', () => {
  it('turns the Selection\'s beads a quarter clockwise about its centre and leaves the Frame alone', () => {
    const project = withBeads(SELECTION_BEADS)
    const result = rotateSelection(project, SELECTION)

    // 2 rows x 3 columns becomes 3 rows x 2 columns about the same middle.
    expect(result.selection).toEqual({ top: 10, left: 11, rows: 3, columns: 2 })
    expect(result.project.frame).toEqual(project.frame)
    expect(result.project.rowProgress).toEqual(project.rowProgress)
    // Clockwise: the old left column (A, D) is now the top row, read right to left... D A / . B / F C
    expect(positionsOf(result.project.beads)).toEqual(
      positionsOf(
        beadsFromColors(
          [
            ['#dd0000', '#aa0000'],
            [null, '#bb0000'],
            ['#ff0000', '#cc0000'],
          ],
          { row: 10, column: 11 },
        ),
      ),
    )
  })

  it('four turns bring everything home', () => {
    let project = withBeads(SELECTION_BEADS)
    let selection = SELECTION
    for (let turn = 0; turn < 4; turn += 1) {
      const turned = rotateSelection(project, selection)
      project = turned.project
      selection = turned.selection
    }
    expect(selection).toEqual(SELECTION)
    expect(positionsOf(project.beads)).toEqual(positionsOf(SELECTION_BEADS))
  })

  it('replaces the beads under the turned footprint', () => {
    // The turned 3 x 2 reaches row 12, below the 2 x 3 Selection, and column 11 of it is bead F.
    const beads = withColors(SELECTION_BEADS, [{ row: 12, column: 11, color: '#123456' }])
    const result = rotateSelection(withBeads(beads), SELECTION)
    expect(positionsOf(result.project.beads)).not.toContain('12,11:#123456')
    expect(positionsOf(result.project.beads)).toContain('12,11:#ff0000')
  })

  it('leaves beads outside both rectangles where they are', () => {
    const beads = withColors(SELECTION_BEADS, [{ row: 30, column: 30, color: '#123456' }])
    expect(positionsOf(rotateSelection(withBeads(beads), SELECTION).project.beads)).toContain('30,30:#123456')
  })

  it('snaps the turned top row to an even row on peyote', () => {
    const turned = rotatedSelection({ technique: 'peyote' }, { top: 10, left: 10, rows: 2, columns: 5 })
    expect(turned.top % 2).toBe(0)
    expect(turned).toMatchObject({ rows: 5, columns: 2 })
  })

  it('carries a Piece\'s name with its beads', () => {
    const named = withPieceName(withBeads(SELECTION_BEADS), { row: 10, column: 10 }, 'Fox')
    const result = rotateSelection(named, SELECTION)
    expect(namedPieces(result.project)).toHaveLength(1)
    expect(namedPieces(result.project)[0]).toMatchObject({ name: 'Fox' })
  })
})

describe('coveredByRotation', () => {
  it('counts the beads outside the Selection that the turn replaced', () => {
    const beads = withColors(SELECTION_BEADS, [
      { row: 12, column: 11, color: '#123456' },
      { row: 30, column: 30, color: '#123456' },
    ])
    const project = withBeads(beads)
    const { project: after, selection } = rotateSelection(project, SELECTION)
    expect(coveredByRotation(project, after, SELECTION, selection)).toBe(1)
  })

  it('counts nothing a trimmed turn left in place', () => {
    const beads = withColors(SELECTION_BEADS, [{ row: 12, column: 11, color: '#123456' }])
    const project = withBeads(beads)
    const { selection } = rotateSelection(project, SELECTION)
    expect(coveredByRotation(project, project, SELECTION, selection)).toBe(0)
  })
})

describe('rotateFrame (ticket 471)', () => {
  const frame = { row: 20, column: 20, rows: 4, columns: 6 }
  const framed = (beads: BeadMap, extra: Partial<Project> = {}): Project => withBeads(beads, { frame, ...extra })

  it('turns the Frame with its margin about their centre, swapping Width and Height, and the beads inside with it', () => {
    const project = framed(withColors({}, [{ row: 20, column: 20, color: '#aa0000' }, { row: 23, column: 25, color: '#bb0000' }]))
    const turned = rotateFrame(project)!

    // The 16 x 18 area at (14, 14) turns to 18 x 16 at (13, 15): the Frame is 6 rows by 4 columns at (19, 21).
    expect(turned.project.frame).toEqual({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(positionsOf(turned.project.beads)).toEqual(['19,24:#aa0000', '24,21:#bb0000'])
    expect(turned.area).toEqual({ top: 13, left: 15, rows: 18, columns: 16 })
  })

  it('comes back after four turns', () => {
    const project = framed(withColors({}, [{ row: 21, column: 22, color: '#aa0000' }]))
    let turned = project
    for (let i = 0; i < 4; i++) turned = rotateFrame(turned)!.project
    expect(turned.frame).toEqual(project.frame)
    expect(turned.beads).toEqual(project.beads)
  })

  it('turns the beads in the margin with the Frame, and leaves a Piece outside the area where it is', () => {
    const project = framed(withColors({}, [{ row: 16, column: 22, color: '#aa0000' }, { row: 2, column: 2, color: '#bb0000' }]))
    const turned = rotateFrame(project)!
    expect(positionsOf(turned.project.beads)).toEqual(['2,2:#bb0000', '21,28:#aa0000'])
  })

  it('carries a Piece name with its beads', () => {
    const named = withPieceName(framed(withColors({}, [{ row: 21, column: 22, color: '#aa0000' }])), { row: 21, column: 22 }, 'Leaf')
    const turned = rotateFrame(named)!
    expect(namedPieces(turned.project).map((piece) => piece.name)).toEqual(['Leaf'])
  })

  it('does nothing without a Frame', () => {
    expect(rotateFrame({ ...base, beads: {}, frame: undefined })).toBeUndefined()
  })
})
