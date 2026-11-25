// @vitest-environment node
import { frameIdIn } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { canvasOf, frameOf } from './layerRecord'
import { rotateFrame, turnCanvasTo, turnTableTo } from './rotate'
import { moveToRow, rowProgressOf, seenWayOf, turnRowDirectionTo } from './rowProgress'
import { canvasAngleOf, frameAngleOf, frameQuarterTurnOf, tableTurnOf } from './table'
import { withCanvasTurned } from './framePlacement'
import { bareProject } from '../testUtils/layerFields'

const beadId = 'miyuki/delica/11-0'
const made = (technique: 'loom' | 'peyote' | 'brick') => createProject({ technique, beadId, size: { width: 6, height: 5, unit: 'beads' } })

describe('the layers\' places on the Table (spec 1234, ticket 1237)', () => {
  it('lays a new Frame at the Canvas\'s angle, the Canvas\'s origin the Table\'s', () => {
    expect(canvasOf(made('peyote')).origin).toBeUndefined()
    expect(canvasAngleOf(made('peyote'))).toBe(90)
    expect(frameAngleOf(made('peyote'), frameIdIn(made('peyote')))).toBe(canvasAngleOf(made('peyote')))
    expect(frameAngleOf(made('loom'), frameIdIn(made('loom')))).toBe(0)
    // With no Frame, the angle a new one would lie at.
    const open = createProject({ technique: 'peyote', beadId, name: 'Open' })
    expect(frameAngleOf(open, frameIdIn(open))).toBe(canvasAngleOf(open))
  })

  it('gives the Frame its own angle in degrees, Rotate Frame turning it a quarter on the Table', () => {
    const turned = rotateFrame(made('loom'), undefined, frameIdIn(made('loom')))!
    expect(frameAngleOf(turned, frameIdIn(turned))).toBe(90)
    expect(frameQuarterTurnOf(turned, frameIdIn(turned))).toBe(90)
    expect(frameQuarterTurnOf(rotateFrame(turned, undefined, frameIdIn(turned))!, frameIdIn(turned))).toBe(180)
  })

  it('turns the Canvas alone (ticket 1188): the Frame keeps its angle, its centre and its way as seen', () => {
    const frameTurned = rotateFrame(made('loom'), undefined, frameIdIn(made('loom')))!
    const woven = moveToRow(turnRowDirectionTo(frameTurned, 'right', frameIdIn(frameTurned)), 2, frameIdIn(frameTurned))
    const turned = turnCanvasTo(woven, 90)
    expect(canvasOf(turned).orientation).toBe(90)
    expect(frameAngleOf(turned, frameIdIn(turned))).toBe(90)
    expect(frameOf(turned)!.centre).toEqual(frameOf(woven)!.centre)
    expect(rowProgressOf(turned, frameIdIn(turned))).toEqual(rowProgressOf(woven, frameIdIn(woven)))
    expect(seenWayOf(turned, frameIdIn(turned))).toBe('right')
    expect(withCanvasTurned(woven, 0)).toBe(woven)
  })

  it('turns the Table, every layer together: no layer\'s place or turn on it changes, the angles on screen all move', () => {
    const framed = rotateFrame(made('loom'), undefined, frameIdIn(made('loom')))!
    const twisted = turnTableTo(framed, 37.5)
    expect(tableTurnOf(twisted)).toBe(37.5)
    expect(canvasOf(twisted).orientation).toBe(0)
    expect(canvasAngleOf(twisted)).toBe(37.5)
    expect(frameAngleOf(twisted, frameIdIn(twisted))).toBe(127.5)
    expect(frameQuarterTurnOf(twisted, frameIdIn(twisted))).toBe(90)
    expect(frameOf(twisted)!.centre).toEqual(frameOf(framed)!.centre)
    expect(tableTurnOf(turnTableTo(twisted, 0))).toBe(0)
  })

  it('moves the Canvas\'s origin by the pivot it turned about, the Frame staying put on the Table', () => {
    const framed = made('loom')
    const turned = turnCanvasTo(framed, 90, { x: 7, y: -2 })
    expect(canvasOf(turned).orientation).toBe(90)
    expect(canvasOf(turned).origin).toBeDefined()
    expect(frameOf(turned)!.centre).toEqual(frameOf(framed)!.centre)
    expect(frameQuarterTurnOf(turned, frameIdIn(turned))).toBe(0)
  })

  it('leaves a Custom frame, whose Row order runs one way, as it was when the Canvas turns', () => {
    const stars = bareProject({ technique: 'peyote', frame: { row: 0, column: 0, rows: 9, columns: 9, technique: 'peyote', beads: {}, shape: 'star' } })
    const turned = withCanvasTurned(stars, 90)
    expect(frameAngleOf(turned, frameIdIn(turned))).toBe(0)
    expect(rowProgressOf(turned, frameIdIn(turned))).toEqual(rowProgressOf(stars, frameIdIn(stars)))
    expect(frameOf(turned)!.centre).toEqual(frameOf(stars)!.centre)
  })
})
