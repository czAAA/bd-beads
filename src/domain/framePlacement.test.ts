// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { frameCornerAt, framePlacement, laidTurnOf, withLaidTurn } from './framePlacement'
import { beadsOfLayer, canvasOf, frameOf, quarterTurnOf, withCanvas, withFrameSheet, withLayer } from './layerRecord'
import { rotateFrame, turnCanvasTo } from './rotate'
import { parseProjectsFile, serializeProject } from './projectFile'
import { withPictureTurned } from '../testUtils/layerFields'
import { changeFrame } from './changeFrame'
import { canvasPlacement, frameQuarterTurnOf } from './table'
import { findBead } from './beads'
import { canvasWeave } from './layerWeave'
import { describeWeave } from './weave'
import type { Project } from './project'

const made = (technique: 'loom' | 'peyote' | 'brick') => createProject({ technique, beadId: 'miyuki/delica/11-0', size: { width: 6, height: 5, unit: 'beads' } })

/** The Project with its Frame moved by whole Canvas positions. */
function moved(project: Project, rows: number, columns: number): Project {
  const result = changeFrame(project, { move: { rows, columns } })
  return result.kind === 'changed' ? result.project : project
}

describe('framePlacement (spec 1182, ticket 1185)', () => {
  it('puts an upright loom Frame\'s centre half its size from its corner, in the Canvas\'s bead widths', () => {
    const square = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 2, unit: 'beads' } })
    expect(framePlacement(square)).toEqual({ angle: 0, at: { x: 2, y: 1 } })
    expect(framePlacement(moved(square, 3, -5))).toEqual({ angle: 0, at: { x: -3, y: 4 } })
    expect(framePlacement(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Open' }))).toBeUndefined()
  })

  it('turns the centre round the Canvas\'s origin with the Canvas', () => {
    const square = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 2, unit: 'beads' } })
    const placement = framePlacement(withPictureTurned(square, 90))!
    expect(placement.angle).toBe(90)
    expect(placement.at.x).toBeCloseTo(-1, 9)
    expect(placement.at.y).toBeCloseTo(2, 9)
  })

  it('reads back the very Canvas position it was worked out from, in every Technique, turned, twisted and in another Bead', () => {
    const fifteen = findBead('miyuki/round/15-0')!
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const placed = moved(made(technique), 7, -3)
      const small = withLayer(placed, 'frame', { bead: fifteen })
      for (const project of [placed, rotateFrame(placed)!, withPictureTurned(rotateFrame(placed)!, 37.5), withPictureTurned(placed, 212), small, withPictureTurned(rotateFrame(small)!, 301)]) {
        const { row, column } = frameOf(project)!
        expect(frameCornerAt(project, framePlacement(project)!.at), technique).toEqual({ row, column })
      }
    }
  })
})

describe('laidTurnOf and withLaidTurn (spec 1182, ticket 1186)', () => {
  const shaped = (): Project => {
    const placed = changeFrame(made('loom'), { custom: { shape: 'triangle', size: 9, centre: { row: 20, column: 20 } } })
    if (placed.kind !== 'changed') throw new Error('expected a triangle')
    return placed.project
  }

  it('reads what exports read before 1186 while the Frame lies alike, whatever the Canvas\'s turn and lean', () => {
    for (const project of [made('peyote'), rotateFrame(made('brick'))!, shaped(), rotateFrame(shaped())!]) {
      for (const turn of [0, 90, 180, 270, 37.5, 301]) {
        const turned = withPictureTurned(project, turn)
        expect(laidTurnOf(turned)).toBe(quarterTurnOf(turned))
      }
    }
  })

  it('lays a Frame upright on a Canvas at its nearest quarter turn, whatever the Canvas\'s own turn', () => {
    for (const project of [made('loom'), rotateFrame(made('peyote'))!, withPictureTurned(rotateFrame(made('brick'))!, 101)]) {
      const laid = withLaidTurn(project)
      expect(canvasOf(laid).orientation).toBe(frameQuarterTurnOf(project))
      expect(frameOf(laid)).toEqual({ ...frameOf(project)!, angle: frameQuarterTurnOf(project), quarterTurns: undefined })
      expect(laidTurnOf(laid)).toBe(frameQuarterTurnOf(project))
      for (const turn of [90, 180, 270, 37.5, 316]) expect(withLaidTurn(withCanvas(project, { orientation: turn }))).toEqual(laid)
    }
  })

  it('keeps a Custom frame as many quarters off the Canvas as it lies, its layout built turned on that grid', () => {
    const turned = withPictureTurned(rotateFrame(shaped())!, 101)
    const laid = withLaidTurn(turned)
    expect(canvasOf(laid).orientation).toBe(90)
    expect(frameOf(laid)).toEqual({ ...frameOf(turned)!, angle: 180 })
  })

  it('lays the Canvas at a turn asked for, and leaves a Project that already lies so, or has no Frame, as it is', () => {
    const turned = rotateFrame(made('peyote'))!
    expect(canvasOf(withLaidTurn(turned, 0)).orientation).toBe(0)
    expect(frameOf(withLaidTurn(turned, 0))!.angle).toBe(0)
    const upright = withPictureTurned(made('loom'), 0)
    expect(withLaidTurn(upright)).toBe(upright)
    const open = withPictureTurned(withFrameSheet(upright, undefined), 90)
    expect(withLaidTurn(open)).toBe(open)
    expect(laidTurnOf(open)).toBe(90)
  })
})

describe('a Frame off the Canvas\'s grid (ticket 1188)', () => {
  /** A loom Frame left upright while its Canvas turned a quarter about a point off its origin. */
  const offGrid = (): Project => turnCanvasTo(moved(made('loom'), 2, 3), 90, { x: 1.25, y: 0.5 })

  it('keeps its centre on the table and has no quarter turns, its rows upright on its own drawing', () => {
    const before = moved(made('loom'), 2, 3)
    const project = offGrid()
    expect(frameOf(project)!.centre).toEqual(framePlacement(before)!.at)
    expect(frameOf(project)!.quarterTurns).toBeUndefined()
    expect(frameCornerAt(project, framePlacement(project)!.at)).toEqual({ row: frameOf(project)!.row, column: frameOf(project)!.column })
  })

  it('grows from the edge it is pulled by, the far edge staying where it is on the table', () => {
    const project = offGrid()
    const frame = frameOf(project)!
    const grown = changeFrame(project, { set: { row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns + 2 } })
    if (grown.kind !== 'changed') throw new Error('expected a resize')
    const [was, now] = [framePlacement(project)!.at, framePlacement(grown.project)!.at]
    // Upright on the table, two more columns to its right: its centre goes one bead to the right.
    expect(now.x - was.x).toBeCloseTo(1, 9)
    expect(now.y - was.y).toBeCloseTo(0, 9)
    expect(frameOf(grown.project)!.angle).toBe(0)
  })

  it('moves by its own rows and columns, along it on screen, and turns about its own centre', () => {
    const project = offGrid()
    const shifted = moved(project, 1, -2)
    const [was, now] = [framePlacement(project)!.at, framePlacement(shifted)!.at]
    // A row of the Delica is taller than a bead is wide.
    expect(now.x - was.x).toBeCloseTo(-2, 9)
    expect(now.y - was.y).toBeCloseTo(describeWeave(canvasWeave(project)).cellAspect, 9)
    const turned = rotateFrame(project)!
    expect(frameOf(turned)!.angle).toBe(90)
    expect(framePlacement(turned)!.at).toEqual(was)
  })

  it('is saved with its centre and opens where it was, at its angle', () => {
    const project = offGrid()
    const [opened] = parseProjectsFile(serializeProject(project)).projects
    // A file's table has its origin at the Canvas's.
    const origin = canvasPlacement(project).at
    const at = framePlacement(project)!.at
    expect(canvasPlacement(opened!).at).toEqual({ x: 0, y: 0 })
    expect(framePlacement(opened!)!.at.x).toBeCloseTo(at.x - origin.x, 5)
    expect(framePlacement(opened!)!.at.y).toBeCloseTo(at.y - origin.y, 5)
    expect(frameOf(opened!)!.angle).toBe(0)
    expect(beadsOfLayer(opened!, 'frame')).toEqual(beadsOfLayer(project, 'frame'))
  })

  it('drops each bead on Remove frame on the Canvas position nearest where it lies on screen', () => {
    const upright = withLayer(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 1, unit: 'beads' } }), 'frame', { beads: { 0: { 0: '#e63746', 1: '#1a1a1a' } } })
    // The Canvas turned a quarter about its origin: what lay at (x, y) on the table is at (y, -x) on the Canvas's axes.
    const project = turnCanvasTo(upright, 90)
    const removed = changeFrame(project, { remove: true })
    if (removed.kind !== 'changed') throw new Error('expected the Frame removed')
    expect(frameOf(removed.project)).toBeUndefined()
    expect(beadsOfLayer(removed.project, 'canvas')).toEqual({ [-1]: { 0: '#e63746' }, [-2]: { 0: '#1a1a1a' } })
  })
})
