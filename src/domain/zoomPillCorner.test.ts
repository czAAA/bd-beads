import { describe, expect, it } from 'vitest'
import { clampOffset, nearestCorner } from './zoomPillCorner'

const area = { left: 0, top: 0, width: 400, height: 600 }
const pill = { left: 100, top: 100, width: 200, height: 40 }

describe('zoomPillCorner', () => {
  it('lets the pill move freely while it stays inside the area', () => {
    expect(clampOffset(pill, area, 50, 30)).toEqual({ x: 50, y: 30 })
  })

  it('stops the pill at every edge', () => {
    expect(clampOffset(pill, area, -500, -500)).toEqual({ x: -100, y: -100 })
    expect(clampOffset(pill, area, 500, 900)).toEqual({ x: 100, y: 460 })
  })

  it('pins a pill wider than the area to its left edge instead of throwing it out', () => {
    const wide = { left: 0, top: 0, width: 500, height: 40 }
    expect(clampOffset(wide, area, 80, 0).x).toBeLessThanOrEqual(0)
  })

  it('picks the corner nearest the pill centre', () => {
    expect(nearestCorner({ ...pill, left: 0, top: 0 }, area)).toBe('top-left')
    expect(nearestCorner({ ...pill, left: 200, top: 0 }, area)).toBe('top-right')
    expect(nearestCorner({ ...pill, left: 0, top: 560 }, area)).toBe('bottom-left')
    expect(nearestCorner({ ...pill, left: 200, top: 560 }, area)).toBe('bottom-right')
  })
})
