// @vitest-environment node
import { frameIdIn, FRAME_ID } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { frameCornerAt, framePlacement, laidTurnOf, withLaidTurn } from './framePlacement'
import { beadsOfLayer, canvasOf, frameOf, quarterTurnOf, withCanvas, withLayer } from './layerRecord'
import { withFrameSheet } from './frameSheet'
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
  const result = changeFrame(project, { move: { rows, columns } }, frameIdIn(project))
  return result.kind === 'changed' ? result.project : project
}

describe('framePlacement (spec 1182, ticket 1185)', () => {
  it('puts an upright loom Frame\'s centre half its size from its corner, in the Canvas\'s bead widths', () => {
    const square = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 2, unit: 'beads' } })
    expect(framePlacement(square, frameIdIn(square))).toEqual({ angle: 0, at: { x: 2, y: 1 } })
    expect(framePlacement(moved(square, 3, -5), frameIdIn(square))).toEqual({ angle: 0, at: { x: -3, y: 4 } })
    expect(framePlacement(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Open' }), frameIdIn(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Open' })))).toBeUndefined()
  })

  it('turns the centre round the Canvas\'s origin with the Canvas', () => {
    const square = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 2, unit: 'beads' } })
    const placement = framePlacement(withPictureTurned(square, 90), frameIdIn(square))!
    expect(placement.angle).toBe(90)
    expect(placement.at.x).toBeCloseTo(-1, 9)
    expect(placement.at.y).toBeCloseTo(2, 9)
  })

  it('reads back the very Canvas position it was worked out from, in every Technique, turned, twisted and in another Bead', () => {
    const fifteen = findBead('miyuki/round/15-0')!
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const placed = moved(made(technique), 7, -3)
      const small = withLayer(placed, FRAME_ID, { bead: fifteen })
      for (const project of [placed, rotateFrame(placed, undefined, frameIdIn(placed))!, withPictureTurned(rotateFrame(placed, undefined, frameIdIn(placed))!, 37.5), withPictureTurned(placed, 212), small, withPictureTurned(rotateFrame(small, undefined, frameIdIn(small))!, 301)]) {
        const { row, column } = frameOf(project)!
        expect(frameCornerAt(project, framePlacement(project, frameIdIn(project))!.at, undefined, frameIdIn(project)), technique).toEqual({ row, column })
      }
    }
  })
})

describe('laidTurnOf and withLaidTurn (spec 1182, ticket 1186)', () => {
  const shaped = (): Project => {
    const placed = changeFrame(made('loom'), { custom: { shape: 'triangle', size: 9, centre: { row: 20, column: 20 } } }, frameIdIn(made('loom')))
    if (placed.kind !== 'changed') throw new Error('expected a triangle')
    return placed.project
  }

  it('reads what exports read before 1186 while the Frame lies alike, whatever the Canvas\'s turn and lean', () => {
    for (const project of [made('peyote'), rotateFrame(made('brick'), undefined, frameIdIn(made('brick')))!, shaped(), rotateFrame(shaped(), undefined, frameIdIn(shaped()))!]) {
      for (const turn of [0, 90, 180, 270, 37.5, 301]) {
        const turned = withPictureTurned(project, turn)
        expect(laidTurnOf(turned, frameIdIn(turned))).toBe(quarterTurnOf(turned))
      }
    }
  })

  it('lays a Frame upright on a Canvas at its nearest quarter turn, whatever the Canvas\'s own turn', () => {
    for (const project of [made('loom'), rotateFrame(made('peyote'), undefined, frameIdIn(made('peyote')))!, withPictureTurned(rotateFrame(made('brick'), undefined, frameIdIn(made('brick')))!, 101)]) {
      const laid = withLaidTurn(project, undefined, frameIdIn(project))
      expect(canvasOf(laid).orientation).toBe(frameQuarterTurnOf(project, frameIdIn(project)))
      expect(frameOf(laid)).toEqual({ ...frameOf(project)!, angle: frameQuarterTurnOf(project, frameIdIn(project)), quarterTurns: undefined })
      expect(laidTurnOf(laid, frameIdIn(laid))).toBe(frameQuarterTurnOf(project, frameIdIn(project)))
      for (const turn of [90, 180, 270, 37.5, 316]) expect(withLaidTurn(withCanvas(project, { orientation: turn }), undefined, frameIdIn(project))).toEqual(laid)
    }
  })

  it('keeps a Custom frame as many quarters off the Canvas as it lies, its layout built turned on that grid', () => {
    const turned = withPictureTurned(rotateFrame(shaped(), undefined, frameIdIn(shaped()))!, 101)
    const laid = withLaidTurn(turned, undefined, frameIdIn(turned))
    expect(canvasOf(laid).orientation).toBe(90)
    expect(frameOf(laid)).toEqual({ ...frameOf(turned)!, angle: 180 })
  })

  it('lays the Canvas at a turn asked for, and leaves a Project that already lies so, or has no Frame, as it is', () => {
    const turned = rotateFrame(made('peyote'), undefined, frameIdIn(made('peyote')))!
    expect(canvasOf(withLaidTurn(turned, 0, frameIdIn(turned))).orientation).toBe(0)
    expect(frameOf(withLaidTurn(turned, 0, frameIdIn(turned)))!.angle).toBe(0)
    const upright = withPictureTurned(made('loom'), 0)
    expect(withLaidTurn(upright, undefined, frameIdIn(upright))).toBe(upright)
    const open = withPictureTurned(withFrameSheet(upright, undefined, { frame: frameIdIn(upright) }), 90)
    expect(withLaidTurn(open, undefined, frameIdIn(open))).toBe(open)
    expect(laidTurnOf(open, frameIdIn(open))).toBe(90)
  })
})

describe('a Frame off the Canvas\'s grid (ticket 1188)', () => {
  /** A loom Frame left upright while its Canvas turned a quarter about a point off its origin. */
  const offGrid = (): Project => turnCanvasTo(moved(made('loom'), 2, 3), 90, { x: 1.25, y: 0.5 })

  it('keeps its centre on the table and has no quarter turns, its rows upright on its own drawing', () => {
    const before = moved(made('loom'), 2, 3)
    const project = offGrid()
    expect(frameOf(project)!.centre).toEqual(framePlacement(before, frameIdIn(before))!.at)
    expect(frameOf(project)!.quarterTurns).toBeUndefined()
    expect(frameCornerAt(project, framePlacement(project, frameIdIn(project))!.at, undefined, frameIdIn(project))).toEqual({ row: frameOf(project)!.row, column: frameOf(project)!.column })
  })

  it('grows from the edge it is pulled by, the far edge staying where it is on the table', () => {
    const project = offGrid()
    const frame = frameOf(project)!
    const grown = changeFrame(project, { set: { row: frame.row, column: frame.column, rows: frame.rows, columns: frame.columns + 2 } }, frameIdIn(project))
    if (grown.kind !== 'changed') throw new Error('expected a resize')
    const [was, now] = [framePlacement(project, frameIdIn(project))!.at, framePlacement(grown.project, frameIdIn(grown.project))!.at]
    // Upright on the table, two more columns to its right: its centre goes one bead to the right.
    expect(now.x - was.x).toBeCloseTo(1, 9)
    expect(now.y - was.y).toBeCloseTo(0, 9)
    expect(frameOf(grown.project)!.angle).toBe(0)
  })

  it('moves by its own rows and columns, along it on screen, and turns about its own centre', () => {
    const project = offGrid()
    const shifted = moved(project, 1, -2)
    const [was, now] = [framePlacement(project, frameIdIn(project))!.at, framePlacement(shifted, frameIdIn(shifted))!.at]
    // A row of the Delica is taller than a bead is wide.
    expect(now.x - was.x).toBeCloseTo(-2, 9)
    expect(now.y - was.y).toBeCloseTo(describeWeave(canvasWeave(project)).cellAspect, 9)
    const turned = rotateFrame(project, undefined, frameIdIn(project))!
    expect(frameOf(turned)!.angle).toBe(90)
    expect(framePlacement(turned, frameIdIn(turned))!.at).toEqual(was)
  })

  it('is saved with its centre and opens where it was, at its angle', () => {
    const project = offGrid()
    const [opened] = parseProjectsFile(serializeProject(project)).projects
    // A file's table has its origin at the Canvas's.
    const origin = canvasPlacement(project).at
    const at = framePlacement(project, frameIdIn(project))!.at
    expect(canvasPlacement(opened!).at).toEqual({ x: 0, y: 0 })
    expect(framePlacement(opened!, frameIdIn(opened))!.at.x).toBeCloseTo(at.x - origin.x, 5)
    expect(framePlacement(opened!, frameIdIn(opened))!.at.y).toBeCloseTo(at.y - origin.y, 5)
    expect(frameOf(opened!)!.angle).toBe(0)
    expect(beadsOfLayer(opened!, frameIdIn(opened!))).toEqual(beadsOfLayer(project, frameIdIn(project)))
  })

  it('takes its beads with it on Remove frame, dropping none onto the Canvas (tickets 1189, 1215)', () => {
    const upright = withLayer(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 1, unit: 'beads' } }), FRAME_ID, { beads: { 0: { 0: '#e63746', 1: '#1a1a1a' } } })
    // The Canvas turned a quarter about its origin: what lay at (x, y) on the table is at (y, -x) on the Canvas's axes.
    const project = turnCanvasTo(upright, 90)
    const removed = changeFrame(project, { remove: true }, frameIdIn(project))
    if (removed.kind !== 'changed') throw new Error('expected the Frame removed')
    expect(frameOf(removed.project)).toBeUndefined()
    expect(beadsOfLayer(removed.project, 'canvas')).toEqual({})
  })
})
