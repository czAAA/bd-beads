import { describe, expect, it } from 'vitest'
import { clampOffset, formatPlacement, nudgedPlacement, parsePlacement, placementOf } from './zoomPillPlacement'

const area = { left: 0, top: 0, width: 400, height: 600 }
const pill = { left: 100, top: 100, width: 200, height: 40 }

describe('zoomPillPlacement', () => {
  it('lets the pill move freely while it stays inside the area', () => {
    expect(clampOffset(pill, area, 50, 30)).toEqual({ x: 50, y: 30 })
  })

  it('stops the pill at every edge, a gap short of it', () => {
    expect(clampOffset(pill, area, -500, -500)).toEqual({ x: -84, y: -84 })
    expect(clampOffset(pill, area, 500, 900)).toEqual({ x: 84, y: 444 })
  })

  it('pins a pill wider than the area to its left edge instead of throwing it out', () => {
    const wide = { left: 0, top: 0, width: 500, height: 40 }
    expect(clampOffset(wide, area, 80, 0).x).toBeLessThanOrEqual(16)
  })

  it('keeps the pill where it was dropped, as a share of the room it has', () => {
    expect(placementOf({ ...pill, left: 16, top: 16 }, area)).toEqual({ x: 0, y: 0 })
    expect(placementOf({ ...pill, left: 184, top: 544 }, area)).toEqual({ x: 1, y: 1 })
    expect(placementOf({ ...pill, left: 100, top: 280 }, area)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('clamps a drop outside the area to its edge', () => {
    expect(placementOf({ ...pill, left: -50, top: 900 }, area)).toEqual({ x: 0, y: 1 })
  })

  it('puts a pill with no room on an axis at its far end', () => {
    expect(placementOf({ ...pill, width: 400 }, area).x).toBe(1)
  })

  it('nudges by a step and stops at the edge', () => {
    const mid = { ...pill, left: 100, top: 280 }
    expect(nudgedPlacement(mid, area, 42, 0)).toEqual({ x: 0.75, y: 0.5 })
    expect(nudgedPlacement(mid, area, 9999, -9999)).toEqual({ x: 1, y: 0 })
  })

  describe('stored form', () => {
    it('round-trips', () => {
      expect(parsePlacement(formatPlacement({ x: 0.123456, y: 1 }))).toEqual({ x: 0.1235, y: 1 })
    })

    it('reads a corner stored before ticket 321 as its placement', () => {
      expect(parsePlacement('top-left')).toEqual({ x: 0, y: 0 })
      expect(parsePlacement('bottom-right')).toEqual({ x: 1, y: 1 })
      expect(parsePlacement('top-right')).toEqual({ x: 1, y: 0 })
      expect(parsePlacement('bottom-left')).toEqual({ x: 0, y: 1 })
    })

    it('pulls shares outside 0..1 back in and rejects anything else', () => {
      expect(parsePlacement('2,-1')).toEqual({ x: 1, y: 0 })
      for (const bad of ['middle', '', '0.5', '0.5,', ',0.5', 'a,b', '1,2,3', null, 5]) expect(parsePlacement(bad)).toBeUndefined()
    })
  })
})
