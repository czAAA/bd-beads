// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadCopy, findBead } from './beads'
import { changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { beadIdOfLayer, beadOfLayer, beadsOfLayer, canvasOf, frameOf, heldWeave, layerOf, lettersOn, withFrameSheet, withLayer, withLetters, withPieceNames } from './layerRecord'
import type { Project } from './project'
import { beadCell } from './weave'
import { withFields } from '../testUtils/flatFields'

const RED = '#ff0000'
const BLUE = '#0000ff'
const delica = findBead('miyuki-delica-11-0')!
const cube = findBead('toho-cube-1.5mm')!

/** A brick Canvas holding a red bead, under a peyote Frame named Rose holding a blue one. */
const framed = (): Project => {
  const made = createProject({ name: 'Garden', technique: 'brick', techniqueSettings: { brickBlock: 3 }, beadId: delica.id, size: { width: 4, height: 4, unit: 'beads' } })
  return withFields(made, { beads: { 9: { 9: RED } }, frame: { ...frameOf(made)!, technique: 'peyote', techniqueSettings: {}, beads: { 1: { 2: BLUE } }, name: 'Rose' } })
}

const open = (): Project => {
  const project = withFrameSheet(framed(), undefined)
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
    expect(layerOf(withFields(framed(), { beadShape: 'real' }), 'frame')).toEqual({
      weave: { technique: 'peyote', cell: beadCell(delica, 'real') },
      beadId: delica.id,
      bead: beadCopy(delica),
      beadShape: 'real',
      beads: { 1: { 2: BLUE } },
      name: 'Rose',
    })
  })

  it('reads an unnamed Frame without a name, and no Frame on a Canvas without one', () => {
    const { name: _name, ...unnamed } = frameOf(framed())!
    expect(layerOf(withFields(framed(), { frame: unnamed }), 'frame')).not.toHaveProperty('name')
    expect(layerOf(open(), 'frame')).toBeUndefined()
    expect(layerOf(open(), 'canvas').beads).toEqual({ 9: { 9: RED } })
  })

  it('reads a Custom frame\'s own beads and Weave', () => {
    const project = triangle()
    const layer = layerOf(project, 'frame')!
    expect(layer.weave.technique).toBe('peyote')
    expect(layer.beads).toBe(frameOf(project)!.beads)
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
  it('writes the Canvas\'s Weave, beads and name into the first layer, leaving the Frame as it was (ticket 0664)', () => {
    const before = framed()
    const after = withLayer(before, 'canvas', { weave: { technique: 'loom' }, beads: { 0: { 0: BLUE } }, name: 'Meadow' })
    expect(canvasOf(after)).toMatchObject({ technique: 'loom', beads: { 0: { 0: BLUE } }, name: 'Meadow' })
    expect(canvasOf(after)).not.toHaveProperty('techniqueSettings')
    expect(frameOf(after)).toBe(frameOf(before))
  })

  it('writes the Frame\'s Weave, beads and name into its layer, leaving the Canvas as it was', () => {
    const before = framed()
    const after = withLayer(before, 'frame', { weave: { technique: 'brick', techniqueSettings: { brickBlock: 2 } }, beads: { 0: { 0: RED } }, name: 'Lily' })
    expect(frameOf(after)).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 2 }, beads: { 0: { 0: RED } }, name: 'Lily', row: frameOf(before)!.row })
    expect(canvasOf(after)).toBe(canvasOf(before))
  })

  it('keeps a Weave\'s cell out of what it stores, and clears a Frame\'s name with an empty one', () => {
    const after = withLayer(framed(), 'frame', { weave: { technique: 'loom', cell: beadCell(delica, 'real') }, name: '' })
    expect(frameOf(after)).not.toHaveProperty('cell')
    expect(frameOf(after)).not.toHaveProperty('name')
  })

  it('writes a layer\'s Bead and Bead shape into every layer, which share them until ticket 0665', () => {
    const after = withLayer(framed(), 'frame', { bead: cube, beadShape: 'real' })
    expect(frameOf(after)).toMatchObject({ beadId: cube.id, bead: beadCopy(cube), beadShape: 'real' })
    expect(canvasOf(after)).toMatchObject({ beadId: cube.id, bead: beadCopy(cube), beadShape: 'real' })
    const symmetric = withLayer(after, 'canvas', { beadShape: 'symmetric' })
    expect(symmetric.layers.some((layer) => 'beadShape' in layer)).toBe(false)
  })

  it('writes a Custom frame\'s beads and Weave, keeping its Frame shape, settings and place', () => {
    const before = triangle()
    const after = withLayer(before, 'frame', { weave: { technique: 'loom' }, beads: { 0: { 0: RED } } })
    const { shape, settings, row, column } = frameOf(before)!
    expect(frameOf(after)).toMatchObject({ technique: 'loom', beads: { 0: { 0: RED } }, shape, settings, row, column })
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

describe('a layer\'s parts read from less than a whole Project (ticket 0662)', () => {
  it('reads each layer\'s beads as its record holds them, and none for a Frame the Project lacks', () => {
    const project = framed()
    expect(beadsOfLayer(project, 'canvas')).toBe(layerOf(project, 'canvas').beads)
    expect(beadsOfLayer(project, 'frame')).toBe(layerOf(project, 'frame')!.beads)
    expect(beadsOfLayer(open(), 'frame')).toBeUndefined()
  })

  it('reads the Bead, its id and Bead shape both layers share, Symmetric where none is saved', () => {
    const project = withFields(framed(), { beadShape: 'real' })
    expect(beadOfLayer(project, 'frame')).toEqual({ bead: beadCopy(delica), beadShape: 'real' })
    expect(beadIdOfLayer(project, 'canvas')).toBe(delica.id)
    expect(beadOfLayer(open(), 'canvas')).toEqual({ bead: beadCopy(delica), beadShape: 'symmetric' })
  })

  it('reads a layer\'s Weave as held, without the cell its Bead draws it in', () => {
    const project = withFields(framed(), { beadShape: 'real' })
    expect(heldWeave(project, 'canvas')).toEqual({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })
    expect(heldWeave(project, 'frame')).toEqual({ technique: 'peyote' })
    expect(heldWeave(open(), 'frame')).toBeUndefined()
  })
})

describe('the layer list (ADR 0079, ticket 0664)', () => {
  it('lays a Frame anew as a copy of the Canvas\'s Bead and Letters, at the first row, under an id of its own', () => {
    const canvas = withLetters(withLayer(open(), 'canvas', { bead: cube, beadShape: 'real' }), true)
    const laid = withFrameSheet(canvas, { row: 1, column: 1, rows: 2, columns: 2, technique: 'loom', beads: {} })
    expect(frameOf(laid)).toMatchObject({ beadId: cube.id, bead: beadCopy(cube), beadShape: 'real', letters: true, rowProgress: { direction: 'rows', currentRow: 0, currentColumn: 0 } })
    expect(frameOf(laid)!.id).not.toBe(canvasOf(laid).id)
  })

  it('keeps a Frame\'s id, Bead, Letters and Row progress when its sheet is laid again, and removes it with none', () => {
    const before = withFields(framed(), { rowProgress: { direction: 'columns', currentRow: 0, currentColumn: 2 } })
    const moved = withFrameSheet(before, { row: 5, column: 5, rows: 2, columns: 2, technique: 'loom', beads: {} })
    const { id, beadId, rowProgress } = frameOf(before)!
    expect(frameOf(moved)).toMatchObject({ id, beadId, rowProgress, row: 5 })
    expect(frameOf(moved)).not.toHaveProperty('name')
    expect(withFrameSheet(before, undefined).layers).toEqual([canvasOf(before)])
  })

  it('reads the Letters switch from the Frame when there is one, else the Canvas, and sets it on every layer', () => {
    const on = withLetters(framed(), true)
    expect(on.layers.every((layer) => layer.letters === true)).toBe(true)
    expect(lettersOn(on)).toBe(true)
    expect(lettersOn(withFields(on, { frame: { ...frameOf(on)!, letters: undefined } }))).toBe(false)
    expect(lettersOn(withLetters(open(), true))).toBe(true)
  })

  it('leaves an empty list of Piece names unsaved', () => {
    const named = withPieceNames(open(), [{ name: 'Fox', row: 9, column: 9 }])
    expect(canvasOf(named).pieceNames).toEqual([{ name: 'Fox', row: 9, column: 9 }])
    expect(canvasOf(withPieceNames(named, []))).not.toHaveProperty('pieceNames')
  })
})
