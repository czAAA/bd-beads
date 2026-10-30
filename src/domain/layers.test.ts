// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from './canvas'
import { layerAt, onLayer, positionInLayer, positionOnCanvas, shownBeads, type LayerSheet } from './layers'
import { beadColorAt } from './layerBeads'
import { createProject } from './createProject'
import { fillArea } from './fill'
import { paintCells } from './drawing'
import type { Project } from './project'
import { beadsOfLayer, frameOf, withFrameSheet } from './layerRecord'
import { withLayers } from '../testUtils/layerFields'

const RED = '#e63746'
const BLUE = '#2f6fed'

/** A 4 x 3 Frame at (10, 20) holding blue at its first bead, over a Canvas holding blue under the Frame and one beyond. */
function layered(): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
  return withLayers(base, {
beads: withColors({}, [{ row: 11, column: 21, color: BLUE }, { row: 50, column: 50, color: BLUE }]),
    frame: { technique: 'loom' as const, row: 10, column: 20, rows: 3, columns: 4, beads: withColors({}, [{ row: 0, column: 0, color: BLUE }]) },
})
}

describe('layerAt', () => {
  it('is the Frame inside its rectangle and the Canvas anywhere else', () => {
    const project = layered()
    expect(layerAt(project, { row: 10, column: 20 })).toBe('frame')
    expect(layerAt(project, { row: 12, column: 23 })).toBe('frame')
    expect(layerAt(project, { row: 13, column: 20 })).toBe('canvas')
    expect(layerAt(project, { row: 10, column: 24 })).toBe('canvas')
    expect(layerAt(withLayers(project, { frame: undefined }), { row: 10, column: 20 })).toBe('canvas')
  })

  it('counts a position in the Frame from its first bead, and back', () => {
    const project = layered()
    expect(positionInLayer(project, 'frame', { row: 11, column: 22 })).toEqual({ row: 1, column: 2 })
    expect(positionOnCanvas(project, 'frame', { row: 1, column: 2 })).toEqual({ row: 11, column: 22 })
    expect(positionInLayer(project, 'canvas', { row: 11, column: 22 })).toEqual({ row: 11, column: 22 })
  })
})

describe('onLayer', () => {
  it('paints the Frame\'s own beads in its own coordinates and leaves the Canvas as it was', () => {
    const project = layered()
    const painted = onLayer(project, 'frame', (view, local) => paintCells(view, [local({ row: 11, column: 22 })], RED))
    expect(frameOf(painted)!.beads[1]).toEqual({ 2: RED })
    expect(beadsOfLayer(painted, 'canvas')).toBe(beadsOfLayer(project, 'canvas'))
    expect(beadColorAt(painted, 11, 22)).toBe(RED)
  })

  it('paints the Canvas and leaves the Frame as it was', () => {
    const project = layered()
    const painted = onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 30, column: 30 }], RED))
    expect(beadsOfLayer(painted, 'canvas')[30]).toEqual({ 30: RED })
    expect(frameOf(painted)).toBe(frameOf(project))
  })

  it('does not change the Canvas under the Frame: what lies there stays hidden, untouched', () => {
    const project = layered()
    const painted = onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 11, column: 21 }, { row: 30, column: 30 }], RED))
    expect(beadsOfLayer(painted, 'canvas')[11]).toEqual({ 21: BLUE })
    expect(beadsOfLayer(painted, 'canvas')[30]).toEqual({ 30: RED })
  })

  it('paints the Canvas under the Frame, hidden, at the positions the command lets through (a Mirror counterpart, ticket 0704) and keeps the rest', () => {
    const project = layered()
    const painted = onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 11, column: 21 }, { row: 11, column: 22 }], RED), { underFrame: ({ column }) => column === 21 })
    expect(beadsOfLayer(painted, 'canvas')[11]).toEqual({ 21: RED })
    expect(beadColorAt(painted, 11, 21)).toBeNull()
  })

  it('hands back the Project itself when the command changed nothing, or only what is under the Frame', () => {
    const project = layered()
    expect(onLayer(project, 'frame', (sheet) => sheet.beads)).toBe(project)
    expect(onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 11, column: 21 }], RED))).toBe(project)
  })

  it('hands a command the Frame counted from its own first bead, with its own edge, for Fill to stop at', () => {
    const project = layered()
    const filled = onLayer(project, 'frame', (view) => fillArea(view, 2, 3, RED))
    // Fill stops at the Frame's edge: its twelve beads but the blue one.
    expect(Object.values(frameOf(filled)!.beads).reduce((sum, row) => sum + Object.keys(row).length, 0)).toBe(12)
    expect(frameOf(filled)!.beads[0]![0]).toBe(BLUE)
    expect(beadsOfLayer(filled, 'canvas')).toBe(beadsOfLayer(project, 'canvas'))
  })

  it('does nothing on the Frame\'s layer when there is no Frame', () => {
    const bare = withFrameSheet(layered(), undefined)
    expect(onLayer(bare, 'frame', (view) => paintCells(view, [{ row: 0, column: 0 }], RED))).toBe(bare)
  })
})

describe('shownBeads', () => {
  it('lays the Frame\'s beads over the Canvas, hiding what lies under the Frame', () => {
    expect(shownBeads(layered())).toEqual(withColors({}, [{ row: 10, column: 20, color: BLUE }, { row: 50, column: 50, color: BLUE }]))
  })

  it('is the Canvas\'s own map when there is no Frame', () => {
    const bare = withFrameSheet(layered(), undefined)
    expect(shownBeads(bare)).toBe(beadsOfLayer(bare, 'canvas'))
  })
})

describe('the Frame as a layer woven in its own Technique (ticket 492)', () => {
  it('hands a command the Frame\'s Weave, not the Canvas\'s', () => {
    const base = layered()
    const project: Project = withLayers(base, { technique: 'brick', techniqueSettings: { brickDrop: 3 }, frame: { ...frameOf(base)!, technique: 'peyote' } })
    const seen: LayerSheet[] = []
    onLayer(project, 'frame', (sheet) => {
      seen.push(sheet)
      return sheet.beads
    })
    expect(seen[0]).toMatchObject({ weave: { technique: 'peyote' }, frame: { technique: 'peyote' }, edge: { row: 0, column: 0, rows: 3, columns: 4 } })
    expect(seen[0]!.weave.techniqueSettings).toEqual({ peyoteDrop: 1 })
  })

  it('hands a command the Canvas\'s Weave for the Canvas', () => {
    const base = layered()
    const project: Project = withLayers(base, { technique: 'brick', techniqueSettings: { brickDrop: 3 }, frame: { ...frameOf(base)!, technique: 'peyote' } })
    const seen: LayerSheet[] = []
    onLayer(project, 'canvas', (sheet) => {
      seen.push(sheet)
      return sheet.beads
    })
    expect(seen[0]).toMatchObject({ weave: { technique: 'brick', techniqueSettings: { brickDrop: 3 } } })
    expect(seen[0]).not.toHaveProperty('edge')
  })
})

describe('a Frame that draws shorter than the rows it names (ADR 0066)', () => {
  // 48 peyote rows over a loom Canvas: the Frame covers the first 36 Canvas rows, the other 12 it names are Canvas.
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 11, height: 48, unit: 'beads' } })
  const project: Project = withLayers(base, { frame: { technique: 'peyote' as const, row: 0, column: 0, rows: 48, columns: 11, beads: withColors({}, [{ row: 40, column: 2, color: BLUE }]) } })

  it('says a position under the drawing is the Frame\'s, and one in the strip the Canvas\'s', () => {
    expect(layerAt(project, { row: 20, column: 3 })).toBe('frame')
    expect(layerAt(project, { row: 40, column: 3 })).toBe('canvas')
  })

  it('takes the layer a pointer hit named over what the position says', () => {
    expect(layerAt(project, { row: 40, column: 2, layer: 'frame' })).toBe('frame')
    expect(layerAt(project, { row: 20, column: 3, layer: 'canvas' })).toBe('canvas')
  })

  it('lets a bead be drawn in the strip and keeps it, as the Canvas\'s', () => {
    const painted = onLayer(project, 'canvas', (view, local) => paintCells(view, [local({ row: 44, column: 3 })], RED))
    expect(beadColorAt(painted, 44, 3, 'canvas')).toBe(RED)
    expect(frameOf(painted)!.beads).toBe(frameOf(project)!.beads)
  })

  it('draws on the Frame\'s own last rows, which share a position with the strip', () => {
    const painted = onLayer(project, 'frame', (view, local) => paintCells(view, [local({ row: 41, column: 2 })], RED))
    expect(frameOf(painted)!.beads[41]?.[2]).toBe(RED)
    expect(beadsOfLayer(painted, 'canvas')).toBe(beadsOfLayer(project, 'canvas'))
  })
})
