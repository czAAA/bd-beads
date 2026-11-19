import { describe, expect, it } from 'vitest'
import { colorAt, withColors } from './canvas'
import { changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { footprintOf } from './footprint'
import { frameAllows } from './frameShape'
import { laidFrame, laidSize, ownEdge, ownSize, seenSize, turnedWithEdges } from './frameOrientation'
import type { FrameEdge } from './frame'
import type { GridPosition } from './grid'
import { frameWeave } from './layerWeave'
import type { Technique } from './weave'
import { layerAt } from './layers'
import { mayPlace } from './margin'
import type { Project } from './project'
import { removeLineRefusal } from './removeLine'
import { rotateFrame } from './rotate'
import { rowProgressOf, shownWayOf, toggleRowDirection, turnRowDirectionTo } from './rowProgress'
import { turnedClockwise } from '../testUtils/rotated'
import { copyLayerSelection, paintLayerSelection, pasteOnLayer } from './selection'
import { wordChartOf } from './wordChart'
import { beadsOfLayer, frameOf } from './layerRecord'
import { withLayers } from '../testUtils/layerFields'

// A Frame's orientation (ticket 0667, ADR 0079): Rotate Frame turns the Frame like a sheet on the Canvas, its beads in
// their own rows and columns, and everything that works on the Frame as it lies follows the turn.

const RED = '#e63746'
const GREEN = '#27ae60'
const BLUE = '#2f6fed'
const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
/** A loom Frame of 4 rows and 6 columns at (20, 20), a red bead in its first, turned once: it lies 6 x 4 at (19, 21). */
const upright: Project = withLayers(base, { beads: {}, frame: { technique: 'loom', row: 20, column: 20, rows: 4, columns: 6, beads: withColors({}, [{ row: 0, column: 0, color: RED }]) } })
const turned = rotateFrame(upright)!

describe('what a turned Frame covers', () => {
  it('lies in its own rows and columns turned, Width and Height swapped as seen', () => {
    expect(laidFrame(turned)).toEqual({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(seenSize(frameOf(turned)!)).toEqual({ columns: 4, rows: 6 })
    expect(laidFrame(upright)).toBe(frameOf(upright))
  })

  it('covers on brick stitch the rows its turned beads reach, which are not its own count', () => {
    const frame = { technique: 'brick' as const, rows: 5, columns: 4, quarterTurns: 1 as const }
    // Five brick rows are 5 beads tall: turned, 5 wide; four beads and a half shift across: turned, 4.5 tall.
    expect(laidSize(frame)).toEqual({ columns: 5, rows: 5 })
  })

  it('covers on peyote the columns its turned beads reach, which are not its own count (ticket 0734)', () => {
    const frame = { technique: 'peyote' as const, rows: 5, columns: 4, quarterTurns: 1 as const }
    // Five peyote rows and the half bead a shifted column hangs lower are 5.5 beads tall: turned, 5.5 wide; four columns
    // are 4 wide: turned, 4 tall.
    expect(laidSize(frame)).toEqual({ columns: 6, rows: 4 })
  })

  it('hides the Canvas and keeps the margin round what it covers, not round its own rows and columns', () => {
    expect(footprintOf(turned)).toEqual({ row: 19, column: 21, rows: 6, columns: 4 })
    expect(layerAt(turned, { row: 24, column: 22 })).toBe('frame')
    expect(layerAt(turned, { row: 21, column: 25 })).toBe('canvas')
    expect(mayPlace(turned, { row: 21, column: 25 })).toBe(false)
    expect(mayPlace(turned, { row: 21, column: 29 })).toBe(true)
  })
})

describe('what a turned Frame offers', () => {
  it('turns, is selected on, woven otherwise and resized (ticket 1016); it has a line removed and is made again only upright', () => {
    for (const action of ['rotate', 'select', 'technique', 'resize'] as const) expect(frameAllows(frameOf(turned), action)).toBe(true)
    for (const action of ['remove-line', 'from-selection'] as const) {
      expect(frameAllows(frameOf(turned), action)).toBe(false)
      expect(frameAllows(frameOf(upright), action)).toBe(true)
    }
    expect(changeFrame(turned, { make: { row: 19, column: 21, rows: 5, columns: 6 } })).toEqual({ kind: 'refused', reason: 'not-offered' })
    expect(removeLineRefusal(turned, { top: 19, left: 21, rows: 1, columns: 6, layer: 'frame' })).toBe('no-line')
  })

  it('drops its beads onto the Canvas on Remove Frame where they lie turned, its Folded beads too (ticket 0669)', () => {
    // Its first bead lies in the top-right corner of what it covers; a Folded bead past its last column, below that.
    const folded = withLayers(turned, { frame: { ...frameOf(turned)!, folded: withColors({}, [{ row: 0, column: 6, color: GREEN }]) } })
    const removed = changeFrame(folded, { remove: true })
    expect(removed.kind === 'changed' && beadsOfLayer(removed.project, 'canvas')).toEqual({ 19: { 24: RED }, 25: { 24: GREEN } })
  })
})

describe('a Selection and a Paste over a turned Frame', () => {
  it('fill the beads lying under the rectangle on screen', () => {
    // The laid rectangle's top row: on a quarter turn the Frame's first column, its rows from the last up.
    const painted = paintLayerSelection(turned, { top: 19, left: 21, rows: 1, columns: 4, layer: 'frame' }, BLUE)
    expect([3, 2, 1, 0].map((row) => colorAt(frameOf(painted)!.beads, row, 0))).toEqual([BLUE, BLUE, BLUE, BLUE])
    expect(colorAt(frameOf(painted)!.beads, 0, 1)).toBeNull()
  })

  it('lay a copy from the Canvas as it is seen', () => {
    const canvas = withLayers(turned, { beads: withColors({}, [{ row: 0, column: 0, color: RED }, { row: 0, column: 1, color: GREEN }, { row: 0, column: 2, color: BLUE }]) })
    const block = copyLayerSelection(canvas, { top: 0, left: 0, rows: 1, columns: 3, layer: 'canvas' })!
    const pasted = pasteOnLayer(canvas, block, { row: 19, column: 21, layer: 'frame' })
    // Left to right across the top of the turned Frame: its first column, from its last row up.
    expect([3, 2, 1].map((row) => colorAt(frameOf(pasted)!.beads, row, 0))).toEqual([RED, GREEN, BLUE])
  })
})

describe('a turned Frame resized (ticket 1016)', () => {
  /** The turned Frame resized to its own rectangle, as a resize handle, a stepper or a typed size asks. */
  const resized = (project: Project, set: { row: number; column: number; rows: number; columns: number }) => {
    const result = changeFrame(project, { set })
    if (result.kind !== 'changed') throw new Error(`not changed: ${result.kind}`)
    return result.project
  }

  it('grows the edge lying under the seen edge, the opposite edge staying where it is on the Canvas', () => {
    // A quarter turn puts its own top on the right as seen: two rows more there grow it two to the right.
    const grown = resized(turned, { row: 17, column: 21, rows: 6, columns: 6 })
    expect(laidFrame(grown)).toEqual({ row: 19, column: 21, rows: 6, columns: 6 })
    expect(frameOf(grown)!.quarterTurns).toBe(1)
    expect(beadsOfLayer(grown, 'frame')).toEqual({ 2: { 0: RED } })
  })

  it('folds what a smaller Frame leaves out and shows it again when it grows, the Canvas untouched', () => {
    const held = withLayers(turned, {
      beads: withColors({}, [{ row: 20, column: 26, color: BLUE }]),
      frame: { ...frameOf(turned)!, beads: withColors(frameOf(turned)!.beads, [{ row: 3, column: 5, color: GREEN }]) },
    })
    // Its own bottom lies on the left as seen: two rows fewer there, and the right edge stays.
    const smaller = resized(held, { row: 19, column: 21, rows: 2, columns: 6 })
    expect(laidFrame(smaller)).toEqual({ row: 19, column: 23, rows: 6, columns: 2 })
    expect(frameOf(smaller)!.folded).toEqual({ 3: { 5: GREEN } })
    expect(beadsOfLayer(smaller, 'canvas')).toEqual(beadsOfLayer(held, 'canvas'))
    const again = resized(smaller, { row: 19, column: 23, rows: 4, columns: 6 })
    expect(beadsOfLayer(again, 'frame')).toEqual({ 0: { 0: RED }, 3: { 5: GREEN } })
    // Grown on the right over a Canvas bead woven alike, it takes nothing from the Canvas.
    const over = resized(held, { row: 16, column: 21, rows: 7, columns: 6 })
    expect(beadsOfLayer(over, 'canvas')).toEqual(beadsOfLayer(held, 'canvas'))
    expect(beadsOfLayer(over, 'frame')).toEqual({ 3: { 0: RED }, 6: { 5: GREEN } })
  })
})

describe("a turned Frame's handles, steppers and typed size (ticket 1016)", () => {
  /** A Frame of 8 rows and 10 columns in a Technique, woven as the Canvas, turned `turns` quarters. */
  const turnedIn = (technique: Technique, turns: number) => {
    const canvas = createProject({ technique, beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
    let project = withLayers(canvas, { beads: {}, frame: { technique, row: 20, column: 20, rows: 8, columns: 10, beads: {} } })
    for (let turn = 0; turn < turns; turn++) project = rotateFrame(project)!
    return project
  }
  const dragged = (project: Project, edges: FrameEdge[], cell: GridPosition) => {
    const result = changeFrame(project, { set: turnedWithEdges({ ...frameOf(project)!, ...frameWeave(project) }, edges, cell) })
    return result.kind === 'changed' ? laidFrame(result.project)! : laidFrame(project)!
  }

  it('moves the edge a handle is dragged on as seen, the opposite one staying, on every Technique at each quarter turn', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      for (const turns of [1, 2, 3]) {
        const project = turnedIn(technique, turns)
        const laid = laidFrame(project)!
        const wider = dragged(project, ['right'], { row: laid.row, column: laid.column + laid.columns + 2 })
        expect([technique, turns, wider.column, wider.columns >= laid.columns + 2]).toEqual([technique, turns, laid.column, true])
        const taller = dragged(project, ['top'], { row: laid.row - 3, column: laid.column })
        expect([technique, turns, taller.row + taller.rows, taller.rows >= laid.rows + 2]).toEqual([technique, turns, laid.row + laid.rows, true])
        const frame = { ...frameOf(project)!, ...frameWeave(project) }
        const own = { row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns }
        const last = { row: laid.row + laid.rows - 1, column: laid.column + laid.columns - 1 }
        // A press on the beads an edge stands on, with no drag, changes nothing.
        expect(turnedWithEdges(frame, ['top', 'left'], { row: laid.row, column: laid.column })).toEqual(own)
        expect(turnedWithEdges(frame, ['bottom', 'right'], last)).toEqual(own)
        const narrower = dragged(project, ['left'], { row: laid.row, column: laid.column + 3 })
        expect([technique, turns, narrower.column + narrower.columns, narrower.columns < laid.columns]).toEqual([technique, turns, laid.column + laid.columns, true])
      }
    }
  })

  it('moves its own top or left edge by a whole cycle on whichever seen edge it lies (peyote)', () => {
    // A quarter turn puts a peyote Frame's own left edge on top as seen: a row up there is two own columns.
    const frame = { technique: 'peyote' as const, row: 20, column: 20, rows: 5, columns: 4, quarterTurns: 1 as const }
    expect(turnedWithEdges(frame, ['top'], { row: 19, column: 21 })).toEqual({ row: 20, column: 18, rows: 5, columns: 6 })
    expect(turnedWithEdges(frame, ['top'], { row: 21, column: 21 })).toEqual({ row: 20, column: 20, rows: 5, columns: 4 })
  })

  it('turned upright again after a resize, starts on a column where a peyote Frame may start', () => {
    const canvas = createProject({ technique: 'peyote', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 2, unit: 'beads' } })
    // Three quarters round, as a resize may leave it: its middle stays, which would put its first column on 21.
    const left = withLayers(canvas, { beads: {}, frame: { technique: 'peyote', row: 20, column: 20, rows: 5, columns: 4, quarterTurns: 3, beads: {} } })
    expect(frameOf(rotateFrame(left)!)).toMatchObject({ row: 20, column: 20, rows: 5, columns: 4 })
    expect(frameOf(rotateFrame(left)!)!.quarterTurns).toBeUndefined()
  })

  it('names the own edge a stepper on a seen edge moves, and the own size a typed size as seen asks', () => {
    const frame = frameOf(turned)!
    expect(['top', 'right', 'bottom', 'left'].map((edge) => ownEdge(frame, edge as FrameEdge))).toEqual(['left', 'top', 'right', 'bottom'])
    expect(ownEdge(frameOf(upright)!, 'right')).toBe('right')
    expect(ownSize(frame, { columns: 9, rows: 7 })).toEqual({ columns: 7, rows: 9 })
    expect(ownSize(frameOf(upright)!, { columns: 9, rows: 7 })).toEqual({ columns: 9, rows: 7 })
  })
})

describe('Row progress on a turned Frame', () => {
  it('runs as its own rows do, turned with it', () => {
    const thrice = rotateFrame(rotateFrame(turned)!)!
    expect(shownWayOf(upright)).toBe('down')
    expect(shownWayOf(turned)).toBe('left')
    expect(shownWayOf(toggleRowDirection(turned))).toBe('down')
    expect(shownWayOf(toggleRowDirection(toggleRowDirection(thrice)))).toBe('left')
  })

  it('puts Row 1 of the Word chart on the edge its first row lies along', () => {
    const lettered = withLayers(turned, { letters: true })
    expect(wordChartOf(withLayers(upright, { letters: true }))!.firstEdge).toBe('top')
    expect(wordChartOf(lettered)!.firstEdge).toBe('right')
    expect(wordChartOf(lettered)!.rows).toHaveLength(4)
  })
})

// Rotate canvas turns the whole picture, the Frame with it (ticket 1101): the way the rows run on screen counts both
// turns, while the Row direction the Frame keeps never changes.
describe('Row progress on a turned Canvas', () => {
  const canvasTurned = turnedClockwise(upright)
  const bothTurned = turnedClockwise(turned)

  it('shows the way as seen: the Frame\'s turn plus the Canvas\'s', () => {
    expect(shownWayOf(canvasTurned)).toBe('left')
    expect(shownWayOf(bothTurned)).toBe('up')
    expect(rowProgressOf(canvasTurned)).toEqual(rowProgressOf(upright))
    // Off a quarter turn it goes by the nearest one, as the drawing does.
    expect(shownWayOf(withLayers(upright, { orientation: 100 }))).toBe('left')
    expect(shownWayOf(withLayers(upright, { orientation: 30 }))).toBe('down')
  })

  it('runs the rows the way chosen on screen, whatever both turns are', () => {
    for (const project of [upright, turned, canvasTurned, bothTurned, turnedClockwise(bothTurned)]) {
      for (const way of ['down', 'right', 'up', 'left'] as const) {
        expect([way, shownWayOf(turnRowDirectionTo(project, way))]).toEqual([way, way])
      }
    }
  })

  it('agrees with the Word chart on the edge Row 1 lies along', () => {
    const firstEdgeOf = { down: 'top', left: 'right', up: 'bottom', right: 'left' } as const
    for (const project of [upright, turned, canvasTurned, bothTurned]) {
      const lettered = withLayers(project, { letters: true })
      expect(wordChartOf(lettered)!.firstEdge).toBe(firstEdgeOf[shownWayOf(lettered)])
    }
  })
})
