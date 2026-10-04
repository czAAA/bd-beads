// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadCount, beadsFromColors, forEachBead, withColors, type BeadMap } from './canvas'
import { createProject, type Project } from './project'
import { piecesOf } from './pieces'
import { rotateProject, rotatedFrame } from './rotate'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })

function withBeads(beads: BeadMap, extra: Partial<Project> = {}): Project {
  return { ...base, beads, frame: { row: 10, column: 10, rows: 2, columns: 3 }, ...extra }
}

/** A 2 x 3 Frame at (10, 10) holding:  A B C / D . F  */
const FRAME_BEADS = beadsFromColors(
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

describe('rotateProject', () => {
  it('turns the Frame and its beads a quarter clockwise about the Frame\'s centre', () => {
    const result = rotateProject(withBeads(FRAME_BEADS))!

    // 2 rows x 3 columns becomes 3 rows x 2 columns about the same middle.
    expect(result.project.frame).toEqual({ row: 10, column: 11, rows: 3, columns: 2 })
    expect(result.moved).toBe(0)
    // Clockwise: the old left column (A, D) is now the top row, read right to left... A D / B . / C F
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
    let project = withBeads(FRAME_BEADS)
    for (let turn = 0; turn < 4; turn += 1) {
      project = rotateProject(project)!.project
    }
    expect(project.frame).toEqual({ row: 10, column: 10, rows: 2, columns: 3 })
    expect(positionsOf(project.beads)).toEqual(positionsOf(FRAME_BEADS))
  })

  it('has nothing to turn without a Frame', () => {
    const { frame: _frame, ...open } = withBeads(FRAME_BEADS)
    expect(rotateProject(open as Project)).toBeUndefined()
  })

  it('leaves beads clear of the turned Frame where they are', () => {
    const far = withColors(FRAME_BEADS, [{ row: 30, column: 30, color: '#123456' }])
    const result = rotateProject(withBeads(far))!
    expect(result.moved).toBe(0)
    expect(result.project.beads[30]![30]).toBe('#123456')
  })

  it('moves a Piece the turned Frame would cover to clear space, whole, losing and overwriting nothing', () => {
    // The turned Frame is rows 10..12, columns 11..12: (12, 12) lies in it, outside the old Frame (rows 10..11, columns 10..12).
    const piece = withColors(FRAME_BEADS, [
      { row: 12, column: 12, color: '#00aa00' },
      { row: 13, column: 12, color: '#00bb00' },
    ])
    const before = withBeads(piece)
    const result = rotateProject(before)!

    expect(result.moved).toBe(1)
    expect(beadCount(result.project.beads)).toBe(beadCount(before.beads))

    const turned = result.project.frame!
    const pieces = piecesOf(result.project.beads, 'loom')
    // The Frame's own beads form one Piece, and the moved Piece is another that is wholly outside the Frame and its rulers.
    expect(pieces).toHaveLength(2)
    const moved = pieces.find((candidate) => candidate.beads === 2)!
    expect(moved.row + moved.rows <= turned.row - 3 || moved.row >= turned.row + turned.rows + 3 || moved.column + moved.columns <= turned.column - 3 || moved.column >= turned.column + turned.columns + 3).toBe(true)
    // The two beads keep their arrangement: one above the other.
    expect(moved.rows).toBe(2)
    expect(moved.columns).toBe(1)
  })

  it('moves a Piece by whole pairs of rows on peyote and brick, keeping its stagger', () => {
    for (const technique of ['peyote', 'brick'] as const) {
      const framed = withBeads(FRAME_BEADS, { technique, frame: { row: 10, column: 10, rows: 2, columns: 3 } })
      const piece = { ...framed, beads: withColors(FRAME_BEADS, [{ row: 12, column: 12, color: '#00aa00' }]) }
      const result = rotateProject(piece)!
      expect(result.moved).toBe(1)
      let movedRow: number | undefined
      forEachBead(result.project.beads, (row, _column, color) => {
        if (color === '#00aa00') movedRow = row
      })
      expect(Math.abs(movedRow! - 12) % 2).toBe(0)
      expect(result.project.frame!.row % 2).toBe(0)
    }
  })

  it('keeps the Project\'s other fields', () => {
    const result = rotateProject(withBeads(FRAME_BEADS, { name: 'Keep me' }))!
    expect(result.project.name).toBe('Keep me')
    expect(result.project.id).toBe(base.id)
  })
})

describe('rotatedFrame', () => {
  it('turns a square Frame in place', () => {
    expect(rotatedFrame(base, { row: 4, column: 7, rows: 5, columns: 5 })).toEqual({ row: 4, column: 7, rows: 5, columns: 5 })
  })
})
