// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { deleteAll } from './drawing'
import { moveToRow } from './rowProgress'
import { replaceBead } from './projectBead'
import { restoreSnapshot, snapshotOf } from './undoSnapshot'
import { withFrame } from './frame'
import { BEAD_CATALOG } from './beads'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('snapshotOf and restoreSnapshot', () => {
  it('put back everything an Edit can change: the grid, Row progress, the Bead and the Frame', () => {
    const before = moveToRow(createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 8, height: 4, unit: 'beads' } }), 3)
    const snapshot = snapshotOf(before)
    const changed = withFrame(replaceBead(deleteAll(before), cubeBead), { row: 0, column: 0, columns: 2, rows: 5 })

    const restored = restoreSnapshot(changed, snapshot)

    expect(restored.beads).toBe(before.beads)
    expect(restored.rowProgress).toEqual(before.rowProgress)
    expect(restored.beadId).toBe(before.beadId)
    expect(restored.frame).toEqual(before.frame)
  })

  it('put back the Canvas\'s whole Weave: its Technique and every setting, and none it did not have (ticket 0624)', () => {
    const peyote = createProject({ technique: 'peyote', beadId: cubeBead.id })
    const brick = { ...peyote, technique: 'brick' as const, techniqueSettings: { brickBlock: 4 } }

    const undone = restoreSnapshot(brick, snapshotOf(peyote))
    expect(undone.technique).toBe('peyote')
    expect(undone.techniqueSettings).toBeUndefined()
    const redone = restoreSnapshot(peyote, snapshotOf(brick))
    expect(redone).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 4 } })
    expect(redone.techniqueSettings).toEqual({ brickBlock: 4 })
  })

  it('restore a Project that had no Frame', () => {
    const before = withFrame(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } }), undefined)
    const framed = withFrame(before, { row: 0, column: 0, columns: 2, rows: 5 })

    expect(restoreSnapshot(framed, snapshotOf(before)).frame).toBeUndefined()
  })
})

describe('the Frame in an undo entry (ADR 0066)', () => {
  it('is put back with its own beads by Undo, and gone again when the entry had none', () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    const drawn = { ...base, frame: { ...base.frame!, beads: { 1: { 1: '#abcdef' } } } }
    const none = { ...base, frame: undefined }

    expect(restoreSnapshot(base, snapshotOf(drawn)).frame?.beads).toEqual({ 1: { 1: '#abcdef' } })
    expect(restoreSnapshot(drawn, snapshotOf(none)).frame).toBeUndefined()
  })

  it('goes empty with Delete all, the Canvas with it', () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    const drawn = { ...base, beads: { 9: { 9: '#111111' } }, frame: { ...base.frame!, beads: { 1: { 1: '#abcdef' } } } }

    const cleared = deleteAll(drawn)

    expect(cleared.beads).toEqual({})
    expect(cleared.frame).toMatchObject({ rows: 3, columns: 4, beads: {} })
  })
})
