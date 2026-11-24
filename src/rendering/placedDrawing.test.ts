import { describe, expect, it } from 'vitest'
import { recordingContext } from '../testUtils/recordingContext'
import { drawPlaced, placementOf } from './placedDrawing'

describe('drawing one Frame of several where it lies on their surface (ticket 1219)', () => {
  it('places a drawing by its seam, from where its bitmap starts to where the surface\'s does, in device px', () => {
    const shifted = { a: 1, b: 0, c: 0, d: 1, e: 30, f: -10 }
    expect(placementOf(shifted, 2, { x: 5, y: 0 }, { x: 0, y: 20 })).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 70, f: -60 })
    // A seam a hair off whole numbers, as two drawings at one lean give, is a shift alone.
    expect(placementOf({ a: 1 + 1e-12, b: -1e-13, c: 0, d: 1, e: 0, f: 0 }, 1, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
  })

  it('lays every transform the drawing sets after the placement, and leaves the context as it was', () => {
    const { context, named } = recordingContext()
    const own = context.setTransform
    drawPlaced(context, { a: 0, b: 1, c: -1, d: 0, e: 100, f: 0 }, () => context.setTransform(2, 0, 0, 2, 10, 0))
    expect(named('setTransform').map((call) => call.args)).toEqual([[0, 2, -2, 0, 100, 10]])
    expect(context.setTransform).toBe(own)
  })

  it('draws as it is through the identity', () => {
    const { context, named } = recordingContext()
    drawPlaced(context, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, () => context.setTransform(2, 0, 0, 2, 10, 0))
    expect(named('setTransform').map((call) => call.args)).toEqual([[2, 0, 0, 2, 10, 0]])
  })
})
