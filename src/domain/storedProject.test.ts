// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { moveToRow, rowProgressOf, toggleRowDirection } from './rowProgress'
import { normalizeProject } from './storedProject'
import { rotateCanvas } from './rotate'
import { withFrame } from './frame'
import { BEAD_CATALOG } from './beads'
import { beadsOfLayer, canvasOf, frameOf, orientationOf } from './layerRecord'
import { replaceBead } from './projectBead'
import { frameSheetOf, withLayers } from '../testUtils/layerFields'
import { legacyRecordOf } from '../testUtils/legacyFile'
import { type RowProgress } from './project'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

describe('normalizeProject', () => {
  it("reads each layer's own Bead back, and the Palette's built-in colors from the Frame's (ticket 0665)", () => {
    const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
    const framed = replaceBead(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 4, unit: 'beads' } }), delica)
    const reopened = normalizeProject(JSON.parse(JSON.stringify(framed)))

    expect([canvasOf(reopened).beadId, frameOf(reopened)!.beadId]).toEqual([cubeBead.id, delica.id])
    expect(reopened.palette).toEqual(framed.palette)
    expect(reopened.paletteLetters).toEqual(framed.paletteLetters)
  })

  it('keeps a reversed way and its pointers through a save, and opens an old file with neither (ticket 0589)', () => {
    const framed = withFrame(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 4, unit: 'beads' } }), { row: 0, column: 0, rows: 4, columns: 3 })
    const upward = moveToRow(toggleRowDirection(toggleRowDirection(framed)), 3)
    const reopened = normalizeProject(JSON.parse(JSON.stringify(upward)))

    expect(rowProgressOf(reopened)).toEqual({ direction: 'rows', reversed: true, currentRow: 0, currentColumn: 0, currentRowBack: 3 })
    expect(rowProgressOf(normalizeProject(JSON.parse(JSON.stringify(framed))))).toEqual({ direction: 'rows', currentRow: 0, currentColumn: 0 })
  })

  it('gives a Project saved as a fixed grid beads by position and a Frame the size of that grid (ADR 0026)', () => {
    const { beads: _beads, frame: _frame, ...base } = legacyRecordOf(createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 3, height: 2, unit: 'beads' } }))
    const legacy = {
      ...base,
      columns: 3,
      rows: 2,
      grid: [
        [{ color: '#f00' }, { color: null }, { color: null }],
        [{ color: null }, { color: null }, { color: '#0f0' }],
      ],
    }

    const normalized = normalizeProject(legacy)

    expect(frameSheetOf(normalized)).toEqual({ technique: 'loom', row: 0, column: 0, columns: 3, rows: 2, beads: { 0: { 0: '#f00' }, 1: { 2: '#0f0' } } })
    expect(beadsOfLayer(normalized, 'canvas')).toEqual({})
    expect(normalized).not.toHaveProperty('grid')
    expect(normalized).not.toHaveProperty('columns')
    expect(normalized).not.toHaveProperty('rows')
  })

  it('keeps a turned canvas through a save and load, and turns on from there (ticket 471)', () => {
    const turned = rotateCanvas(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } }))
    const loaded = normalizeProject(JSON.parse(JSON.stringify(turned)))
    expect(orientationOf(loaded)).toBe(90)
    expect(orientationOf(rotateCanvas(rotateCanvas(rotateCanvas(loaded))))).toBe(0)
  })

  it('backfills row progress and the rotation on a Project saved before they existed', () => {
    const { rowProgress: _rowProgress, rotation: _rotation, ...legacy } = legacyRecordOf(
      createProject({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 15, unit: 'mm' },
      }),
    )

    const normalized = normalizeProject(legacy as never)

    expect(rowProgressOf(normalized)).toEqual({
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
    expect(orientationOf(normalized)).toBe(0)
  })

  it('reads ticket 28\'s two-position `rotated` boolean as its nearest quarter turn (ticket 171)', () => {
    const { rotation: _rotation, ...legacy } = legacyRecordOf(
      createProject({
        technique: 'loom',
        beadId: cubeBead.id,
        size: { width: 15, height: 15, unit: 'mm' },
      }),
    )

    expect(orientationOf(normalizeProject({ ...legacy, rotated: false } as never))).toBe(0)
    expect(orientationOf(normalizeProject({ ...legacy, rotated: true } as never))).toBe(90)
  })

  it('drops the color-to-bead override field a Project saved before ticket 36 may still carry (ADR 0007)', () => {
    const legacy = {
      ...legacyRecordOf(
        createProject({
          technique: 'loom',
          beadId: cubeBead.id,
          size: { width: 15, height: 15, unit: 'mm' },
        }),
      ),
      colorBeadOverrides: { red: 'miyuki-delica-11-0' },
    }

    const normalized = normalizeProject(legacy)

    expect((normalized as unknown as { colorBeadOverrides?: unknown }).colorBeadOverrides).toBeUndefined()
  })

  it('keeps the row pointer of progress saved before row direction existed, running it along the grid rows', () => {
    const base = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' },
    })

    const normalized = normalizeProject({ ...legacyRecordOf(base), rowProgress: { currentRow: 5 } as RowProgress })

    expect(rowProgressOf(normalized)).toEqual({
      direction: 'rows',
      currentRow: 5,
      currentColumn: 0,
    })
  })

  it('drops the stored real-world size a Project saved before ADR 0026 still carries, and keeps its grid', () => {
    const base = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })
    const legacy = { ...legacyRecordOf(base), widthMm: 15, heightMm: 30 }

    const normalized = normalizeProject(legacy)

    expect(normalized).not.toHaveProperty('widthMm')
    expect(normalized).not.toHaveProperty('heightMm')
    expect(frameOf(normalized)!.columns).toBe(10)
    expect(frameOf(normalized)!.rows).toBe(20)
    expect(beadsOfLayer(normalized, 'canvas')).toBe(beadsOfLayer(base, 'canvas'))
  })

  it('clamps row and column pointers that no longer fit the Project', () => {
    const base = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 30, unit: 'mm' }, // 10 columns x 20 rows
    })

    const normalized = normalizeProject(withLayers(base, { rowProgress: { direction: 'columns', currentRow: 999, currentColumn: 999 } }))

    expect(rowProgressOf(normalized).currentRow).toBe(20)
    expect(rowProgressOf(normalized).currentColumn).toBe(10)
  })
})
