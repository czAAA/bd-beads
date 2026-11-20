// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { convertPopoverPlace, pictureBarPlace, pictureBounds, reachClearOf } from './pictureBarPlacement'

const viewport = { width: 1000, height: 700 }
const bar = { width: 160, height: 40 }
const picture = { left: 300, top: 200, width: 200, height: 100 }

describe('the picture bar and the Convert to beads popover on the canvas box (ReferenceImage card, ticket 0883)', () => {
  it('bounds a turned picture by the box round it on screen', () => {
    const bounds = pictureBounds({ centre: { x: 100, y: 100 }, width: 80, height: 40, angle: 90 })
    expect(Object.values(bounds).map(Math.round)).toEqual([80, 60, 40, 80])
  })

  it('centres the bar over the picture, its bottom 14px above the top edge', () => {
    expect(pictureBarPlace(picture, bar, viewport)).toEqual({ left: 320, top: 146 })
  })

  it('stands the bar above the Frame\'s margin sheet where the picture lies under it', () => {
    expect(pictureBarPlace(picture, bar, viewport, { left: 250, top: 150, width: 400, height: 300 })).toEqual({ left: 320, top: 96 })
    expect(pictureBarPlace(picture, bar, viewport, { left: 700, top: 150, width: 100, height: 100 })).toEqual({ left: 320, top: 146 })
  })

  it('stands 14px inside the picture\'s top edge with no room above, and keeps inside the canvas box', () => {
    expect(pictureBarPlace({ left: -100, top: 10, width: 150, height: 100 }, bar, viewport)).toEqual({ left: 8, top: 24 })
    expect(pictureBarPlace({ left: 300, top: -300, width: 200, height: 900 }, bar, viewport)).toEqual({ left: 320, top: 14 })
  })

  it('goes out of view with a picture panned away, rather than wait at the canvas box\'s edge (ticket 1011)', () => {
    // Panned off the right: the bar keeps 24px over the picture's left edge, past the canvas box.
    expect(pictureBarPlace({ left: 1100, top: 200, width: 200, height: 100 }, bar, viewport)).toEqual({ left: 964, top: 146 })
    // Off the left: 24px over its right edge.
    expect(pictureBarPlace({ left: -400, top: 200, width: 200, height: 100 }, bar, viewport)).toEqual({ left: -224, top: 146 })
    // Off the bottom: still 14px above its top edge.
    expect(pictureBarPlace({ left: 300, top: 900, width: 200, height: 100 }, bar, viewport)).toEqual({ left: 320, top: 846 })
    // Off the top: 14px inside the bottom edge, the last of the picture it can stand on.
    expect(pictureBarPlace({ left: 300, top: -300, width: 200, height: 280 }, bar, viewport)).toEqual({ left: 320, top: -74 })
    // A picture narrower than 48px keeps the bar over half its width.
    expect(pictureBarPlace({ left: 1100, top: 200, width: 30, height: 100 }, bar, viewport)).toEqual({ left: 955, top: 146 })
  })

  it('keeps 14px inside the top edge of a picture too short to hold the bar above its bottom edge (ticket 1011)', () => {
    expect(pictureBarPlace({ left: 300, top: 10, width: 200, height: 50 }, bar, viewport)).toEqual({ left: 320, top: 24 })
  })

  it('stands inside the picture\'s top edge with no room above its sheet either', () => {
    const sheet = { left: 0, top: 20, width: 1000, height: 670 }
    expect(pictureBarPlace({ left: 300, top: 80, width: 200, height: 560 }, bar, viewport, sheet)).toEqual({ left: 320, top: 94 })
  })

  it('puts the popover 20px right of the picture, level with the bar, or left of it with no room', () => {
    const popover = { width: 360, height: 400 }
    expect(convertPopoverPlace(picture, 146, popover, viewport)).toEqual({ left: 520, top: 146 })
    expect(convertPopoverPlace({ ...picture, left: 600 }, 146, popover, viewport)).toEqual({ left: 220, top: 146 })
  })

  it('stands a handle on beyond the bar where it would land under it, and leaves it where it is clear (ticket 1160)', () => {
    const over = { left: 320, top: 146, width: 160, height: 40 }
    const up = { x: 0, y: -1 }
    // From the picture's top edge, 48px up lands on the bar: on to 22px above the bar's top.
    expect(reachClearOf({ x: 400, y: 200 }, up, 48, over, 22)).toBe(76)
    // Down from the bottom edge, or with no bar, the handle keeps its offset.
    expect(reachClearOf({ x: 400, y: 300 }, { x: 0, y: 1 }, 48, over, 22)).toBe(48)
    expect(reachClearOf({ x: 400, y: 200 }, up, 48, undefined, 22)).toBe(48)
    // Beside the bar's end it is clear already; slanting under its end it leaves by the nearer side.
    expect(reachClearOf({ x: 520, y: 200 }, up, 48, over, 22)).toBe(48)
    expect(reachClearOf({ x: 460, y: 200 }, { x: 0.8, y: -0.6 }, 48, over, 22)).toBeCloseTo(52.5)
  })
})
