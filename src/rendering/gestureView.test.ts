// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { beadsToDraw, gestureTransform } from './gestureView'

describe('gestureTransform', () => {
  it('is the identity for an unchanged view', () => {
    expect(gestureTransform({ zoom: 1, scroll: { x: 30, y: 40 } }, { zoom: 1, scroll: { x: 30, y: 40 } })).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('moves the bitmap against the scroll when panning', () => {
    expect(gestureTransform({ zoom: 1, scroll: { x: 0, y: 0 } }, { zoom: 1, scroll: { x: 50, y: -20 } })).toEqual({ scale: 1, x: -50, y: 20 })
  })

  it('keeps the point that stays under the fingers where it was when zooming', () => {
    const from = { zoom: 1, scroll: { x: 100, y: 60 } }
    // Zooming to 0.5 about the screen point (200, 100): the displayed point under it stays under it.
    const to = { zoom: 0.5, scroll: { x: (100 + 200) * 0.5 - 200, y: (60 + 100) * 0.5 - 100 } }
    const { scale, x, y } = gestureTransform(from, to)
    expect(scale).toBe(0.5)
    expect([200 * scale + x, 100 * scale + y]).toEqual([200, 100])
  })
})

describe('beadsToDraw', () => {
  it('is capped by what fits in view', () => {
    expect(beadsToDraw(1_000_000, 0, { width: 200, height: 100 }, 1)).toBe(10 * 5)
  })

  it('is capped by what is there to draw', () => {
    expect(beadsToDraw(10, 90, { width: 2000, height: 2000 }, 1)).toBe(100)
  })
})
