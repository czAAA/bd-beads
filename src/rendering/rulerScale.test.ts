import { describe, expect, it } from 'vitest'
import { frameOutsetPx, rulerScale } from './rulerScale'

describe('rulerScale', () => {
  it('is the base measure at zoom 1', () => {
    expect(rulerScale(1, 11)).toEqual({ fontPx: 11, frameOutset: 7, pieceOutset: 5, gap: 3, dotRadius: 1, fifthDotRadius: 1.75 })
  })

  it('brings the lines closer to the beads and makes the numbers bigger when zoomed out, and stops there', () => {
    const far = rulerScale(0.1, 11)
    expect(far.frameOutset).toBeLessThan(4)
    expect(far.fontPx).toBeGreaterThan(13)
    expect(rulerScale(0.05, 11)).toEqual(far)
    expect(rulerScale(0.5, 11).frameOutset).toBeGreaterThan(far.frameOutset)
    expect(rulerScale(0.5, 11).frameOutset).toBeLessThan(7)
  })

  it('grows the numbers, their gap to the line and the dots when zoomed in, and stops there', () => {
    const near = rulerScale(4, 11)
    expect(near.fontPx).toBeGreaterThan(16)
    expect(near.gap).toBeGreaterThanOrEqual(8)
    expect(near.dotRadius).toBeGreaterThanOrEqual(2.5)
    expect(rulerScale(8, 11)).toEqual(near)
  })

  it('gives the Frame handles the same outset the line has', () => {
    expect(frameOutsetPx(2)).toBe(rulerScale(2, 11).frameOutset)
  })
})
