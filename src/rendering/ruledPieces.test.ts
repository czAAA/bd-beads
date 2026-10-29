import { describe, expect, it } from 'vitest'
import { withColors, type BeadChange } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { pieceAreasOf } from '../domain/pieces'
import type { Project } from '../domain/project'
import { countingBeads } from '../testUtils/countingBeads'
import { ruledPieces } from './ruledPieces'
import { beadsOfLayer, heldWeave } from '../domain/layerRecord'
import { withLayers } from '../testUtils/layerFields'

const R = '#e63746'
const open = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const square = (row: number, column: number, size: number): BeadChange[] =>
  Array.from({ length: size * size }, (_, i) => ({ row: row + Math.floor(i / size), column: column + (i % size), color: R }))
const paint = (project: Project, changes: BeadChange[]): Project => (withLayers(project, { beads: withColors(beadsOfLayer(project, 'canvas'), changes) }))

// Counted, not timed (ticket 0674): a recount of the Pieces reads every row of the Canvas.
describe('the Pieces the rulers hang from', () => {
  function start() {
    const counting = countingBeads(withColors({}, [...square(0, 0, 5), ...square(0, 20, 5)]))
    const project: Project = withLayers(open, { beads: counting.beads, pieceNames: [{ name: 'Fox', row: 0, column: 0 }] })
    return { project, ...counting }
  }

  it('are counted from the beads while no stroke is going on', () => {
    const { project } = start()
    const edited = ruledPieces(ruledPieces(undefined, project, { numbers: true, stroking: false }), paint(project, [{ row: 0, column: 5, color: R }]), { numbers: true, stroking: false })

    expect(edited.areas).toEqual([{ row: 0, column: 0, rows: 5, columns: 6 }, { row: 0, column: 20, rows: 5, columns: 5 }])
    expect(edited.named).toEqual([{ name: 'Fox', row: 0, column: 0, rows: 5, columns: 6, beads: 26 }])
  })

  it('are not recounted between a stroke\'s start and its end: the box each step touches grows, and the end counts again', () => {
    const counting = start()
    let project = counting.project
    let pieces = ruledPieces(undefined, project, { numbers: true, stroking: false })
    counting.reset()

    for (const column of [5, 6, 7]) {
      project = paint(project, [{ row: 2, column, color: R }])
      pieces = ruledPieces(pieces, project, { numbers: true, stroking: true })
    }
    // A bead far from every Piece starts a box of its own.
    project = paint(project, [{ row: 40, column: 40, color: R }])
    pieces = ruledPieces(pieces, project, { numbers: true, stroking: true })

    expect([...counting.reads.rows]).toEqual([2])
    expect(pieces.areas).toEqual([{ row: 0, column: 0, rows: 5, columns: 8 }, { row: 0, column: 20, rows: 5, columns: 5 }, { row: 40, column: 40, rows: 1, columns: 1 }])
    expect(pieces.named).toEqual([{ name: 'Fox', row: 0, column: 0, rows: 5, columns: 8, beads: 25 }])

    const ended = ruledPieces(pieces, project, { numbers: true, stroking: false })
    expect(counting.reads.rows.size).toBe(5)
    expect(ended.areas).toEqual(pieceAreasOf(beadsOfLayer(project, 'canvas'), heldWeave(project, 'canvas')))
  })

  it('are not counted at all while the rulers are hidden, nor while a Frame carries them; the names still are', () => {
    const { project, reads } = start()
    const hidden = ruledPieces(undefined, withLayers(project, { pieceNames: undefined }), { numbers: false, stroking: false })
    const framed = ruledPieces(undefined, withLayers(project, { pieceNames: undefined, frame: { row: 50, column: 50, rows: 4, columns: 4, technique: 'loom', beads: {} } }), { numbers: true, stroking: false })

    expect(reads.beads).toBe(0)
    expect(hidden.areas).toBeUndefined()
    expect(framed.areas).toBeUndefined()
    expect(ruledPieces(undefined, project, { numbers: false, stroking: false }).named).toHaveLength(1)
  })
})
