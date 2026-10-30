import { describe, expect, it } from 'vitest'
import { colorAt } from './canvas'
import { createProject } from './createProject'
import { beadsOfLayer, frameOf } from './layerRecord'
import { MIRROR_OFF, type MirrorSetting } from './mirror'
import { mirrorLayerSelection } from './mirrorSelection'
import { moveToRow } from './rowProgress'
import type { Selection } from './selection'
import { paintAt } from '../testUtils/layers'
import { withLayers } from '../testUtils/layerFields'
import { frameGrid } from '../testUtils/frameGrid'

const RED = '#e63746'
const BLUE = '#2a6fdb'

/** A 6 x 4 loom Frame at the Canvas's origin. */
const framed = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 6, height: 4, unit: 'beads' } })

const on = (axes: Partial<MirrorSetting['axes']>, counts: Partial<MirrorSetting['counts']> = {}, mode: MirrorSetting['mode'] = 'mirror'): MirrorSetting => ({
  ...MIRROR_OFF,
  mode,
  axes: { ...MIRROR_OFF.axes, ...axes },
  counts: { ...MIRROR_OFF.counts, ...counts },
})

/** The Frame's drawn beads as "row:column=color" strings, in reading order. */
const drawn = (project: ReturnType<typeof createProject>) =>
  frameGrid(project)
    .flatMap((row, r) => row.map((cell, c) => (cell.color ? `${r}:${c}=${cell.color}` : undefined)))
    .filter((cell): cell is string => !!cell)

describe('mirrorLayerSelection (ticket 0707, spec 0702)', () => {
  it('copies the fragment\'s beads to their counterparts across one Left–right axis and leaves the fragment as it was', () => {
    const project = paintAt(paintAt(framed, [{ row: 0, column: 0 }, { row: 1, column: 1 }], RED), [{ row: 0, column: 1 }], BLUE)
    const selection: Selection = { top: 0, left: 0, rows: 2, columns: 2 }

    const result = mirrorLayerSelection(project, selection, on({ leftRight: true }))

    expect(drawn(result.project)).toEqual([`0:0=${RED}`, `0:1=${BLUE}`, `0:4=${BLUE}`, `0:5=${RED}`, `1:1=${RED}`, `1:4=${RED}`])
    expect(result.dropped).toBe(0)
    expect(frameOf(result.project)).toMatchObject({ row: 0, column: 0, rows: 4, columns: 6 })
    expect(beadsOfLayer(result.project, 'canvas')).toBe(beadsOfLayer(project, 'canvas'))
  })

  it('copies only the Selection\'s own beads, an empty cell copying nothing and a bead outside the Selection left alone', () => {
    const project = paintAt(framed, [{ row: 0, column: 0 }, { row: 3, column: 0 }], RED)
    const result = mirrorLayerSelection(project, { top: 0, left: 0, rows: 2, columns: 2 }, on({ leftRight: true }))
    expect(drawn(result.project)).toEqual([`0:0=${RED}`, `0:5=${RED}`, `3:0=${RED}`])
  })

  it('hands the setting through: under Repeat with two axes the fragment lies the same way round in each strip', () => {
    const project = paintAt(framed, [{ row: 0, column: 0 }], RED)
    const result = mirrorLayerSelection(project, { top: 0, left: 0, rows: 1, columns: 2 }, on({ leftRight: true }, { leftRight: 2 }, 'repeat'))
    expect(drawn(result.project)).toEqual([`0:0=${RED}`, `0:2=${RED}`, `0:4=${RED}`])
  })

  it('keeps the fragment\'s own beads where a counterpart lands on one, as the axis runs through the Selection', () => {
    const project = paintAt(paintAt(framed, [{ row: 0, column: 0 }], RED), [{ row: 0, column: 5 }], BLUE)
    const result = mirrorLayerSelection(project, { top: 0, left: 0, rows: 1, columns: 6 }, on({ leftRight: true }))
    expect(drawn(result.project)).toEqual([`0:0=${RED}`, `0:5=${BLUE}`])
  })

  it('drops a counterpart that lands in a finished row and counts it, the rest copied', () => {
    const project = paintAt(framed, [{ row: 3, column: 0 }, { row: 2, column: 0 }], RED)
    const result = mirrorLayerSelection(moveToRow(project, 1), { top: 2, left: 0, rows: 2, columns: 1 }, on({ topBottom: true }))
    // Row 0 is finished: the image of row 3 is dropped; row 2's image at row 1 lands.
    expect(colorAt(frameOf(result.project)!.beads, 0, 0)).toBeNull()
    expect(colorAt(frameOf(result.project)!.beads, 1, 0)).toBe(RED)
    expect(result.dropped).toBe(1)
  })

  it('changes nothing, with no drop, while Mirror is off or no Axis is on', () => {
    const project = paintAt(framed, [{ row: 0, column: 0 }], RED)
    const selection: Selection = { top: 0, left: 0, rows: 1, columns: 1 }
    expect(mirrorLayerSelection(project, selection, MIRROR_OFF)).toEqual({ project, dropped: 0 })
    expect(mirrorLayerSelection(project, selection, on({})).project).toBe(project)
  })

  it('gives the same Project back when the fragment holds no bead', () => {
    const result = mirrorLayerSelection(framed, { top: 0, left: 0, rows: 2, columns: 2 }, on({ leftRight: true }))
    expect(result).toEqual({ project: framed, dropped: 0 })
  })

  it('acts on the Selection\'s own layer: a Canvas Selection beside the Frame copies nothing yet (the open Canvas waits for ticket 0704)', () => {
    const beside = withLayers(framed, { beads: {} })
    const project = paintAt(beside, [{ row: 10, column: 10 }], RED)
    const result = mirrorLayerSelection(project, { top: 10, left: 10, rows: 1, columns: 1, layer: 'canvas' }, on({ leftRight: true }))
    expect(result.project).toBe(project)
    expect(frameGrid(result.project).flat().every((cell) => !cell.color)).toBe(true)
  })
})
