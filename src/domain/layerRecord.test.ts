// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadCopy, findBead } from './beads'
import { changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { layerOf, withLayer } from './layerRecord'
import type { Project } from './project'
import { beadCell } from './weave'

const RED = '#ff0000'
const BLUE = '#0000ff'
const delica = findBead('miyuki-delica-11-0')!
const cube = findBead('toho-cube-1.5mm')!

/** A brick Canvas holding a red bead, under a peyote Frame named Rose holding a blue one. */
const framed = (): Project => {
  const made = createProject({ name: 'Garden', technique: 'brick', techniqueSettings: { brickBlock: 3 }, beadId: delica.id, size: { width: 4, height: 4, unit: 'beads' } })
  return { ...made, beads: { 9: { 9: RED } }, frame: { ...made.frame!, technique: 'peyote', techniqueSettings: {}, beads: { 1: { 2: BLUE } }, name: 'Rose' } }
}

const open = (): Project => {
  const { frame: _frame, ...project } = framed()
  return project
}

describe('a layer read as one record (ADR 0079, ticket 0661)', () => {
  it('reads the Canvas from the Project: its Weave, Bead, Bead shape, beads and the Project\'s name', () => {
    expect(layerOf(framed(), 'canvas')).toEqual({
      weave: { technique: 'brick', techniqueSettings: { brickBlock: 3 } },
      beadId: delica.id,
      bead: beadCopy(delica),
      beadShape: 'symmetric',
      beads: { 9: { 9: RED } },
      name: 'Garden',
    })
  })

  it('reads the Frame from its sheet, with the Project\'s Bead and Bead shape', () => {
    expect(layerOf({ ...framed(), beadShape: 'real' }, 'frame')).toEqual({
      weave: { technique: 'peyote', cell: beadCell(delica, 'real') },
      beadId: delica.id,
      bead: beadCopy(delica),
      beadShape: 'real',
      beads: { 1: { 2: BLUE } },
      name: 'Rose',
    })
  })

  it('reads an unnamed Frame without a name, and no Frame on a Canvas without one', () => {
    const { name: _name, ...unnamed } = framed().frame!
    expect(layerOf({ ...framed(), frame: unnamed }, 'frame')).not.toHaveProperty('name')
    expect(layerOf(open(), 'frame')).toBeUndefined()
    expect(layerOf(open(), 'canvas').beads).toEqual({ 9: { 9: RED } })
  })

  it('reads a Custom frame\'s own beads and Weave', () => {
    const project = triangle()
    const layer = layerOf(project, 'frame')!
    expect(layer.weave.technique).toBe('peyote')
    expect(layer.beads).toBe(project.frame!.beads)
    expect(layerOf(project, 'canvas').beads).toEqual({ 9: { 9: RED } })
  })
})

/** The open Canvas with a Triangle Custom frame laid on it. */
function triangle(): Project {
  const result = changeFrame(open(), { custom: { shape: 'triangle', size: 3, centre: { row: 20, column: 30 } } })
  if (result.kind !== 'changed') throw new Error('expected a Custom frame')
  return result.project
}

describe('a layer written through the same record (ADR 0079, ticket 0661)', () => {
  it('writes the Canvas\'s Weave, beads and name into the Project\'s own fields, leaving the Frame as it was', () => {
    const before = framed()
    const after = withLayer(before, 'canvas', { weave: { technique: 'loom' }, beads: { 0: { 0: BLUE } }, name: 'Meadow' })
    expect(after).toMatchObject({ technique: 'loom', beads: { 0: { 0: BLUE } }, name: 'Meadow', frame: before.frame })
    expect(after).not.toHaveProperty('techniqueSettings')
  })

  it('writes the Frame\'s Weave, beads and name onto its sheet, leaving the Canvas as it was', () => {
    const before = framed()
    const after = withLayer(before, 'frame', { weave: { technique: 'brick', techniqueSettings: { brickBlock: 2 } }, beads: { 0: { 0: RED } }, name: 'Lily' })
    expect(after.frame).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 2 }, beads: { 0: { 0: RED } }, name: 'Lily', row: before.frame!.row })
    expect(after).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 }, beads: before.beads, name: 'Garden' })
  })

  it('keeps a Weave\'s cell out of what it stores, and clears a Frame\'s name with an empty one', () => {
    const after = withLayer(framed(), 'frame', { weave: { technique: 'loom', cell: beadCell(delica, 'real') }, name: '' })
    expect(after.frame).not.toHaveProperty('cell')
    expect(after.frame).not.toHaveProperty('name')
  })

  it('writes a layer\'s Bead and Bead shape into the Project\'s, which both layers share for now', () => {
    const after = withLayer(framed(), 'frame', { bead: cube, beadShape: 'real' })
    expect(after).toMatchObject({ beadId: cube.id, bead: beadCopy(cube), beadShape: 'real' })
    expect(layerOf(after, 'canvas')).toMatchObject({ beadId: cube.id, beadShape: 'real' })
    expect(withLayer(after, 'canvas', { beadShape: 'symmetric' })).not.toHaveProperty('beadShape')
  })

  it('writes a Custom frame\'s beads and Weave, keeping its Frame shape, settings and place', () => {
    const before = triangle()
    const after = withLayer(before, 'frame', { weave: { technique: 'loom' }, beads: { 0: { 0: RED } } })
    const { shape, settings, row, column } = before.frame!
    expect(after.frame).toMatchObject({ technique: 'loom', beads: { 0: { 0: RED } }, shape, settings, row, column })
  })

  it('leaves the change unstamped, for the caller to stamp', () => {
    const before = framed()
    expect(withLayer(before, 'canvas', { beads: {} }).updatedAt).toBe(before.updatedAt)
  })

  it('leaves a Project without a Frame as it is when the Frame is written', () => {
    const project = open()
    expect(withLayer(project, 'frame', { beads: { 0: { 0: RED } } })).toBe(project)
  })
})
