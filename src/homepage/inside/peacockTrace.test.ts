import { describe, expect, it } from 'vitest'
import { PEACOCK_CUFF, PEACOCK_RING, type PeacockDrawing, type PeacockPart } from './peacock'
import { beadsRound, eyeByHand, eyeTrace, pupilMiddle, ringGroundFills, strokesThrough, type TraceBead, type TraceStep } from './peacockTrace'

/** A piece of beads the size of a drawing, painted and filled as the editor does it, every press laid in each strip as
 * the Mirror's Repeat lays it. */
function piece(drawing: PeacockDrawing) {
  const beads = drawing.rows.map((row) => [...row].map((): string | undefined => undefined))
  const strips = drawing.length / drawing.period
  const everyStrip = ([line, along]: TraceBead): TraceBead[] => Array.from({ length: strips }, (_, strip) => [line, (along % drawing.period) + strip * drawing.period])
  const has = ([line, along]: TraceBead) => line >= 0 && line < drawing.lines && along >= 0 && along < drawing.length
  function fill(from: TraceBead, part: string) {
    const was = beads[from[0]]![from[1]]
    if (was === part) return
    const reach = [from]
    beads[from[0]]![from[1]] = part
    for (let at = 0; at < reach.length; at++) {
      for (const next of beadsRound(reach[at]!)) {
        if (!has(next) || beads[next[0]]![next[1]] !== was) continue
        beads[next[0]]![next[1]] = part
        reach.push(next)
      }
    }
  }
  function draw(steps: readonly TraceStep[], repeat: boolean) {
    for (const { part, strokes, fills } of steps) {
      for (const bead of strokes.flat()) for (const [line, along] of repeat ? everyStrip(bead) : [bead]) beads[line]![along] = part
      for (const press of fills) for (const each of repeat ? everyStrip(press) : [press]) fill(each, part)
    }
  }
  return { beads, draw, fill, rows: () => beads.map((row) => row.map((part) => part ?? ' ').join('')) }
}

/** How many beads a trace paints, and how many times it presses Fill. */
function work(steps: readonly TraceStep[]) {
  return { painted: steps.reduce((sum, step) => sum + step.strokes.flat().length, 0), fills: steps.reduce((sum, step) => sum + step.fills.length, 0) }
}

describe("how the ghost draws the peacock's eye (ticket 0831)", () => {
  it('draws strokes of neighbouring beads, every bead once', () => {
    for (const steps of [eyeByHand(3), eyeTrace(PEACOCK_CUFF, 2)]) {
      for (const { strokes } of steps) {
        const drawn = strokes.flat().map(([line, along]) => `${line},${along}`)
        expect(new Set(drawn).size).toBe(drawn.length)
        for (const stroke of strokes) {
          for (let at = 1; at < stroke.length; at++) expect(beadsRound(stroke[at - 1]!).some(([line, along]) => line === stroke[at]![0] && along === stroke[at]![1]), `${stroke[at - 1]} to ${stroke[at]}`).toBe(true)
        }
      }
    }
    expect(strokesThrough([[0, 0], [0, 1], [5, 5]])).toEqual([[[0, 0], [0, 1]], [[5, 5]]])
  })

  it("draws the ring's eye by hand in five colors from the outside in, 30 beads, in one strip", () => {
    const steps = eyeByHand(3)
    expect(steps.map((step) => [step.part, step.strokes.flat().length])).toEqual([['G', 10], ['D', 8], ['T', 7], ['B', 4], ['N', 1]])
    expect(steps.flatMap((step) => step.strokes.flat()).every(([, along]) => along >= 27)).toBe(true)
  })

  it("fills the ring's ground either side of the first eye, and Repeat lays the eye in the other strips: the drawing, bead for bead", () => {
    const ring = piece(PEACOCK_RING)
    ring.draw(eyeByHand(3), false)
    const presses = ringGroundFills(3)
    expect(presses).toHaveLength(2)
    for (const press of presses) ring.fill(press, '.')
    ring.draw(eyeByHand(2), true)
    expect(ring.rows()).toEqual(PEACOCK_RING.rows)
  })

  it('traces one eye of the cuff with Repeat into the whole drawing, bead for bead, its barbs green', () => {
    const cuff = piece(PEACOCK_CUFF)
    const steps = eyeTrace(PEACOCK_CUFF, 2)
    cuff.draw(steps, true)
    expect(cuff.rows()).toEqual(PEACOCK_CUFF.rows)
    expect(steps.map((step) => step.part)).toEqual<PeacockPart[]>(['G', 'D', 'T', 'B', 'N', '.', 'g'])
  })

  it('paints only the edges, the barbs and the pupil, and fills the rest', () => {
    const { painted, fills } = work(eyeTrace(PEACOCK_CUFF, 2))
    expect(painted).toBeLessThan(200)
    expect(fills).toBeLessThanOrEqual(8)
  })

  it("names the middle line of each of the cuff's pupils, three beads an eye", () => {
    expect(pupilMiddle(0)).toEqual([[13, 6], [13, 7], [13, 8]])
    expect(pupilMiddle(2)).toEqual([[13, 38], [13, 39], [13, 40]])
  })
})
