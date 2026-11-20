import { describe, expect, it } from 'vitest'
import { withColors, type BeadChange } from './canvas'
import { createProject } from './createProject'
import { fillPreview, inFilledRegion, type FillPressReach } from './fillPress'
import { frameOf } from './layerRecord'
import { MIRROR_OFF, type MirrorSetting } from './mirror'
import type { Project } from './project'
import { moveToRow } from './rowProgress'
import { paintAt } from '../testUtils/layers'
import { withLayers } from '../testUtils/layerFields'

const fourWide = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
const leftRight: MirrorSetting = { ...MIRROR_OFF, mode: 'mirror', axes: { ...MIRROR_OFF.axes, leftRight: true }, place: { layer: 'frame' } }
const reach = (mirror: MirrorSetting = MIRROR_OFF, onScreen = { row: -10, column: -10, rows: 30, columns: 30 }): FillPressReach => ({ mirror, onScreen })

/** Two blue beads in the Frame's first row, from its first column. */
function twoBlue(project: Project): Project {
  const { row, column } = frameOf(project)!
  return paintAt(project, [{ row, column }, { row, column: column + 1 }], '#0000ff')
}

describe('fillPreview (ticket 1153)', () => {
  it('names every bead of the region a Fill would flood on the Frame, and no counterpart under the Mirror (ticket 1025)', () => {
    const project = twoBlue(fourWide())
    const { row, column } = frameOf(project)!
    const { cells } = fillPreview(project, { row, column, layer: 'frame', color: '#00ff00' }, reach(leftRight))
    expect(cells).toEqual([
      { row, column, layer: 'frame' },
      { row, column: column + 1, layer: 'frame' },
    ])
    expect(fillPreview(project, { row: row + 1, column, layer: 'frame', color: '#00ff00' }, reach(leftRight)).cells).toHaveLength(10)
  })

  it('stops at the edge of the Mirror\'s Canvas Area, as the Fill does', () => {
    const framed = withLayers(fourWide(), { frame: { ...frameOf(fourWide())!, row: 10, column: 10 } })
    const inArea: MirrorSetting = { ...leftRight, place: { layer: 'canvas', area: { row: 0, column: 0, rows: 25, columns: 13 } } }
    const painted = paintAt(framed, [{ row: 20, column: 12 }, { row: 20, column: 13 }], '#0000ff')
    expect(fillPreview(painted, { row: 20, column: 12, layer: 'canvas', color: '#00ff00' }, reach(inArea)).cells).toEqual([{ row: 20, column: 12 }])
    expect(fillPreview(painted, { row: 20, column: 13, layer: 'canvas', color: '#00ff00' }, reach(inArea)).cells).toEqual([{ row: 20, column: 13 }])
  })

  it('leaves out what Edit keeps: the rows marked done', () => {
    const project = moveToRow(fourWide(), 1)
    const { row, column } = frameOf(project)!
    const { cells } = fillPreview(project, { row: row + 2, column, layer: 'frame', color: '#00ff00' }, reach())
    expect(cells).toHaveLength(8)
    expect(cells.some((cell) => cell.row === row)).toBe(false)
  })

  it('names nothing for a Fill that changes nothing or that Fill reach refuses (ticket 0715)', () => {
    const project = twoBlue(fourWide())
    const { row, column } = frameOf(project)!
    expect(fillPreview(project, { row, column, layer: 'frame', color: '#0000ff' }, reach()).cells).toEqual([])
    // Empty space on the open Canvas that the screen does not hold whole.
    const far = withLayers(fourWide(), { frame: { ...frameOf(fourWide())!, row: 2000, column: 2000 }, beads: withColors({}, [] as BeadChange[]) })
    expect(fillPreview(far, { row: 5, column: 5, layer: 'canvas', color: '#00ff00' }, reach()).cells).toEqual([])
  })
})

describe('inFilledRegion (ticket 1153)', () => {
  it('holds for every bead the previewed Fill floods, and for no other', () => {
    const project = twoBlue(fourWide())
    const { row, column } = frameOf(project)!
    const { region } = fillPreview(project, { row, column, layer: 'frame', color: '#00ff00' }, reach())
    expect(inFilledRegion(project, region, 'frame', { row, column: column + 1 })).toBe(true)
    expect(inFilledRegion(project, region, 'frame', { row, column: column + 2 })).toBe(false)
    expect(inFilledRegion(project, project, 'frame', { row, column })).toBe(false)
  })

  it('holds where a refused Fill\'s flood reached, refused there alike, so the hover floods no more (ticket 0715)', () => {
    // A ring enclosing 501 x 501 empty positions, over the Fill cap, far from the Frame.
    const side = 503
    const ring: BeadChange[] = Array.from({ length: side }, (_cell, at) => [
      { row: 0, column: at, color: '#000000' },
      { row: side - 1, column: at, color: '#000000' },
      { row: at, column: 0, color: '#000000' },
      { row: at, column: side - 1, color: '#000000' },
    ]).flat()
    const project = withLayers(fourWide(), { frame: { ...frameOf(fourWide())!, row: 5000, column: 5000 }, beads: withColors({}, ring) })
    const big = reach(MIRROR_OFF, { row: -10, column: -10, rows: 600, columns: 600 })
    const { cells, region } = fillPreview(project, { row: 250, column: 250, layer: 'canvas', color: '#00ff00' }, big)
    expect(cells).toEqual([])
    expect(inFilledRegion(project, region, 'canvas', { row: 250, column: 251 })).toBe(true)
    expect(inFilledRegion(project, region, 'canvas', { row: 0, column: 0 })).toBe(false)
  })
})
