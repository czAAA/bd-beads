// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsFromColors, forEachBead, withColors, type BeadMap } from './canvas'
import { namedPieces, withPieceName } from './pieceNames'
import { createProject } from './createProject'
import { isInFinishedRow, rowProgressOf } from './rowProgress'
import type { Project } from './project'
import { coveredByRotation, rotateFrame, rotateLayerSelection, rotateSelection, rotatedSelection } from './rotate'
import { laidFrame } from './frameOrientation'
import type { Selection } from './selection'
import { beadsOfLayer, frameOf } from './layerRecord'
import { frameSheetOf, type LayersChange, withLayers } from '../testUtils/layerFields'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })

function withBeads(beads: BeadMap, extra: LayersChange = {}): Project {
  return withLayers(base, { beads, frame: { technique: 'loom' as const, row: 0, column: 0, rows: 40, columns: 40, beads: {} }, ...extra })
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
    expect(frameSheetOf(result.project)).toEqual(frameSheetOf(project))
    expect(rowProgressOf(result.project)).toEqual(rowProgressOf(project))
    // Clockwise: the old left column (A, D) is now the top row, read right to left... D A / . B / F C
    expect(positionsOf(beadsOfLayer(result.project, 'canvas'))).toEqual(
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
    expect(positionsOf(beadsOfLayer(project, 'canvas'))).toEqual(positionsOf(SELECTION_BEADS))
  })

  it('replaces the beads under the turned footprint', () => {
    // The turned 3 x 2 reaches row 12, below the 2 x 3 Selection, and column 11 of it is bead F.
    const beads = withColors(SELECTION_BEADS, [{ row: 12, column: 11, color: '#123456' }])
    const result = rotateSelection(withBeads(beads), SELECTION)
    expect(positionsOf(beadsOfLayer(result.project, 'canvas'))).not.toContain('12,11:#123456')
    expect(positionsOf(beadsOfLayer(result.project, 'canvas'))).toContain('12,11:#ff0000')
  })

  it('leaves beads outside both rectangles where they are', () => {
    const beads = withColors(SELECTION_BEADS, [{ row: 30, column: 30, color: '#123456' }])
    expect(positionsOf(beadsOfLayer(rotateSelection(withBeads(beads), SELECTION).project, 'canvas'))).toContain('30,30:#123456')
  })

  it('snaps the turned top row to an even row on peyote', () => {
    const turned = rotatedSelection({ technique: 'peyote' }, { top: 10, left: 10, rows: 2, columns: 5 })
    expect(turned.top % 2).toBe(0)
    expect(turned).toMatchObject({ rows: 5, columns: 2 })
  })

  it('snaps the turned top row to a multiple of 2N on brick stitch (ticket 477)', () => {
    const turned = rotatedSelection({ technique: 'brick', techniqueSettings: { brickDrop: 3 } }, { top: 10, left: 10, rows: 2, columns: 5 })
    expect(turned.top % 6).toBe(0)
    expect(turned).toMatchObject({ rows: 5, columns: 2 })
  })

  it('snaps the turned top row to a multiple of 2N on peyote with a Drop of N (ticket 0691)', () => {
    const turned = rotatedSelection({ technique: 'peyote', techniqueSettings: { peyoteDrop: 2 } }, { top: 10, left: 10, rows: 2, columns: 5 })
    expect(turned.top % 4).toBe(0)
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
    expect(coveredByRotation({ beads: beadsOfLayer(project, 'canvas') }, { beads: beadsOfLayer(after, 'canvas') }, SELECTION, selection)).toBe(1)
  })

  it('counts nothing a trimmed turn left in place', () => {
    const beads = withColors(SELECTION_BEADS, [{ row: 12, column: 11, color: '#123456' }])
    const project = withBeads(beads)
    const { selection } = rotateSelection(project, SELECTION)
    expect(coveredByRotation({ beads: beadsOfLayer(project, 'canvas') }, { beads: beadsOfLayer(project, 'canvas') }, SELECTION, selection)).toBe(0)
  })
})

describe('rotateLayerSelection (ADR 0066)', () => {
  const frame = { technique: 'loom' as const, row: 10, column: 10, rows: 3, columns: 3 }
  const inFrame = (beads: BeadMap, extra: LayersChange = {}): Project => (withLayers(base, { beads: {}, frame: { ...frame, beads }, ...extra }))

  it('turns the Canvas\'s beads for a Selection on the Canvas, in Canvas positions', () => {
    const project = withBeads(SELECTION_BEADS, { frame: undefined })
    const result = rotateLayerSelection(project, SELECTION)
    expect(result.selection).toMatchObject({ top: 10, left: 11, rows: 3, columns: 2 })
    expect(positionsOf(beadsOfLayer(result.project, 'canvas'))).toEqual(positionsOf(beadsOfLayer(rotateSelection(project, SELECTION).project, 'canvas')))
  })

  it('turns the Frame\'s own beads for a Selection that begins in the Frame, and answers in Canvas positions', () => {
    const project = inFrame(beadsFromColors([['#aa0000', '#bb0000', null], [null, null, null]]), { beads: withColors({}, [{ row: 11, column: 11, color: '#999999' }]) })
    const result = rotateLayerSelection(project, { top: 10, left: 10, rows: 2, columns: 2 })
    expect(result.selection).toMatchObject({ top: 10, left: 10, rows: 2, columns: 2 })
    expect(positionsOf(frameOf(result.project)!.beads)).toEqual(['0,1:#aa0000', '1,1:#bb0000'])
    expect(beadsOfLayer(result.project, 'canvas')).toEqual(beadsOfLayer(project, 'canvas'))
  })

  it('drops what the turn would put outside the Frame', () => {
    const project = inFrame(beadsFromColors([['#aa0000', '#bb0000', '#cc0000']]))
    // A 1 x 3 row turned upright would stand 3 rows tall from row -1 to 1 about the Selection\'s middle, partly above the Frame.
    const result = rotateLayerSelection(project, { top: 10, left: 10, rows: 1, columns: 3 })
    expect(positionsOf(frameOf(result.project)!.beads).every((entry) => Number(entry.split(',')[0]) >= 0)).toBe(true)
    expect(positionsOf(frameOf(result.project)!.beads)).toHaveLength(2)
  })

  it('counts the layer\'s beads outside the Selection that the turn replaced', () => {
    const project = inFrame(beadsFromColors([['#aa0000', '#bb0000', null], ['#dd0000', '#ee0000', null], [null, '#123456', null]]))
    expect(rotateLayerSelection(project, { top: 10, left: 10, rows: 1, columns: 2 }).covered).toBe(1)
  })

  it('turns only the Canvas beads clear of the Frame and its margin for a Canvas Selection across them (ticket 0659)', () => {
    const canvas = withColors({}, [
      { row: 2, column: 2, color: '#aa0000' },
      { row: 8, column: 10, color: '#00aa00' },
      { row: 10, column: 10, color: '#0000aa' },
    ])
    const project = inFrame({}, { beads: canvas })
    const result = rotateLayerSelection(project, { top: 2, left: 2, rows: 9, columns: 9, layer: 'canvas' })
    expect(positionsOf(beadsOfLayer(result.project, 'canvas'))).toEqual(['10,10:#0000aa', '2,10:#aa0000', '8,10:#00aa00'])
  })
})

describe('rotateFrame (tickets 471, 0667, ADR 0052, 0079)', () => {
  const frame = { technique: 'loom' as const, row: 20, column: 20, rows: 4, columns: 6 }
  const framed = (beads: BeadMap, extra: LayersChange = {}): Project => (withLayers(base, { beads: {}, frame: { ...frame, beads }, ...extra }))

  it('steps the Frame\'s orientation about its centre: its beads keep their own rows and columns, what it covers turns', () => {
    const project = framed(withColors({}, [{ row: 0, column: 0, color: '#aa0000' }, { row: 3, column: 5, color: '#bb0000' }]))
    const turned = rotateFrame(project)!

    // The 4 x 6 Frame at (20, 20) lies 6 x 4 at (19, 21); its own size and beads are as they were.
    expect(frameOf(turned)).toMatchObject({ row: 19, column: 21, rows: 4, columns: 6, quarterTurns: 1 })
    expect(frameOf(turned)!.beads).toBe(frameOf(project)!.beads)
    expect(laidFrame(turned)).toEqual({ row: 19, column: 21, rows: 6, columns: 4 })
  })

  it('comes back after four turns, upright again', () => {
    const project = framed(withColors({}, [{ row: 1, column: 2, color: '#aa0000' }]))
    let turned = project
    for (let i = 0; i < 4; i++) turned = rotateFrame(turned)!
    expect(frameSheetOf(turned)).toEqual(frameSheetOf(project))
  })

  it('leaves the Canvas where it is, and keeps the Frame\'s name', () => {
    const canvas = withColors({}, [{ row: 21, column: 22, color: '#999999' }])
    const project = framed(withColors({}, [{ row: 1, column: 2, color: '#aa0000' }]), { beads: canvas })
    const named = withLayers(project, { frame: { ...frameOf(project)!, name: 'Leaf' } })
    const turned = rotateFrame(named)!
    expect(beadsOfLayer(turned, 'canvas')).toBe(canvas)
    expect(frameOf(turned)!.name).toBe('Leaf')
  })

  it('rewrites nothing on peyote and brick stitch, so no row snaps (ADR 0079)', () => {
    const beads = withColors({}, [{ row: 0, column: 0, color: '#aa0000' }, { row: 1, column: 3, color: '#bb0000' }])
    for (const [technique, techniqueSettings] of [['peyote', undefined], ['brick', { brickDrop: 3 }]] as const) {
      const project = withLayers(base, { technique, beads: {}, frame: { technique, ...(techniqueSettings ? { techniqueSettings } : {}), row: 20, column: 20, rows: 5, columns: 4, beads } })
      let turned: Project = project
      for (let turn = 1; turn <= 4; turn++) {
        turned = rotateFrame(turned)!
        expect(frameOf(turned)!.beads, `${technique} turn ${turn}`).toBe(beads)
        expect(frameOf(turned)).toMatchObject({ rows: 5, columns: 4 })
      }
      expect(frameSheetOf(turned)).toEqual(frameSheetOf(project))
    }
  })

  it('does nothing without a Frame', () => {
    expect(rotateFrame(withLayers(base, { beads: {}, frame: undefined }))).toBeUndefined()
  })

  it('keeps its Folded beads as they are, in its own rows and columns (ticket 0638)', () => {
    const project = framed(withColors({}, [{ row: 0, column: 0, color: '#aa0000' }]))
    const folded = withLayers(project, { frame: { ...frameOf(project)!, folded: withColors({}, [{ row: 0, column: 7, color: '#cc0000' }]) } })
    expect(frameOf(rotateFrame(folded))!.folded).toBe(frameOf(folded)!.folded)
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
    expect(positionsOf(beadsOfLayer(result.project, 'canvas')).filter((entry) => entry.endsWith('#aa0000'))).toHaveLength(3)
    // the blue bead is under the turned footprint but not on a turned cell: it stays
    expect(positionsOf(beadsOfLayer(result.project, 'canvas'))).toContain('11,11:#0000bb')
  })

  it('reports as covered only the beads the shape landed on', () => {
    const turned = rotateSelection(withBeads(beads), shape)
    expect(coveredByRotation({ beads: beadsOfLayer(withBeads(beads), 'canvas') }, { beads: beadsOfLayer(turned.project, 'canvas') }, shape, turned.selection)).toBe(0)
  })
})

describe('rotateFrame with Row progress (tickets 0647, 0667, ADR 0052)', () => {
  /** A Frame of 5 rows and 6 columns at (20, 20) in a Technique, its four pointers set and its rows running `way`. */
  function woven(technique: 'loom' | 'peyote' | 'brick', way: { direction: 'rows' | 'columns'; reversed?: boolean }): Project {
    return withLayers(base, { technique, beads: {}, frame: { technique, row: 20, column: 20, rows: 5, columns: 6, beads: {} }, rowProgress: { currentRow: 3, currentColumn: 4, currentRowBack: 2, currentColumnBack: 5, ...way } })
  }

  it('keeps every pointer, so the same beads stay finished, on loom, peyote and brick stitch', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      for (const way of [{ direction: 'rows' as const }, { direction: 'columns' as const, reversed: true }]) {
        const project = woven(technique, way)
        const turned = rotateFrame(project)!
        expect(rowProgressOf(turned), `${technique} ${JSON.stringify(way)}`).toBe(rowProgressOf(project))
        expect(isInFinishedRow(turned, { row: frameOf(turned)!.row + 1, column: frameOf(turned)!.column, layer: 'frame' })).toBe(isInFinishedRow(project, { row: 21, column: 20, layer: 'frame' }))
      }
    }
  })
})
