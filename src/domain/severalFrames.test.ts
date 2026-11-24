import { frameIdIn } from '../testUtils/frameId'
import { firstOf, SECOND, twoFrames } from '../testUtils/twoFrames'
import { withLayers } from '../testUtils/layerFields'
import { describe, expect, it } from 'vitest'
import { keepAllowedEdits } from './allowedEdits'
import { colorAt, withColors } from './canvas'
import { changeFrame, type FrameChangeResult } from './changeFrame'
import { createProject } from './createProject'
import { footprintsOf } from './footprint'
import { withFrameSheet } from './frameSheet'
import { frameMet, twistStop } from './frameSpacing'
import type { FrameId, GridPosition } from './grid'
import { beadsOfLayer, frameById, frameIdOf, framesOf, newLayerId, soloFrame } from './layerRecord'
import { beadsShown, inMargin, mayPlace, selectionAllowed, trimToAllowed } from './margin'
import type { Project } from './project'
import { rotateFrame, rotateSelection, twistFrameTo } from './rotate'
import { pasteOnLayer, pieceSelectionOnLayer, type CopiedBlock } from './selection'
import { placedStarter, starterById, designSizes } from './starters'
import { frameAngleOf } from './table'

// Ticket 1218: every rule of the Frame holds for each Frame. The app still makes one, so these Projects have two
// (`twoFrames`), each with its own Keep-out margin.

const RED = '#ff0000'

/** The Canvas beads painted as a drawing command would hand them over, before an Edit keeps what may stay. */
const rawPaint = (project: Project, positions: GridPosition[], color: string | null): Project =>
  withLayers(project, { beads: withColors(beadsOfLayer(project, 'canvas'), positions.map((position) => ({ ...position, color }))) })

/** The Project a Frame change made; fails on any other outcome. */
function changed(result: FrameChangeResult): Project {
  if (result.kind !== 'changed') throw new Error(`not changed: ${result.kind}`)
  return result.project
}

describe('each Frame keeps its own margin (ticket 1218)', () => {
  const project = twoFrames()
  const inFirst = { row: 7, column: 1 }
  const inSecond = { row: 18, column: 22 }

  it('refuses a press in either margin, and allows both Frames and the Canvas between', () => {
    expect([mayPlace(project, inFirst), mayPlace(project, inSecond)]).toEqual([false, false])
    expect(inMargin(footprintsOf(project), inSecond)).toBe(true)
    expect(mayPlace(project, { row: 12, column: 12 })).toBe(true)
    expect(mayPlace(project, { row: 21, column: 21 })).toBe(true)
    expect(mayPlace(project, { row: 1, column: 1 })).toBe(true)
  })

  it('takes back Paint, Paste and Rotate in either margin, and lets Erase through', () => {
    const painted = keepAllowedEdits(project, rawPaint(project, [inFirst, inSecond, { row: 12, column: 12 }], RED))
    expect([inFirst, inSecond, { row: 12, column: 12 }].map(({ row, column }) => colorAt(beadsOfLayer(painted, 'canvas'), row, column))).toEqual([null, null, RED])

    const block: CopiedBlock = { rows: 1, columns: 10, colors: [Array<string>(10).fill(RED)], anchor: { row: 0, column: 0 } }
    const pasted = keepAllowedEdits(project, pasteOnLayer(project, block, { row: 18, column: 10 }))
    const row = beadsOfLayer(pasted, 'canvas')[18] ?? {}
    expect(Object.keys(row).map(Number)).toEqual([10, 11, 12, 13, 14, 15])

    const strip = rawPaint(project, Array.from({ length: 9 }, (_, i) => ({ row: 12, column: 18 + i })), RED)
    const drawn = keepAllowedEdits(project, strip)
    const turned = keepAllowedEdits(drawn, rotateSelection(drawn, { top: 12, left: 18, rows: 1, columns: 9 }).project)
    expect(colorAt(beadsOfLayer(turned, 'canvas'), 15, 22)).toBe(RED)
    expect(colorAt(beadsOfLayer(turned, 'canvas'), 16, 22)).toBeNull()

    const legacy = withLayers(project, { beads: withColors({}, [{ ...inSecond, color: RED }]) })
    const erased = keepAllowedEdits(legacy, rawPaint(legacy, [inSecond], null))
    expect(colorAt(beadsOfLayer(erased, 'canvas'), inSecond.row, inSecond.column)).toBeNull()
  })

  it('keeps a Selection out of either margin, trimming it clear of both', () => {
    const footprints = footprintsOf(project)
    expect(selectionAllowed(footprints, { top: 17, left: 22, rows: 1, columns: 1 })).toBe(false)
    expect(trimToAllowed(footprints, { top: 4, left: 4, rows: 16, columns: 16 }, { row: 12, column: 12 })).toEqual({ top: 4, left: 8, rows: 12, columns: 12 })
    expect(trimToAllowed(footprints, { top: 4, left: 4, rows: 16, columns: 16 }, inSecond)).toBeUndefined()
    const pieced = withLayers(project, { beads: withColors({}, [{ ...inSecond, color: RED }]) })
    expect(pieceSelectionOnLayer(pieced, inSecond)).toBeUndefined()
  })

  it('hides and leaves uncounted the Canvas beads under either Frame or margin', () => {
    const beads = withColors({}, [inFirst, inSecond, { row: 21, column: 21 }, { row: 12, column: 12 }].map((at) => ({ ...at, color: RED })))
    expect(beadsShown(beads, footprintsOf(project))).toEqual({ 12: { 12: RED } })
  })
})

describe('Frames never meet (spec 1214, ticket 1218)', () => {
  it('stops a move at the last place clear of the other Frame', () => {
    const project = twoFrames()
    expect(frameMet(project, SECOND)).toBeUndefined()
    const moved = changed(changeFrame(project, { move: { rows: -20, columns: -20 } }, SECOND))
    expect(frameById(moved, SECOND)).toMatchObject({ row: 12, column: 12 })
    expect(frameMet(moved, SECOND)).toBeUndefined()
    expect(changeFrame(moved, { move: { rows: -1, columns: -1 } }, SECOND).kind).toBe('unchanged')
    // A move that stays clear is taken whole.
    expect(frameById(changed(changeFrame(project, { move: { rows: 5, columns: -20 } }, SECOND)), SECOND)).toMatchObject({ row: 25, column: 0 })
  })

  it('stops a resize at the last size clear of the other Frame', () => {
    const project = twoFrames()
    const grown = changed(changeFrame(project, { set: { row: 10, column: 10, rows: 16, columns: 14 } }, SECOND))
    expect(frameById(grown, SECOND)).toMatchObject({ row: 12, column: 12, rows: 14, columns: 12 })
    expect(frameById(grown, firstOf(project))).toEqual(frameById(project, firstOf(project)))
  })

  it('leaves a Frame unturned where Rotate Frame would bring it into the other margin', () => {
    // A tall strip whose margin clears the first Frame's by two: turned across, it would lie over it.
    const project = twoFrames({ row: 0, column: 14 }, { rows: 20, columns: 2 })
    expect(frameMet(project, SECOND)).toBeUndefined()
    expect(rotateFrame(project, 'keep', SECOND)).toBeUndefined()
    expect(rotateFrame(twoFrames(), 'keep', SECOND)).toBeDefined()
  })

  it('stops a twist at the last whole degree clear of the other Frame', () => {
    const project = twoFrames({ row: 0, column: 14 }, { rows: 20, columns: 2 })
    const stop = twistStop(project, 90, SECOND)
    expect(stop).toBeGreaterThan(0)
    expect(stop).toBeLessThan(90)
    const twisted = twistFrameTo(project, 90, 'keep', SECOND)!
    expect(frameAngleOf(twisted, SECOND)).toBe(stop)
    expect(frameMet(twisted, SECOND)).toBeUndefined()
    expect(twistStop(twoFrames(), 30, SECOND)).toBe(30)
  })
})

describe('a view of one Frame (ticket 1218)', () => {
  it('holds the Canvas and the Frame named, and is the Project itself where that is all it holds', () => {
    const project = twoFrames()
    const solo = soloFrame(project, SECOND)
    expect(solo.layers.map((layer) => layer.id)).toEqual([project.layers[0].id, SECOND])
    expect(frameById(solo, SECOND)).toEqual(frameById(project, SECOND))
    const one = soloFrame(project, firstOf(project))
    expect(soloFrame(one, firstOf(project))).toBe(one)
  })
})

describe('a Starter on an open Project (ticket 1218)', () => {
  it('adds a Frame, the one there left as it was', () => {
    const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })
    const project = withFrameSheet(base, { row: 0, column: 0, rows: 6, columns: 4, beads: {}, technique: 'loom' }, { frame: frameIdIn(base) })
    const starter = starterById('triangle')
    const added = newLayerId() as FrameId
    const placed = changed(placedStarter(project, starter, { sizes: designSizes(starter), useDesign: true }, { row: 60, column: 60 }, added))
    expect(framesOf(placed).map(frameIdOf)).toEqual([firstOf(project), added])
    expect(frameById(placed, firstOf(project))).toEqual(frameById(project, firstOf(project)))
    expect(frameById(placed, added)!.shape).toBe('triangle')
  })
})
