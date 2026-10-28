// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsFromColors, forEachBead, withColors, type BeadMap } from './canvas'
import { namedPieces, withPieceName } from './pieceNames'
import { createProject } from './createProject'
import { isInFinishedRow } from './rowProgress'
import type { Project } from './project'
import { coveredByRotation, rotateFrame, rotateLayerSelection, rotateSelection, rotatedSelection } from './rotate'
import type { Selection } from './selection'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })

function withBeads(beads: BeadMap, extra: Partial<Project> = {}): Project {
  return { ...base, beads, frame: { technique: 'loom' as const, row: 0, column: 0, rows: 40, columns: 40, beads: {} }, ...extra }
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
    expect(result.selection).toMatchObject({ top: 10, left: 11, rows: 3, columns: 2 })
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
    const turned = rotatedSelection({ technique: 'brick', techniqueSettings: { brickBlock: 3 } }, { top: 10, left: 10, rows: 2, columns: 5 })
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
  const frame = { technique: 'loom' as const, row: 10, column: 10, rows: 3, columns: 3 }
  const inFrame = (beads: BeadMap, extra: Partial<Project> = {}): Project => ({ ...base, beads: {}, frame: { ...frame, beads }, ...extra })

  it('turns the Canvas\'s beads for a Selection on the Canvas, in Canvas positions', () => {
    const project = withBeads(SELECTION_BEADS, { frame: undefined })
    const result = rotateLayerSelection(project, SELECTION)
    expect(result.selection).toMatchObject({ top: 10, left: 11, rows: 3, columns: 2 })
    expect(positionsOf(result.project.beads)).toEqual(positionsOf(rotateSelection(project, SELECTION).project.beads))
  })

  it('turns the Frame\'s own beads for a Selection that begins in the Frame, and answers in Canvas positions', () => {
    const project = inFrame(beadsFromColors([['#aa0000', '#bb0000', null], [null, null, null]]), { beads: withColors({}, [{ row: 11, column: 11, color: '#999999' }]) })
    const result = rotateLayerSelection(project, { top: 10, left: 10, rows: 2, columns: 2 })
    expect(result.selection).toMatchObject({ top: 10, left: 10, rows: 2, columns: 2 })
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
  const frame = { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6 }
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
    const peyote = { ...framed(withColors({}, [{ row: 0, column: 0, color: '#aa0000' }])), technique: 'peyote' as const, frame: { technique: 'peyote' as const, row: 20, column: 20, rows: 5, columns: 4, beads: withColors({}, [{ row: 0, column: 0, color: '#aa0000' }]) } }
    const turned = rotateFrame(peyote)!
    expect(turned.frame!.row % 2).toBe(0)
    expect(turned.frame).toMatchObject({ rows: 4, columns: 5 })
    expect(positionsOf(turned.frame!.beads)).toHaveLength(1)
  })

  it('moves the turned Frame by whole cycles of its own rows on brick stitch with a Brick block of N (tickets 477, 492)', () => {
    for (const brickBlock of [2, 3, 5]) {
      const brick = { ...base, technique: 'brick' as const, brickBlock, beads: {}, frame: { technique: 'brick' as const, techniqueSettings: { brickBlock }, row: 30, column: 20, rows: 7, columns: 4, beads: withColors({}, [{ row: 0, column: 0, color: '#aa0000' }]) } }
      const turned = rotateFrame(brick)!
      expect((turned.frame!.row - brick.frame.row) % (2 * brickBlock)).toBe(0)
      expect(turned.frame).toMatchObject({ rows: 4, columns: 7 })
      expect(positionsOf(turned.frame!.beads)).toHaveLength(1)
    }
  })

  it('does nothing without a Frame', () => {
    expect(rotateFrame({ ...base, beads: {}, frame: undefined })).toBeUndefined()
  })

  it('turns its Folded beads with it, kept folded beyond the turned edge (ticket 0638)', () => {
    const project = framed(withColors({}, [{ row: 0, column: 0, color: '#aa0000' }]))
    const folded = { ...project, frame: { ...project.frame!, folded: withColors({}, [{ row: 0, column: 7, color: '#cc0000' }, { row: 3, column: -2, color: '#dd0000' }]) } }
    const turned = rotateFrame(folded)!
    expect(positionsOf(turned.frame!.beads)).toEqual(['0,3:#aa0000'])
    // Past the right edge before, below the bottom after; past the left edge before, above the top after.
    expect(positionsOf(turned.frame!.folded!)).toEqual(['-2,0:#dd0000', '7,3:#cc0000'])
    let back = turned
    for (let i = 0; i < 3; i++) back = rotateFrame(back)!
    expect(back.frame).toEqual(folded.frame)
  })

})

describe('rotating a Piece-tool shape (ticket 547)', () => {
  // A bar of three red beads with a blue bead beside its middle one, inside the bar's bounding rectangle.
  const beads = beadsFromColors(
    [
      ['#aa0000', '#aa0000', '#aa0000'],
      [null, '#0000bb', null],
    ],
    { row: 10, column: 10 },
  )
  const shape: Selection = {
    top: 10,
    left: 10,
    rows: 2,
    columns: 3,
    cells: [{ row: 10, column: 10 }, { row: 10, column: 11 }, { row: 10, column: 12 }],
  }

  it('turns its own beads, leaves the other Piece where it is and keeps the turned shape selected', () => {
    const result = rotateSelection(withBeads(beads), shape)
    expect(result.selection.cells).toHaveLength(3)
    expect(result.selection).toMatchObject({ rows: 3, columns: 2 })
    expect(positionsOf(result.project.beads).filter((entry) => entry.endsWith('#aa0000'))).toHaveLength(3)
    // the blue bead is under the turned footprint but not on a turned cell: it stays
    expect(positionsOf(result.project.beads)).toContain('11,11:#0000bb')
  })

  it('reports as covered only the beads the shape landed on', () => {
    const turned = rotateSelection(withBeads(beads), shape)
    expect(coveredByRotation(withBeads(beads), turned.project, shape, turned.selection)).toBe(0)
  })
})

describe('rotateFrame with Row progress (ticket 0647, ADR 0052)', () => {
  type Way = { direction: 'rows' | 'columns'; reversed?: boolean }
  const WAYS: Way[] = [{ direction: 'rows' }, { direction: 'columns' }, { direction: 'rows', reversed: true }, { direction: 'columns', reversed: true }]
  const pointers = { currentRow: 3, currentColumn: 4, currentRowBack: 2, currentColumnBack: 5 }

  /** A Frame of 5 rows and 6 columns at (20, 20) in a Technique, its four pointers set and its rows running `way`. */
  function woven(technique: 'loom' | 'peyote' | 'brick', way: Way, rows = 5): Project {
    return { ...base, technique, beads: {}, frame: { technique, row: 20, column: 20, rows, columns: 6, beads: {} }, rowProgress: { ...pointers, ...way } }
  }

  /** Every finished position of the Frame, counted from its first row and column, as `place` sends it. */
  function finished(project: Project, place: (row: number, column: number) => [number, number] = (row, column) => [row, column]): string[] {
    const { row: top, column: left, rows, columns } = project.frame!
    const found: string[] = []
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        if (isInFinishedRow(project, { row: top + row, column: left + column, layer: 'frame' })) found.push(place(row, column).join(','))
      }
    }
    return found.sort()
  }

  it('moves each way\'s pointer a quarter turn on: five rows done from the top are five columns done from the right', () => {
    const turned = rotateFrame({ ...woven('loom', { direction: 'rows' }), rowProgress: { direction: 'rows', currentRow: 5, currentColumn: 0 } })!
    expect(turned.rowProgress).toEqual({ direction: 'columns', reversed: true, currentRow: 0, currentColumn: 0, currentColumnBack: 5 })
    expect(rotateFrame(woven('loom', { direction: 'columns' }))!.rowProgress).toEqual({ direction: 'rows', currentRow: 4, currentColumn: 2, currentRowBack: 5, currentColumnBack: 3 })
  })

  it('keeps the same beads finished every way, on loom, peyote and brick stitch', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      for (const way of WAYS) {
        const project = woven(technique, way)
        // A quarter turn clockwise sends row r, column c of the 5-row Frame to row c, column 4 - r.
        expect(finished(rotateFrame(project)!), `${technique} ${JSON.stringify(way)}`).toEqual(finished(project, (row, column) => [column, 4 - row]))
      }
    }
  })

  it('takes a peyote column half woven back to its start where the turn swaps its halves', () => {
    // Columns of 6 beads: turned, a column's even and odd beads swap passes, so its first half can't stay the done one.
    const project = { ...woven('peyote', { direction: 'columns' }, 6), rowProgress: { direction: 'columns' as const, currentRow: 0, currentColumn: 4 } }
    const turned = rotateFrame(project)!
    expect(turned.rowProgress.currentRow).toBe(3)
    expect(finished(project, (row, column) => [column, 5 - row])).toEqual(expect.arrayContaining(finished(turned)))
  })
})
