import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { layerSheet } from './layers'
import { changeFrame } from './changeFrame'
import { withLayers } from '../testUtils/layerFields'
import { frameOf, withFrameSheet } from './layerRecord'
import { frameLayoutOf, type FrameShapeId, type QuarterTurns } from './frameShape'
import type { Project } from './project'
import {
  MIRROR_OFF,
  axisLimitsOf,
  canvasAxesOf,
  canvasMirrors,
  counterparts,
  foldAngle,
  foldByIndex,
  mirrorSettingOf,
  mirroredOnCanvas,
  readCanvasAxes,
  readMirrorSetting,
  snapAxis,
  snapCentre,
  toggledMirror,
  withAxesPlaced,
  withAxisToggled,
  withCanvasAxes,
  withMirror,
  withMirrorCount,
  withMirrorFold,
  withMirrorMode,
  withMirrorArea,
  mirrorAreaOf,
  mirrorLayerOf,
  readMirrorArea,
  areaBetween,
  shapeAxesOf,
  type CanvasAxes,
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

/** Radial on at a Fold (ticket 0705), a position, and a result's positions as [row, column] pairs. */
const radial = (fold: number, mode: MirrorSetting['mode'] = 'repeat'): MirrorSetting => ({ ...MIRROR_OFF, mode, axes: { ...MIRROR_OFF.axes, radial: true }, fold })
const at = (row: number, column: number) => ({ row, column })
const cells = (result: { positions: { row: number; column: number }[] }) => result.positions.map(({ row, column }) => [row, column])

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

describe('counterparts on the open Canvas by index (ticket 0704, spec 0702)', () => {
  /** A Project with no Frame, its Canvas's Axes where given. */
  function open(technique: Technique, axes: CanvasAxes): Project {
    const project = (changeFrame(framed(technique, 4, 4), { remove: true }) as { project: Project }).project
    return withCanvasAxes(project, axes)
  }

  it('reflects the column about a Left–right Axis through a position\'s centre, which mirrors that position onto itself', () => {
    const sheet = layerSheet(open('loom', { leftRight: 3 }), 'canvas')
    expect(sheet.axes).toEqual({ leftRight: 3 })
    expect(counterparts(sheet, on({ leftRight: true }), [{ row: 2, column: 1 }]).positions).toEqual([
      { row: 2, column: 1 },
      { row: 2, column: 5 },
    ])
    expect(counterparts(sheet, on({ leftRight: true }), [{ row: 2, column: 3 }]).positions).toEqual([{ row: 2, column: 3 }])
    expect(counterparts(sheet, on({ leftRight: true }), [{ row: -4, column: -2 }]).positions).toEqual([
      { row: -4, column: -2 },
      { row: -4, column: 8 },
    ])
  })

  it('reflects about a boundary (a half position) and the row about a Top–bottom Axis, both directions giving four images, on brick too', () => {
    const sheet = layerSheet(open('brick', { leftRight: 2.5, topBottom: -0.5 }), 'canvas')
    expect(counterparts(sheet, on({ leftRight: true, topBottom: true }), [{ row: 1, column: 0 }]).positions).toEqual([
      { row: 1, column: 0 },
      { row: 1, column: 5 },
      { row: -2, column: 0 },
      { row: -2, column: 5 },
    ])
    expect(counterparts(sheet, on({ topBottom: true }), [{ row: 1, column: 0 }]).positions).toEqual([
      { row: 1, column: 0 },
      { row: -2, column: 0 },
    ])
  })

  it('mirrors nothing in Repeat mode, with the direction off, or with no Axis placed yet: no edge gives no strip to repeat (spec 0702)', () => {
    const sheet = layerSheet(open('loom', { leftRight: 3 }), 'canvas')
    expect(counterparts(sheet, on({ leftRight: true }, {}, 'repeat'), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    expect(counterparts(sheet, on({ topBottom: true }), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    expect(counterparts(layerSheet(open('loom', {}), 'canvas'), on({ leftRight: true }), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    expect(counterparts(sheet, on({ leftRight: true }), [{ row: 0, column: 0 }]).dropped).toBe(0)
  })

  it('carries a Paste\'s color onto a counterpart, the source keeping its own where the two meet', () => {
    const sheet = layerSheet(open('loom', { leftRight: 0.5 }), 'canvas')
    expect(counterparts(sheet, on({ leftRight: true }), [{ row: 0, column: 0, color: '#ff0000' }, { row: 0, column: 1, color: '#0000ff' }]).positions).toEqual([
      { row: 0, column: 0, color: '#ff0000' },
      { row: 0, column: 1, color: '#0000ff' },
    ])
  })
})

describe('the Canvas\'s Axes on the Canvas layer\'s record (ticket 0704)', () => {
  it('snaps a position to a centre or a boundary, the nearer', () => {
    expect(snapAxis(2.2)).toBe(2)
    expect(snapAxis(2.3)).toBe(2.5)
    expect(snapAxis(-0.74)).toBe(-0.5)
  })

  it('places an Axis through the view\'s centre, snapped, when its direction goes on, or is on with none placed; one on already stays', () => {
    const both = on({ leftRight: true, topBottom: true })
    const centre = { leftRight: 4.3, topBottom: -1.1 }
    expect(withAxesPlaced({}, MIRROR_OFF, both, centre)).toEqual({ leftRight: 4.5, topBottom: -1 })
    expect(withAxesPlaced({ leftRight: 2 }, on({ leftRight: true }), both, centre)).toEqual({ leftRight: 2, topBottom: -1 })
    expect(withAxesPlaced({ leftRight: 2 }, MIRROR_OFF, both, centre)).toEqual({ leftRight: 4.5, topBottom: -1 })
    expect(withAxesPlaced({}, MIRROR_OFF, on({ leftRight: true }), centre)).toEqual({ leftRight: 4.5 })
    expect(withAxesPlaced({}, MIRROR_OFF, both, undefined)).toEqual({ leftRight: 0, topBottom: 0 })
    expect(withAxesPlaced({ leftRight: 2 }, MIRROR_OFF, both, undefined)).toEqual({ leftRight: 2, topBottom: 0 })
    const placed = { leftRight: 2, topBottom: 3 }
    expect(withAxesPlaced(placed, both, both, { leftRight: 9, topBottom: 9 })).toBe(placed)
    expect(withAxesPlaced(placed, both, { ...both, mode: 'off' }, { leftRight: 9, topBottom: 9 })).toBe(placed)
  })

  it('is read back from a Project, empty without one, and from a file\'s raw value with anything unreadable left out', () => {
    const project = framed('loom', 4, 4)
    expect(canvasAxesOf(project)).toEqual({})
    expect(canvasAxesOf(withCanvasAxes(project, { topBottom: 1.5 }))).toEqual({ topBottom: 1.5 })
    expect(readCanvasAxes({ leftRight: 2, topBottom: 'x' })).toEqual({ leftRight: 2 })
    expect(readCanvasAxes({ leftRight: 2.3 })).toEqual({ leftRight: 2.5 })
    expect(readCanvasAxes(null)).toBeUndefined()
    expect(readCanvasAxes({ leftRight: Infinity })).toBeUndefined()
  })
})

describe('mirroredOnCanvas', () => {
  it('expands the Canvas\'s own positions across its Axes in Mirror mode, leaving out a counterpart in the keep-out margin (ticket 0704)', () => {
    const framedAt = withLayers(framed('loom', 4, 2), { frame: { ...frameOf(framed('loom', 4, 2))!, row: 10, column: 10 } })
    const project = withCanvasAxes(framedAt, { leftRight: 20 })
    const setting = on({ leftRight: true })
    expect(mirroredOnCanvas(project, setting, [{ row: 0, column: 25, layer: 'canvas' }])).toEqual([
      { row: 0, column: 25, layer: 'canvas' },
      { row: 0, column: 15, layer: 'canvas' },
    ])
    // The margin is four positions round the Frame at rows 10 to 11, columns 10 to 13: (8, 15) lies in it.
    expect(mirroredOnCanvas(project, setting, [{ row: 8, column: 25, layer: 'canvas' }])).toEqual([{ row: 8, column: 25, layer: 'canvas' }])
  })

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
    expect(readMirrorSetting({ ...MIRROR_OFF, fold: 20 })?.fold).toBe(8)
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

describe('Radial counterparts on a grid (ticket 0705, spec 0702)', () => {

  it('at Fold 4 turns the position a quarter at a time about the Frame\'s centre by index, as Rotate turns a fragment (ADR 0052), on a Frame of odd and of even size', () => {
    const odd = layerSheet(framed('loom', 5, 5), 'frame')
    expect(cells(counterparts(odd, radial(4), [at(0, 0)]))).toEqual([[0, 0], [0, 4], [4, 4], [4, 0]])
    expect(cells(counterparts(odd, radial(4), [at(0, 1)]))).toEqual([[0, 1], [1, 4], [4, 3], [3, 0]])
    expect(cells(counterparts(odd, radial(4), [at(2, 2)]))).toEqual([[2, 2]])
    const even = layerSheet(framed('loom', 4, 4), 'frame')
    expect(cells(counterparts(even, radial(4), [at(0, 0)]))).toEqual([[0, 0], [0, 3], [3, 3], [3, 0]])
  })

  it('at Fold 2 turns the position a half about the centre, and in Mirror mode reflects it too: the two straight Axes\' four images', () => {
    const sheet = layerSheet(framed('loom', 5, 5), 'frame')
    expect(cells(counterparts(sheet, radial(2), [at(0, 1)]))).toEqual([[0, 1], [4, 3]])
    expect(cells(counterparts(sheet, radial(2, 'mirror'), [at(0, 1)]))).toEqual([[0, 1], [4, 3], [0, 3], [4, 1]])
  })

  it('in Mirror mode at Fold 4 on a loom grid is the eightfold kaleidoscope, the diagonal reflections as index swaps: up to 2n − 1 counterparts, Repeat n − 1', () => {
    const sheet = layerSheet(framed('loom', 5, 5), 'frame')
    expect(cells(counterparts(sheet, radial(4, 'mirror'), [at(0, 1)]))).toEqual([[0, 1], [1, 4], [4, 3], [3, 0], [0, 3], [3, 4], [4, 1], [1, 0]])
    // A bead on the diagonal is its own reflection across it: four images.
    expect(cells(counterparts(sheet, radial(4, 'mirror'), [at(0, 0)]))).toEqual([[0, 0], [0, 4], [4, 4], [4, 0]])
  })

  it('on peyote and brick keeps the index and takes the grid\'s half-bead shift, and four quarter turns come back to the start: every image has the same images', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      for (const [columns, rows] of [[6, 6], [7, 7], [5, 4]]) {
        const sheet = layerSheet(framed(technique, columns, rows), 'frame')
        const source = at(1, 0)
        const images = counterparts(sheet, radial(4, 'mirror'), [source]).positions
        for (const image of images) {
          const back = counterparts(sheet, radial(4, 'mirror'), [image]).positions
          expect(new Set(back.map(({ row, column }) => `${row}:${column}`)), `${technique} ${columns}×${rows} from ${image.row}:${image.column}`).toEqual(new Set(images.map(({ row, column }) => `${row}:${column}`)))
        }
      }
    }
    expect(cells(counterparts(layerSheet(framed('brick', 4, 4), 'frame'), radial(4), [at(0, 0)]))).toEqual([[0, 0], [0, 3], [3, 3], [3, 0]])
  })

  it('on a Frame whose rows and columns differ in parity a quarter turn can land off the Frame, which is dropped, while the half turn stays exact', () => {
    const sheet = layerSheet(framed('loom', 4, 5), 'frame')
    expect(cells(counterparts(sheet, radial(4), [at(0, 0)]))).toEqual([[0, 0], [0, 3], [3, 3], [3, 0]])
    expect(counterparts(sheet, radial(4), [at(4, 0)])).toEqual({ positions: [at(4, 0)], dropped: 3 })
    expect(cells(counterparts(sheet, radial(2), [at(0, 0)]))).toEqual([[0, 0], [4, 3]])
    expect(cells(counterparts(sheet, radial(2, 'mirror'), [at(0, 0)]))).toEqual([[0, 0], [4, 3], [0, 3], [4, 0]])
    expect(cells(counterparts(sheet, radial(2), [at(4, 3)]))).toEqual([[4, 3], [0, 0]])
  })
})

describe('Radial counterparts by geometry, Fold 3 and 5 to 8 (ticket 0705, spec 0702)', () => {

  it('at Fold 3 turns the bead\'s centre about the Frame\'s centre by 120° and the nearest bead takes each image; Mirror turns its reflection too, 2n images', () => {
    const sheet = layerSheet(framed('loom', 7, 7), 'frame')
    expect(cells(counterparts(sheet, radial(3), [at(3, 1)]))).toEqual([[3, 1], [1, 4], [5, 4]])
    expect(cells(counterparts(sheet, radial(3, 'mirror'), [at(3, 1)]))).toEqual([[3, 1], [1, 4], [5, 4], [3, 5], [5, 2], [1, 2]])
  })

  it('takes every image in one shot from the source, never chained: at Fold 8 the images far out are exact and symmetric', () => {
    const sheet = layerSheet(framed('loom', 15, 15), 'frame')
    expect(cells(counterparts(sheet, radial(8), [at(7, 1)]))).toEqual([[7, 1], [3, 3], [1, 7], [3, 11], [7, 13], [11, 11], [13, 7], [11, 3]])
  })

  it('merges images near the centre rather than drifting: the centre bead has none, and a bead one out at Fold 7 has fewer than six', () => {
    const sheet = layerSheet(framed('loom', 7, 7), 'frame')
    expect(cells(counterparts(sheet, radial(7), [at(3, 3)]))).toEqual([[3, 3]])
    const near = counterparts(sheet, radial(7), [at(3, 2)])
    expect(near.positions.length).toBeLessThan(7)
    expect(near.positions.length).toBeGreaterThan(1)
    expect(new Set(near.positions.map(({ row, column }) => `${row}:${column}`)).size).toBe(near.positions.length)
    expect(near.dropped).toBe(0)
  })

  it('lands on the Frame\'s own positions on peyote and brick too, at most the Fold in Repeat, and drops what turns off the Frame', () => {
    for (const technique of ['peyote', 'brick'] as const) {
      const sheet = layerSheet(framed(technique, 8, 8), 'frame')
      const result = counterparts(sheet, radial(6), [at(2, 2)])
      expect(result.positions.length, technique).toBeGreaterThan(1)
      expect(result.positions.length, technique).toBeLessThanOrEqual(6)
      expect(result.positions.every((position) => sheet.geometry.hasPosition(position)), technique).toBe(true)
    }
    // A corner of a square turned 60° lies outside it.
    const corner = counterparts(layerSheet(framed('loom', 9, 9), 'frame'), radial(6), [at(0, 0)])
    expect(corner.dropped).toBeGreaterThan(0)
  })
})

describe('Radial on the open Canvas about its centre handle (ticket 0705)', () => {
  function open(technique: Technique, axes: CanvasAxes): Project {
    const project = (changeFrame(framed(technique, 4, 4), { remove: true }) as { project: Project }).project
    return withCanvasAxes(project, axes)
  }

  it('turns by index about a position or a corner between four, in Repeat mode too (a turn needs no edge), and the geometric Folds about its point', () => {
    const onPosition = layerSheet(open('loom', { centre: { row: 2, column: 2 } }), 'canvas')
    expect(cells(counterparts(onPosition, radial(4), [{ row: 0, column: 0 }]))).toEqual([[0, 0], [0, 4], [4, 4], [4, 0]])
    const onCorner = layerSheet(open('brick', { centre: { row: 1.5, column: 1.5 } }), 'canvas')
    expect(cells(counterparts(onCorner, radial(2, 'mirror'), [{ row: 0, column: 0 }]))).toEqual([[0, 0], [3, 3], [0, 3], [3, 0]])
    const geometric = layerSheet(open('loom', { centre: { row: 3, column: 3 } }), 'canvas')
    expect(cells(counterparts(geometric, radial(3), [{ row: 3, column: 1 }]))).toEqual([[3, 1], [1, 4], [5, 4]])
  })

  it('mirrors nothing until the centre is placed, and says so through canvasMirrors', () => {
    const unplaced = open('loom', {})
    expect(counterparts(layerSheet(unplaced, 'canvas'), radial(4), [{ row: 0, column: 0 }])).toEqual({ positions: [{ row: 0, column: 0 }], dropped: 0 })
    expect(canvasMirrors(unplaced, radial(4))).toBe(false)
    const placed = open('loom', { centre: { row: 2, column: 2 } })
    expect(canvasMirrors(placed, radial(4))).toBe(true)
    expect(canvasMirrors(placed, radial(4, 'mirror'))).toBe(true)
    expect(canvasMirrors(placed, radial(4, 'off'))).toBe(false)
  })

  it('snaps the centre to the nearer of a position and a corner between four, a tie taking the position', () => {
    expect(snapCentre({ row: 2.3, column: 2.4 })).toEqual({ row: 2.5, column: 2.5 })
    expect(snapCentre({ row: -0.7, column: 0.9 })).toEqual({ row: -1, column: 1 })
    expect(snapCentre({ row: 2.2, column: 2.3 })).toEqual({ row: 2, column: 2 })
  })

  it('places the centre at the view\'s middle when Radial goes on, or is on with none placed, and keeps one placed', () => {
    const centre = { leftRight: 4.3, topBottom: -1.1 }
    expect(withAxesPlaced({}, MIRROR_OFF, radial(4), centre)).toEqual({ centre: { row: -1, column: 4 } })
    expect(withAxesPlaced({ leftRight: 2 }, MIRROR_OFF, radial(4), undefined)).toEqual({ leftRight: 2, centre: { row: 0, column: 0 } })
    const placed = { centre: { row: 3, column: 3 } }
    expect(withAxesPlaced(placed, radial(4), radial(4), centre)).toBe(placed)
    expect(withAxesPlaced(placed, MIRROR_OFF, radial(4), centre)).toEqual({ centre: { row: -1, column: 4 } })
    expect(withAxesPlaced(placed, radial(4), withAxisToggled(radial(4), 'radial'), centre)).toBe(placed)
  })

  it('reads the centre back from a file\'s raw value, snapped, and leaves out one that is no point', () => {
    expect(readCanvasAxes({ centre: { row: 1.3, column: 1.4 } })).toEqual({ centre: { row: 1.5, column: 1.5 } })
    expect(readCanvasAxes({ leftRight: 1, centre: 'x' })).toEqual({ leftRight: 1 })
    expect(readCanvasAxes({ centre: { row: 1 } })).toBeUndefined()
  })
})

describe('the Radial chip and the Fold on the setting (ticket 0705)', () => {
  it('Radial on turns the straight Axes off and remembers them, Radial off brings them back, and a straight Axis on turns Radial off', () => {
    const straight = on({ leftRight: true, topBottom: true })
    const radial = withAxisToggled(straight, 'radial')
    expect(radial).toEqual({ ...on({ radial: true }), beforeRadial: { leftRight: true, topBottom: true } })
    expect(withAxisToggled(radial, 'radial')).toEqual(straight)
    expect(withAxisToggled(radial, 'topBottom')).toEqual({ ...on({ topBottom: true }), beforeRadial: { leftRight: true, topBottom: true } })
    expect(withAxisToggled(MIRROR_OFF, 'radial')).toEqual({ ...on({ radial: true }), beforeRadial: { leftRight: false, topBottom: false } })
    expect(readMirrorSetting(JSON.parse(JSON.stringify(radial)))).toEqual(radial)
  })

  it('steps the Fold within 2 to 8, says which Folds map by index, and the turn between images in degrees', () => {
    expect(withMirrorFold(MIRROR_OFF, 5).fold).toBe(5)
    expect(withMirrorFold(MIRROR_OFF, 1).fold).toBe(2)
    expect(withMirrorFold(MIRROR_OFF, 9).fold).toBe(8)
    expect([2, 3, 4, 5, 6, 7, 8].filter(foldByIndex)).toEqual([2, 4])
    expect([3, 6, 7].map(foldAngle)).toEqual([120, 60, 51])
  })
})

describe('the Area the Axes run inside (ticket 0710, spec 0702)', () => {
  const area = (row: number, column: number, rows: number, columns: number) => ({ row, column, rows, columns })
  /** A Project with no Frame and an Area on its Canvas. */
  function openWithArea(technique: Technique, rect: ReturnType<typeof area>, axes: CanvasAxes = {}): Project {
    const project = (changeFrame(framed(technique, 4, 4), { remove: true }) as { project: Project }).project
    return withMirrorArea(withCanvasAxes(project, axes), 'canvas', rect)
  }

  it('on a loom Frame a straight Axis runs through the Area\'s centre, N axes cut it into equal strips, and a count over its beads minus 1 is clamped', () => {
    const sheet = layerSheet(withMirrorArea(framed('loom', 8, 4), 'frame', area(1, 2, 2, 4)), 'frame')
    expect(sheet.area).toEqual(area(1, 2, 2, 4))
    expect(columnsOf(counterparts(sheet, on({ leftRight: true }), [at(1, 2)]))).toEqual([2, 5])
    expect(columnsOf(counterparts(sheet, on({ leftRight: true }), [at(2, 3)]))).toEqual([3, 4])
    expect(columnsOf(counterparts(sheet, on({ leftRight: true }, { leftRight: 9 }), [at(1, 2)]))).toEqual([2, 3, 4, 5])
    expect(cells(counterparts(sheet, on({ topBottom: true }), [at(1, 3)]))).toEqual([[1, 3], [2, 3]])
  })

  it('on a peyote Frame the Area maps by index too, and a gesture outside the Area is not mirrored at all', () => {
    const sheet = layerSheet(withMirrorArea(framed('peyote', 6, 6), 'frame', area(1, 1, 4, 4)), 'frame')
    expect(cells(counterparts(sheet, on({ topBottom: true }), [at(1, 2)]))).toEqual([[1, 2], [4, 2]])
    expect(cells(counterparts(sheet, on({ topBottom: true }), [at(2, 2)]))).toEqual([[2, 2], [3, 2]])
    expect(counterparts(sheet, on({ leftRight: true, topBottom: true }), [at(0, 0)])).toEqual({ positions: [at(0, 0)], dropped: 0 })
    expect(counterparts(sheet, radial(4, 'mirror'), [at(5, 5)])).toEqual({ positions: [at(5, 5)], dropped: 0 })
  })

  it('Radial turns about the Area\'s centre, and a counterpart that would land outside the Area is dropped though the Frame has the position', () => {
    const sheet = layerSheet(withMirrorArea(framed('loom', 8, 6), 'frame', area(2, 2, 2, 4)), 'frame')
    expect(cells(counterparts(sheet, radial(2), [at(2, 2)]))).toEqual([[2, 2], [3, 5]])
    expect(counterparts(sheet, radial(4), [at(2, 2)])).toEqual({ positions: [at(2, 2), at(3, 5)], dropped: 2 })
  })

  it('on the open Canvas an Area makes a bounded region: strips in both modes with counts, Radial about its centre, the handles not acting, a stroke outside it alone', () => {
    const sheet = layerSheet(openWithArea('loom', area(0, 0, 3, 6), { leftRight: 10, topBottom: 10 }), 'canvas')
    expect(columnsOf(counterparts(sheet, on({ leftRight: true }, { leftRight: 2 }, 'repeat'), [at(0, 0)]))).toEqual([0, 2, 4])
    expect(columnsOf(counterparts(sheet, on({ leftRight: true }, { leftRight: 2 }), [at(0, 0)]))).toEqual([0, 3, 4])
    expect(cells(counterparts(sheet, on({ topBottom: true }), [at(0, 1)]))).toEqual([[0, 1], [2, 1]])
    expect(cells(counterparts(sheet, radial(2), [at(0, 0)]))).toEqual([[0, 0], [2, 5]])
    expect(counterparts(sheet, on({ leftRight: true }), [at(5, 1)])).toEqual({ positions: [at(5, 1)], dropped: 0 })
    expect(counterparts(sheet, on({ leftRight: true }), [at(0, 20)])).toEqual({ positions: [at(0, 20)], dropped: 0 })
  })

  it('the Canvas mirrors with an Area and an Axis on in either mode, and the count limits are the Area\'s beads minus 1 on the Frame and on the Canvas', () => {
    const open = openWithArea('loom', area(0, 0, 3, 6))
    expect(canvasMirrors(open, on({ leftRight: true }, {}, 'repeat'))).toBe(true)
    expect(canvasMirrors(open, on({ radial: true }))).toBe(true)
    expect(canvasMirrors(open, on({}))).toBe(false)
    expect(canvasMirrors(withMirrorArea(open, 'canvas', undefined), on({ leftRight: true }, {}, 'repeat'))).toBe(false)
    expect(axisLimitsOf(open)).toEqual({ leftRight: 5, topBottom: 2 })
    expect(axisLimitsOf(withMirrorArea(open, 'canvas', undefined))).toBeUndefined()
    const framedArea = withMirrorArea(framed('loom', 8, 4), 'frame', area(1, 2, 2, 4))
    expect(axisLimitsOf(framedArea)).toEqual({ leftRight: 3, topBottom: 1 })
    expect(mirrorLayerOf(framedArea)).toBe('frame')
    expect(mirrorLayerOf(open)).toBe('canvas')
  })

  it('is kept per layer on the Project, cleared with none, and read back from a file only as a whole rectangle of beads', () => {
    const project = framed('loom', 8, 4)
    expect(mirrorAreaOf(project, 'frame')).toBeUndefined()
    const set = withMirrorArea(project, 'frame', area(1, 2, 2, 4))
    expect(mirrorAreaOf(set, 'frame')).toEqual(area(1, 2, 2, 4))
    expect(mirrorAreaOf(set, 'canvas')).toBeUndefined()
    expect(set.layers[1]!.mirrorArea).toEqual(area(1, 2, 2, 4))
    expect(mirrorAreaOf(withMirrorArea(set, 'frame', undefined), 'frame')).toBeUndefined()
    expect(withMirrorArea(set, 'frame', undefined).layers[1]).not.toHaveProperty('mirrorArea')
    expect(readMirrorArea({ row: 1, column: 2, rows: 2, columns: 4 })).toEqual(area(1, 2, 2, 4))
    expect(readMirrorArea({ row: 1, column: 2, rows: 0, columns: 4 })).toBeUndefined()
    expect(readMirrorArea({ row: 1.5, column: 2, rows: 2, columns: 4 })).toBeUndefined()
    expect(readMirrorArea('area')).toBeUndefined()
    expect(readMirrorArea(undefined)).toBeUndefined()
  })

  it('a pick between two cells is the rectangle they span, either way round, kept inside the Frame', () => {
    expect(areaBetween(at(3, 5), at(1, 2))).toEqual(area(1, 2, 3, 4))
    expect(areaBetween(at(0, 0), at(0, 0))).toEqual(area(0, 0, 1, 1))
    expect(areaBetween(at(-2, 1), at(9, 9), area(0, 0, 4, 6))).toEqual(area(0, 1, 4, 5))
  })
})

describe('Mirror on a Custom frame through its layout (ticket 0706, spec 0702)', () => {
  /** A Custom frame of the shape at a size, its layout, and its layer as a command works on it. */
  const custom = (shape: FrameShapeId, size: number, quarterTurns?: QuarterTurns) => {
    const open = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(open, { custom: { shape, size, centre: { row: 20, column: 30 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
    const project = quarterTurns ? withLayers(placed.project, { frame: { ...frameOf(placed.project)!, quarterTurns } }) : placed.project
    return { project, sheet: layerSheet(project, 'frame'), layout: frameLayoutOf(frameOf(project)!)! }
  }
  const radialOn = (mode: MirrorSetting['mode']): MirrorSetting => ({ ...MIRROR_OFF, mode, axes: { leftRight: false, topBottom: false, radial: true } })

  it('on a Star Radial is the shape\'s fivefold turn: Repeat lands a bead at the same round and place on every arm, Mirror at its reflected place within each arm too', () => {
    const { sheet } = custom('star', 3)
    const repeat = counterparts(sheet, radialOn('repeat'), [at(0, 0)])
    expect(cells(repeat)).toEqual([[0, 0], [0, 4], [0, 8], [0, 12], [0, 16]])
    expect(repeat.dropped).toBe(0)
    const mirror = counterparts(sheet, radialOn('mirror'), [at(2, 1)])
    expect(mirror.positions).toHaveLength(10)
    expect(new Set(mirror.positions.map(({ column }) => column)).size).toBe(10)
    expect(mirror.positions.every(({ row }) => row === 2)).toBe(true)
    expect(mirror.dropped).toBe(0)
  })

  it('is exact by construction on a Star: every bead\'s every counterpart lands on a position, none dropped, in both modes', () => {
    const { sheet, layout } = custom('star', 3)
    for (const position of layout.positions) {
      const repeat = counterparts(sheet, radialOn('repeat'), [at(position.row, position.column)])
      expect(repeat.positions).toHaveLength(5)
      expect(repeat.dropped).toBe(0)
      expect(counterparts(sheet, radialOn('mirror'), [at(position.row, position.column)]).dropped).toBe(0)
    }
  })

  it('on a Triangle Left–right reflects across the vertical through the centre: a side\'s places swap and its middle bead is its own; Top–bottom is no symmetry of it and maps nothing', () => {
    const { sheet, project } = custom('triangle', 4)
    expect(cells(counterparts(sheet, on({ leftRight: true }), [at(1, 0)]))).toEqual([[1, 0], [1, 1]])
    expect(cells(counterparts(sheet, on({ leftRight: true }), [at(0, 0)]))).toEqual([[0, 0]])
    expect(cells(counterparts(sheet, on({ topBottom: true }), [at(1, 0)]))).toEqual([[1, 0]])
    expect(shapeAxesOf(project)).toEqual({ offered: { leftRight: true, topBottom: false, radial: true }, sides: 3 })
    expect(counterparts(sheet, radialOn('repeat'), [at(1, 0)]).positions).toHaveLength(3)
  })

  it('on a Kite Left–right pairs the wings, Radial is not offered and maps nothing, and Repeat with a straight Axis maps nothing (no strip on a shape)', () => {
    const { sheet, project, layout } = custom('kite', 15)
    expect(cells(counterparts(sheet, on({ leftRight: true }), [at(3, 2)]))).toEqual([[3, 2], [3, 3]])
    expect(shapeAxesOf(project)).toEqual({ offered: { leftRight: true, topBottom: false, radial: false } })
    expect(cells(counterparts(sheet, radialOn('repeat'), [at(3, 2)]))).toEqual([[3, 2]])
    expect(cells(counterparts(sheet, on({ leftRight: true }, {}, 'repeat'), [at(3, 2)]))).toEqual([[3, 2]])
    for (const position of layout.positions) expect(counterparts(sheet, on({ leftRight: true }), [at(position.row, position.column)]).dropped).toBe(0)
  })

  it('on a Fringe earring Left–right pairs the strands and the top\'s beads across its middle, every counterpart landing', () => {
    const { sheet, layout } = custom('fringeEarring', 7)
    expect(cells(counterparts(sheet, on({ leftRight: true }), [at(1000, 0)]))).toEqual([[1000, 0], [1000, 6]])
    expect(cells(counterparts(sheet, on({ leftRight: true }), [at(1, 0)]))).toEqual([[1, 0], [1, 5]])
    for (const position of layout.positions) expect(counterparts(sheet, on({ leftRight: true }), [at(position.row, position.column)]).dropped).toBe(0)
  })

  it('a turned Kite lies with its spine across, so Top–bottom is the Axis offered and Left–right is not; a turned Star likewise, a Warped Square either way', () => {
    expect(shapeAxesOf(custom('kite', 15, 1).project)).toEqual({ offered: { leftRight: false, topBottom: true, radial: false } })
    expect(shapeAxesOf(custom('warpedSquare', 4, 1).project)).toEqual({ offered: { leftRight: true, topBottom: true, radial: true }, sides: 4 })
    expect(shapeAxesOf(custom('kaleidocycle', 3).project)).toEqual({ offered: { leftRight: true, topBottom: true, radial: true }, sides: 6 })
    expect(shapeAxesOf(custom('star', 3, 1).project)?.offered).toEqual({ leftRight: false, topBottom: true, radial: true })
    expect(shapeAxesOf(withFrameSheet(custom('star', 3).project, undefined))).toBeUndefined()
  })
})
