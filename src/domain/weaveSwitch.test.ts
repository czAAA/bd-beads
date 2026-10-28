// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { isInCurrentRow, isInFinishedRow, rowProgressPosition, toggleRowDirection } from './rowProgress'
import { normalizeProject } from './storedProject'
import type { Project } from './project'
import { withFrame } from './frame'
import { canvasWeave, frameWeave } from './layerWeave'
import { withWeave } from './weaveSwitch'

describe('a Frame woven in its own Technique (ticket 492)', () => {
  const canvasLoom = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
  /** A loom Canvas with a peyote Frame of 4 × 6 at (10, 10). */
  const peyoteOnLoom = (): Project => {
    const base = canvasLoom()
    return { ...base, frame: { ...base.frame!, technique: 'peyote', row: 10, column: 10 } }
  }

  it('is made in the Technique the Project was made in, and its Weave is the Frame\'s own', () => {
    const brick = createProject({ technique: 'brick', techniqueSettings: { brickBlock: 3 }, beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
    expect(brick.frame).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })
    expect(frameWeave(peyoteOnLoom())).toEqual({ technique: 'peyote' })
    expect(canvasWeave(peyoteOnLoom())).toEqual({ technique: 'loom' })
  })

  it('reads each layer\'s settings map, and keeps a Brick block off brick stitch for a switch back (tickets 0624, 0625)', () => {
    const brick = createProject({ technique: 'brick', techniqueSettings: { brickBlock: 3 }, beadId: 'toho-cube-1.5mm', size: { width: 4, height: 6, unit: 'beads' } })
    const netFrame = { ...brick, frame: { ...brick.frame!, technique: 'netting' as const, techniqueSettings: { netSize: 5 } } }
    expect(canvasWeave(netFrame)).toEqual({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })
    expect(frameWeave(netFrame)).toEqual({ technique: 'netting', techniqueSettings: { netSize: 5 } })
    // A Brick block kept off brick stitch, for a switch back, lays nothing out in loom.
    const loom = withWeave(brick, 'canvas', { technique: 'loom' })
    expect(canvasWeave(loom).techniqueSettings).toEqual({ brickBlock: 3 })
    expect(canvasWeave(withWeave(loom, 'canvas', { technique: 'brick' })).techniqueSettings).toEqual({ brickBlock: 3 })
  })

  it('counts a Canvas with no Frame in the Canvas\'s own Weave', () => {
    const { frame: _frame, ...open } = peyoteOnLoom()
    expect(frameWeave(open)).toEqual({ technique: 'loom' })
  })

  it('counts its rows, passes and size in its own Weave: peyote\'s first line takes one pass and every later one two', () => {
    const project = { ...peyoteOnLoom(), rowProgress: { direction: 'rows' as const, currentRow: 1, currentColumn: 0 } }
    expect(rowProgressPosition(project).total).toBe(11)
    // Row 0 is pass 0, done; row 1 is pass 1 on its even positions and pass 2 on its odd.
    expect(isInFinishedRow(project, { row: 10, column: 10 })).toBe(true)
    expect(isInFinishedRow(project, { row: 11, column: 10 })).toBe(false)
    expect(isInCurrentRow(project, { row: 11, column: 10 })).toBe(true)
  })

  it('is the Frame\'s own Weave that Turn row direction asks: a Netting Frame on a loom Canvas stays on rows', () => {
    const base = peyoteOnLoom()
    const netting = { ...base, frame: { ...base.frame!, technique: 'netting' as const } }
    expect(toggleRowDirection(netting)).toBe(netting)
    expect(toggleRowDirection({ ...base, frame: { ...base.frame!, technique: 'loom' as const } }).rowProgress.direction).toBe('columns')
  })

  it('switches the Canvas without touching the Frame, and the Frame without touching the Canvas', () => {
    const peyote = withWeave(canvasLoom(), 'canvas', { technique: 'peyote' })
    expect(peyote.technique).toBe('peyote')
    expect(peyote.frame?.technique).toBe('loom')
    const framePeyote = withWeave(canvasLoom(), 'frame', { technique: 'peyote' })
    expect(framePeyote.technique).toBe('loom')
    expect(framePeyote.frame?.technique).toBe('peyote')
  })

  it('keeps the Frame\'s Weave when it is resized, and gives a new one the Canvas\'s', () => {
    const resized = withFrame(peyoteOnLoom(), { row: 10, column: 10, rows: 8, columns: 4 })
    expect(resized.frame?.technique).toBe('peyote')
    const { frame: _frame, ...open } = withWeave(peyoteOnLoom(), 'canvas', { technique: 'brick' })
    expect(withFrame(open, { row: 0, column: 0, rows: 4, columns: 4 }).frame?.technique).toBe('brick')
  })

  it('moves its corner on the Canvas by as far as its own rows went, to the nearest position', () => {
    // Four rows of peyote (3/4 of a bead each) are three Canvas rows: dragging the top edge up by 4 moves the corner up 3.
    const grown = withFrame(peyoteOnLoom(), { row: 6, column: 10, rows: 10, columns: 4 })
    expect(grown.frame).toMatchObject({ row: 7, rows: 10 })
    // Alike, it is exactly the rectangle asked for.
    const alike = withFrame(withWeave(peyoteOnLoom(), 'canvas', { technique: 'peyote' }), { row: 6, column: 10, rows: 10, columns: 4 })
    expect(alike.frame).toMatchObject({ row: 6, rows: 10 })
  })

  it('reads a Frame stored without a Weave of its own as woven like the Project, and an unreadable one the same', () => {
    const base = withWeave(canvasLoom(), 'canvas', { technique: 'brick' })
    const { technique: _technique, ...bare } = base.frame!
    expect(normalizeProject({ ...base, brickBlock: 2, frame: bare as never }).frame).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 2 } })
    expect(normalizeProject({ ...base, frame: { ...base.frame!, technique: 'sideways' as never } }).frame?.technique).toBe('brick')
  })

  it('keeps a Frame\'s own Weave when it is read back', () => {
    expect(normalizeProject(peyoteOnLoom()).frame?.technique).toBe('peyote')
  })
})
