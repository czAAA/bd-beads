import { describe, expect, it } from 'vitest'
import { withColors, type BeadChange } from './canvas'
import { keepAllowedEdits } from './allowedEdits'
import { NO_MIRROR_AXES } from './mirror'
import { carryNames, namedPieceCutBy, namedPieces, pieceNameAt, withPieceName } from './pieceNames'
import { createProject, deleteAll, frameGrid, restoreSnapshot, snapshotOf, type Project } from './project'
import { removeSelectedLine } from './removeLine'
import { rotateSelection } from './rotate'
import { changeFrame } from './changeFrame'

const R = '#e63746'
const row = (r: number, from: number, to: number): BeadChange[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ row: r, column: from + i, color: R }))

function projectWith(...rows: BeadChange[][]): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
  return { ...base, beads: withColors({}, rows.flat()) }
}

/** What a drawing edit that sets `changes` does to the Project, through the rules every drawing edit keeps. */
const draw = (project: Project, changes: BeadChange[]) =>
  keepAllowedEdits(project, { ...project, beads: withColors(project.beads, changes) })

describe('piece names', () => {
  it('names the Piece that holds a bead, and an empty name removes it', () => {
    const project = projectWith(row(0, 0, 3), row(5, 0, 1))
    const named = withPieceName(project, { row: 0, column: 2 }, '  Fox ')

    expect(pieceNameAt(named, { row: 0, column: 0 })).toBe('Fox')
    expect(pieceNameAt(named, { row: 5, column: 0 })).toBeUndefined()
    expect(namedPieces(named)).toEqual([{ name: 'Fox', row: 0, column: 0, rows: 1, columns: 4, beads: 4 }])
    expect(withPieceName(named, { row: 0, column: 0 }, '').pieceNames).toBeUndefined()
  })

  it('cuts a name to 40 characters and does nothing where there is no bead', () => {
    const project = projectWith(row(0, 0, 1))

    expect(withPieceName(project, { row: 0, column: 0 }, 'x'.repeat(60)).pieceNames![0].name).toHaveLength(40)
    expect(withPieceName(project, { row: 9, column: 9 }, 'Fox')).toBe(project)
  })

  it('keeps the name when the Piece grows or loses a bead', () => {
    const named = withPieceName(projectWith(row(0, 0, 3)), { row: 0, column: 0 }, 'Fox')
    const grown = draw(named, [{ row: 1, column: 0, color: R }])
    expect(namedPieces(grown)[0].beads).toBe(5)

    // The anchor bead itself is erased, and the name stays with the Piece.
    const erased = draw(named, [{ row: 0, column: 0, color: null }])
    expect(namedPieces(erased)).toEqual([{ name: 'Fox', row: 0, column: 1, rows: 1, columns: 3, beads: 3 }])
  })

  it('lets a named Piece absorb an unnamed one', () => {
    const named = withPieceName(projectWith(row(0, 0, 1), row(0, 4, 5)), { row: 0, column: 0 }, 'Fox')
    const joined = draw(named, row(0, 2, 3))

    expect(namedPieces(joined)).toEqual([{ name: 'Fox', row: 0, column: 0, rows: 1, columns: 6, beads: 6 }])
  })

  it('refuses a bead that would join two named Pieces, and paints the rest', () => {
    const base = projectWith(row(0, 0, 1), row(0, 5, 6))
    const named = withPieceName(withPieceName(base, { row: 0, column: 0 }, 'A'), { row: 0, column: 5 }, 'B')
    const bridged = draw(named, [...row(0, 2, 4), { row: 3, column: 3, color: R }])

    expect(namedPieces(bridged).map((piece) => piece.name).sort()).toEqual(['A', 'B'])
    expect(bridged.beads[0]?.[3]).toBeUndefined()
    expect(bridged.beads[3]?.[3]).toBe(R)
  })

  it('refuses the join even when the edit also erases an anchor', () => {
    const base = projectWith(row(0, 0, 1), row(0, 4, 5))
    const named = withPieceName(withPieceName(base, { row: 0, column: 0 }, 'A'), { row: 0, column: 5 }, 'B')
    const bridged = draw(named, [{ row: 0, column: 0, color: null }, ...row(0, 2, 3)])

    expect(namedPieces(bridged).map((piece) => piece.name).sort()).toEqual(['A', 'B'])
  })

  it('leaves the name with the larger part when a Piece splits', () => {
    const named = withPieceName(projectWith(row(0, 0, 1), row(0, 2, 2), row(0, 3, 8)), { row: 0, column: 0 }, 'Fox')
    const split = draw(named, [{ row: 0, column: 2, color: null }])

    expect(namedPieces(split)).toEqual([{ name: 'Fox', row: 0, column: 3, rows: 1, columns: 6, beads: 6 }])
    expect(pieceNameAt(split, { row: 0, column: 0 })).toBeUndefined()
  })

  it('deletes the name when every bead of the Piece is erased', () => {
    const named = withPieceName(projectWith(row(0, 0, 2)), { row: 0, column: 0 }, 'Fox')
    const erased = draw(named, row(0, 0, 2).map((change) => ({ ...change, color: null })))

    expect(erased.pieceNames).toBeUndefined()
  })

  it('is dropped by Delete all', () => {
    const named = withPieceName(projectWith(row(0, 0, 2)), { row: 0, column: 0 }, 'Fox')

    expect(deleteAll(named).pieceNames).toBeUndefined()
  })

  it('is no change when the edit changes nothing', () => {
    const named = withPieceName(projectWith(row(0, 0, 2)), { row: 0, column: 0 }, 'Fox')

    expect(keepAllowedEdits(named, named)).toBe(named)
    expect(keepAllowedEdits(named, { ...named })).toBe(named)
  })

  it('follows its beads through Rotate and Remove line', () => {
    const fox = withPieceName(projectWith(row(1, 1, 3)), { row: 1, column: 1 }, 'Fox')
    const turned = rotateSelection(fox, { top: 0, left: 0, rows: 4, columns: 5 }).project
    expect(pieceNameAt(turned, { row: 1, column: 1 })).toBeUndefined()
    expect(namedPieces(turned)).toHaveLength(1)
    expect(namedPieces(turned)[0]).toMatchObject({ name: 'Fox', beads: 3, rows: 3, columns: 1 })

    const tall = withPieceName(projectWith(row(1, 1, 3), row(2, 1, 3)), { row: 1, column: 1 }, 'Fox')
    const removed = removeSelectedLine(tall, { top: 1, left: 1, rows: 1, columns: 3 })
    expect(removed.kind).toBe('changed')
    if (removed.kind === 'changed') {
      expect(namedPieces(removed.project)[0]).toMatchObject({ name: 'Fox', row: 1, column: 1, beads: 3 })
    }
  })

  it('is restored by Undo and Redo with the beads', () => {
    const base = projectWith(row(0, 0, 3))
    const named = withPieceName(base, { row: 0, column: 0 }, 'Fox')
    const undone = restoreSnapshot(named, snapshotOf(base, NO_MIRROR_AXES))
    expect(undone.pieceNames).toBeUndefined()

    const redone = restoreSnapshot(undone, snapshotOf(named, NO_MIRROR_AXES))
    expect(redone.pieceNames).toEqual([{ row: 0, column: 0, name: 'Fox' }])
  })

  it('carries nothing when no Piece is named', () => {
    const project = projectWith(row(0, 0, 1))
    const after = { ...project, beads: {} }

    expect(carryNames(project, after)).toBe(after)
  })

  describe('framing a named Schema (ticket 407)', () => {
    const fox = () => withPieceName(projectWith(row(0, 0, 3), row(0, 10, 12)), { row: 0, column: 0 }, 'Fox')

    it('frames a named Piece whole: the Frame snaps to it and takes its name with the beads', () => {
      const project = fox()
      const result = changeFrame(project, { make: { row: 0, column: 0, rows: 1, columns: 4 } })

      expect(result.kind === 'changed' && result.project.frame).toEqual({ technique: 'loom', row: 0, column: 0, rows: 1, columns: 4, name: 'Fox', beads: { 0: { 0: R, 1: R, 2: R, 3: R } } })
      expect(result.kind === 'changed' && namedPieces(result.project)).toEqual([])
    })

    it('refuses a Frame that cuts a named Piece, and says which', () => {
      const project = fox()
      const cut = { row: 0, column: 2, rows: 1, columns: 4 }

      expect(namedPieceCutBy(project, cut)).toBe('Fox')
      expect(changeFrame(project, { make: cut })).toEqual({ kind: 'refused', reason: 'cuts-schema' })
    })

    it('lets a Frame cut an unnamed Piece, as before, and take in a named one whole with it', () => {
      const project = fox()

      expect(namedPieceCutBy(project, { row: 0, column: 11, rows: 1, columns: 5 })).toBeUndefined()
      expect(namedPieceCutBy(project, { row: 0, column: 0, rows: 1, columns: 20 })).toBeUndefined()
    })

    it('leaves the beads of every other Schema out of what the Frame holds, which is what Export, Beads needed and Row progress read', () => {
      const both = withPieceName(fox(), { row: 0, column: 10 }, 'Owl')
      const onFox = changeFrame(both, { make: { row: 0, column: 0, rows: 1, columns: 4 } })
      if (onFox.kind !== 'changed') throw new Error('expected a change')

      const colors = frameGrid(onFox.project).flat().map((cell) => cell.color)

      expect(colors).toEqual([R, R, R, R])
    })

    it('keeps the Schema and its name when the Frame moves to another Schema, and the Frame lays the other one back on the Canvas, named, when removed', () => {
      const both = withPieceName(fox(), { row: 0, column: 10 }, 'Owl')
      const onFox = changeFrame(both, { make: { row: 0, column: 0, rows: 1, columns: 4 } })
      if (onFox.kind !== 'changed') throw new Error('expected a change')
      const onOwl = changeFrame(onFox.project, { make: { row: 0, column: 10, rows: 1, columns: 3 } })
      if (onOwl.kind !== 'changed') throw new Error('expected a change')
      const removed = changeFrame(onOwl.project, { remove: true })

      expect(onOwl.project.frame?.name).toBe('Owl')
      expect(onOwl.project.pieceNames?.map((entry) => entry.name)).toEqual(['Fox'])
      expect(removed.kind === 'changed' && removed.project.frame).toBeUndefined()
      expect(removed.kind === 'changed' && removed.project.pieceNames?.map((entry) => entry.name)).toEqual(['Fox', 'Owl'])
    })
  })
})
