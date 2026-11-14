import { describe, expect, it } from 'vitest'
import { channelsOf, toCielab } from '../domain/color'
import { farGapOf, farShareAt, farShares } from './gridFocus'
import { tileColorOf } from './tonalTiles'

describe('the far gap', () => {
  it.each([
    ['Night', '#202020', '#262626'],
    ['Studio', '#fafafa', '#f2f2f2'],
  ])('is the BeadBoard card\'s on %s (%s → %s), never the tile', (_name, background, far) => {
    expect(farGapOf(background)).toBe(far)
    expect(farGapOf(background)).not.toBe(tileColorOf(background))
  })

  it('leaves about 3.8 L* between it and the tile, 1.11:1', () => {
    for (const background of ['#202020', '#0e0e0e', '#3b3e43', '#fafafa', '#e6e3de', '#cdcac4']) {
      const [far, tile] = [toCielab(channelsOf(farGapOf(background))), toCielab(channelsOf(tileColorOf(background)))]
      expect(Math.abs(tile.l - far.l)).toBeGreaterThan(3.2)
      expect(Math.abs(tile.l - far.l)).toBeLessThan(4.4)
    }
  })
})

describe('the easing', () => {
  it('is full within about 3 beads of the work, far from about 7 out, and only grows between', () => {
    expect(farShareAt(0)).toBe(0)
    expect(farShareAt(60)).toBe(0)
    expect(farShareAt(132)).toBe(1)
    expect(farShareAt(400)).toBe(1)
    expect(farShareAt(96)).toBeCloseTo(0.5, 5)
    for (let at = 60; at < 132; at += 1) expect(farShareAt(at + 1)).toBeGreaterThanOrEqual(farShareAt(at))
  })

  it('gives every box its own near area, its corners rounded, and follows the zoom', () => {
    // Two boxes 1000 px apart on a field sampled every 10 px, at zoom 1 and at zoom 2.
    const boxes = [{ x: 100, y: 100, width: 40, height: 40 }, { x: 1100, y: 100, width: 40, height: 40 }]
    const field = farShares(boxes, 140, 30, 10, 1)
    const at = (x: number, y: number) => field[(y / 10) * 140 + x / 10]!
    expect(at(120, 120)).toBe(0)
    expect(at(1120, 120)).toBe(0)
    expect(at(600, 120)).toBe(1)
    // 60 px off a side is full; 60 px off both sides of a corner is about 85 px off it, already easing.
    expect(at(200, 120)).toBe(0)
    expect(at(200, 200)).toBeGreaterThan(0)
    const doubled = farShares(boxes.map(({ x, y, width, height }) => ({ x: x * 2, y: y * 2, width: width * 2, height: height * 2 })), 280, 60, 10, 2)
    expect(doubled[(400 / 10) * 280 + 400 / 10]).toBe(at(200, 200))
  })
})
