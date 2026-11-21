// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { changeFrame } from './changeFrame'
import { createProject } from './createProject'
import { framePlacement, withLaidTurn } from './framePlacement'
import { beadsOfLayer, canvasOf, frameOf } from './layerRecord'
import type { Project } from './project'
import { rotateFrame, turnCanvasTo, twistFrameTo } from './rotate'
import { currentPass, frameRowOrder, moveToRow, rowProgressOf, seenWayOf, turnRowDirectionTo } from './rowProgress'
import { frameQuarterTurnOf, lieAlike, settledFrameAngle } from './table'
import type { Technique } from './weave'
import { twistFrameQuestion } from './wovenLines'

// A two-finger twist of the Frame (ticket 1190, spec 1182): it turns the Frame about its own centre, settles onto the
// Canvas's angle with whole positions, then onto the screen's quarter turns, else leans; one Undo step on settle.

const beadId = 'miyuki/delica/11-0'

/** A Project of 10 by 8 beads in a Technique, its Frame moved off the origin by whole positions. */
function framed(technique: Technique = 'loom'): Project {
  const made = createProject({ technique, beadId, size: { width: 10, height: 8, unit: 'beads' } })
  const moved = changeFrame(made, { move: { rows: 4, columns: 6 } })
  return moved.kind === 'changed' ? moved.project : made
}

const centreOf = (project: Project) => framePlacement(project)!.at

function expectSameCentre(after: Project, before: Project): void {
  expect(centreOf(after).x).toBeCloseTo(centreOf(before).x, 6)
  expect(centreOf(after).y).toBeCloseTo(centreOf(before).y, 6)
}

describe('the Frame\'s settle (ticket 1190)', () => {
  it('eases onto the Canvas\'s angle, or a quarter off it, within about 10°', () => {
    const canvas = turnCanvasTo(framed(), 37)
    expect(settledFrameAngle(canvas, 44)).toBe(37)
    expect(settledFrameAngle(canvas, 30)).toBe(37)
    expect(settledFrameAngle(canvas, 120)).toBe(127)
    expect(settledFrameAngle(canvas, 310)).toBe(307)
  })

  it('else onto the screen\'s nearest quarter turn within about 10°', () => {
    const canvas = turnCanvasTo(framed(), 37)
    expect(settledFrameAngle(canvas, 5)).toBe(0)
    expect(settledFrameAngle(canvas, 352)).toBe(0)
    expect(settledFrameAngle(canvas, 96)).toBe(90)
  })

  it('else stays leaning where it is', () => {
    const canvas = turnCanvasTo(framed(), 37)
    expect(settledFrameAngle(canvas, 62)).toBe(62)
    expect(settledFrameAngle(framed(), 23)).toBe(23)
  })

  it('takes the Canvas\'s angle first where both are near', () => {
    const canvas = turnCanvasTo(framed(), 8)
    expect(settledFrameAngle(canvas, 3)).toBe(8)
  })
})

describe('twistFrameTo (ticket 1190)', () => {
  it('leans the Frame about its own centre, off the Canvas\'s grid, its beads and Canvas untouched', () => {
    const before = framed()
    const after = twistFrameTo(before, 23)!
    expect(frameOf(after)!.angle).toBe(23)
    expect(frameOf(after)!.centre).toBeDefined()
    expect(lieAlike(after)).toBe(false)
    expectSameCentre(after, before)
    expect(beadsOfLayer(after, 'frame')).toEqual(beadsOfLayer(before, 'frame'))
    expect(canvasOf(after)).toEqual(canvasOf(before))
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt)
  })

  it('rests on the screen\'s quarter turn on a turned Canvas, off its grid, where it was', () => {
    const before = turnCanvasTo(framed(), 37)
    const leaning = twistFrameTo(before, 20)!
    const upright = twistFrameTo(leaning, 0)!
    expect(frameOf(upright)!.angle).toBe(0)
    expect(lieAlike(upright)).toBe(false)
    expectSameCentre(upright, before)
  })

  it('lies alike again on the Canvas\'s angle, slid onto whole positions a Frame may start on, in every Technique', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      const before = framed(technique)
      const leaning = twistFrameTo(before, 23)!
      const back = twistFrameTo(leaning, canvasOf(before).orientation)!
      expect(lieAlike(back), technique).toBe(true)
      const [was, now] = [frameOf(before)!, frameOf(back)!]
      expect({ row: now.row, column: now.column }, technique).toEqual({ row: was.row, column: was.column })
      expectSameCentre(back, before)
    }
  })

  it('lies alike again on a Canvas at a fractional angle, float noise no lean', () => {
    const before = turnCanvasTo(framed(), 37.3)
    const back = twistFrameTo(twistFrameTo(before, 60)!, settledFrameAngle(before, 125))!
    expect(frameOf(back)!.angle).toBe(127.3)
    expect(frameOf(back)!.centre).toBeUndefined()
  })

  it('slides a Frame moved off its positions onto the nearest one, a quarter off the Canvas too', () => {
    const before = framed()
    const leaning = twistFrameTo(before, 23)!
    const centre = centreOf(leaning)
    // Moved half a bead and a little across and down by hand while it leaned.
    const nudged = { ...leaning, layers: [leaning.layers[0], { ...leaning.layers[1]!, centre: { x: centre.x + 0.4, y: centre.y - 0.3 } }] } as Project
    const quarter = twistFrameTo(nudged, 90)!
    expect(lieAlike(quarter)).toBe(false)
    expect(frameOf(quarter)!.centre).toBeUndefined()
    expect(frameOf(quarter)!.quarterTurns).toBe(1)
    const upright = twistFrameTo(nudged, 0)!
    expect(lieAlike(upright)).toBe(true)
    expect({ row: frameOf(upright)!.row, column: frameOf(upright)!.column }).toEqual({ row: frameOf(before)!.row, column: frameOf(before)!.column })
  })

  it('is read by its nearest quarter turn: a lean is in no export', () => {
    const leaning = twistFrameTo(framed(), 23)!
    expect(frameQuarterTurnOf(leaning)).toBe(0)
    const laid = withLaidTurn(leaning)
    expect(frameOf(laid)!.angle).toBe(0)
    expect(frameOf(laid)!.centre).toBeUndefined()
    expect(frameQuarterTurnOf(twistFrameTo(framed(), 70)!)).toBe(90)
  })

  it('leaves Row progress as it is with no pass done, so the way sticks as seen', () => {
    const before = turnRowDirectionTo(framed(), 'left')
    const after = twistFrameTo(before, 90)!
    expect(rowProgressOf(after)).toEqual(rowProgressOf(before))
    expect(seenWayOf(after)).toBe('left')
  })

  it('with a pass done, keeps the rows turned with the Frame, or starts over, as Rotate Frame does', () => {
    const before = moveToRow(framed(), 3)
    const kept = twistFrameTo(before, 85, 'keep')!
    expect(rowProgressOf(kept)).toEqual(rowProgressOf(rotateFrame(before, 'keep')!))
    expect(currentPass(rowProgressOf(kept))).toBe(3)
    expect(rowProgressOf(twistFrameTo(before, 270, 'start-over')!)).toEqual({ way: seenWayOf(before) })
    const back = twistFrameTo(before, 265, 'keep')!
    const [was, now] = [frameRowOrder(before), frameRowOrder(back)]
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 10; column += 1) expect(now.passAt({ row, column })).toBe(was.passAt({ row, column }))
    }
  })

  it('leaves Row progress alone for a lean about the quarter turn it is read by, a pass done or not', () => {
    const before = moveToRow(framed(), 3)
    expect(rowProgressOf(twistFrameTo(before, 30, 'start-over')!)).toEqual(rowProgressOf(before))
  })

  it('does nothing without a Frame', () => {
    const removed = changeFrame(framed(), { remove: true })
    if (removed.kind !== 'changed') throw new Error('expected the Frame removed')
    expect(twistFrameTo(removed.project, 30)).toBeUndefined()
  })
})

describe('a Frame twist\'s question (ticket 1190)', () => {
  it('asks Rotate Frame\'s question where it settles on another quarter turn with a pass done', () => {
    const woven = moveToRow(framed(), 2)
    expect(twistFrameQuestion(woven, 90)).toEqual({ lines: 2, way: seenWayOf(woven) })
    expect(twistFrameQuestion(woven, 300)).toEqual({ lines: 2, way: seenWayOf(woven) })
  })

  it('asks nothing for a lean about its quarter turn, or with no pass done', () => {
    expect(twistFrameQuestion(moveToRow(framed(), 2), 30)).toBeUndefined()
    expect(twistFrameQuestion(framed(), 90)).toBeUndefined()
  })
})

describe('Rotate Frame from a leaning angle (ticket 1190)', () => {
  it('turns a quarter on from whatever angle the Frame is at, about its centre', () => {
    const leaning = twistFrameTo(framed(), 23)!
    const turned = rotateFrame(leaning)!
    expect(frameOf(turned)!.angle).toBe(113)
    expectSameCentre(turned, leaning)
    expect(frameOf(rotateFrame(turned)!)!.angle).toBe(203)
  })
})
