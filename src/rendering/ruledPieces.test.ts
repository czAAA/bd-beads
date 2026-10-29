import { afterEach, describe, expect, it, vi } from 'vitest'
import { withColors, type BeadChange } from '../domain/canvas'
import { createProject } from '../domain/createProject'
import { namedPieces } from '../domain/pieceNames'
import { pieceAreasOf } from '../domain/pieces'
import type { Project } from '../domain/project'
import { ruledPieces } from './ruledPieces'

// Counted, not timed (ticket 0674): what the rulers recount is what these spies see.
vi.mock('../domain/pieces', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/pieces')>()
  return { ...actual, pieceAreasOf: vi.fn(actual.pieceAreasOf) }
})
vi.mock('../domain/pieceNames', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/pieceNames')>()
  return { ...actual, namedPieces: vi.fn(actual.namedPieces) }
})

const R = '#e63746'
const open = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
const square = (row: number, column: number, size: number): BeadChange[] =>
  Array.from({ length: size * size }, (_, i) => ({ row: row + Math.floor(i / size), column: column + (i % size), color: R }))
const paint = (project: Project, changes: BeadChange[]): Project => ({ ...project, beads: withColors(project.beads, changes) })

describe('the Pieces the rulers hang from', () => {
  afterEach(() => vi.clearAllMocks())

  const start: Project = { ...open, beads: withColors({}, [...square(0, 0, 5), ...square(0, 20, 5)]), pieceNames: [{ name: 'Fox', row: 0, column: 0 }] }

  it('are counted once per edit while no stroke is going on', () => {
    const counted = ruledPieces(undefined, start, { numbers: true, stroking: false })
    const edited = ruledPieces(counted, paint(start, [{ row: 0, column: 5, color: R }]), { numbers: true, stroking: false })

    expect(pieceAreasOf).toHaveBeenCalledTimes(2)
    expect(edited.areas).toEqual([{ row: 0, column: 0, rows: 5, columns: 6 }, { row: 0, column: 20, rows: 5, columns: 5 }])
    expect(edited.named).toEqual([{ name: 'Fox', row: 0, column: 0, rows: 5, columns: 6, beads: 26 }])
  })

  it('are not recounted between a stroke\'s start and its end: the box each step touches grows, and the end counts again', () => {
    let project = start
    let pieces = ruledPieces(undefined, project, { numbers: true, stroking: false })
    vi.clearAllMocks()

    for (const column of [5, 6, 7]) {
      project = paint(project, [{ row: 2, column, color: R }])
      pieces = ruledPieces(pieces, project, { numbers: true, stroking: true })
    }
    // A bead far from every Piece starts a box of its own.
    project = paint(project, [{ row: 40, column: 40, color: R }])
    pieces = ruledPieces(pieces, project, { numbers: true, stroking: true })

    expect(pieceAreasOf).not.toHaveBeenCalled()
    expect(namedPieces).not.toHaveBeenCalled()
    expect(pieces.areas).toEqual([{ row: 0, column: 0, rows: 5, columns: 8 }, { row: 0, column: 20, rows: 5, columns: 5 }, { row: 40, column: 40, rows: 1, columns: 1 }])
    expect(pieces.named).toEqual([{ name: 'Fox', row: 0, column: 0, rows: 5, columns: 8, beads: 25 }])

    const ended = ruledPieces(pieces, project, { numbers: true, stroking: false })
    expect(pieceAreasOf).toHaveBeenCalledTimes(1)
    expect(ended.areas).toEqual(pieceAreasOf(project.beads, project))
  })

  it('are not counted at all while the rulers are hidden, nor while a Frame carries them', () => {
    const hidden = ruledPieces(undefined, start, { numbers: false, stroking: false })
    const framed = ruledPieces(undefined, { ...start, frame: { row: 50, column: 50, rows: 4, columns: 4, technique: 'loom', beads: {} } }, { numbers: true, stroking: false })

    expect(pieceAreasOf).not.toHaveBeenCalled()
    expect(hidden.areas).toBeUndefined()
    expect(framed.areas).toBeUndefined()
    // The names are drawn with the rulers off too.
    expect(hidden.named).toHaveLength(1)
  })
})
