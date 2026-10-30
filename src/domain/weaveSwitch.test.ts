// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { isInCurrentRow, isInFinishedRow, rowProgressPosition } from './rowProgress'
import { normalizeProject } from './storedProject'
import type { Project } from './project'
import { withFrame } from './frame'
import { canvasWeave, frameWeave } from './layerWeave'
import { withWeave } from './weaveSwitch'
import { beadCell, rowCycle } from './weave'
import { findBead } from './beads'
import { canvasOf, frameOf, withFrameSheet } from './layerRecord'
import { withLayers } from '../testUtils/layerFields'

describe('a Frame woven in its own Technique (ticket 492)', () => {
  /** The cube's real cell, which every layer of these Projects draws (ticket 0724). */
  const cell = beadCell(findBead('toho-cube-1.5mm'))
  const canvasLoom = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  /** A loom Canvas with a peyote Frame of 4 × 6 at (10, 10). */
  const peyoteOnLoom = (): Project => {
    const base = canvasLoom()
    return withLayers(base, { frame: { ...frameOf(base)!, technique: 'peyote', row: 10, column: 10 } })
  }

  it('is made in the Technique the Project was made in, and its Weave is the Frame\'s own', () => {
    const brick = createProject({ technique: 'brick', techniqueSettings: { brickDrop: 3 }, beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
    expect(frameOf(brick)).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 3 } })
    expect(frameWeave(peyoteOnLoom())).toEqual({ technique: 'peyote', techniqueSettings: { peyoteDrop: 1 }, cell })
    expect(canvasWeave(peyoteOnLoom())).toEqual({ technique: 'loom', cell })
  })

  it('reads each layer\'s settings map, and keeps brick stitch\'s Drop off it for a switch back (tickets 0624, 0625)', () => {
    const brick = createProject({ technique: 'brick', techniqueSettings: { brickDrop: 3 }, beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
    const brickFrame = withLayers(brick, { technique: 'peyote' as const, techniqueSettings: {}, frame: { ...frameOf(brick)!, techniqueSettings: { brickDrop: 5 } } })
    expect(canvasWeave(brickFrame)).toEqual({ technique: 'peyote', techniqueSettings: { peyoteDrop: 1 }, cell })
    expect(frameWeave(brickFrame)).toEqual({ technique: 'brick', techniqueSettings: { brickDrop: 5 }, cell })
    // Brick stitch's Drop kept off it, for a switch back, lays nothing out in loom.
    const loom = withWeave(brick, 'canvas', { technique: 'loom' })
    expect(canvasWeave(loom).techniqueSettings).toEqual({ brickDrop: 3 })
    expect(canvasWeave(withWeave(loom, 'canvas', { technique: 'brick' })).techniqueSettings).toEqual({ brickDrop: 3 })
  })

  it('keeps peyote\'s Drop and brick stitch\'s each its own when the Technique is switched away and back (ticket 0691)', () => {
    const brick = createProject({ technique: 'brick', techniqueSettings: { brickDrop: 3 }, beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
    const peyote = withWeave(brick, 'canvas', { technique: 'peyote', techniqueSettings: { brickDrop: 3, peyoteDrop: 2 } })
    expect(canvasWeave(peyote).techniqueSettings).toEqual({ brickDrop: 3, peyoteDrop: 2 })
    expect(rowCycle(canvasWeave(peyote))).toBe(4)
    const back = withWeave(withWeave(peyote, 'canvas', { technique: 'loom' }), 'canvas', { technique: 'brick' })
    expect(rowCycle(canvasWeave(back))).toBe(6)
    expect(rowCycle(canvasWeave(withWeave(back, 'canvas', { technique: 'peyote' })))).toBe(4)
  })

  it('counts a Canvas with no Frame in the Canvas\'s own Weave', () => {
    const open = withFrameSheet(peyoteOnLoom(), undefined)
    expect(frameWeave(open)).toEqual({ technique: 'loom', cell })
  })

  it('counts its rows, passes and size in its own Weave: peyote\'s first line takes one pass and every later one two', () => {
    const project = withLayers(peyoteOnLoom(), { rowProgress: { direction: 'rows' as const, currentRow: 1, currentColumn: 0 } })
    expect(rowProgressPosition(project).total).toBe(11)
    // Row 0 is pass 0, done; row 1 is pass 1 on its even positions and pass 2 on its odd.
    expect(isInFinishedRow(project, { row: 10, column: 10 })).toBe(true)
    expect(isInFinishedRow(project, { row: 11, column: 10 })).toBe(false)
    expect(isInCurrentRow(project, { row: 11, column: 10 })).toBe(true)
  })

  it('switches the Canvas without touching the Frame, and the Frame without touching the Canvas', () => {
    const peyote = withWeave(canvasLoom(), 'canvas', { technique: 'peyote' })
    expect(canvasOf(peyote).technique).toBe('peyote')
    expect(frameOf(peyote)?.technique).toBe('loom')
    const framePeyote = withWeave(canvasLoom(), 'frame', { technique: 'peyote' })
    expect(canvasOf(framePeyote).technique).toBe('loom')
    expect(frameOf(framePeyote)?.technique).toBe('peyote')
  })

  it('keeps the Frame\'s Weave when it is resized, and gives a new one the Canvas\'s', () => {
    const resized = withFrame(peyoteOnLoom(), { row: 10, column: 10, rows: 8, columns: 4 })
    expect(frameOf(resized)?.technique).toBe('peyote')
    const open = withFrameSheet(withWeave(peyoteOnLoom(), 'canvas', { technique: 'brick' }), undefined)
    expect(frameOf(withFrame(open, { row: 0, column: 0, rows: 4, columns: 4 }))?.technique).toBe('brick')
  })

  it('moves its corner on the Canvas by as far as its own rows went, to the nearest position', () => {
    // Four rows of peyote (3/4 of a bead each) are three Canvas rows: dragging the top edge up by 4 moves the corner up 3.
    const grown = withFrame(peyoteOnLoom(), { row: 6, column: 10, rows: 10, columns: 4 })
    expect(frameOf(grown)).toMatchObject({ row: 7, rows: 10 })
    // Alike, it is exactly the rectangle asked for.
    const alike = withFrame(withWeave(peyoteOnLoom(), 'canvas', { technique: 'peyote' }), { row: 6, column: 10, rows: 10, columns: 4 })
    expect(frameOf(alike)).toMatchObject({ row: 6, rows: 10 })
  })

  it('reads a Frame stored without a Weave of its own as woven like the Project, and an unreadable one the same', () => {
    const base = withWeave(canvasLoom(), 'canvas', { technique: 'brick' })
    const { technique: _technique, ...bare } = frameOf(base)!
    expect(frameOf(normalizeProject(withLayers(base, { techniqueSettings: { brickDrop: 2 }, frame: bare as never })))).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 2 } })
    expect(frameOf(normalizeProject(withLayers(base, { frame: { ...frameOf(base)!, technique: 'sideways' as never } })))?.technique).toBe('brick')
  })

  it('keeps a Frame\'s own Weave when it is read back', () => {
    expect(frameOf(normalizeProject(peyoteOnLoom()))?.technique).toBe('peyote')
  })
})
