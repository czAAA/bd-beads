// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeColorQuantities } from './beadQuantities'
import { beadCount, colorAt, type FrameSheet } from './canvas'
import { changeFrame, relaidInBead, type FrameChange } from './changeFrame'
import { findBead } from './beads'
import { customFrameSize, frameLayoutOf, type FrameSettings } from './frameShape'
import { replaceBead } from './projectBead'
import { frameGeometryOf, onLayer } from './layers'
import { beadCell, describeWeave } from './weave'
import { canvasDistance, frameWeave } from './layerWeave'
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

describe('a Custom frame in another Bead (ticket 0723)', () => {
  /** Where the Frame's middle lies on the Canvas, in Canvas positions. */
  const middle = (project: Project) => {
    const frame = frameOf(project)!
    const half = canvasDistance(project, frameWeave(project), Math.floor(frame.rows / 2), Math.floor(frame.columns / 2))
    return { row: frame.row + half.row, column: frame.column + half.column }
  }

  it('is laid out again in the Frame\'s new Bead round its own middle, every bead keeping its name and colour', () => {
    const project = paintFrame(changed(openPeyote(), { custom: { shape: 'warpedSquare', size: 6, centre: { row: 20, column: 30 } } }), [{ row: 5, column: 0 }, { row: 2, column: 4 }], RED)
    const round = findBead('toho/round/11-0')!
    const relaid = relaidInBead(project, replaceBead(project, round))
    expect(frameOf(relaid)).toMatchObject(customFrameSize('warpedSquare', { rounds: 6 }, undefined, { technique: 'peyote' }, beadCell(round, 'peyote')))
    expect(frameOf(relaid)!.rows).not.toBe(frameOf(project)!.rows)
    expect(frameOf(relaid)!.beads).toEqual(frameOf(project)!.beads)
    expect(frameLayoutOf({ ...frameOf(relaid)!, cell: frameWeave(relaid).cell })!.beadDepth).toBeCloseTo(2.2 / 1.65, 9)
    const [before, after] = [middle(project), middle(relaid)]
    expect(Math.abs(after.row - before.row)).toBeLessThanOrEqual(1)
    expect(Math.abs(after.column - before.column)).toBeLessThanOrEqual(1)
  })

  it('leaves a Frame without a Frame shape, and a Bead as deep as it had, as Replace Bead left it', () => {
    const round = findBead('toho/round/11-0')!
    const plain = changed(openPeyote(), { place: { frame: { row: 0, column: 0, rows: 6, columns: 6 }, weave: { technique: 'peyote' } } })
    const rebeaded = replaceBead(plain, round)
    expect(relaidInBead(plain, rebeaded)).toBe(rebeaded)
    const square = changed(openPeyote(), { custom: { shape: 'warpedSquare', size: 6, centre: { row: 20, column: 30 } } })
    // A Toho Cube 1.5mm, as the Frame has: its layout and rectangle are as they were.
    const same = replaceBead(square, findBead('toho/cube/1.5mm')!)
    expect(relaidInBead(square, same)).toBe(same)
  })
})

describe('every Frame action on a Custom frame, each done through its shape (ADR 0079, ticket 0669)', () => {
  /** The Canvas position nearest a Frame bead's centre: the cell of the Frame's own Weave nearest it, on the Canvas (a
   * real cell's rows overlap, so the one drawn over it may be another). */
  const nearestCanvasPosition = (project: Project, position: { row: number; column: number }) => {
    const { box } = frameGeometryOf(project).place(position)!
    const weave = describeWeave(frameWeave(project))
    const cell = weave.nearestPosition(box.x + box.width / 2, box.y + box.height / 2, 1, weave.cellAspect)
    return { row: cell.row + frameOf(project)!.row, column: cell.column + frameOf(project)!.column }
  }

  it('drops its beads onto the Canvas on Remove Frame, each on the Canvas position nearest its centre, clearing its footprint', () => {
    const covered = withLayers(triangle(4), { beads: { 20: { 30: BLUE } } })
    const project = paintFrame(covered, [{ row: 3, column: 4 }], RED)
    const removed = changed(project, { remove: true })
    expect(frameOf(removed)).toBeUndefined()
    const at = nearestCanvasPosition(project, { row: 3, column: 4 })
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
    const selection = { row: 16, column: 26, rows: 8, columns: 9 }
    const drawn = withLayers(triangle(4, openPeyote(), { row: 80, column: 80 }), { beads: { 16: { 29: RED }, 17: { 29: RED }, 18: { 31: BLUE }, 22: { 29: BLUE } } })
    const made = changed(drawn, { make: selection })
    expect(frameOf(made)).toMatchObject({ ...selection, shape: 'triangle', settings: { rounds: 4 } })
    expect(beadsOfLayer(made, 'canvas')).toEqual({})
    expect(computeColorQuantities(made, projectPalette(made))).toEqual(expect.arrayContaining([expect.objectContaining({ hex: RED, count: 2 }), expect.objectContaining({ hex: BLUE, count: 2 })]))
  })

  it('leaves a Canvas bead it cannot lift, on a Seam or Off-shape, hidden on the Canvas under it', () => {
    const made = changed(withLayers(triangle(4, openPeyote(), { row: 80, column: 80 }), { beads: { 16: { 26: RED } } }), { make: { row: 16, column: 26, rows: 8, columns: 9 } })
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

  it('reads settings it was not given as the shape\'s defaults, and a body under its point of an even number of rows (ticket 0814)', () => {
    expect(frameOf(earring({ topWidth: 5, topRows: 9 }))!.settings).toEqual({ topWidth: 5, topRows: 8, fringeStyle: 'straight', fringeLength: 12 })
  })

  describe('with its top woven in another Technique (ticket 0814)', () => {
    const woven = (technique: 'peyote' | 'loom' | 'brick', techniqueSettings?: Record<string, number>, given: FrameSettings = settings) =>
      changed(open(), { custom: { shape: 'fringeEarring', settings: given, centre: { row: 20, column: 30 }, weave: { technique, ...(techniqueSettings ? { techniqueSettings } : {}) } } })

    it('keeps a peyote Width an odd number of blocks of Drop, stepping it by two blocks', () => {
      expect(frameOf(woven('peyote'))!.settings!.topWidth).toBe(5)
      const peyote = woven('peyote', undefined, { ...settings, topWidth: 7 })
      expect(frameOf(changed(peyote, { settings: { topWidth: 8 } }))!.settings!.topWidth).toBe(9)
      expect(frameOf(changed(peyote, { settings: { topWidth: 6 } }))!.settings!.topWidth).toBe(5)
      expect(frameOf(woven('peyote', { peyoteDrop: 2 }, { ...settings, topWidth: 8 }))!.settings!.topWidth).toBe(6)
    })

    it('grows a peyote or loom body a row at a time, and a 2-drop brick body four rows at a time', () => {
      // A peyote Width of 5 tapers in 3 lines, a loom one in 3 rows; a 2-drop brick Width of 6 in 10 rows.
      expect(frameOf(changed(woven('peyote', undefined, { ...settings, topWidth: 5, topRows: 3 }), { settings: { topRows: 4 } }))!.settings!.topRows).toBe(4)
      expect(frameOf(changed(woven('loom', undefined, { ...settings, topWidth: 5, topRows: 3 }), { settings: { topRows: 4 } }))!.settings!.topRows).toBe(4)
      const brick = woven('brick', { brickDrop: 2 }, { ...settings, topRows: 10 })
      expect(frameOf(changed(brick, { settings: { topRows: 11 } }))!.settings!.topRows).toBe(14)
    })

    it('switches its top\'s Technique keeping each bead\'s row and column, folding what has no place, the strands untouched, as one change', () => {
      const project = paintFrame(earring(), [base, { row: 3, column: 1 }, strandEnd], RED)
      const loom = changed(project, { technique: 'loom' })
      expect(frameOf(loom)).toMatchObject({ technique: 'loom', settings })
      // A loom row 3 of a Width of 6 has no place: the point tapers to a pair in 3 rows, a body row under them.
      expect(frameOf(loom)!.beads).toEqual({ [base.row]: { [base.column]: RED }, [strandEnd.row]: { [strandEnd.column]: RED } })
      expect(colorAt(frameOf(loom)!.folded!, 3, 1)).toBe(RED)
      expect(frameOf(changed(loom, { technique: 'brick' }))!.beads).toEqual(frameOf(project)!.beads)
      // Peyote makes the even Width odd.
      const peyote = changed(project, { technique: 'peyote' })
      expect(frameOf(peyote)!.settings!.topWidth).toBe(5)
      // Saved and opened again, its settings are read in its own Weave.
      const tall = changed(peyote, { settings: { topRows: 6 } })
      expect(parseProjectsFile(serializeProject(tall)).projects).toEqual([tall])
      // On 2-drop the base row's block is two rows of the Width.
      expect(frameLayoutOf(frameOf(changed(project, { techniqueSettings: { brickDrop: 2 } }))!)!.positions.filter(({ row }) => row === 1)).toHaveLength(6)
    })
  })

  describe('resized by its handles and steppers (ticket 0814)', () => {
    /** Where the Frame's four edges lie on the Canvas. */
    const edges = (project: Project) => {
      const frame = frameOf(project)!
      const extent = canvasDistance(project, frameWeave(project), frame.rows, frame.columns)
      return { top: frame.row, bottom: frame.row + extent.row, left: frame.column, right: frame.column + extent.column }
    }
    /** The Frame's rectangle with one edge dragged out by some rows or columns. */
    const dragged = (project: Project, edge: 'top' | 'bottom' | 'left' | 'right', by: number) => {
      const frame = frameOf(project)!
      if (edge === 'top') return { ...frame, row: frame.row - by, rows: frame.rows + by }
      if (edge === 'left') return { ...frame, column: frame.column - by, columns: frame.columns + by }
      return edge === 'bottom' ? { ...frame, rows: frame.rows + by } : { ...frame, columns: frame.columns + by }
    }

    it('changes Width by its left and right handles, only the dragged side moving', () => {
      const project = earring()
      const right = changed(project, { set: dragged(project, 'right', 2) })
      expect(frameOf(right)!.settings).toEqual({ ...settings, topWidth: 8 })
      expect(edges(right).left).toBe(edges(project).left)
      expect(edges(right).right).toBeGreaterThan(edges(project).right)
      const left = changed(project, { set: dragged(project, 'left', 2) })
      expect(frameOf(left)!.settings).toEqual({ ...settings, topWidth: 8 })
      expect(edges(left).right).toBe(edges(project).right)
      expect(edges(left).left).toBeLessThan(edges(project).left)
    })

    it('changes Top rows by its top handle, growing upwards with the strands staying put', () => {
      const project = earring()
      const taller = changed(project, { set: dragged(project, 'top', 3) })
      expect(frameOf(taller)!.settings).toMatchObject({ topWidth: 6, fringeLength: 9 })
      expect(frameOf(taller)!.settings!.topRows).toBeGreaterThan(5)
      expect(edges(taller).bottom).toBe(edges(project).bottom)
      expect(edges(taller).top).toBeLessThan(edges(project).top)
    })

    it('changes Fringe length by its bottom handle, the top staying put', () => {
      const project = earring()
      const longer = changed(project, { set: dragged(project, 'bottom', 3) })
      expect(frameOf(longer)!.settings).toEqual({ ...settings, fringeLength: 12 })
      expect(edges(longer).top).toBe(edges(project).top)
      // A V's tip moves the same way.
      const v = earring({ ...settings, fringeStyle: 'v' })
      expect(frameOf(changed(v, { set: dragged(v, 'bottom', 3) }))!.settings).toEqual({ ...settings, fringeStyle: 'v', fringeLength: 12 })
    })

    it('drives the setting of the shape\'s side a handle sits on once Rotate Frame has turned it', () => {
      // A quarter turn clockwise lays the top on the right and the strands on the left.
      const turned = rotateFrame(earring())!
      expect(frameOf(changed(turned, { set: dragged(turned, 'right', 3) }))!.settings!.topRows).toBeGreaterThan(5)
      expect(frameOf(changed(turned, { set: dragged(turned, 'left', 3) }))!.settings).toEqual({ ...settings, fringeLength: 12 })
      expect(frameOf(changed(turned, { set: dragged(turned, 'bottom', 2) }))!.settings).toEqual({ ...settings, topWidth: 8 })
    })

    it('takes Top rows past its point two brick rows at a time, and keeps the body as tall when Width changes', () => {
      // A Width of 6 tapers to a pair in 5 rows.
      const point = changed(earring(), { settings: { topRows: 5 } })
      const body = changed(point, { settings: { topRows: 6 } })
      expect(frameOf(body)!.settings!.topRows).toBe(7)
      expect(frameOf(changed(body, { settings: { topRows: 6 } }))!.settings!.topRows).toBe(5)
      expect(frameOf(changed(body, { settings: { topWidth: 8 } }))!.settings).toMatchObject({ topWidth: 8, topRows: 9 })
      expect(frameOf(changed(body, { settings: { topWidth: 4 } }))!.settings).toMatchObject({ topWidth: 4, topRows: 5 })
      // A whole point stays whole with no body under it, and a cut-off one keeps its rows where the point has them.
      expect(frameOf(changed(point, { settings: { topWidth: 4 } }))!.settings).toMatchObject({ topWidth: 4, topRows: 3 })
      expect(frameOf(changed(point, { settings: { topWidth: 8 } }))!.settings).toMatchObject({ topWidth: 8, topRows: 7 })
      expect(frameOf(changed(earring(), { settings: { topWidth: 8 } }))!.settings).toMatchObject({ topWidth: 8, topRows: 4 })
      expect(frameOf(changed(earring(), { settings: { topWidth: 4 } }))!.settings).toMatchObject({ topWidth: 4, topRows: 3 })
    })

    it('keeps the point\'s beads in the point as the body grows and shrinks, the body\'s given-up rows folded until they come back', () => {
      const tall = changed(earring(), { settings: { topRows: 9 } })
      // The body's fourth row, named from -1000 up.
      const bodyBead = frameLayoutOf(frameOf(tall)!)!.positions.find(({ row }) => row === -1000 + 3)!
      const painted = paintFrame(tall, [base, bodyBead], RED)
      const short = changed(painted, { settings: { topRows: 7 } })
      expect(frameOf(short)!.beads).toEqual({ [base.row]: { [base.column]: RED } })
      expect(colorAt(frameOf(short)!.folded!, bodyBead.row, bodyBead.column)).toBe(RED)
      expect(frameOf(changed(short, { settings: { topRows: 9 } }))!.beads).toEqual(frameOf(painted)!.beads)
    })
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
