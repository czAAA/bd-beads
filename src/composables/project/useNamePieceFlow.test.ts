import { describe, expect, it } from 'vitest'
import { withColors } from '../../domain/canvas'
import { namedPieces } from '../../domain/pieceNames'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import { editHarness } from '../../testUtils/editHarness'
import { useNamePieceFlow } from './useNamePieceFlow'
import { canvasOf } from '../../domain/layerRecord'
import { withFields } from '../../testUtils/flatFields'

const R = '#e63746'
const base: Project = withFields(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' }), {
beads: withColors({}, [
    { row: 0, column: 0, color: R },
    { row: 0, column: 1, color: R },
    { row: 6, column: 6, color: R },
  ]),
})
const onFirstPiece: Selection = { top: 0, left: 0, rows: 1, columns: 2 }
const onBoth: Selection = { top: 0, left: 0, rows: 8, columns: 8 }

function setup(selection?: Selection) {
  const harness = editHarness(base)
  const flow = useNamePieceFlow({ currentProject: harness.currentProject, edit: harness.edit, selection: () => selection })
  return { harness, ...flow }
}

describe('useNamePieceFlow', () => {
  it('is available only when the Selection holds beads of exactly one Piece', () => {
    expect(setup(onFirstPiece).canNamePiece.value).toBe(true)
    expect(setup(onBoth).canNamePiece.value).toBe(false)
    expect(setup({ top: 3, left: 3, rows: 1, columns: 1 }).canNamePiece.value).toBe(false)
    expect(setup().canNamePiece.value).toBe(false)
  })

  it('is not available for a Selection that begins on the Frame: Pieces are the Canvas\'s (ADR 0066)', () => {
    const framed: Project = withFields(base, { frame: { technique: 'loom' as const, row: 0, column: 0, rows: 3, columns: 3, beads: { 0: { 0: R, 1: R } } }, beads: {} })
    const harness = editHarness(framed)
    const flow = useNamePieceFlow({ currentProject: harness.currentProject, edit: harness.edit, selection: () => onFirstPiece })
    expect(flow.canNamePiece.value).toBe(false)
  })

  it('names the Piece as one Undo step, and Undo takes the name off', () => {
    const { harness, onNamePiece, onSavePieceName, naming } = setup(onFirstPiece)
    onNamePiece()
    expect(naming.value?.name).toBe('')

    onSavePieceName('Fox')
    expect(naming.value).toBeUndefined()
    expect(namedPieces(harness.project)).toEqual([{ name: 'Fox', row: 0, column: 0, rows: 1, columns: 2, beads: 2 }])

    harness.history.onUndo()
    expect(canvasOf(harness.project).pieceNames).toBeUndefined()
    harness.history.onRedo()
    expect(canvasOf(harness.project).pieceNames).toHaveLength(1)
  })

  it('offers the current name, and an empty one removes it', () => {
    const { harness, onNamePiece, onSavePieceName, naming } = setup(onFirstPiece)
    onNamePiece()
    onSavePieceName('Fox')
    onNamePiece()
    expect(naming.value?.name).toBe('Fox')

    onSavePieceName('')
    expect(canvasOf(harness.project).pieceNames).toBeUndefined()
  })

  it('does nothing when the dialog is cancelled', () => {
    const { harness, onNamePiece, onCancelPieceName, naming } = setup(onFirstPiece)
    onNamePiece()
    onCancelPieceName()

    expect(naming.value).toBeUndefined()
    expect(harness.history.canUndo.value).toBe(false)
  })
})
