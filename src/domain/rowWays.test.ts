// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withColors } from './canvas'
import { changeFrame, type FrameChangeResult } from './changeFrame'
import { createProject, createProjectFromImage } from './createProject'
import { deleteAll } from './drawing'
import { fitToDrawing } from './frame'
import { frameOf, withLayer } from './layerRecord'
import type { Project } from './project'
import { rotateCanvas, rotateFrame } from './rotate'
import { columnsAsSeen, moveToRow, rowProgressOf, seenWayOf, toggleRowDirection, turnRowDirectionTo } from './rowProgress'
import { ownRowWay, seenWayOfOwn, startingRowProgress, turnedWithFrame } from './rowWays'
import { pointersOf } from '../testUtils/layerFields'
import { designSizes, placedStarter, starterById, starterProject } from './starters'
import type { Technique } from './weave'

const beadId = 'miyuki/delica/11-0'
const TECHNIQUES = ['loom', 'peyote', 'brick'] as const
/** Each Technique's own way as seen: loom top to bottom, peyote left to right, brick stitch bottom to top. */
const WAYS = { loom: 'down', peyote: 'right', brick: 'up' } as const

function changed(result: FrameChangeResult): Project {
  if (result.kind !== 'changed') throw new Error(result.kind)
  return result.project
}

/** A Project of 10 by 10 beads in a Technique, its Frame made with it. */
const made = (technique: Technique) => createProject({ technique, beadId, size: { width: 10, height: 10, unit: 'beads' } })

/** A Canvas with no Frame in a Technique, a few beads painted on it. */
function painted(technique: Technique): Project {
  const open = createProject({ technique, beadId, name: 'Open' })
  return withLayer(open, 'canvas', { beads: withColors({}, [{ row: 2, column: 2, color: '#111111' }, { row: 5, column: 6, color: '#222222' }]) })
}

describe('startingRowProgress (tickets 1172, 1185)', () => {
  it('starts at the first pass in the Technique\'s way as seen, the turns never asked', () => {
    expect(startingRowProgress('loom')).toEqual({ way: 'down' })
    expect(startingRowProgress('peyote')).toEqual({ way: 'right' })
    expect(startingRowProgress('brick')).toEqual({ way: 'up' })
  })

  it('starts a Frame with a Frame shape along its rows whatever the Technique', () => {
    expect(startingRowProgress('peyote', true)).toEqual({ way: 'down' })
  })
})

describe('ownRowWay: the Frame\'s own axis and end (ticket 1185)', () => {
  it('turns a way as seen back by the quarter turn the Frame lies at', () => {
    expect(ownRowWay('down', 0)).toEqual({ direction: 'rows' })
    expect(ownRowWay('left', 0)).toEqual({ direction: 'columns', reversed: true })
    // Top to bottom as seen on a Frame turned a quarter clockwise runs its own columns left to right.
    expect(ownRowWay('down', 90)).toEqual({ direction: 'columns' })
    expect(ownRowWay('right', 90)).toEqual({ direction: 'rows', reversed: true })
    expect(ownRowWay('up', 180)).toEqual({ direction: 'rows' })
  })

  it('finds the way as seen again from the own axis and end', () => {
    for (const turn of [0, 90, 180, 270] as const) {
      for (const way of ['down', 'right', 'up', 'left'] as const) expect(seenWayOfOwn(ownRowWay(way, turn), turn)).toBe(way)
    }
  })
})

describe('the starting way: progress starting afresh runs the Frame Technique\'s own way as the Frame lies (spec 1182)', () => {
  it('starts a new Project\'s Frame in its Technique\'s way, peyote\'s Canvas turned a quarter', () => {
    expect(TECHNIQUES.map((technique) => seenWayOf(made(technique)))).toEqual(['down', 'right', 'up'])
  })

  it('starts Convert image on peyote left to right, its Canvas upright (bug: it ran bottom to top)', () => {
    for (const technique of TECHNIQUES) {
      const grid = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ color: '#111111' })))
      const project = createProjectFromImage({ technique, beadId, size: { width: 4, height: 4, unit: 'beads' }, grid })
      expect(seenWayOf(project), technique).toBe(WAYS[technique])
    }
  })

  it('starts a first Frame from Selection in its Technique\'s way (bug: always top to bottom)', () => {
    for (const technique of TECHNIQUES) {
      const project = changed(changeFrame(painted(technique), { make: { row: 0, column: 0, rows: 8, columns: 8 } }))
      expect(seenWayOf(project), technique).toBe(WAYS[technique])
      expect((rowProgressOf(project).down ?? 0)).toBe(0)
    }
  })

  it('starts a first Frame by Fit to drawing in its Technique\'s way, on a turned Canvas too', () => {
    for (const technique of TECHNIQUES) {
      for (const open of [painted(technique), rotateCanvas(painted(technique))]) {
        const project = changed(changeFrame(open, { make: fitToDrawing(open)! }))
        expect(seenWayOf(project), technique).toBe(WAYS[technique])
      }
    }
  })

  it('starts a Starter laid turned on an open Project in its Technique\'s way (bug: it started turned)', () => {
    // A peyote Ring lies across a loom Canvas, its Frame turned a quarter.
    const ring = starterById('ringDiamonds')
    const choice = { sizes: designSizes(ring), useDesign: true }
    const open = createProject({ technique: 'loom', beadId, name: 'Open' })
    for (const canvas of [open, rotateCanvas(open)]) {
      expect(seenWayOf(changed(placedStarter(canvas, ring, choice, { row: 50, column: 50 })))).toBe('right')
    }
    expect(frameOf(changed(placedStarter(open, ring, choice, { row: 50, column: 50 })))!.quarterTurns).toBe(1)
    expect(seenWayOf(starterProject(ring, { ...choice, name: 'Ring', beadId }))).toBe('right')
  })

  it('starts a Starter laid over a Frame afresh, whatever way that Frame ran', () => {
    const ring = starterById('ringDiamonds')
    const open = turnRowDirectionTo(made('loom'), 'left')
    expect(seenWayOf(changed(placedStarter(open, ring, { sizes: designSizes(ring), useDesign: true }, { row: 5, column: 5 })))).toBe('right')
  })

  it('sets the starting way on Delete all for the Frame as it lies, however it was turned', () => {
    for (const technique of TECHNIQUES) {
      const woven = moveToRow(turnRowDirectionTo(rotateFrame(rotateCanvas(made(technique)))!, 'left'), 2)
      const cleared = deleteAll(woven)
      expect(seenWayOf(cleared), technique).toBe(WAYS[technique])
      expect(pointersOf(rowProgressOf(cleared))).toEqual({})
      expect(deleteAll(cleared)).toBe(cleared)
    }
  })

  it('sets the new Technique\'s way on a Frame Technique change, after a hand-picked way or a turned Frame too', () => {
    const loom = made('loom')
    for (const before of [loom, turnRowDirectionTo(loom, 'left'), rotateFrame(loom)!, rotateCanvas(loom), rotateFrame(rotateCanvas(turnRowDirectionTo(loom, 'up')))!]) {
      for (const technique of ['peyote', 'brick'] as const) {
        expect(seenWayOf(changed(changeFrame(before, { technique }))), technique).toBe(WAYS[technique])
      }
    }
  })

  it('keeps the way on a change of the Frame\'s settings alone', () => {
    const picked = turnRowDirectionTo(made('peyote'), 'down')
    expect(seenWayOf(changed(changeFrame(picked, { techniqueSettings: { peyoteDrop: 2 } })))).toBe('down')
  })

  it('never reads the Canvas\'s Technique: a peyote Frame on a loom Canvas starts left to right', () => {
    const framed = changed(changeFrame(painted('loom'), { make: { row: 0, column: 0, rows: 8, columns: 8 } }))
    expect(seenWayOf(changed(changeFrame(framed, { technique: 'peyote' })))).toBe('right')
  })
})

describe('Rotate Frame with no pass done keeps the way as seen (spec 1182)', () => {
  it('keeps each of the four ways as seen through every quarter turn, on a turned Canvas too', () => {
    for (const technique of TECHNIQUES) {
      for (const way of ['down', 'right', 'up', 'left'] as const) {
        let project = turnRowDirectionTo(rotateCanvas(made(technique)), way)
        for (let turn = 0; turn < 4; turn += 1) {
          project = rotateFrame(project)!
          expect(seenWayOf(project), `${technique} ${way} ${turn}`).toBe(way)
        }
      }
    }
  })

  it('leaves Row progress as it is, so the way sticks as seen', () => {
    const picked = turnRowDirectionTo(made('loom'), 'left')
    expect(rowProgressOf(rotateFrame(rotateFrame(picked)!)!)).toEqual({ way: 'left' })
  })
})

describe('turnedWithFrame: the rows kept on the Frame as it turns (ticket 1185)', () => {
  it('steps the way and each pointer\'s slot on with the turn', () => {
    // A quarter clockwise takes top to bottom to right to left, left to right to top to bottom.
    expect(turnedWithFrame({ way: 'down', down: 3, right: 4, up: 2, left: 5 }, 1)).toEqual({ way: 'left', left: 3, down: 4, right: 2, up: 5 })
    expect(turnedWithFrame({ way: 'right', right: 1 }, -1)).toEqual({ way: 'up', up: 1 })
  })
})

describe('the way named as seen (spec 1182)', () => {
  it('calls top to bottom and bottom to top rows, left to right and right to left columns, whatever the Frame\'s own lines', () => {
    const loom = made('loom')
    for (const project of [loom, rotateFrame(loom)!, rotateCanvas(loom)]) {
      expect((['down', 'right', 'up', 'left'] as const).map((way) => columnsAsSeen(turnRowDirectionTo(project, way)))).toEqual([false, true, false, true])
    }
  })

  it('steps the `D` key top to bottom, left to right, bottom to top, right to left as seen', () => {
    for (const project of [made('loom'), rotateCanvas(made('brick')), rotateFrame(made('peyote'))!]) {
      const seen: string[] = []
      let next = turnRowDirectionTo(project, 'down')
      for (let press = 0; press < 4; press += 1) {
        seen.push(seenWayOf(next))
        next = toggleRowDirection(next)
      }
      expect(seen).toEqual(['down', 'right', 'up', 'left'])
    }
  })
})
