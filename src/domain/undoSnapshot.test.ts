// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { deleteAll } from './drawing'
import { moveToRow, rowProgressOf } from './rowProgress'
import { replaceBead } from './projectBead'
import { restoreSnapshot, snapshotOf, UNDO_CAP } from './undoSnapshot'
import { withColors, type BeadMap } from './canvas'
import { withFrame } from './frame'
import { BEAD_CATALOG } from './beads'
import { backgroundOf, beadsOfLayer, canvasOf, frameOf, withBackground, withLetters } from './layerRecord'
import { frameSheetOf, layersView, withLayers } from '../testUtils/layerFields'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('snapshotOf and restoreSnapshot', () => {
  it('put back everything an Edit can change: the grid, Row progress, the Bead and the Frame', () => {
    const before = moveToRow(createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 8, height: 4, unit: 'beads' } }), 3)
    const snapshot = snapshotOf(before)
    const changed = withFrame(replaceBead(deleteAll(before), cubeBead), { row: 0, column: 0, columns: 2, rows: 5 })

    const restored = restoreSnapshot(changed, snapshot)

    expect(beadsOfLayer(restored, 'canvas')).toBe(beadsOfLayer(before, 'canvas'))
    expect(rowProgressOf(restored)).toEqual(rowProgressOf(before))
    expect(canvasOf(restored).beadId).toBe(canvasOf(before).beadId)
    expect(frameSheetOf(restored)).toEqual(frameSheetOf(before))
  })

  it('put back whole layers but keep the views as they are now: the name, the Canvas\'s orientation and Letters (ticket 0664)', () => {
    const before = createProject({ name: 'Fox', technique: 'loom', beadId: roundBead.id, size: { width: 4, height: 4, unit: 'beads' } })
    const snapshot = snapshotOf(before)
    const viewed = withLetters(withLayers(deleteAll(withLayers(before, { beads: { 9: { 9: '#e63746' } } })), { name: 'Owl', orientation: 90 }), true)

    const restored = restoreSnapshot(viewed, snapshot)

    expect(canvasOf(restored)).toMatchObject({ name: 'Owl', orientation: 90, letters: true, beads: {} })
    expect(frameOf(restored)).toMatchObject({ id: frameOf(before)!.id, letters: true })
    expect(restoreSnapshot(before, snapshot).layers[1]).toBe(before.layers[1])
  })

  it('keep each layer\'s Background as it is now, a view and no Undo step (ticket 0666)', () => {
    const before = withBackground(createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 8, height: 4, unit: 'beads' } }), 'frame', 2)
    const snapshot = snapshotOf(before)
    const changed = withBackground(withBackground(deleteAll(before), 'canvas', 4), 'frame', '#336699')

    const restored = restoreSnapshot(changed, snapshot)

    expect(beadsOfLayer(restored, 'canvas')).toBe(beadsOfLayer(before, 'canvas'))
    expect([backgroundOf(restored, 'canvas'), backgroundOf(restored, 'frame')]).toEqual([4, '#336699'])
  })

  it('put back the Canvas\'s whole Weave: its Technique and every setting, and none it did not have (ticket 0624)', () => {
    const peyote = createProject({ technique: 'peyote', beadId: cubeBead.id })
    const brick = withLayers(peyote, { technique: 'brick' as const, techniqueSettings: { brickDrop: 4 } })

    const undone = restoreSnapshot(brick, snapshotOf(peyote))
    expect(canvasOf(undone).technique).toBe('peyote')
    expect(canvasOf(undone).techniqueSettings).toEqual({ peyoteDrop: 1 })
    const redone = restoreSnapshot(peyote, snapshotOf(brick))
    expect(layersView(redone)).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 4 } })
    expect(canvasOf(redone).techniqueSettings).toEqual({ brickDrop: 4 })
  })

  it('restore a Project that had no Frame', () => {
    const before = withFrame(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } }), undefined)
    const framed = withFrame(before, { row: 0, column: 0, columns: 2, rows: 5 })

    expect(frameOf(restoreSnapshot(framed, snapshotOf(before)))).toBeUndefined()
  })
})

describe('the Frame in an undo entry (ADR 0066)', () => {
  it('is put back with its own beads by Undo, and gone again when the entry had none', () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    const drawn = withLayers(base, { frame: { ...frameOf(base)!, beads: { 1: { 1: '#abcdef' } } } })
    const none = withLayers(base, { frame: undefined })

    expect(frameOf(restoreSnapshot(base, snapshotOf(drawn)))?.beads).toEqual({ 1: { 1: '#abcdef' } })
    expect(frameOf(restoreSnapshot(drawn, snapshotOf(none)))).toBeUndefined()
  })

  it('goes empty with Delete all, the Canvas with it', () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 4, height: 3, unit: 'beads' } })
    const drawn = withLayers(base, { beads: { 9: { 9: '#111111' } }, frame: { ...frameOf(base)!, beads: { 1: { 1: '#abcdef' } } } })

    const cleared = deleteAll(drawn)

    expect(beadsOfLayer(cleared, 'canvas')).toEqual({})
    expect(frameOf(cleared)).toMatchObject({ rows: 3, columns: 4, beads: {} })
  })
})

// Ticket 0677: an Undo step's size is the bead rows it holds that the step after it replaced.
describe('UNDO_CAP', () => {
  const GREY = '#8a8a8a'
  const BLACK = '#111111'
  /** A 300 × 300 Frame with no Canvas beads, every Frame bead `color`. */
  function sheet(color: string) {
    const project = withFrame(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 300, height: 300, unit: 'beads' } }), { row: 0, column: 0, rows: 300, columns: 300 })
    const changes = Array.from({ length: 300 * 300 }, (_bead, at) => ({ row: Math.floor(at / 300), column: at % 300, color }))
    return withLayers(project, { frame: { ...frameSheetOf(project)!, beads: withColors({}, changes) } })
  }
  const repainted = (project: ReturnType<typeof sheet>, beads: BeadMap) => withLayers(project, { frame: { ...frameSheetOf(project)!, beads } })

  it('sizes a step the next one shares whole at almost nothing', () => {
    const entry = snapshotOf(sheet(GREY))

    expect(UNDO_CAP.sizeOf(entry, { ...entry, palette: [] })).toBeLessThan(1024)
  })

  it('sizes a one-bead stroke at about the one row it replaced, and a whole-sheet repaint at every row, dozens of which fit the cap', () => {
    const grey = sheet(GREY)
    const frameBeads = beadsOfLayer(grey, 'frame')!
    const stroke = UNDO_CAP.sizeOf(snapshotOf(grey), snapshotOf(repainted(grey, withColors(frameBeads, [{ row: 7, column: 7, color: BLACK }]))))
    const repaint = UNDO_CAP.sizeOf(snapshotOf(grey), snapshotOf(sheet(BLACK)))

    expect(stroke).toBeGreaterThan(300 * 4)
    expect(stroke).toBeLessThan(16 * 1024)
    expect(repaint).toBeGreaterThan(300 * stroke * 0.9)
    expect(UNDO_CAP.bytes / repaint).toBeGreaterThan(40)
  })

  it('counts the beads of a Frame the next step no longer has', () => {
    const grey = sheet(GREY)

    expect(UNDO_CAP.sizeOf(snapshotOf(grey), snapshotOf(withLayers(grey, { frame: undefined })))).toBeGreaterThan(300 * 300 * 4)
  })
})
