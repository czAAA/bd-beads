import { describe, expect, it } from 'vitest'
import { carryAlong, expandedLayout, expandedPitch, expandedSides, expandedZoom, lookAlong, runsOn } from './expandedSheet'

describe('expandedSides', () => {
  it('holds the numbers on the top and the left, 3px off the line (MarginSheet card, Expand the Frame)', () => {
    // Top: 3, 11 numbers, 3. Left: 6 inset, 13 numbers, 3. Right and bottom: the inset.
    expect(expandedSides({ compact: false, numbers: { left: 13, top: 11 } })).toEqual({ top: 17, left: 22, right: 6, bottom: 6 })
  })

  it('leaves a side without numbers its inset alone, smaller under bp-tablet', () => {
    expect(expandedSides({ compact: true, numbers: { left: 0, top: 0 } })).toEqual({ top: 4, left: 4, right: 4, bottom: 4 })
  })
})

describe('expandedZoom (ticket 1260)', () => {
  it('fits the whole Frame where that draws its beads at the weaving pitch or larger', () => {
    expect(expandedZoom({ across: 5, down: 3, comfort: 1.4 })).toBe(3)
  })

  it('weaves at the comfortable pitch where the whole Frame would be smaller, the rows running on', () => {
    // 24 × 70: across holds 2×, the whole height only 0.5×.
    expect(expandedZoom({ across: 2, down: 0.5, comfort: 1.4 })).toBe(1.4)
  })

  it('never runs past what the other way holds', () => {
    expect(expandedZoom({ across: 1.1, down: 0.5, comfort: 1.4 })).toBe(1.1)
    expect(expandedZoom({ across: 0.3, down: 0.8, comfort: 1.4 })).toBe(0.8)
  })

  it('weaves at 28px a bead in a wide drawing area, 26px up to 1500px', () => {
    expect(expandedPitch(1710)).toBe(28)
    expect(expandedPitch(1366)).toBe(26)
  })
})

describe('the expanded rows’ axis (ticket 1260)', () => {
  // A room of 100 to 500 along the axis, a Frame of 1000 starting where the room does.
  const axis = { start: 100, length: 1000, room: { start: 100, end: 500 } }

  it('runs on where the Frame is longer than its room', () => {
    expect(runsOn(axis)).toBe(true)
    expect(runsOn({ ...axis, length: 400 })).toBe(false)
  })

  it('is carried no further than the Frame’s ends reaching the room’s', () => {
    expect(carryAlong(axis, -200)).toBe(-200)
    expect(carryAlong(axis, 50)).toBe(0)
    expect(carryAlong(axis, -900)).toBe(-600)
  })

  it('does not jump a Frame already past an end back to it', () => {
    expect(carryAlong({ ...axis, start: 150 }, 10)).toBe(0)
    expect(carryAlong({ ...axis, start: 150 }, -10)).toBe(-10)
  })

  it('looks at a place along the Frame in the room’s middle, held to the ends', () => {
    // Halfway: 600 comes to 300.
    expect(lookAlong(axis, 0.5)).toBe(-300)
    expect(lookAlong(axis, 0)).toBe(0)
    expect(lookAlong(axis, 1)).toBe(-600)
  })
})

describe('expandedLayout (ticket 1260)', () => {
  const desktop = { width: 1710, height: 860 }

  it('stands two rails beside a tall or square Frame', () => {
    expect(expandedLayout({ width: 240, height: 700 }, desktop)).toBe('rails')
    expect(expandedLayout({ width: 400, height: 400 }, desktop)).toBe('rails')
  })

  it('lays a band along the top for a Frame wider for its height than the area, or an area with no room for rails', () => {
    expect(expandedLayout({ width: 1000, height: 110 }, desktop)).toBe('band')
    expect(expandedLayout({ width: 240, height: 700 }, { width: 744, height: 900 })).toBe('band')
    expect(expandedLayout({ width: 240, height: 700 }, { width: 390, height: 700 })).toBe('narrow')
  })
})
