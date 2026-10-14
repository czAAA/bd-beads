// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsFromColors, forEachBead, withColors, type BeadMap } from './canvas'
import { namedPieces, withPieceName } from './pieceNames'
import { createProject, type Project } from './project'
import { coveredByRotation, rotateSelection, rotatedSelection } from './rotate'
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
