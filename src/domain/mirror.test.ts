import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { layerSheet } from './layers'
import { changeFrame } from './changeFrame'
import { withLayers } from '../testUtils/layerFields'
import { frameOf, withFrameSheet } from './layerRecord'
import { frameLayoutOf, type FrameShapeId, type QuarterTurns } from './frameShape'
import type { Rect } from './canvas'
import type { Project } from './project'
import {
  MIRROR_OFF,
  canvasMirrors,
  counterparts,
  isMirrorOn,
  mirrorSettingOf,
  mirroredOnCanvas,
  placeRect,
  readMirrorArea,
  readMirrorSetting,
  shapeAxesOf,
  withAxisToggled,
  withMirror,
  withMirrorCount,
  withMirrorFold,
  withMirrorMode,
  withMirrorPlace,
  type MirrorPlace,
  type MirrorSetting,
} from './mirror'
import type { Technique } from './weave'

/** A Project with a Frame of the size, on a grid. */
function framed(technique: Technique, columns: number, rows: number) {
  return createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })
}

/** The same with no Frame: the open Canvas alone. */
function open(technique: Technique): Project {
  return (changeFrame(framed(technique, 4, 4), { remove: true }) as { project: Project }).project
}

const WHOLE_FRAME: MirrorPlace = { layer: 'frame' }
const area = (row: number, column: number, rows: number, columns: number): Rect => ({ row, column, rows, columns })
const onCanvas = (rect: Rect): MirrorPlace => ({ layer: 'canvas', area: rect })

/** The Mirror on, at a place (the whole Frame unless given), with its Axes, counts and Mode. */
const on = (axes: Partial<MirrorSetting['axes']>, counts: Partial<MirrorSetting['counts']> = {}, mode: MirrorSetting['mode'] = 'mirror', place: MirrorPlace = WHOLE_FRAME): MirrorSetting => ({
  ...MIRROR_OFF,
  mode,
  axes: { ...MIRROR_OFF.axes, ...axes },
  counts: { ...MIRROR_OFF.counts, ...counts },
  place,
})

const columnsOf = (result: { positions: { column: number }[] }) => result.positions.map(({ column }) => column)

/** Radial on at a Fold (ticket 0705), a position, and a result's positions as [row, column] pairs. */
const radial = (fold: number, mode: MirrorSetting['mode'] = 'repeat', place: MirrorPlace = WHOLE_FRAME): MirrorSetting => ({ ...MIRROR_OFF, mode, axes: { ...MIRROR_OFF.axes, radial: true }, fold, place })
const at = (row: number, column: number) => ({ row, column })
const cells = (result: { positions: { row: number; column: number }[] }) => result.positions.map(({ row, column }) => [row, column])

describe('counterparts on the whole Frame by index (tickets 0703, 0750, spec 0702)', () => {
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

  it('leaves a gesture alone while the Mirror is off, with no Axis on, and on the layer it is not on', () => {
    const project = framed('loom', 4, 4)
    const frame = layerSheet(project, 'frame')
    expect(counterparts(frame, MIRROR_OFF, [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    expect(counterparts(frame, on({}), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    expect(counterparts(layerSheet(project, 'canvas'), on({ leftRight: true }), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
    expect(counterparts(frame, on({ leftRight: true }, {}, 'mirror', onCanvas(area(0, 0, 4, 4))), [{ row: 0, column: 0 }]).positions).toEqual([{ row: 0, column: 0 }])
  })
})

describe('counterparts inside a Canvas Area (tickets 0710, 0750, spec 0702)', () => {
  it('runs a straight Axis through the Area\'s centre, N axes cutting it into equal strips in both modes, a count over its beads minus 1 clamped', () => {
    const sheet = layerSheet(open('loom'), 'canvas')
    const inArea = (axes: Partial<MirrorSetting['axes']>, counts: Partial<MirrorSetting['counts']> = {}, mode: MirrorSetting['mode'] = 'mirror') => on(axes, counts, mode, onCanvas(area(0, 0, 3, 6)))
    expect(columnsOf(counterparts(sheet, inArea({ leftRight: true }), [at(0, 0)]))).toEqual([0, 5])
    expect(columnsOf(counterparts(sheet, inArea({ leftRight: true }, { leftRight: 2 }, 'repeat'), [at(0, 0)]))).toEqual([0, 2, 4])
    expect(columnsOf(counterparts(sheet, inArea({ leftRight: true }, { leftRight: 2 }), [at(0, 0)]))).toEqual([0, 3, 4])
    expect(columnsOf(counterparts(sheet, inArea({ leftRight: true }, { leftRight: 9 }), [at(0, 0)]))).toEqual([0, 1, 2, 3, 4, 5])
    expect(cells(counterparts(sheet, inArea({ topBottom: true }), [at(0, 1)]))).toEqual([[0, 1], [2, 1]])
  })

  it('maps peyote by index, leaves a gesture outside the Area alone, and drops a counterpart that would land outside it', () => {
    const sheet = layerSheet(open('peyote'), 'canvas')
    const place = onCanvas(area(1, 1, 4, 4))
    expect(cells(counterparts(sheet, on({ topBottom: true }, {}, 'mirror', place), [at(1, 2)]))).toEqual([[1, 2], [4, 2]])
    expect(counterparts(sheet, on({ leftRight: true, topBottom: true }, {}, 'mirror', place), [at(0, 0)])).toEqual({ positions: [at(0, 0)], dropped: 0 })
    const wide = layerSheet(open('loom'), 'canvas')
    expect(counterparts(wide, radial(4, 'repeat', onCanvas(area(2, 2, 2, 4))), [at(2, 2)])).toEqual({ positions: [at(2, 2), at(3, 5)], dropped: 2 })
  })

  it('turns Radial about the Area\'s centre, by index at Fold 2 and 4 and geometrically at 3', () => {
    const sheet = layerSheet(open('loom'), 'canvas')
    expect(cells(counterparts(sheet, radial(2, 'repeat', onCanvas(area(0, 0, 3, 6))), [at(0, 0)]))).toEqual([[0, 0], [2, 5]])
    expect(cells(counterparts(sheet, radial(4, 'repeat', onCanvas(area(0, 0, 5, 5))), [at(0, 0)]))).toEqual([[0, 0], [0, 4], [4, 4], [4, 0]])
    expect(cells(counterparts(sheet, radial(3, 'repeat', onCanvas(area(0, 0, 7, 7))), [at(3, 1)]))).toEqual([[3, 1], [1, 4], [5, 4]])
  })

  it('has no Axis in a direction one bead across (its chip is off), the other direction still mirroring', () => {
    const sheet = layerSheet(open('loom'), 'canvas')
    const thin = onCanvas(area(0, 0, 1, 6))
    expect(counterparts(sheet, on({ topBottom: true }, {}, 'mirror', thin), [at(0, 1)])).toEqual({ positions: [at(0, 1)], dropped: 0 })
    expect(cells(counterparts(sheet, on({ leftRight: true, topBottom: true }, {}, 'mirror', thin), [at(0, 1)]))).toEqual([[0, 1], [0, 4]])
  })

  it('says a Canvas Mirror lets a Canvas command paint under the Frame (spec 0702\'s Edges), the whole Frame\'s and an off one not', () => {
    expect(canvasMirrors(on({ leftRight: true }, {}, 'repeat', onCanvas(area(0, 0, 3, 6))))).toBe(true)
    expect(canvasMirrors(on({ leftRight: true }))).toBe(false)
    expect(canvasMirrors(MIRROR_OFF)).toBe(false)
  })
})

describe('mirroredOnCanvas', () => {
  it('expands the Canvas\'s own positions inside a Canvas Area, leaving out a counterpart in the keep-out margin', () => {
    const framedAt = withLayers(framed('loom', 4, 2), { frame: { ...frameOf(framed('loom', 4, 2))!, row: 10, column: 10 } })
    const setting = on({ leftRight: true }, {}, 'mirror', onCanvas(area(0, 15, 12, 11)))
    expect(mirroredOnCanvas(framedAt, setting, [{ row: 0, column: 25, layer: 'canvas' }])).toEqual([
      { row: 0, column: 25, layer: 'canvas' },
      { row: 0, column: 15, layer: 'canvas' },
    ])
    // The margin is four positions round the Frame at rows 10 to 11, columns 10 to 13: (8, 15) lies in it.
    expect(mirroredOnCanvas(framedAt, setting, [{ row: 8, column: 25, layer: 'canvas' }])).toEqual([{ row: 8, column: 25, layer: 'canvas' }])
  })

  it('expands Canvas positions that lie on the Frame through the Frame\'s own positions for the whole-Frame Mirror, and leaves the Canvas\'s alone', () => {
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

describe('the one Mirror of a Project (ADR 0082, ticket 0750)', () => {
  it('is off on a Project without one, and off for a whole-Frame Mirror whose Frame is gone', () => {
    const project = framed('loom', 4, 4)
    expect(mirrorSettingOf(project)).toEqual(MIRROR_OFF)
    expect(isMirrorOn(mirrorSettingOf(project))).toBe(false)
    const mirrored = withMirrorPlace(project, WHOLE_FRAME)
    expect(isMirrorOn(mirrorSettingOf(mirrored))).toBe(true)
    const unframed = (changeFrame(mirrored, { remove: true }) as { project: Project }).project
    expect(isMirrorOn(mirrorSettingOf(unframed))).toBe(false)
  })

  it('is made at a place, Mirror mode with Left–right the first time, and a new place replaces the one before, keeping the Mode and Axes', () => {
    const made = withMirrorPlace(open('loom'), onCanvas(area(0, 0, 4, 6)))
    expect(mirrorSettingOf(made)).toEqual({ ...on({ leftRight: true }, {}, 'mirror', onCanvas(area(0, 0, 4, 6))) })
    const set = withMirror(made, on({ topBottom: true }, { topBottom: 3 }, 'repeat'))
    const moved = withMirrorPlace(set, onCanvas(area(5, 5, 8, 8)))
    expect(mirrorSettingOf(moved)).toEqual(on({ topBottom: true }, { topBottom: 3 }, 'repeat', onCanvas(area(5, 5, 8, 8))))
  })

  it('clamps the counts to a smaller place: an Axis count to its beads across minus one', () => {
    const counted = withMirror(withMirrorPlace(open('loom'), onCanvas(area(0, 0, 10, 10))), on({ leftRight: true, topBottom: true }, { leftRight: 6, topBottom: 4 }))
    expect(mirrorSettingOf(withMirrorPlace(counted, onCanvas(area(0, 0, 3, 5)))).counts).toEqual({ leftRight: 4, topBottom: 2 })
  })

  it('keeps the bar\'s settings out of its place: withMirror never moves it, and they are not what Undo puts back', () => {
    const made = withMirrorPlace(open('loom'), onCanvas(area(0, 0, 4, 6)))
    const set = withMirror(made, { ...on({ radial: true }), place: onCanvas(area(9, 9, 9, 9)) })
    expect(mirrorSettingOf(set).place).toEqual(onCanvas(area(0, 0, 4, 6)))
    expect(mirrorSettingOf(set).axes.radial).toBe(true)
  })

  it('closes, its Area dropped and its Mode, Axes and counts kept for the next one', () => {
    const set = withMirror(withMirrorPlace(open('loom'), onCanvas(area(0, 0, 10, 10))), on({ topBottom: true }, { topBottom: 2 }, 'repeat'))
    const closed = withMirrorPlace(set, undefined)
    expect(mirrorSettingOf(closed)).toEqual({ ...on({ topBottom: true }, { topBottom: 2 }, 'repeat'), place: null })
    expect(mirrorSettingOf(withMirrorPlace(closed, onCanvas(area(1, 1, 4, 4))))).toEqual(on({ topBottom: true }, { topBottom: 2 }, 'repeat', onCanvas(area(1, 1, 4, 4))))
  })

  it('gives a place its rectangle in its layer\'s positions: the Canvas Area, or the whole Frame\'s from its first row and column', () => {
    expect(placeRect(framed('loom', 5, 3), WHOLE_FRAME)).toEqual(area(0, 0, 3, 5))
    expect(placeRect(open('loom'), WHOLE_FRAME)).toBeUndefined()
    expect(placeRect(open('loom'), onCanvas(area(2, 3, 4, 5)))).toEqual(area(2, 3, 4, 5))
  })

  it('reads back as saved, its place too, and a closed one as closed', () => {
    const saved = mirrorSettingOf(withMirror(withMirrorPlace(open('loom'), onCanvas(area(0, 0, 4, 6))), on({ leftRight: true }, { leftRight: 2 }, 'repeat')))
    const firstForm = { framed: true }
    expect(readMirrorSetting(JSON.parse(JSON.stringify(saved)), firstForm)).toEqual(saved)
    expect(readMirrorSetting(JSON.parse(JSON.stringify({ ...saved, place: null })), firstForm)).toEqual({ ...saved, place: null })
    expect(readMirrorSetting({ ...saved, place: { layer: 'canvas', area: 'x' } }, firstForm)?.place).toBeNull()
    expect(readMirrorSetting({ mode: 'sideways', axes: 3 }, firstForm)).toBeUndefined()
    expect(readMirrorSetting({ ...MIRROR_OFF, fold: 20, place: null }, firstForm)?.fold).toBe(8)
  })

  it('reads the first form\'s record as it acted: its Canvas Area as the Mirror, else a Frame\'s whole Frame, else off; its Off stays off', () => {
    const first = { mode: 'repeat', axes: { leftRight: true }, counts: { leftRight: 0 } }
    expect(readMirrorSetting(first, { canvasArea: area(1, 2, 3, 4), framed: true })).toEqual(on({ leftRight: true }, {}, 'repeat', onCanvas(area(1, 2, 3, 4))))
    expect(readMirrorSetting(first, { framed: true })?.place).toEqual(WHOLE_FRAME)
    expect(readMirrorSetting(first, { framed: false })?.place).toBeNull()
    expect(readMirrorSetting({ ...first, mode: 'off' }, { canvasArea: area(1, 2, 3, 4), framed: true })).toEqual({ ...on({ leftRight: true }), place: null })
  })

  it('reads an Area only as a whole rectangle of beads', () => {
    expect(readMirrorArea({ row: 1, column: 2, rows: 2, columns: 4 })).toEqual(area(1, 2, 2, 4))
    expect(readMirrorArea({ row: 1, column: 2, rows: 0, columns: 4 })).toBeUndefined()
    expect(readMirrorArea({ row: 1.5, column: 2, rows: 2, columns: 4 })).toBeUndefined()
    expect(readMirrorArea('area')).toBeUndefined()
  })
})

describe('the Mirror bar\'s settings (ContextBar card, Mirror bar)', () => {
  it('switches the Mode and steps a count, never under one, and the Fold within 2 to 8', () => {
    expect(withMirrorMode(on({ leftRight: true }), 'repeat').mode).toBe('repeat')
    expect(withMirrorCount(MIRROR_OFF, 'topBottom', 0).counts.topBottom).toBe(1)
    expect(withMirrorFold(MIRROR_OFF, 5).fold).toBe(5)
    expect(withMirrorFold(MIRROR_OFF, 1).fold).toBe(2)
    expect(withMirrorFold(MIRROR_OFF, 9).fold).toBe(8)
  })

  it('Radial on turns the straight Axes off and remembers them, Radial off brings them back, and a straight Axis on turns Radial off', () => {
    const straight = on({ leftRight: true, topBottom: true })
    const radialOn = withAxisToggled(straight, 'radial')
    expect(radialOn).toEqual({ ...on({ radial: true }), beforeRadial: { leftRight: true, topBottom: true } })
    expect(withAxisToggled(radialOn, 'radial')).toEqual(straight)
    expect(withAxisToggled(radialOn, 'topBottom')).toEqual({ ...on({ topBottom: true }), beforeRadial: { leftRight: true, topBottom: true } })
  })

  it('keeps one Axis on: pressing the last one changes nothing, and Radial off with none to bring back takes Left–right', () => {
    const one = on({ topBottom: true })
    expect(withAxisToggled(one, 'topBottom')).toBe(one)
    const lone = on({ radial: true })
    expect(withAxisToggled(lone, 'radial')).toEqual(on({ leftRight: true }))
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

describe('the whole-Frame Mirror on a Custom frame, the shape\'s own Axes (tickets 0706, 0750, spec 0702)', () => {
  /** A Custom frame of the shape at a size, its layout, and its layer as a command works on it. */
  const custom = (shape: FrameShapeId, size: number, quarterTurns?: QuarterTurns) => {
    const blank = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
    const placed = changeFrame(blank, { custom: { shape, size, centre: { row: 20, column: 30 } } })
    if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
    const project = quarterTurns ? withLayers(placed.project, { frame: { ...frameOf(placed.project)!, quarterTurns } }) : placed.project
    return { project, sheet: layerSheet(project, 'frame'), layout: frameLayoutOf(frameOf(project)!)! }
  }
  /** The whole-Frame Mirror in a Mode, whatever Axes the setting holds: the shape's are the ones that act. */
  const inMode = (mode: MirrorSetting['mode']): MirrorSetting => on({ leftRight: true }, {}, mode)

  it('on a Star is Radial at the shape\'s fivefold turn: Repeat lands a bead at the same round and place on every arm, Mirror at its reflected place within each arm too', () => {
    const { sheet } = custom('star', 3)
    const repeat = counterparts(sheet, inMode('repeat'), [at(0, 0)])
    expect(cells(repeat)).toEqual([[0, 0], [0, 4], [0, 8], [0, 12], [0, 16]])
    expect(repeat.dropped).toBe(0)
    const mirror = counterparts(sheet, inMode('mirror'), [at(2, 1)])
    expect(mirror.positions).toHaveLength(10)
    expect(new Set(mirror.positions.map(({ column }) => column)).size).toBe(10)
    expect(mirror.positions.every(({ row }) => row === 2)).toBe(true)
    expect(mirror.dropped).toBe(0)
  })

  it('is exact by construction on a Star: every bead\'s every counterpart lands on a position, none dropped, in both modes', () => {
    const { sheet, layout } = custom('star', 3)
    for (const position of layout.positions) {
      const repeat = counterparts(sheet, inMode('repeat'), [at(position.row, position.column)])
      expect(repeat.positions).toHaveLength(5)
      expect(repeat.dropped).toBe(0)
      expect(counterparts(sheet, inMode('mirror'), [at(position.row, position.column)]).dropped).toBe(0)
    }
  })

  it('on a Triangle is Radial with its three sides, and on a Warped Square or a Kaleidocycle Radial with theirs', () => {
    const { sheet, project } = custom('triangle', 4)
    expect(shapeAxesOf(project)).toEqual({ axes: { leftRight: false, topBottom: false, radial: true }, sides: 3 })
    expect(counterparts(sheet, inMode('repeat'), [at(1, 0)]).positions).toHaveLength(3)
    expect(shapeAxesOf(custom('warpedSquare', 4).project)).toEqual({ axes: { leftRight: false, topBottom: false, radial: true }, sides: 4 })
    expect(shapeAxesOf(custom('kaleidocycle', 3).project)).toEqual({ axes: { leftRight: false, topBottom: false, radial: true }, sides: 6 })
    expect(shapeAxesOf(withFrameSheet(custom('star', 3).project, undefined))).toBeUndefined()
  })

  it('on a Kite is its one Left–right line, pairing the wings, every counterpart landing; Repeat on a line maps nothing (no strip on a shape)', () => {
    const { sheet, project, layout } = custom('kite', 15)
    expect(shapeAxesOf(project)).toEqual({ axes: { leftRight: true, topBottom: false, radial: false } })
    expect(cells(counterparts(sheet, on({ radial: true }), [at(3, 2)]))).toEqual([[3, 2], [3, 3]])
    expect(cells(counterparts(sheet, inMode('repeat'), [at(3, 2)]))).toEqual([[3, 2]])
    for (const position of layout.positions) expect(counterparts(sheet, inMode('mirror'), [at(position.row, position.column)]).dropped).toBe(0)
  })

  it('on a Fringe earring pairs the strands and the top\'s beads across its middle, every counterpart landing', () => {
    const { sheet, layout } = custom('fringeEarring', 7)
    expect(cells(counterparts(sheet, inMode('mirror'), [at(1000, 0)]))).toEqual([[1000, 0], [1000, 6]])
    expect(cells(counterparts(sheet, inMode('mirror'), [at(1, 0)]))).toEqual([[1, 0], [1, 5]])
    for (const position of layout.positions) expect(counterparts(sheet, inMode('mirror'), [at(position.row, position.column)]).dropped).toBe(0)
  })

  it('a turned Kite lies with its spine across, so its line is Top–bottom, still pairing the wings', () => {
    const turnedKite = custom('kite', 15, 1)
    expect(shapeAxesOf(turnedKite.project)).toEqual({ axes: { leftRight: false, topBottom: true, radial: false } })
    expect(cells(counterparts(turnedKite.sheet, inMode('mirror'), [at(3, 2)]))).toEqual([[3, 2], [3, 3]])
  })

  it('is set to the shape\'s own Axes when the Mirror moves onto it, with the side count as the Fold, and to Left–right when it moves off', () => {
    const { project } = custom('star', 3)
    const onStar = withMirrorPlace(project, WHOLE_FRAME)
    expect(mirrorSettingOf(onStar)).toMatchObject({ axes: { leftRight: false, topBottom: false, radial: true }, fold: 5, place: WHOLE_FRAME })
    const offStar = withMirrorPlace(onStar, onCanvas(area(0, 0, 4, 4)))
    expect(mirrorSettingOf(offStar).axes).toEqual({ leftRight: true, topBottom: false, radial: false })
    const afterClose = withMirrorPlace(withMirrorPlace(onStar, undefined), onCanvas(area(0, 0, 4, 4)))
    expect(mirrorSettingOf(afterClose).axes).toEqual({ leftRight: true, topBottom: false, radial: false })
  })
})
