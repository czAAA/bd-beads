// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { frameOf } from './layerRecord'
import { rotateFrame, turnCanvasTo } from './rotate'
import { moveToRow, ownRowWayOf, rowProgressOf, seenWayOf, turnRowDirectionTo } from './rowProgress'
import { canvasPlacement, frameAngleOf, frameQuarterTurnOf, lieAlike, withCanvasTurned } from './table'
import { bareProject } from '../testUtils/layerFields'

const beadId = 'miyuki/delica/11-0'
const made = (technique: 'loom' | 'peyote' | 'brick') => createProject({ technique, beadId, size: { width: 6, height: 5, unit: 'beads' } })

describe('the layers\' placements on the table (spec 1182, ticket 1185)', () => {
  it('lays a new Frame at the Canvas\'s angle, the Canvas\'s origin the table\'s', () => {
    expect(canvasPlacement(made('peyote'))).toEqual({ angle: 90, at: { x: 0, y: 0 } })
    expect(frameAngleOf(made('peyote'))).toBe(90)
    expect(frameAngleOf(made('loom'))).toBe(0)
    // With no Frame, the angle a new one would lie at.
    expect(frameAngleOf(createProject({ technique: 'peyote', beadId, name: 'Open' }))).toBe(90)
  })

  it('gives the Frame its own angle in degrees, Rotate Frame turning it a quarter on the table', () => {
    const turned = rotateFrame(made('loom'))!
    expect(frameAngleOf(turned)).toBe(90)
    expect(frameOf(turned)!.quarterTurns).toBe(1)
    expect(frameQuarterTurnOf(rotateFrame(turned)!)).toBe(180)
  })

  it('carries the Frame with the Canvas until 1188: its angle turns as far, and its own rows stay its own', () => {
    const woven = moveToRow(turnRowDirectionTo(rotateFrame(made('loom'))!, 'right'), 2)
    const twisted = turnCanvasTo(woven, 37.5)
    expect(frameAngleOf(twisted)).toBe(127.5)
    expect(frameQuarterTurnOf(twisted)).toBe(90)
    expect(frameOf(twisted)!.quarterTurns).toBe(1)
    const halfRound = withCanvasTurned(woven, 180)
    expect(frameAngleOf(halfRound)).toBe(270)
    // The Frame's own axis and end, and every pass done on them, stay; the way as seen turns with them.
    expect(ownRowWayOf(halfRound)).toEqual(ownRowWayOf(woven))
    expect(seenWayOf(halfRound)).toBe('left')
    expect(rowProgressOf(halfRound)).toEqual({ way: 'left', left: 2 })
    expect(withCanvasTurned(woven, 0)).toBe(woven)
  })

  it('carries a Custom frame, whose Row order runs one way, with its progress as it was', () => {
    const stars = bareProject({ technique: 'peyote', frame: { row: 0, column: 0, rows: 9, columns: 9, technique: 'peyote', beads: {}, shape: 'star' } })
    const turned = withCanvasTurned(stars, 90)
    expect(frameAngleOf(turned)).toBe(90)
    expect(rowProgressOf(turned)).toEqual(rowProgressOf(stars))
    expect(seenWayOf(turned)).toBe('left')
  })
})

describe('lieAlike (spec 1182, ticket 1185)', () => {
  it('is true with no Frame, and for a Frame at the Canvas\'s angle on whole positions, the Canvas leaning or not', () => {
    expect(lieAlike(createProject({ technique: 'loom', beadId, name: 'Open' }))).toBe(true)
    expect(lieAlike(made('peyote'))).toBe(true)
    expect(lieAlike(turnCanvasTo(made('brick'), 37.5))).toBe(true)
  })

  it('is false for a Frame turned on the Canvas, and true again once turned back', () => {
    const turned = rotateFrame(made('loom'))!
    expect(lieAlike(turned)).toBe(false)
    expect(lieAlike(turnCanvasTo(turned, 200))).toBe(false)
    expect(lieAlike(rotateFrame(rotateFrame(rotateFrame(turned)!)!)!)).toBe(true)
  })

  it('takes a Custom frame turned a quarter as lying alike: its turned layout is built on the Canvas\'s grid', () => {
    const star = bareProject({ technique: 'peyote', frame: { row: 0, column: 0, rows: 9, columns: 9, technique: 'peyote', beads: {}, shape: 'star', quarterTurns: 1 } })
    expect(frameOf(star)!.quarterTurns).toBe(1)
    expect(lieAlike(star)).toBe(true)
  })
})
