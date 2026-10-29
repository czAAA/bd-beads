// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeColorQuantities } from './beadQuantities'
import { beadCount, colorAt, type FrameSheet } from './canvas'
import { changeFrame, type FrameChange } from './changeFrame'
import { frameLayoutOf, type FrameSettings } from './frameShape'
import { frameGeometryOf, onLayer } from './layers'
import { gridGeometry } from './layerGeometry'
import { frameWeave } from './layerWeave'
import { projectPalette } from './palette'
import { parseProjectsFile, serializeProject } from './projectFile'
import { createProject } from './createProject'
import { fillArea } from './fill'
import { paintCells } from './drawing'
import { isInFinishedRow, rowProgressOf, rowProgressOn } from './rowProgress'
import { rotateFrame } from './rotate'
import type { Project } from './project'
import { beadsOfLayer, frameOf, withFrameSheet } from './layerRecord'
import { withLayers } from '../testUtils/layerFields'

const RED = '#ff0000'
const BLUE = '#0000ff'

const open = (): Project => {
  const project = withFrameSheet(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
  return project
}

/** An open Canvas woven in peyote, as the Triangle is: its rows and columns are the Frame's. */
const openPeyote = (): Project => {
  const project = withFrameSheet(createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } }), undefined)
  return project
}

/** The Project after a change that must happen. */
function changed(project: Project, change: FrameChange): Project {
  const result = changeFrame(project, change)
  if (result.kind !== 'changed') throw new Error(`expected a change, got ${JSON.stringify(result)}`)
  return result.project
}

const triangle = (rounds = 4, project = open(), centre = { row: 20, column: 30 }) => changed(project, { custom: { shape: 'triangle', size: rounds, centre } })

/** Paints Frame positions (round, place in round) as a press on the Frame does. */
const paintFrame = (project: Project, positions: { row: number; column: number }[], color: string | null) =>
  onLayer(project, 'frame', (view) => paintCells(view, positions, color))

describe('a Custom frame put in place holding beads (ticket 0596)', () => {
  it('keeps the beads its layout has a position for, and drops the rest', () => {
    // A Triangle of 2 rounds has 3 beads in round 0 and 6 in round 1, none in round 2 or at place 3 of round 0.
    const placed = changed(open(), { custom: { shape: 'triangle', size: 2, centre: { row: 20, column: 30 }, beads: { 0: { 0: RED, 3: RED }, 1: { 5: BLUE }, 2: { 0: BLUE } } } })
    expect(frameOf(placed)!.beads).toEqual({ 0: { 0: RED }, 1: { 5: BLUE } })
  })
})

describe('a Custom frame put on the open Canvas (ticket 0592)', () => {
  it('is a peyote Frame of its Frame shape and Rounds, empty, round the centre it was given', () => {
    const frame = frameOf(triangle(4))!
    expect(frame).toMatchObject({ shape: 'triangle', settings: { rounds: 4 }, technique: 'peyote', beads: {} })
    expect(frame.row).toBeLessThanOrEqual(20)
    expect(frame.row + frame.rows).toBeGreaterThan(20)
    expect(frame.column + frame.columns / 2).toBeCloseTo(30, -1)
  })

  it('replaces the Frame there with its beads, and turns Row progress on like any first Frame (ticket 0594)', () => {
    const square = changed(triangle(), { custom: { shape: 'warpedSquare', size: 3, centre: { row: 0, column: 0 } } })
    expect(frameOf(square)).toMatchObject({ shape: 'warpedSquare', settings: { rounds: 3 } })
    expect(rowProgressOn(square)).toBe(true)
  })
})

describe('painting a Custom frame', () => {
  it('paints and erases its positions, and nothing where it has none', () => {
    const painted = paintFrame(triangle(3), [{ row: 2, column: 8 }, { row: 2, column: 9 }, { row: 0, column: 0 }], RED)
    expect(beadCount(frameOf(painted)!.beads)).toBe(2)
    expect(colorAt(frameOf(painted)!.beads, 2, 8)).toBe(RED)
    const erased = paintFrame(painted, [{ row: 2, column: 8 }], null)
    expect(colorAt(frameOf(erased)!.beads, 2, 8)).toBeNull()
  })

  it('fills across panels where beads touch, and stops at another colour', () => {
    const project = triangle(4)
    const filled = onLayer(project, 'frame', (view) => fillArea(view, 0, 0, RED))
    expect(beadCount(frameOf(filled)!.beads)).toBe(frameLayoutOf(frameOf(project)!)!.positions.length)
    // A peyote column's beads touch two rounds apart, so the wall is two rounds deep.
    const wall = [1, 2].flatMap((row) => Array.from({ length: 3 * (row + 1) }, (_unused, column) => ({ row, column })))
    const walled = paintFrame(project, wall, BLUE)
    const inner = onLayer(walled, 'frame', (view) => fillArea(view, 0, 0, RED))
    expect(beadCount(frameOf(inner)!.beads)).toBe(15 + 3)
  })
})

describe('changing a Custom frame\'s Rounds', () => {
  it('grows by empty rounds outside, keeping every bead and the centre where it was', () => {
    const project = paintFrame(triangle(3), [{ row: 2, column: 4 }], RED)
    const grown = changed(project, { settings: { rounds: 6 } })
    expect(frameOf(grown)).toMatchObject({ settings: { rounds: 6 } })
    expect(colorAt(frameOf(grown)!.beads, 2, 4)).toBe(RED)
    expect(frameOf(grown)!.rows).toBeGreaterThan(frameOf(project)!.rows)
    const centre = (frame: FrameSheet | undefined) => frame!.row + Math.floor(frame!.rows / 2)
    expect(Math.abs(centre(frameOf(grown)) - centre(frameOf(project)))).toBeLessThanOrEqual(1)
  })

  it('shrinks by folding the outer rounds\' painted beads, and shows them again where they were when grown back (ticket 0640)', () => {
    const project = paintFrame(triangle(4), [{ row: 3, column: 0 }, { row: 3, column: 1 }, { row: 0, column: 0 }], RED)
    const shrunk = changed(project, { settings: { rounds: 2 } })
    expect(frameOf(shrunk)!.beads).toEqual({ 0: { 0: RED } })
    expect(frameOf(shrunk)!.folded).toEqual({ 3: { 0: RED, 1: RED } })
    expect(computeColorQuantities(shrunk, projectPalette(shrunk))).toMatchObject([{ hex: RED, count: 1 }])
    const grown = changed(changed(shrunk, { settings: { rounds: 3 } }), { settings: { rounds: 4 } })
    expect(frameOf(grown)!.beads).toEqual(frameOf(project)!.beads)
    expect(frameOf(grown)!.folded).toBeUndefined()
  })

  it('turns its Folded beads with it (ticket 0640)', () => {
    const shrunk = changed(paintFrame(triangle(4), [{ row: 3, column: 0 }], RED), { settings: { rounds: 3 } })
    const turned = rotateFrame(shrunk)!
    expect(frameOf(turned)!.folded).toEqual(frameOf(shrunk)!.folded)
    expect(frameOf(changed(turned, { settings: { rounds: 4 } }))!.beads).toEqual({ 3: { 0: RED } })
  })

  it('keeps its pointer and the same beads finished on Rotate Frame, as its order turns with its layout (ticket 0647)', () => {
    const project = withLayers(triangle(4), { rowProgress: { direction: 'rows' as const, currentRow: 2, currentColumn: 0 } })
    const turned = rotateFrame(project)!
    const finished = (woven: Project) =>
      frameLayoutOf(frameOf(woven)!)!.positions.filter(({ row, column }) => isInFinishedRow(woven, { row: row + frameOf(woven)!.row, column: column + frameOf(woven)!.column, layer: 'frame' })).map(({ row, column }) => `${row},${column}`)
    expect(rowProgressOf(turned)).toEqual(rowProgressOf(project))
    expect(finished(turned)).toEqual(finished(project))
    expect(finished(project)).toHaveLength(3 + 6)
  })

  it('is no change at the Rounds it has, and keeps within the shape\'s range', () => {
    expect(changeFrame(triangle(4), { settings: { rounds: 4 } }).kind).toBe('unchanged')
    expect(frameOf(changed(triangle(4), { settings: { rounds: 999 } }))!.settings).toEqual({ rounds: 40 })
  })
})

describe('every Frame action on a Custom frame, each done through its shape (ADR 0079, ticket 0669)', () => {
  /** The Canvas position nearest a Frame bead's centre: the cell of the Frame's own Weave under it, on the Canvas. */
  const nearestCanvasPosition = (project: Project, position: { row: number; column: number }) => {
    const { box } = frameGeometryOf(project).place(position)!
    const cell = gridGeometry(frameWeave(project)).positionAt({ x: box.x + box.width / 2, y: box.y + box.height / 2 })!
    return { row: cell.row + frameOf(project)!.row, column: cell.column + frameOf(project)!.column }
  }

  it('drops its beads onto the Canvas on Remove Frame, each on the Canvas position nearest its centre, clearing its footprint', () => {
    const covered = withLayers(triangle(4), { beads: { 20: { 30: BLUE } } })
    const project = paintFrame(covered, [{ row: 3, column: 5 }], RED)
    const removed = changed(project, { remove: true })
    expect(frameOf(removed)).toBeUndefined()
    const at = nearestCanvasPosition(project, { row: 3, column: 5 })
    expect(beadsOfLayer(removed, 'canvas')).toEqual({ [at.row]: { [at.column]: RED } })
  })

  it('loses none of its beads on Remove Frame where two lie nearest the same Canvas position', () => {
    const project = triangle(4)
    const filled = onLayer(project, 'frame', (view) => fillArea(view, 0, 0, RED))
    expect(beadCount(beadsOfLayer(changed(filled, { remove: true }), 'canvas'))).toBe(frameLayoutOf(frameOf(project)!)!.positions.length)
  })

  it('drops its Folded beads too on Remove Frame, where growing it back would show them, under the beads it shows', () => {
    const painted = paintFrame(paintFrame(triangle(4), [{ row: 3, column: 0 }], BLUE), [{ row: 0, column: 0 }], RED)
    const shrunk = changed(painted, { settings: { rounds: 3 } })
    expect(frameOf(shrunk)!.folded).toEqual({ 3: { 0: BLUE } })
    const blue = (project: Project) => Object.entries(beadsOfLayer(project, 'canvas')).flatMap(([row, beads]) => Object.keys(beads).filter((column) => beads[Number(column)] === BLUE).map((column) => `${row},${column}`))
    const removed = changed(shrunk, { remove: true })
    expect(blue(removed)).toEqual(blue(changed(changed(shrunk, { settings: { rounds: 4 } }), { remove: true })))
    expect(beadCount(beadsOfLayer(removed, 'canvas'))).toBe(2)
  })

  it('steps its size setting to the rectangle a resize handle asks for, folding what a smaller one leaves out', () => {
    const project = paintFrame(triangle(4), [{ row: 3, column: 0 }], RED)
    const { rows, columns } = frameOf(triangle(6))!
    expect(frameOf(changed(project, { set: { ...frameOf(project)!, rows, columns } }))!.settings).toEqual({ rounds: 6 })
    const smaller = changed(project, { set: { ...frameOf(project)!, columns: frameOf(triangle(3))!.columns } })
    expect(frameOf(smaller)).toMatchObject({ settings: { rounds: 3 }, beads: {}, folded: { 3: { 0: RED } } })
    expect(changeFrame(project, { set: { ...frameOf(project)!, columns: frameOf(project)!.columns } }).kind).toBe('unchanged')
  })

  it('holds its size still once a Row progress pass is done', () => {
    const project = withLayers(triangle(4), { rowProgress: { direction: 'rows' as const, currentRow: 1, currentColumn: 0 } })
    expect(changeFrame(project, { set: { ...frameOf(project)!, columns: frameOf(project)!.columns + 6 } })).toEqual({ kind: 'refused', reason: 'locked' })
  })

  it('becomes its shape round a Selection on Frame from Selection, the smallest that covers it, lifting the Canvas beads in', () => {
    // On a Canvas woven like it, the rectangle a 4-round Triangle round row 20, column 30 has, and Canvas beads over four
    // of its beads.
    const selection = { row: 16, column: 26, rows: 11, columns: 9 }
    const drawn = withLayers(triangle(4, openPeyote(), { row: 80, column: 80 }), { beads: { 16: { 29: RED }, 17: { 29: RED }, 18: { 28: BLUE }, 24: { 29: BLUE } } })
    const made = changed(drawn, { make: selection })
    expect(frameOf(made)).toMatchObject({ ...selection, shape: 'triangle', settings: { rounds: 4 } })
    expect(beadsOfLayer(made, 'canvas')).toEqual({})
    expect(computeColorQuantities(made, projectPalette(made))).toEqual(expect.arrayContaining([expect.objectContaining({ hex: RED, count: 2 }), expect.objectContaining({ hex: BLUE, count: 2 })]))
  })

  it('leaves a Canvas bead it cannot lift, on a Seam or Off-shape, hidden on the Canvas under it', () => {
    const made = changed(withLayers(triangle(4, openPeyote(), { row: 80, column: 80 }), { beads: { 16: { 26: RED } } }), { make: { row: 16, column: 26, rows: 11, columns: 9 } })
    expect(beadsOfLayer(made, 'canvas')).toEqual({ 16: { 26: RED } })
    expect(frameOf(made)!.beads).toEqual({})
  })

  it('lays its own beads on the Canvas first on Frame from Selection elsewhere', () => {
    const project = paintFrame(triangle(4), [{ row: 3, column: 5 }], RED)
    const made = changed(project, { make: { row: 60, column: 60, rows: 4, columns: 4 } })
    expect(beadsOfLayer(made, 'canvas')).toEqual(beadsOfLayer(changed(project, { remove: true }), 'canvas'))
    expect(frameOf(made)!.beads).toEqual({})
  })

  it('is woven in the Techniques its shape supports and refuses another; Remove row/column alone is not offered', () => {
    const project = triangle()
    expect(changeFrame(project, { technique: 'peyote' }).kind).toBe('unchanged')
    for (const change of [{ technique: 'loom' }, { removeLine: { axis: 'row', index: 0 } }] as FrameChange[]) {
      expect(changeFrame(project, change)).toEqual({ kind: 'refused', reason: 'not-offered' })
    }
  })

  it('moves with the Move handle, its beads with it', () => {
    const project = paintFrame(triangle(), [{ row: 1, column: 1 }], RED)
    const moved = changed(project, { move: { rows: 2, columns: 3 } })
    expect(frameOf(moved)).toMatchObject({ row: frameOf(project)!.row + 2, column: frameOf(project)!.column + 3, beads: frameOf(project)!.beads })
  })
})

describe('Beads needed for a Custom frame', () => {
  it('counts every painted bead of it, on whichever panel', () => {
    const project = paintFrame(triangle(4), [{ row: 3, column: 0 }, { row: 3, column: 5 }, { row: 3, column: 11 }, { row: 0, column: 1 }], RED)
    expect(computeColorQuantities(project, projectPalette(project))).toMatchObject([{ hex: RED, count: 4 }])
  })
})

// A Kaleidocycle's triangles stand a gap apart round the hole, so a fill keeps to the one of its six it starts on.
describe.each([
  { shape: 'star', setting: 'partSize', size: 4, filledShare: 1 },
  { shape: 'kaleidocycle', setting: 'partSize', size: 4, filledShare: 1 / 6 },
  { shape: 'kite', setting: 'rows', size: 9, filledShare: 1 },
] as const)('a $shape Custom frame (ticket 0593)', ({ shape, setting, size, filledShare }) => {
  const placed = (at = size) => changed(open(), { custom: { shape, size: at, centre: { row: 20, column: 30 } } })
  const layout = () => frameLayoutOf(frameOf(placed())!)!
  /** A position on the last round or row, and one on the first. */
  const outer = () => layout().positions.find(({ row }) => row === size - 1)!
  const inner = () => layout().positions.find(({ row }) => row === 0)!
  const name = ({ row, column }: { row: number; column: number }) => ({ row, column })

  it('is an empty peyote Frame of its Frame shape, sized by its own setting, with Row progress on', () => {
    const project = placed()
    expect(frameOf(project)).toMatchObject({ shape, settings: { [setting]: size }, technique: 'peyote', beads: {} })
    expect(rowProgressOn(project)).toBe(true)
  })

  it('paints and erases its positions, and nothing where it has none', () => {
    const painted = paintFrame(placed(), [name(outer()), { row: size, column: 0 }, { row: 0, column: 999 }], RED)
    expect(beadCount(frameOf(painted)!.beads)).toBe(1)
    expect(beadCount(frameOf(paintFrame(painted, [name(outer())], null))!.beads)).toBe(0)
  })

  it('fills every bead that touches, across its panels', () => {
    const filled = onLayer(placed(), 'frame', (view) => fillArea(view, inner().row, inner().column, RED))
    expect(beadCount(frameOf(filled)!.beads)).toBe(layout().positions.length * filledShare)
  })

  it('grows by empty rounds or rows outside, keeping every bead, and folds what a shrink leaves out until it grows back (ticket 0640)', () => {
    const project = paintFrame(placed(), [name(inner()), name(outer())], RED)
    const grown = changed(project, { settings: { [setting]: size + 3 } })
    expect(frameOf(grown)!.settings).toEqual({ [setting]: size + 3 })
    expect(frameOf(grown)!.beads).toEqual(frameOf(project)!.beads)
    const shrunk = changed(project, { settings: { [setting]: size - 1 } })
    expect(frameOf(shrunk)!.beads).toEqual({ [inner().row]: { [inner().column]: RED } })
    expect(frameOf(shrunk)!.folded).toEqual({ [outer().row]: { [outer().column]: RED } })
    const back = changed(shrunk, { settings: { [setting]: size } })
    expect(frameOf(back)!.beads).toEqual(frameOf(project)!.beads)
    expect(frameOf(back)!.folded).toBeUndefined()
  })

  it('moves with its beads, and drops them onto the Canvas on Remove Frame', () => {
    const project = paintFrame(placed(), [name(inner())], RED)
    expect(frameOf(changed(project, { move: { rows: 2, columns: 3 } }))).toMatchObject({ row: frameOf(project)!.row + 2, beads: frameOf(project)!.beads })
    const removed = changed(project, { remove: true })
    expect(frameOf(removed)).toBeUndefined()
    expect(beadCount(beadsOfLayer(removed, 'canvas'))).toBe(1)
  })

  it('steps its size setting to a resize handle, and refuses Remove row/column and another Technique', () => {
    const bigger = frameOf(changed(open(), { custom: { shape, size: size + 2, centre: { row: 20, column: 30 } } }))!
    expect(frameOf(changed(placed(), { set: { ...frameOf(placed())!, rows: bigger.rows, columns: bigger.columns } }))!.settings).toEqual({ [setting]: size + 2 })
    for (const change of [{ removeLine: { axis: 'row', index: 0 } }, { technique: 'loom' }] as FrameChange[]) {
      expect(changeFrame(placed(), change)).toEqual({ kind: 'refused', reason: 'not-offered' })
    }
  })

  it('counts its painted beads in Beads needed, and comes back from the Project file as it was', () => {
    const project = paintFrame(placed(), [name(inner()), name(outer())], RED)
    expect(computeColorQuantities(project, projectPalette(project))).toMatchObject([{ hex: RED, count: 2 }])
    expect(parseProjectsFile(serializeProject(project)).projects).toEqual([project])
  })
})

describe('a Fringe earring Custom frame (ticket 0597)', () => {
  const settings = { topWidth: 6, topRows: 4, fringeStyle: 'straight', fringeLength: 9 } as const
  const earring = (given: FrameSettings = settings) => changed(open(), { custom: { shape: 'fringeEarring', settings: given, centre: { row: 20, column: 30 } } })
  /** The first bead of the base row, and the last bead of the first strand. */
  const base = { row: 0, column: 0 }
  const strandEnd = { row: 1008, column: 0 }

  it('is an empty brick-stitch Frame with its four settings, Row progress on', () => {
    const project = earring()
    expect(frameOf(project)).toMatchObject({ shape: 'fringeEarring', settings, technique: 'brick', beads: {} })
    expect(frameLayoutOf(frameOf(project)!)!.positions).toHaveLength(6 + 5 + 4 + 3 + 6 * 9)
    expect(rowProgressOn(project)).toBe(true)
  })

  it('reads settings it was not given as the shape\'s defaults, and fewer Top rows than its Top width, ending on a pair', () => {
    expect(frameOf(earring({ topWidth: 5, topRows: 9 }))!.settings).toEqual({ topWidth: 5, topRows: 4, fringeStyle: 'straight', fringeLength: 12 })
  })

  it('paints its top and its strands, and nothing on the Seam between them', () => {
    const painted = paintFrame(earring(), [base, strandEnd, { row: 1009, column: 0 }, { row: 4, column: 0 }], RED)
    expect(beadCount(frameOf(painted)!.beads)).toBe(2)
  })

  it('changes one setting at a time, keeping every bead still in it, and folds the strands\' ends a V or a shorter fringe leaves out until they come back (ticket 0640)', () => {
    const project = paintFrame(earring(), [base, strandEnd], RED)
    const longer = changed(project, { settings: { fringeLength: 12 } })
    expect(frameOf(longer)!.settings).toEqual({ ...settings, fringeLength: 12 })
    expect(frameOf(longer)!.beads).toEqual(frameOf(project)!.beads)
    const shorter = changed(project, { settings: { fringeLength: 8 } })
    expect(frameOf(shorter)!.beads).toEqual({ [base.row]: { [base.column]: RED } })
    expect(frameOf(shorter)!.folded).toEqual({ [strandEnd.row]: { [strandEnd.column]: RED } })
    expect(frameOf(changed(shorter, { settings: { fringeLength: 9 } }))!.beads).toEqual(frameOf(project)!.beads)
    const v = changed(project, { settings: { fringeStyle: 'v' } })
    expect(colorAt(frameOf(v)!.beads, 0, 0)).toBe(RED)
    expect(colorAt(frameOf(v)!.folded!, strandEnd.row, strandEnd.column)).toBe(RED)
    expect(frameOf(changed(v, { settings: { fringeStyle: 'straight' } }))!.beads).toEqual(frameOf(project)!.beads)
    expect(changeFrame(project, { settings: { fringeStyle: 'straight' } }).kind).toBe('unchanged')
  })

  it('moves with its beads, drops them onto the Canvas on Remove Frame, and comes back from the Project file', () => {
    const project = paintFrame(earring(), [base, strandEnd], RED)
    expect(frameOf(changed(project, { move: { rows: 2, columns: 3 } }))!.beads).toEqual(frameOf(project)!.beads)
    const removed = changed(project, { remove: true })
    expect(frameOf(removed)).toBeUndefined()
    expect(beadCount(beadsOfLayer(removed, 'canvas'))).toBe(2)
    expect(parseProjectsFile(serializeProject(project)).projects).toEqual([project])
  })
})
