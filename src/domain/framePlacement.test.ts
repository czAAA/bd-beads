// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { frameCornerAt, framePlacement, laidTurnOf, withLaidTurn } from './framePlacement'
import { canvasOf, frameOf, quarterTurnOf, withCanvas, withFrameSheet, withLayer } from './layerRecord'
import { rotateFrame, turnCanvasTo } from './rotate'
import { changeFrame } from './changeFrame'
import { frameQuarterTurnOf } from './table'
import { findBead } from './beads'
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
    const placement = framePlacement(turnCanvasTo(square, 90))!
    expect(placement.angle).toBe(90)
    expect(placement.at.x).toBeCloseTo(-1, 9)
    expect(placement.at.y).toBeCloseTo(2, 9)
  })

  it('reads back the very Canvas position it was worked out from, in every Technique, turned, twisted and in another Bead', () => {
    const fifteen = findBead('miyuki/round/15-0')!
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const placed = moved(made(technique), 7, -3)
      const small = withLayer(placed, 'frame', { bead: fifteen })
      for (const project of [placed, rotateFrame(placed)!, turnCanvasTo(rotateFrame(placed)!, 37.5), turnCanvasTo(placed, 212), small, turnCanvasTo(rotateFrame(small)!, 301)]) {
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
        const turned = turnCanvasTo(project, turn)
        expect(laidTurnOf(turned)).toBe(quarterTurnOf(turned))
      }
    }
  })

  it('lays a Frame upright on a Canvas at its nearest quarter turn, whatever the Canvas\'s own turn', () => {
    for (const project of [made('loom'), rotateFrame(made('peyote'))!, turnCanvasTo(rotateFrame(made('brick'))!, 101)]) {
      const laid = withLaidTurn(project)
      expect(canvasOf(laid).orientation).toBe(frameQuarterTurnOf(project))
      expect(frameOf(laid)).toEqual({ ...frameOf(project)!, angle: frameQuarterTurnOf(project), quarterTurns: undefined })
      expect(laidTurnOf(laid)).toBe(frameQuarterTurnOf(project))
      for (const turn of [90, 180, 270, 37.5, 316]) expect(withLaidTurn(withCanvas(project, { orientation: turn }))).toEqual(laid)
    }
  })

  it('keeps a Custom frame as many quarters off the Canvas as it lies, its layout built turned on that grid', () => {
    const turned = turnCanvasTo(rotateFrame(shaped())!, 101)
    const laid = withLaidTurn(turned)
    expect(canvasOf(laid).orientation).toBe(90)
    expect(frameOf(laid)).toEqual({ ...frameOf(turned)!, angle: 180 })
  })

  it('lays the Canvas at a turn asked for, and leaves a Project that already lies so, or has no Frame, as it is', () => {
    const turned = rotateFrame(made('peyote'))!
    expect(canvasOf(withLaidTurn(turned, 0)).orientation).toBe(0)
    expect(frameOf(withLaidTurn(turned, 0))!.angle).toBe(0)
    const upright = turnCanvasTo(made('loom'), 0)
    expect(withLaidTurn(upright)).toBe(upright)
    const open = turnCanvasTo(withFrameSheet(upright, undefined), 90)
    expect(withLaidTurn(open)).toBe(open)
    expect(laidTurnOf(open)).toBe(90)
  })
})
