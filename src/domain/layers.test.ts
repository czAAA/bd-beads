// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from './canvas'
import { layerAt, onLayer, positionInLayer, positionOnCanvas, shownBeads } from './layers'
import { beadColorAt, createProject, fillArea, paintCells, type Project } from './project'

const NONE = { columns: 0, rows: 0 }
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
    expect(layerAt({ frame: undefined }, { row: 10, column: 20 })).toBe('canvas')
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
    const painted = onLayer(project, 'frame', (view, local) => paintCells(view, [local({ row: 11, column: 22 })], RED, NONE))
    expect(painted.frame!.beads[1]).toEqual({ 2: RED })
    expect(painted.beads).toBe(project.beads)
    expect(beadColorAt(painted, 11, 22)).toBe(RED)
  })

  it('paints the Canvas and leaves the Frame as it was', () => {
    const project = layered()
    const painted = onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 30, column: 30 }], RED, NONE))
    expect(painted.beads[30]).toEqual({ 30: RED })
    expect(painted.frame).toBe(project.frame)
  })

  it('does not change the Canvas under the Frame: what lies there stays hidden, untouched', () => {
    const project = layered()
    const painted = onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 11, column: 21 }, { row: 30, column: 30 }], RED, NONE))
    expect(painted.beads[11]).toEqual({ 21: BLUE })
    expect(painted.beads[30]).toEqual({ 30: RED })
  })

  it('hands back the Project itself when the command changed nothing, or only what is under the Frame', () => {
    const project = layered()
    expect(onLayer(project, 'frame', (view) => view)).toBe(project)
    expect(onLayer(project, 'canvas', (view) => paintCells(view, [{ row: 11, column: 21 }], RED, NONE))).toBe(project)
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
    expect(onLayer(bare, 'frame', (view) => paintCells(view, [{ row: 0, column: 0 }], RED, NONE))).toBe(bare)
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
    const project: Project = { ...base, technique: 'brick', brickBlock: 3, frame: { ...base.frame!, technique: 'peyote' } }
    const seen: Project[] = []
    onLayer(project, 'frame', (view) => {
      seen.push(view)
      return view
    })
    expect(seen[0]).toMatchObject({ technique: 'peyote', frame: { technique: 'peyote' } })
    expect(seen[0]).not.toHaveProperty('brickBlock')
  })

  it('hands a command the Canvas\'s Weave for the Canvas', () => {
    const base = layered()
    const project: Project = { ...base, technique: 'brick', brickBlock: 3, frame: { ...base.frame!, technique: 'peyote' } }
    const seen: Project[] = []
    onLayer(project, 'canvas', (view) => {
      seen.push(view)
      return view
    })
    expect(seen[0]).toMatchObject({ technique: 'brick', brickBlock: 3 })
  })
})
