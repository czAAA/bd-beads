// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeColorQuantities } from './beadQuantities'
import { beadCount, colorAt } from './canvas'
import { changeFrame, customFrameLoss, type FrameChange } from './changeFrame'
import { frameLayoutOf, type CustomFrameKindId } from './frameKind'
import { onLayer } from './layers'
import { projectPalette } from './palette'
import { parseProjectsFile, serializeProject } from './projectFile'
import { createProject, fillArea, paintCells, rowProgressOn, type Project } from './project'

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

  it('shrinks by dropping the outer rounds, and says how many painted beads that would drop', () => {
    const project = paintFrame(triangle(4), [{ row: 3, column: 0 }, { row: 3, column: 1 }, { row: 0, column: 0 }], RED)
    expect(customFrameLoss(project, { rounds: 3 })).toBe(2)
    expect(customFrameLoss(project, { rounds: 5 })).toBe(0)
    const shrunk = changed(project, { settings: { rounds: 3 } })
    expect(beadCount(shrunk.frame!.beads)).toBe(1)
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

  it('grows by empty rounds or rows outside, keeping every bead, and asks before shrinking drops painted ones', () => {
    const project = paintFrame(placed(), [name(inner()), name(outer())], RED)
    const grown = changed(project, { settings: { [setting]: size + 3 } })
    expect(grown.frame!.settings).toEqual({ [setting]: size + 3 })
    expect(grown.frame!.beads).toEqual(project.frame!.beads)
    expect(customFrameLoss(project, { [setting]: size - 1 })).toBeGreaterThanOrEqual(1)
    expect(beadCount(changed(project, { settings: { [setting]: size - 1 } }).frame!.beads)).toBeLessThan(2)
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
