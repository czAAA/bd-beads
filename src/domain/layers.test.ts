// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from './canvas'
import { layerAt, onLayer, positionInLayer, positionOnCanvas, shownBeads } from './layers'
import { beadColorAt } from './layerBeads'
import { createProject } from './createProject'
import { fillArea } from './fill'
import { paintCells } from './drawing'
import type { Project } from './project'

const RED = '#e63746'
const BLUE = '#2f6fed'

/** A 4 x 3 Frame at (10, 20) holding blue at its first bead, over a Canvas holding blue under the Frame and one beyond. */
function layered(): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 3, unit: 'beads' } })
  return {
    ...base,
    beads: withColors({}, [{ row: 11, column: 21, color: BLUE }, { row: 50, column: 50, color: BLUE }]),
    frame: { technique: 'loom' as const, row: 10, column: 20, rows: 3, columns: 4, beads: withColors({}, [{ row: 0, column: 0, color: BLUE }]) },
  }
}

describe('layerAt', () => {
  it('is the Frame inside its rectangle and the Canvas anywhere else', () => {
    const project = layered()
    expect(layerAt(project, { row: 10, column: 20 })).toBe('frame')
    expect(layerAt(project, { row: 12, column: 23 })).toBe('frame')
    expect(layerAt(project, { row: 13, column: 20 })).toBe('canvas')
    expect(layerAt(project, { row: 10, column: 24 })).toBe('canvas')
    expect(layerAt({ ...project, frame: undefined }, { row: 10, column: 20 })).toBe('canvas')
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
    expect(painted.frame!.beads[1]).toEqual({ 2: RED })
    expect(painted.beads).toBe(project.beads)
    expect(beadColorAt(painted, 11, 22)).toBe(RED)
  })

  it('paints the Canvas and leaves the Frame as it was', () => {
    const project = layered()
    const painted = onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 30, column: 30 }], RED))
    expect(painted.beads[30]).toEqual({ 30: RED })
    expect(painted.frame).toBe(project.frame)
  })

  it('does not change the Canvas under the Frame: what lies there stays hidden, untouched', () => {
    const project = layered()
    const painted = onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 11, column: 21 }, { row: 30, column: 30 }], RED))
    expect(painted.beads[11]).toEqual({ 21: BLUE })
    expect(painted.beads[30]).toEqual({ 30: RED })
  })

  it('hands back the Project itself when the command changed nothing, or only what is under the Frame', () => {
    const project = layered()
    expect(onLayer(project, 'frame', (view) => view)).toBe(project)
    expect(onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 11, column: 21 }], RED))).toBe(project)
  })

  it('gives the view of the Frame a Frame of its own at the origin, for Mirror and Fill to work on', () => {
    const project = layered()
    const filled = onLayer(project, 'frame', (view) => fillArea(view, 2, 3, RED))
    // Fill stops at the Frame's edge: its twelve beads but the blue one.
    expect(Object.values(filled.frame!.beads).reduce((sum, row) => sum + Object.keys(row).length, 0)).toBe(12)
    expect(filled.frame!.beads[0]![0]).toBe(BLUE)
    expect(filled.beads).toBe(project.beads)
  })

  it('does nothing on the Frame\'s layer when there is no Frame', () => {
    const { frame: _frame, ...bare } = layered()
    expect(onLayer(bare, 'frame', (view) => paintCells(view, [{ row: 0, column: 0 }], RED))).toBe(bare)
  })
})

describe('shownBeads', () => {
  it('lays the Frame\'s beads over the Canvas, hiding what lies under the Frame', () => {
    expect(shownBeads(layered())).toEqual(withColors({}, [{ row: 10, column: 20, color: BLUE }, { row: 50, column: 50, color: BLUE }]))
  })

  it('is the Canvas\'s own map when there is no Frame', () => {
    const { frame: _frame, ...bare } = layered()
    expect(shownBeads(bare)).toBe(bare.beads)
  })
})

describe('the Frame as a layer woven in its own Technique (ticket 492)', () => {
  it('hands a command the Frame\'s Weave, not the Canvas\'s', () => {
    const base = layered()
    const project: Project = { ...base, technique: 'brick', techniqueSettings: { brickBlock: 3 }, frame: { ...base.frame!, technique: 'peyote' } }
    const seen: Project[] = []
    onLayer(project, 'frame', (view) => {
      seen.push(view)
      return view
    })
    expect(seen[0]).toMatchObject({ technique: 'peyote', frame: { technique: 'peyote' } })
    expect(seen[0]).not.toHaveProperty('techniqueSettings')
  })

  it('hands a command the Canvas\'s Weave for the Canvas', () => {
    const base = layered()
    const project: Project = { ...base, technique: 'brick', techniqueSettings: { brickBlock: 3 }, frame: { ...base.frame!, technique: 'peyote' } }
    const seen: Project[] = []
    onLayer(project, 'canvas', (view) => {
      seen.push(view)
      return view
    })
    expect(seen[0]).toMatchObject({ technique: 'brick', techniqueSettings: { brickBlock: 3 } })
  })
})

describe('a Frame that draws shorter than the rows it names (ADR 0066)', () => {
  // 48 peyote rows over a loom Canvas: the Frame covers the first 36 Canvas rows, the other 12 it names are Canvas.
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 11, height: 48, unit: 'beads' } })
  const project: Project = { ...base, frame: { technique: 'peyote' as const, row: 0, column: 0, rows: 48, columns: 11, beads: withColors({}, [{ row: 40, column: 2, color: BLUE }]) } }

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
    expect(painted.frame!.beads).toBe(project.frame!.beads)
  })

  it('draws on the Frame\'s own last rows, which share a position with the strip', () => {
    const painted = onLayer(project, 'frame', (view, local) => paintCells(view, [local({ row: 41, column: 2 })], RED))
    expect(painted.frame!.beads[41]?.[2]).toBe(RED)
    expect(painted.beads).toBe(project.beads)
  })
})
