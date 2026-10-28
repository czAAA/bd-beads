// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeColorQuantities } from './beadQuantities'
import { beadCount, colorAt } from './canvas'
import { changeFrame, type FrameChange } from './changeFrame'
import { frameLayoutOf, type CustomFrameKindId, type FrameSettings } from './frameKind'
import { onLayer } from './layers'
import { projectPalette } from './palette'
import { parseProjectsFile, serializeProject } from './projectFile'
import { createProject } from './createProject'
import { fillArea } from './fill'
import { paintCells } from './drawing'
import { rowProgressOn } from './rowProgress'
import { rotateFrame } from './rotate'
import type { Project } from './project'

const RED = '#ff0000'
const BLUE = '#0000ff'

const open = (): Project => {
  const { frame: _frame, ...project } = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })
  return project
}

/** The Project after a change that must happen. */
function changed(project: Project, change: FrameChange): Project {
  const result = changeFrame(project, change)
  if (result.kind !== 'changed') throw new Error(`expected a change, got ${JSON.stringify(result)}`)
  return result.project
}

const triangle = (rounds = 4, project = open()) => changed(project, { custom: { kind: 'triangle', size: rounds, centre: { row: 20, column: 30 } } })

/** Paints Frame positions (round, place in round) as a press on the Frame does. */
const paintFrame = (project: Project, positions: { row: number; column: number }[], color: string | null) =>
  onLayer(project, 'frame', (view) => paintCells(view, positions, color))

describe('a Custom frame put in place holding beads (ticket 0596)', () => {
  it('keeps the beads its layout has a position for, and drops the rest', () => {
    // A Triangle of 2 rounds has 3 beads in round 0 and 6 in round 1, none in round 2 or at place 3 of round 0.
    const placed = changed(open(), { custom: { kind: 'triangle', size: 2, centre: { row: 20, column: 30 }, beads: { 0: { 0: RED, 3: RED }, 1: { 5: BLUE }, 2: { 0: BLUE } } } })
    expect(placed.frame!.beads).toEqual({ 0: { 0: RED }, 1: { 5: BLUE } })
  })
})

describe('a Custom frame put on the open Canvas (ticket 0592)', () => {
  it('is a peyote Frame of its kind and Rounds, empty, round the centre it was given', () => {
    const frame = triangle(4).frame!
    expect(frame).toMatchObject({ kind: 'triangle', settings: { rounds: 4 }, technique: 'peyote', beads: {} })
    expect(frame.row).toBeLessThanOrEqual(20)
    expect(frame.row + frame.rows).toBeGreaterThan(20)
    expect(frame.column + frame.columns / 2).toBeCloseTo(30, -1)
  })

  it('replaces the Frame there with its beads, and turns Row progress on like any first Frame (ticket 0594)', () => {
    const square = changed(triangle(), { custom: { kind: 'warpedSquare', size: 3, centre: { row: 0, column: 0 } } })
    expect(square.frame).toMatchObject({ kind: 'warpedSquare', settings: { rounds: 3 } })
    expect(rowProgressOn(square)).toBe(true)
  })
})

describe('painting a Custom frame', () => {
  it('paints and erases its positions, and nothing where it has none', () => {
    const painted = paintFrame(triangle(3), [{ row: 2, column: 8 }, { row: 2, column: 9 }, { row: 0, column: 0 }], RED)
    expect(beadCount(painted.frame!.beads)).toBe(2)
    expect(colorAt(painted.frame!.beads, 2, 8)).toBe(RED)
    const erased = paintFrame(painted, [{ row: 2, column: 8 }], null)
    expect(colorAt(erased.frame!.beads, 2, 8)).toBeNull()
  })

  it('fills across panels where beads touch, and stops at another colour', () => {
    const project = triangle(4)
    const filled = onLayer(project, 'frame', (view) => fillArea(view, 0, 0, RED))
    expect(beadCount(filled.frame!.beads)).toBe(frameLayoutOf(project.frame!)!.positions.length)
    // A peyote column's beads touch two rounds apart, so the wall is two rounds deep.
    const wall = [1, 2].flatMap((row) => Array.from({ length: 3 * (row + 1) }, (_unused, column) => ({ row, column })))
    const walled = paintFrame(project, wall, BLUE)
    const inner = onLayer(walled, 'frame', (view) => fillArea(view, 0, 0, RED))
    expect(beadCount(inner.frame!.beads)).toBe(15 + 3)
  })
})

describe('changing a Custom frame\'s Rounds', () => {
  it('grows by empty rounds outside, keeping every bead and the centre where it was', () => {
    const project = paintFrame(triangle(3), [{ row: 2, column: 4 }], RED)
    const grown = changed(project, { settings: { rounds: 6 } })
    expect(grown.frame).toMatchObject({ settings: { rounds: 6 } })
    expect(colorAt(grown.frame!.beads, 2, 4)).toBe(RED)
    expect(grown.frame!.rows).toBeGreaterThan(project.frame!.rows)
    const centre = (frame: Project['frame']) => frame!.row + Math.floor(frame!.rows / 2)
    expect(Math.abs(centre(grown.frame) - centre(project.frame))).toBeLessThanOrEqual(1)
  })

  it('shrinks by folding the outer rounds\' painted beads, and shows them again where they were when grown back (ticket 0640)', () => {
    const project = paintFrame(triangle(4), [{ row: 3, column: 0 }, { row: 3, column: 1 }, { row: 0, column: 0 }], RED)
    const shrunk = changed(project, { settings: { rounds: 2 } })
    expect(shrunk.frame!.beads).toEqual({ 0: { 0: RED } })
    expect(shrunk.frame!.folded).toEqual({ 3: { 0: RED, 1: RED } })
    expect(computeColorQuantities(shrunk, projectPalette(shrunk))).toMatchObject([{ hex: RED, count: 1 }])
    const grown = changed(changed(shrunk, { settings: { rounds: 3 } }), { settings: { rounds: 4 } })
    expect(grown.frame!.beads).toEqual(project.frame!.beads)
    expect(grown.frame!.folded).toBeUndefined()
  })

  it('turns its Folded beads with it, and takes them with it on Remove Frame (ticket 0640)', () => {
    const shrunk = changed(paintFrame(triangle(4), [{ row: 3, column: 0 }], RED), { settings: { rounds: 3 } })
    const turned = rotateFrame(shrunk)!
    expect(turned.frame!.folded).toEqual(shrunk.frame!.folded)
    expect(changed(turned, { settings: { rounds: 4 } }).frame!.beads).toEqual({ 3: { 0: RED } })
    expect(changed(shrunk, { remove: true }).beads).toEqual(shrunk.beads)
  })

  it('is no change at the Rounds it has, and keeps within the kind\'s range', () => {
    expect(changeFrame(triangle(4), { settings: { rounds: 4 } }).kind).toBe('unchanged')
    expect(changed(triangle(4), { settings: { rounds: 999 } }).frame!.settings).toEqual({ rounds: 40 })
  })
})

describe('what a Custom frame does not offer', () => {
  it('refuses a new rectangle, Remove row/column, Frame from Selection and another Technique', () => {
    const project = triangle()
    const changes: FrameChange[] = [
      { set: { row: 0, column: 0, rows: 3, columns: 3 } },
      { removeLine: { axis: 'row', index: 0 } },
      { make: { row: 0, column: 0, rows: 3, columns: 3 } },
      { technique: 'loom' },
    ]
    for (const change of changes) expect(changeFrame(project, change)).toEqual({ kind: 'refused', reason: 'not-offered' })
  })

  it('moves with the Move handle, its beads with it', () => {
    const project = paintFrame(triangle(), [{ row: 1, column: 1 }], RED)
    const moved = changed(project, { move: { rows: 2, columns: 3 } })
    expect(moved.frame).toMatchObject({ row: project.frame!.row + 2, column: project.frame!.column + 3, beads: project.frame!.beads })
  })

  it('takes its beads with it on Remove Frame, leaving the Canvas as it was', () => {
    const project = paintFrame(triangle(), [{ row: 1, column: 1 }], RED)
    const removed = changed(project, { remove: true })
    expect(removed.frame).toBeUndefined()
    expect(removed.beads).toEqual(project.beads)
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
  { kind: 'star', setting: 'partSize', size: 4, filledShare: 1 },
  { kind: 'kaleidocycle', setting: 'partSize', size: 4, filledShare: 1 / 6 },
  { kind: 'kite', setting: 'rows', size: 9, filledShare: 1 },
] as const)('a $kind Custom frame (ticket 0593)', ({ kind, setting, size, filledShare }) => {
  const placed = (at = size) => changed(open(), { custom: { kind: kind as CustomFrameKindId, size: at, centre: { row: 20, column: 30 } } })
  const layout = () => frameLayoutOf(placed().frame!)!
  /** A position on the last round or row, and one on the first. */
  const outer = () => layout().positions.find(({ row }) => row === size - 1)!
  const inner = () => layout().positions.find(({ row }) => row === 0)!
  const name = ({ row, column }: { row: number; column: number }) => ({ row, column })

  it('is an empty peyote Frame of its kind, sized by its own setting, with Row progress on', () => {
    const project = placed()
    expect(project.frame).toMatchObject({ kind, settings: { [setting]: size }, technique: 'peyote', beads: {} })
    expect(rowProgressOn(project)).toBe(true)
  })

  it('paints and erases its positions, and nothing where it has none', () => {
    const painted = paintFrame(placed(), [name(outer()), { row: size, column: 0 }, { row: 0, column: 999 }], RED)
    expect(beadCount(painted.frame!.beads)).toBe(1)
    expect(beadCount(paintFrame(painted, [name(outer())], null).frame!.beads)).toBe(0)
  })

  it('fills every bead that touches, across its panels', () => {
    const filled = onLayer(placed(), 'frame', (view) => fillArea(view, inner().row, inner().column, RED))
    expect(beadCount(filled.frame!.beads)).toBe(layout().positions.length * filledShare)
  })

  it('grows by empty rounds or rows outside, keeping every bead, and folds what a shrink leaves out until it grows back (ticket 0640)', () => {
    const project = paintFrame(placed(), [name(inner()), name(outer())], RED)
    const grown = changed(project, { settings: { [setting]: size + 3 } })
    expect(grown.frame!.settings).toEqual({ [setting]: size + 3 })
    expect(grown.frame!.beads).toEqual(project.frame!.beads)
    const shrunk = changed(project, { settings: { [setting]: size - 1 } })
    expect(shrunk.frame!.beads).toEqual({ [inner().row]: { [inner().column]: RED } })
    expect(shrunk.frame!.folded).toEqual({ [outer().row]: { [outer().column]: RED } })
    const back = changed(shrunk, { settings: { [setting]: size } })
    expect(back.frame!.beads).toEqual(project.frame!.beads)
    expect(back.frame!.folded).toBeUndefined()
  })

  it('moves with its beads, and takes them with it on Remove Frame', () => {
    const project = paintFrame(placed(), [name(inner())], RED)
    expect(changed(project, { move: { rows: 2, columns: 3 } }).frame).toMatchObject({ row: project.frame!.row + 2, beads: project.frame!.beads })
    const removed = changed(project, { remove: true })
    expect(removed.frame).toBeUndefined()
    expect(removed.beads).toEqual(project.beads)
  })

  it('refuses a new rectangle, Remove row/column and another Technique', () => {
    for (const change of [{ set: { row: 0, column: 0, rows: 3, columns: 3 } }, { removeLine: { axis: 'row', index: 0 } }, { technique: 'loom' }] as FrameChange[]) {
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
  const earring = (given: FrameSettings = settings) => changed(open(), { custom: { kind: 'fringeEarring', settings: given, centre: { row: 20, column: 30 } } })
  /** The first bead of the base row, and the last bead of the first strand. */
  const base = { row: 0, column: 0 }
  const strandEnd = { row: 1008, column: 0 }

  it('is an empty brick-stitch Frame with its four settings, Row progress on', () => {
    const project = earring()
    expect(project.frame).toMatchObject({ kind: 'fringeEarring', settings, technique: 'brick', beads: {} })
    expect(frameLayoutOf(project.frame!)!.positions).toHaveLength(6 + 5 + 4 + 3 + 6 * 9)
    expect(rowProgressOn(project)).toBe(true)
  })

  it('reads settings it was not given as the kind\'s defaults, and fewer Top rows than its Top width, ending on a pair', () => {
    expect(earring({ topWidth: 5, topRows: 9 }).frame!.settings).toEqual({ topWidth: 5, topRows: 4, fringeStyle: 'straight', fringeLength: 12 })
  })

  it('paints its top and its strands, and nothing on the Seam between them', () => {
    const painted = paintFrame(earring(), [base, strandEnd, { row: 1009, column: 0 }, { row: 4, column: 0 }], RED)
    expect(beadCount(painted.frame!.beads)).toBe(2)
  })

  it('changes one setting at a time, keeping every bead still in it, and folds the strands\' ends a V or a shorter fringe leaves out until they come back (ticket 0640)', () => {
    const project = paintFrame(earring(), [base, strandEnd], RED)
    const longer = changed(project, { settings: { fringeLength: 12 } })
    expect(longer.frame!.settings).toEqual({ ...settings, fringeLength: 12 })
    expect(longer.frame!.beads).toEqual(project.frame!.beads)
    const shorter = changed(project, { settings: { fringeLength: 8 } })
    expect(shorter.frame!.beads).toEqual({ [base.row]: { [base.column]: RED } })
    expect(shorter.frame!.folded).toEqual({ [strandEnd.row]: { [strandEnd.column]: RED } })
    expect(changed(shorter, { settings: { fringeLength: 9 } }).frame!.beads).toEqual(project.frame!.beads)
    const v = changed(project, { settings: { fringeStyle: 'v' } })
    expect(colorAt(v.frame!.beads, 0, 0)).toBe(RED)
    expect(colorAt(v.frame!.folded!, strandEnd.row, strandEnd.column)).toBe(RED)
    expect(changed(v, { settings: { fringeStyle: 'straight' } }).frame!.beads).toEqual(project.frame!.beads)
    expect(changeFrame(project, { settings: { fringeStyle: 'straight' } }).kind).toBe('unchanged')
  })

  it('moves and turns with its beads, takes them with it on Remove Frame, and comes back from the Project file', () => {
    const project = paintFrame(earring(), [base, strandEnd], RED)
    expect(changed(project, { move: { rows: 2, columns: 3 } }).frame!.beads).toEqual(project.frame!.beads)
    const removed = changed(project, { remove: true })
    expect(removed.frame).toBeUndefined()
    expect(removed.beads).toEqual(project.beads)
    expect(parseProjectsFile(serializeProject(project)).projects).toEqual([project])
  })
})
