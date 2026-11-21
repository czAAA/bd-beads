// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { frameOf } from './layerRecord'
import { rotateFrame, turnCanvasTo } from './rotate'
import { moveToRow, rowProgressOf, seenWayOf, turnRowDirectionTo } from './rowProgress'
import { canvasPlacement, frameAngleOf, frameQuarterTurnOf, lieAlike, liesOnGrid } from './table'
import { framePlacement, withCanvasTurned } from './framePlacement'
import { bareProject, withPictureTurned } from '../testUtils/layerFields'

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

  it('turns the Canvas alone (ticket 1188): the Frame keeps its angle, its place on the table and its way as seen', () => {
    const woven = moveToRow(turnRowDirectionTo(rotateFrame(made('loom'))!, 'right'), 2)
    const twisted = turnCanvasTo(woven, 37.5)
    expect(frameAngleOf(twisted)).toBe(90)
    expect(framePlacement(twisted)).toEqual(framePlacement(woven))
    expect(rowProgressOf(twisted)).toEqual(rowProgressOf(woven))
    expect(seenWayOf(twisted)).toBe('right')
    // Off the Canvas's grid it has no quarter turns of its own: its rows are upright on its own drawing.
    expect(frameOf(twisted)!.centre).toEqual(framePlacement(woven)!.at)
    expect(frameOf(twisted)!.quarterTurns).toBeUndefined()
    expect(withCanvasTurned(woven, 0)).toBe(woven)
  })

  it('moves the Canvas\'s origin by the pivot it turned about, the Frame staying put on the table', () => {
    const framed = made('loom')
    const turned = turnCanvasTo(framed, 90, { x: 7, y: -2 })
    expect(canvasPlacement(turned)).toEqual({ angle: 90, at: { x: 7, y: -2 } })
    expect(framePlacement(turned)).toEqual(framePlacement(framed))
    expect(lieAlike(turned)).toBe(false)
  })

  it('lays the Frame back on the grid once the Canvas comes back, its beads\' positions as they were', () => {
    const framed = made('peyote')
    const back = [1, 2, 3, 4].reduce((project) => turnCanvasTo(project, canvasPlacement(project).angle + 90, { x: 1.5, y: 0.25 }), framed)
    // Four quarter turns about one pivot each time put the origin back where it began.
    const round = [1, 2, 3, 4].reduce((project) => {
      const { angle, at } = canvasPlacement(project)
      const pivot = { x: 3, y: 4 }
      const swung = { x: pivot.x - (at.y - pivot.y), y: pivot.y + (at.x - pivot.x) }
      return turnCanvasTo(project, angle + 90, { x: swung.x - at.x, y: swung.y - at.y })
    }, framed)
    expect(lieAlike(back)).toBe(false)
    expect(lieAlike(round)).toBe(true)
    expect(frameOf(round)).toMatchObject({ row: frameOf(framed)!.row, column: frameOf(framed)!.column, angle: 90 })
    expect(frameOf(round)!.centre).toBeUndefined()
  })

  it('leaves a Custom frame, whose Row order runs one way, as it was', () => {
    const stars = bareProject({ technique: 'peyote', frame: { row: 0, column: 0, rows: 9, columns: 9, technique: 'peyote', beads: {}, shape: 'star' } })
    const turned = withCanvasTurned(stars, 90)
    expect(frameAngleOf(turned)).toBe(0)
    expect(rowProgressOf(turned)).toEqual(rowProgressOf(stars))
    expect(frameOf(turned)!.quarterTurns).toBe(3)
  })
})

describe('lieAlike (spec 1182, ticket 1185)', () => {
  it('is true with no Frame, and for a Frame at the Canvas\'s angle on whole positions, the Canvas leaning or not', () => {
    expect(lieAlike(createProject({ technique: 'loom', beadId, name: 'Open' }))).toBe(true)
    expect(lieAlike(made('peyote'))).toBe(true)
    expect(lieAlike(withPictureTurned(made('brick'), 37.5))).toBe(true)
  })

  it('is false for a Frame turned on the Canvas, and true again once turned back', () => {
    const turned = rotateFrame(made('loom'))!
    expect(lieAlike(turned)).toBe(false)
    expect(lieAlike(turnCanvasTo(turned, 200))).toBe(false)
    expect(liesOnGrid(turned)).toBe(true)
    expect(liesOnGrid(turnCanvasTo(turned, 200))).toBe(false)
    expect(lieAlike(rotateFrame(rotateFrame(rotateFrame(turned)!)!)!)).toBe(true)
  })

  it('takes a Custom frame turned a quarter as lying alike: its turned layout is built on the Canvas\'s grid', () => {
    const star = bareProject({ technique: 'peyote', frame: { row: 0, column: 0, rows: 9, columns: 9, technique: 'peyote', beads: {}, shape: 'star', quarterTurns: 1 } })
    expect(frameOf(star)!.quarterTurns).toBe(1)
    expect(lieAlike(star)).toBe(true)
  })
})
