// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { convertPopoverPlace, pictureBarPlace, pictureBounds } from './pictureBarPlacement'

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

  it('stands inside the picture\'s top edge with no room above its sheet either', () => {
    const sheet = { left: 0, top: 20, width: 1000, height: 670 }
    expect(pictureBarPlace({ left: 300, top: 80, width: 200, height: 560 }, bar, viewport, sheet)).toEqual({ left: 320, top: 94 })
  })

  it('puts the popover 20px right of the picture, level with the bar, or left of it with no room', () => {
    const popover = { width: 360, height: 400 }
    expect(convertPopoverPlace(picture, 146, popover, viewport)).toEqual({ left: 520, top: 146 })
    expect(convertPopoverPlace({ ...picture, left: 600 }, 146, popover, viewport)).toEqual({ left: 220, top: 146 })
  })
})
