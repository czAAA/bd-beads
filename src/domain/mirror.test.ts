import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { layerSheet } from './layers'
import { changeFrame } from './changeFrame'
import { withLayers } from '../testUtils/layerFields'
import { frameOf } from './layerRecord'
import type { Project } from './project'
import {
  MIRROR_OFF,
  axisLimitsOf,
  counterparts,
  mirrorSettingOf,
  mirroredOnCanvas,
  readMirrorSetting,
  toggledMirror,
  withAxisToggled,
  withMirror,
  withMirrorCount,
  withMirrorMode,
  type MirrorSetting,
} from './mirror'
import type { Technique } from './weave'

/** A Project with a Frame of the size, on a grid. */
function framed(technique: Technique, columns: number, rows: number) {
  return createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
}

const on = (axes: Partial<MirrorSetting['axes']>, counts: Partial<MirrorSetting['counts']> = {}, mode: MirrorSetting['mode'] = 'mirror'): MirrorSetting => ({
  ...MIRROR_OFF,
  mode,
  axes: { ...MIRROR_OFF.axes, ...axes },
  counts: { ...MIRROR_OFF.counts, ...counts },
})

const columnsOf = (result: { positions: { column: number }[] }) => result.positions.map(({ column }) => column)

describe('counterparts on a Frame by index (ticket 0703, spec 0702)', () => {
  it('reflects the column about one Left–right axis: 0 and 3 are a pair on 4 beads across, and the middle bead of 5 is its own', () => {
    const four = layerSheet(framed('loom', 4, 2), 'frame')
    expect(columnsOf(counterparts(four, on({ leftRight: true }), [{ row: 0, column: 0 }]))).toEqual([0, 3])
    expect(columnsOf(counterparts(four, on({ leftRight: true }), [{ row: 0, column: 2 }]))).toEqual([2, 1])

    const five = layerSheet(framed('loom', 5, 2), 'frame')
    expect(columnsOf(counterparts(five, on({ leftRight: true }), [{ row: 1, column: 2 }]))).toEqual([2])
    expect(counterparts(five, on({ leftRight: true }), [{ row: 1, column: 4 }]).positions).toEqual([
      { row: 1, column: 4 },
      { row: 1, column: 0 },
    ])
  })

  it('with two axes cuts 6 beads into three strips, Mirror alternating A | A′ | A and Repeat the same way round', () => {
    const six = layerSheet(framed('loom', 6, 1), 'frame')
    expect(columnsOf(counterparts(six, on({ leftRight: true }, { leftRight: 2 }), [{ row: 0, column: 0 }]))).toEqual([0, 3, 4])
    expect(columnsOf(counterparts(six, on({ leftRight: true }, { leftRight: 2 }), [{ row: 0, column: 3 }]))).toEqual([3, 0, 4])
    expect(columnsOf(counterparts(six, on({ leftRight: true }, { leftRight: 2 }, 'repeat'), [{ row: 0, column: 0 }]))).toEqual([0, 2, 4])
    expect(columnsOf(counterparts(six, on({ leftRight: true }, { leftRight: 2 }, 'repeat'), [{ row: 0, column: 1 }]))).toEqual([1, 3, 5])
  })

  it('makes the strips as equal as possible: 7 beads over two axes give the middle strip the odd bead, its own centre (ticket 0044)', () => {
    const seven = layerSheet(framed('loom', 7, 1), 'frame')
    expect(columnsOf(counterparts(seven, on({ leftRight: true }, { leftRight: 2 }), [{ row: 0, column: 3 }]))).toEqual([3, 1, 5])
    expect(columnsOf(counterparts(seven, on({ leftRight: true }, { leftRight: 2 }), [{ row: 0, column: 0 }]))).toEqual([0, 4, 5])
  })

  it('reflects the row about a Top–bottom axis, and both directions together give four images', () => {
    const sheet = layerSheet(framed('loom', 4, 4), 'frame')
    expect(counterparts(sheet, on({ topBottom: true }), [{ row: 0, column: 1 }]).positions).toEqual([
      { row: 0, column: 1 },
      { row: 3, column: 1 },
    ])
    expect(counterparts(sheet, on({ leftRight: true, topBottom: true }), [{ row: 0, column: 0 }]).positions).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 3 },
      { row: 3, column: 0 },
      { row: 3, column: 3 },
    ])
  })

  it('maps peyote by index too, the half-bead shift being the grid\'s own', () => {
    const sheet = layerSheet(framed('peyote', 6, 3), 'frame')
    expect(counterparts(sheet, on({ leftRight: true, topBottom: true }), [{ row: 1, column: 1 }]).positions).toEqual([
      { row: 1, column: 1 },
      { row: 1, column: 4 },
    ])
  })

  it('carries what rides on a position, a Paste\'s color, onto its counterparts, and a source bead keeps its own color over a counterpart', () => {
    const sheet = layerSheet(framed('loom', 4, 1), 'frame')
    const pasted = counterparts(sheet, on({ leftRight: true }), [
      { row: 0, column: 0, color: '#ff0000' },
      { row: 0, column: 3, color: '#0000ff' },
    ])
    expect(pasted.positions).toEqual([
      { row: 0, column: 0, color: '#ff0000' },
      { row: 0, column: 3, color: '#0000ff' },
    ])
  })

  it('counts nothing as dropped on a Frame without a shape, and maps nothing off the Frame', () => {
    const sheet = layerSheet(framed('loom', 4, 2), 'frame')
    expect(counterparts(sheet, on({ leftRight: true }), [{ row: 0, column: 0 }]).dropped).toBe(0)
    expect(counterparts(sheet, on({ leftRight: true }), [{ row: 5, column: 9 }]).positions).toEqual([{ row: 5, column: 9 }])
  })

  it('clamps a count the Frame has shrunk under: 9 axes on 4 beads act as 3', () => {
    const sheet = layerSheet(framed('loom', 4, 1), 'frame')
    expect(columnsOf(counterparts(sheet, on({ leftRight: true }, { leftRight: 9 }), [{ row: 0, column: 0 }]))).toEqual([0, 1, 2, 3])
  })

  it('leaves a gesture alone while the mode is Off, with no Axis on, on the open Canvas, and on a Custom frame (tickets 0704, 0706)', () => {
    const project = framed('loom', 4, 4)
    const frame = layerSheet(project, 'frame')
    expect(counterparts(frame, MIRROR_OFF, [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    expect(counterparts(frame, on({}), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    expect(counterparts(layerSheet(project, 'canvas'), on({ leftRight: true }), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    const star = withLayers(project, { frame: { ...frameOf(project)!, shape: 'triangle', settings: { rounds: 4 } } })
    expect(counterparts(layerSheet(star, 'frame'), on({ leftRight: true }), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
  })
})

describe('mirroredOnCanvas', () => {
  it('expands Canvas positions that lie on the Frame through the Frame\'s own positions, and leaves the Canvas\'s alone', () => {
    const project = framed('loom', 4, 2)
    const { row, column } = project.layers[1]!
    const setting = on({ leftRight: true })
    expect(mirroredOnCanvas(project, setting, [{ row, column, layer: 'frame' }])).toEqual([
      { row, column, layer: 'frame' },
      { row, column: column + 3, layer: 'frame' },
    ])
    expect(mirroredOnCanvas(project, setting, [{ row: row - 5, column: column - 5, layer: 'canvas' }])).toEqual([{ row: row - 5, column: column - 5, layer: 'canvas' }])
  })
})

describe('the Mirror setting on the Project', () => {
  it('is off on a Project without one, and read back as set, through a file\'s raw value too', () => {
    const project = framed('loom', 4, 4)
    expect(mirrorSettingOf(project)).toEqual(MIRROR_OFF)
    const setting = on({ leftRight: true }, { leftRight: 2 }, 'repeat')
    expect(mirrorSettingOf(withMirror(project, setting))).toEqual(setting)
    expect(readMirrorSetting(JSON.parse(JSON.stringify(setting)))).toEqual(setting)
    expect(readMirrorSetting({ mode: 'sideways', axes: 3 })).toBeUndefined()
    expect(readMirrorSetting({ mode: 'mirror', axes: { leftRight: true }, counts: { leftRight: 0 } })).toEqual({ ...on({ leftRight: true }), counts: { leftRight: 1, topBottom: 1 } })
  })

  it('turning an Axis on while Off sets the mode to Mirror, and Off keeps the Axes and counts for next time', () => {
    const lit = withAxisToggled(MIRROR_OFF, 'topBottom')
    expect(lit).toEqual(on({ topBottom: true }))
    const off = withMirrorMode(withMirrorCount(lit, 'topBottom', 3), 'off')
    expect(off).toEqual(on({ topBottom: true }, { topBottom: 3 }, 'off'))
    expect(withAxisToggled(lit, 'topBottom')).toEqual(on({}))
  })

  it('key 8 toggles the mode with its last settings: Mirror with Left–right on if no Axis was, back to the mode it had', () => {
    expect(toggledMirror(MIRROR_OFF, 'mirror')).toEqual(on({ leftRight: true }))
    const repeating = on({ topBottom: true }, {}, 'repeat')
    expect(toggledMirror(repeating, 'mirror')).toEqual({ ...repeating, mode: 'off' })
    expect(toggledMirror({ ...repeating, mode: 'off' }, 'repeat')).toEqual(repeating)
  })

  it('limits each direction\'s count to the Frame\'s beads minus one, none without a Frame', () => {
    const project = framed('loom', 5, 3)
    expect(axisLimitsOf(project)).toEqual({ leftRight: 4, topBottom: 2 })
    expect(axisLimitsOf((changeFrame(project, { remove: true }) as { project: Project }).project)).toBeUndefined()
  })
})
