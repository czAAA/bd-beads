// @vitest-environment node
import { frameIdIn, FRAME_ID } from '../testUtils/frameId'
import { describe, expect, it } from 'vitest'
import { findBead } from './beads'
import { createProject } from './createProject'
import { frameOf, withLayer } from './layerRecord'
import { frameScale, placedFrame } from './layerWeave'
import { withLayers } from '../testUtils/layerFields'
import { squareBead } from '../testUtils/squareBead'

const round8 = findBead('toho/round/8-0')!
const round15 = findBead('toho/round/15-0')!

/** A loom Canvas in 8/0 with a 4 by 4 loom Frame at row 2, column 3, in 8/0 or in a Bead of its own. */
function framed(frameBead = round8) {
  const made = withLayers(createProject({ name: 'Two Beads', technique: 'loom', beadId: round8.id, size: { width: 4, height: 4, unit: 'beads' } }), { bead: squareBead(round8) })
  const { centre: _centre, ...sheet } = frameOf(made)!
  return withLayer(withLayers(made, { frame: { ...sheet, row: 2, column: 3 } }), FRAME_ID, { bead: squareBead(frameBead) })
}

describe('a distance in the Frame read on the Canvas through millimetres (ADR 0079, ticket 0665)', () => {
  it("scales the Frame by its Bead's pitch over the Canvas's, 1 alike or without a Frame", () => {
    expect(frameScale(framed(round15), frameIdIn(framed(round15)))).toBe(0.5)
    expect(frameScale(framed(), frameIdIn(framed()))).toBe(1)
    expect(frameScale(withLayers(framed(round15), { frame: undefined }), frameIdIn(withLayers(framed(round15), { frame: undefined })))).toBe(1)
    expect(placedFrame(framed(round15), frameIdIn(framed(round15)))).toMatchObject({ technique: 'loom', scale: 0.5 })
  })
})
