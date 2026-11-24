// @vitest-environment node
import { frameIdIn } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { changeFrame, frameChangeRefusal, type FrameChangeResult } from './changeFrame'
import { createProject } from './createProject'
import type { Project } from './project'
import { rotateFrame } from './rotate'
import { currentPass, frameRowOrder, moveToRow, ROW_WAYS, rowProgressOf, seenWayOf, turnRowDirectionTo } from './rowProgress'
import { firstPassAfterLines, rotateFrameQuestion, techniqueChangeQuestion, wholeLinesDone } from './wovenLines'
import type { Technique } from './weave'
import type { SeenWay } from './rowWays'

const beadId = 'miyuki/delica/11-0'
const WAYS = ROW_WAYS

function changed(result: FrameChangeResult): Project {
  if (result.kind !== 'changed') throw new Error(result.kind)
  return result.project
}

/** A Project of 10 by 10 beads in a Technique, its Frame made with it, woven `way` as seen with `passes` done. */
function woven(technique: Technique, passes: number, way?: SeenWay): Project {
  const project = createProject({ technique, beadId, size: { width: 10, height: 10, unit: 'beads' } })
  return moveToRow(way ? turnRowDirectionTo(project, way, frameIdIn(project)) : project, passes, frameIdIn(way ? turnRowDirectionTo(project, way, frameIdIn(project)) : project))
}

/** A Custom frame on a peyote Canvas: a warped square, woven in its shape's Techniques. */
const customFrame = () => changed(changeFrame(createProject({ technique: 'peyote', beadId }), { custom: { shape: 'warpedSquare', size: 6, centre: { row: 20, column: 30 } } }, frameIdIn(createProject({ technique: 'peyote', beadId }))))

/** How many whole lines are done the way the Frame's rows run now. */
const linesDone = (project: Project) => wholeLinesDone(frameRowOrder(project, frameIdIn(project)), currentPass(rowProgressOf(project, frameIdIn(project))))

describe('whole lines done (ticket 1184)', () => {
  it('counts a loom pass as a line', () => {
    const order = frameRowOrder(woven('loom', 0), frameIdIn(woven('loom', 0)))
    expect([0, 1, 4, 10].map((pass) => wholeLinesDone(order, pass))).toEqual([0, 1, 4, 10])
    expect([0, 1, 4, 10].map((lines) => firstPassAfterLines(order, lines))).toEqual([0, 1, 4, 10])
  })

  it('counts a peyote line with only one of its two passes done as not done', () => {
    // Peyote's first line is one pass and every later one two: passes 0 | 1 2 | 3 4 | ...
    const order = frameRowOrder(woven('peyote', 0), frameIdIn(woven('peyote', 0)))
    expect([0, 1, 2, 3, 4, 5].map((pass) => wholeLinesDone(order, pass))).toEqual([0, 1, 1, 2, 2, 3])
    expect([0, 1, 2, 3].map((lines) => firstPassAfterLines(order, lines))).toEqual([0, 1, 3, 5])
    expect(firstPassAfterLines(order, 10)).toBe(order.count)
  })
})

describe('Rotate Frame\'s question (ticket 1184)', () => {
  it('asks nothing with no pass done', () => {
    expect(rotateFrameQuestion(woven('loom', 0), frameIdIn(woven('loom', 0)))).toBeUndefined()
  })

  it('tells the whole lines done and the way as seen', () => {
    expect(rotateFrameQuestion(woven('loom', 2, 'left'), frameIdIn(woven('loom', 2, 'left')))).toEqual({ lines: 2, way: 'left' })
    expect(rotateFrameQuestion(woven('peyote', 4, 'down'), frameIdIn(woven('peyote', 4, 'down')))).toEqual({ lines: 2, way: 'down' })
  })

  it('asks nothing on a Custom frame, whose order turns with its layout and whose pointer stays', () => {
    const custom = customFrame()
    const started = moveToRow(custom, 1, frameIdIn(custom))
    expect(rotateFrameQuestion(started, frameIdIn(started))).toBeUndefined()
    expect(currentPass(rowProgressOf(rotateFrame(started, undefined, frameIdIn(started))!, frameIdIn(started)))).toBe(1)
  })
})

describe('Rotate Frame\'s answers (ticket 1184)', () => {
  it('keeps the rows: the way turns with the Frame and the same beads stay finished', () => {
    for (const technique of ['loom', 'peyote', 'brick'] as const) {
      for (const way of WAYS) {
        const before = woven(technique, 3, way)
        const after = rotateFrame(before, 'keep', frameIdIn(before))!
        expect(currentPass(rowProgressOf(after, frameIdIn(after))), `${technique} ${way}`).toBe(3)
        expect(seenWayOf(after, frameIdIn(after))).not.toBe(way)
        // Its beads keep their own rows and columns, so the same passes weave them: the same beads stay finished.
        const [was, now] = [frameRowOrder(before, frameIdIn(before)), frameRowOrder(after, frameIdIn(after))]
        for (let row = 0; row < 10; row += 1) {
          for (let column = 0; column < 10; column += 1) expect(now.passAt({ row, column })).toBe(was.passAt({ row, column }))
        }
      }
    }
  })

  it('starts over: every pointer back at the first pass, the way kept as seen', () => {
    for (const way of WAYS) {
      const after = rotateFrame(woven('loom', 3, way), 'start-over', frameIdIn(woven('loom', 3, way)))!
      expect(rowProgressOf(after, frameIdIn(after))).toEqual({ way })
      expect(rotateFrameQuestion(after, frameIdIn(after))).toBeUndefined()
    }
  })
})

describe('a Frame Technique change\'s question (ticket 1184)', () => {
  it('asks nothing with no pass done or for the same Technique', () => {
    expect(techniqueChangeQuestion(woven('loom', 0), 'peyote', frameIdIn(woven('loom', 0)))).toBeUndefined()
    expect(techniqueChangeQuestion(woven('loom', 3), 'loom', frameIdIn(woven('loom', 3)))).toBeUndefined()
  })

  it('tells the whole lines done, the way as seen and the new Technique', () => {
    expect(techniqueChangeQuestion(woven('peyote', 2, 'down'), 'brick', frameIdIn(woven('peyote', 2, 'down')))).toEqual({ lines: 1, way: 'down', technique: 'brick' })
  })

  it('no longer refuses a Technique change once a pass is done, but still refuses its settings alone', () => {
    const started = woven('peyote', 3)
    expect(frameChangeRefusal(started, { technique: 'loom' }, frameIdIn(started))).toBeUndefined()
    expect(frameChangeRefusal(started, { technique: 'peyote', techniqueSettings: { peyoteDrop: 2 } }, frameIdIn(started))).toBe('locked')
    expect(frameChangeRefusal(started, { techniqueSettings: { peyoteDrop: 2 } }, frameIdIn(started))).toBe('locked')
  })
})

describe('a Frame Technique change\'s answers (ticket 1184)', () => {
  it('starts over for the new Technique: its default way, every pointer at the first pass', () => {
    const after = changed(changeFrame(woven('loom', 4, 'left'), { technique: 'brick' }, frameIdIn(woven('loom', 4, 'left'))))
    expect(rowProgressOf(after, frameIdIn(after))).toEqual({ way: 'up' })
  })

  it('keeps the whole lines in the current way, loom and brick stitch to peyote and back, all four ways', () => {
    const pairs: [Technique, Technique][] = [['loom', 'peyote'], ['brick', 'peyote'], ['peyote', 'loom'], ['peyote', 'brick'], ['loom', 'brick']]
    for (const [from, to] of pairs) {
      for (const way of WAYS) {
        // Three whole lines done; on peyote that is five passes.
        const before = woven(from, firstPassAfterLines(frameRowOrder(woven(from, 0, way), frameIdIn(woven(from, 0, way))), 3), way)
        expect(linesDone(before), `${from} ${way}`).toBe(3)
        const after = changed(changeFrame(before, { technique: to, woven: 'keep' }, frameIdIn(before)))
        expect(seenWayOf(after, frameIdIn(after)), `${from} → ${to} ${way}`).toBe(way)
        expect(linesDone(after), `${from} → ${to} ${way}`).toBe(3)
        expect(currentPass(rowProgressOf(after, frameIdIn(after)))).toBe(firstPassAfterLines(frameRowOrder(after, frameIdIn(after)), 3))
      }
    }
  })

  it('takes a half-done peyote line back to its start', () => {
    for (const way of WAYS) {
      // Passes 0 | 1 2 | 3: two whole lines and half of the third.
      const before = woven('peyote', 4, way)
      expect(linesDone(before)).toBe(2)
      const after = changed(changeFrame(before, { technique: 'loom', woven: 'keep' }, frameIdIn(before)))
      expect(rowProgressOf(after, frameIdIn(after))[way]).toBe(2)
    }
  })

  it('keeps a Custom frame\'s Technique waiting once a pass is done', () => {
    const custom = moveToRow(customFrame(), 1, frameIdIn(customFrame()))
    expect(techniqueChangeQuestion(custom, 'brick', frameIdIn(custom))).toBeUndefined()
    expect(frameChangeRefusal(custom, { technique: 'brick' }, frameIdIn(custom))).toBe('locked')
  })
})
