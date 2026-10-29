// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findBead } from './beads'
import { createProject } from './createProject'
import { frameOf, withLayer } from './layerRecord'
import { canvasDistance, frameScale, laidOnCanvas, layersAlike, placedFrame } from './layerWeave'
import { withLayers } from '../testUtils/layerFields'

const round8 = findBead('toho/round/8-0')!
const round15 = findBead('toho/round/15-0')!
const RED = '#e63746'
const BLUE = '#2f6fed'

/** A loom Canvas in 8/0 with a 4 by 4 loom Frame at row 2, column 3, in 8/0 or in a Bead of its own. */
function framed(frameBead = round8) {
  const made = createProject({ name: 'Two Beads', technique: 'loom', beadId: round8.id, size: { width: 4, height: 4, unit: 'beads' } })
  return withLayer(withLayers(made, { frame: { ...frameOf(made)!, row: 2, column: 3 } }), 'frame', { bead: frameBead })
}

describe('a distance in the Frame read on the Canvas through millimetres (ADR 0079, ticket 0665)', () => {
  it("scales the Frame by its Bead's pitch over the Canvas's, 1 alike or without a Frame", () => {
    expect(frameScale(framed(round15))).toBe(0.5)
    expect(frameScale(framed())).toBe(1)
    expect(frameScale(withLayers(framed(round15), { frame: undefined }))).toBe(1)
    expect(placedFrame(framed(round15))).toMatchObject({ row: 2, column: 3, technique: 'loom', scale: 0.5 })
  })

  it('takes the layers as alike only woven alike in a Bead of the same size', () => {
    expect(layersAlike(framed())).toBe(true)
    expect(layersAlike(framed(round15))).toBe(false)
    expect(layersAlike(withLayers(framed(), { frame: undefined }))).toBe(false)
  })

  it("reads a Frame's rows and columns as the Canvas positions as far, in a Bead half as wide", () => {
    expect(canvasDistance(framed(round15), { technique: 'loom' }, 10, 6)).toEqual({ row: 5, column: 3 })
    expect(canvasDistance(framed(), { technique: 'loom' }, 10, 6)).toEqual({ row: 10, column: 6 })
  })

  it('lays Frame beads on the Canvas positions under them, each taking the bead under its middle', () => {
    const beads = { 0: { 0: RED, 1: RED, 2: RED, 3: RED }, 1: { 0: RED, 1: RED, 2: RED, 3: RED }, 2: { 0: BLUE, 1: BLUE, 2: BLUE, 3: BLUE }, 3: { 0: BLUE, 1: BLUE, 2: BLUE, 3: BLUE } }
    expect(laidOnCanvas(framed(round15), beads, { row: 2, column: 3 })).toEqual({ 2: { 3: RED, 4: RED }, 3: { 3: BLUE, 4: BLUE } })
    expect(laidOnCanvas(framed(), beads, { row: 2, column: 3 })[2]).toEqual({ 3: RED, 4: RED, 5: RED, 6: RED })
  })
})
