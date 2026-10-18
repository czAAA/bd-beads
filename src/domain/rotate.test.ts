// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsFromColors, forEachBead, withColors, type BeadMap } from './canvas'
import { namedPieces, withPieceName } from './pieceNames'
import { createProject, type Project } from './project'
import { coveredByRotation, rotateFrame, rotateLayerSelection, rotateSelection, rotatedSelection } from './rotate'
import type { Selection } from './selection'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })

function withBeads(beads: BeadMap, extra: Partial<Project> = {}): Project {
  return { ...base, beads, frame: { row: 0, column: 0, rows: 40, columns: 40, beads: {} }, ...extra }
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

  it('snaps the turned top row to a multiple of 2N on brick stitch (ticket 477)', () => {
    const turned = rotatedSelection({ technique: 'brick', brickBlock: 3 }, { top: 10, left: 10, rows: 2, columns: 5 })
    expect(turned.top % 6).toBe(0)
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

describe('rotateLayerSelection (ADR 0066)', () => {
  const frame = { row: 10, column: 10, rows: 3, columns: 3 }
  const inFrame = (beads: BeadMap, extra: Partial<Project> = {}): Project => ({ ...base, beads: {}, frame: { ...frame, beads }, ...extra })

  it('turns the Canvas\'s beads for a Selection on the Canvas, in Canvas positions', () => {
    const project = withBeads(SELECTION_BEADS, { frame: undefined })
    const result = rotateLayerSelection(project, SELECTION)
    expect(result.selection).toEqual({ top: 10, left: 11, rows: 3, columns: 2 })
    expect(positionsOf(result.project.beads)).toEqual(positionsOf(rotateSelection(project, SELECTION).project.beads))
  })

  it('turns the Frame\'s own beads for a Selection that begins in the Frame, and answers in Canvas positions', () => {
    const project = inFrame(beadsFromColors([['#aa0000', '#bb0000', null], [null, null, null]]), { beads: withColors({}, [{ row: 11, column: 11, color: '#999999' }]) })
    const result = rotateLayerSelection(project, { top: 10, left: 10, rows: 2, columns: 2 })
    expect(result.selection).toEqual({ top: 10, left: 10, rows: 2, columns: 2 })
    expect(positionsOf(result.project.frame!.beads)).toEqual(['0,1:#aa0000', '1,1:#bb0000'])
    expect(result.project.beads).toEqual(project.beads)
  })

  it('drops what the turn would put outside the Frame', () => {
    const project = inFrame(beadsFromColors([['#aa0000', '#bb0000', '#cc0000']]))
    // A 1 x 3 row turned upright would stand 3 rows tall from row -1 to 1 about the Selection\'s middle, partly above the Frame.
    const result = rotateLayerSelection(project, { top: 10, left: 10, rows: 1, columns: 3 })
    expect(positionsOf(result.project.frame!.beads).every((entry) => Number(entry.split(',')[0]) >= 0)).toBe(true)
    expect(positionsOf(result.project.frame!.beads)).toHaveLength(2)
  })

  it('counts the layer\'s beads outside the Selection that the turn replaced', () => {
    const project = inFrame(beadsFromColors([['#aa0000', '#bb0000', null], ['#dd0000', '#ee0000', null], [null, '#123456', null]]))
    expect(rotateLayerSelection(project, { top: 10, left: 10, rows: 1, columns: 2 }).covered).toBe(1)
  })
})

describe('rotateFrame (ticket 471, ADR 0066)', () => {
  const frame = { row: 20, column: 20, rows: 4, columns: 6 }
  const framed = (beads: BeadMap, extra: Partial<Project> = {}): Project => ({ ...base, beads: {}, frame: { ...frame, beads }, ...extra })

  it('turns the Frame about its centre, swapping Width and Height, and its own beads with it', () => {
    const project = framed(withColors({}, [{ row: 0, column: 0, color: '#aa0000' }, { row: 3, column: 5, color: '#bb0000' }]))
    const turned = rotateFrame(project)!

    // The 4 x 6 Frame at (20, 20) turns to 6 x 4 at (19, 21); its first bead goes to the top right, its last to the bottom left.
    expect(turned.frame).toMatchObject({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(positionsOf(turned.frame!.beads)).toEqual(['0,3:#aa0000', '5,0:#bb0000'])
  })

  it('comes back after four turns', () => {
    const project = framed(withColors({}, [{ row: 1, column: 2, color: '#aa0000' }]))
    let turned = project
    for (let i = 0; i < 4; i++) turned = rotateFrame(turned)!
    expect(turned.frame).toEqual(project.frame)
  })

  it('leaves the Canvas where it is, and keeps the Frame\'s name', () => {
    const canvas = withColors({}, [{ row: 21, column: 22, color: '#999999' }])
    const project = framed(withColors({}, [{ row: 1, column: 2, color: '#aa0000' }]), { beads: canvas })
    const named = { ...project, frame: { ...project.frame!, name: 'Leaf' } }
    const turned = rotateFrame(named)!
    expect(turned.beads).toBe(canvas)
    expect(turned.frame!.name).toBe('Leaf')
  })

  it('starts the turned Frame on an even row on peyote', () => {
    // A 5 x 4 Frame at (20, 20): its turned top row falls on an odd row, so it snaps to the even row above.
    const peyote = { ...framed(withColors({}, [{ row: 0, column: 0, color: '#aa0000' }])), technique: 'peyote' as const, frame: { row: 20, column: 20, rows: 5, columns: 4, beads: withColors({}, [{ row: 0, column: 0, color: '#aa0000' }]) } }
    const turned = rotateFrame(peyote)!
    expect(turned.frame!.row % 2).toBe(0)
    expect(turned.frame).toMatchObject({ rows: 4, columns: 5 })
    expect(positionsOf(turned.frame!.beads)).toHaveLength(1)
  })

  it('starts the turned Frame on a multiple of 2N rows on brick stitch with a Brick block of N (ticket 477)', () => {
    for (const brickBlock of [2, 3, 5]) {
      const brick = { ...base, technique: 'brick' as const, brickBlock, beads: {}, frame: { row: 30, column: 20, rows: 7, columns: 4, beads: withColors({}, [{ row: 0, column: 0, color: '#aa0000' }]) } }
      const turned = rotateFrame(brick)!
      expect(turned.frame!.row % (2 * brickBlock)).toBe(0)
      expect(turned.frame).toMatchObject({ rows: 4, columns: 7 })
      expect(positionsOf(turned.frame!.beads)).toHaveLength(1)
    }
  })

  it('does nothing without a Frame', () => {
    expect(rotateFrame({ ...base, beads: {}, frame: undefined })).toBeUndefined()
  })
})
