// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  newReferenceImage,
  readReferenceImage,
  referenceHeight,
  replacedPicture,
  resizedFromCorner,
  scaledBy,
  snappedAngle,
  turnedBy,
  turnedToward,
  withReferenceImage,
  type ReferenceImage,
  type ReferencePicture,
} from './referenceImage'
import { bareProject } from '../testUtils/layerFields'

const wide: ReferencePicture = { name: 'rose.png', type: 'image/webp', width: 400, height: 200, bytes: 4096 }
const tall: ReferencePicture = { name: 'tall.jpg', type: 'image/jpeg', width: 100, height: 300, bytes: 2048 }
const box = { x: 0, y: 0, width: 200, height: 200 }
const limits = { min: 20, max: 2000 }

describe('a new reference image (ReferenceImage card)', () => {
  it('is fitted inside the Canvas box, centred, upright, shown at 50%', () => {
    const image = newReferenceImage(wide, box)
    expect(image.place).toEqual({ x: 100, y: 100, width: 200, angle: 0 })
    expect(referenceHeight(image)).toBe(100)
    expect(image.opacity).toBe(50)
    expect(image.shown).toBe(true)
  })

  it('fits a tall picture by its height', () => {
    const image = newReferenceImage(tall, { x: 10, y: 20, width: 300, height: 150 })
    expect(image.place).toEqual({ x: 160, y: 95, width: 50, angle: 0 })
  })
})

describe('replacing the picture', () => {
  it('keeps the place, the turn and the width; the height follows the new shape', () => {
    const placed: ReferenceImage = { ...newReferenceImage(wide, box), place: { x: 40, y: 60, width: 120, angle: 30 }, opacity: 75, shown: false }
    const replaced = replacedPicture(placed, tall)
    expect(replaced.place).toEqual({ x: 40, y: 60, width: 120, angle: 30 })
    expect(referenceHeight(replaced)).toBe(360)
    expect(replaced.picture).toEqual(tall)
    expect(replaced.opacity).toBe(75)
    expect(replaced.shown).toBe(true)
  })
})

describe('resizing from a corner', () => {
  const upright = { x: 100, y: 100, width: 200, angle: 0 }

  it('keeps the shape and the opposite corner where it was', () => {
    // 400 × 200 picture drawn 200 × 100: the top-left corner at (0, 50), the bottom-right at (200, 150).
    const place = resizedFromCorner(upright, 0.5, 'bottom-right', { x: 300, y: 200 }, limits)
    expect(place).toEqual({ x: 150, y: 125, width: 300, angle: 0 })
  })

  it('reads the pointer along the turned picture', () => {
    // Turned a quarter: its right edge points down, so its "bottom-right" corner is at the bottom-left on screen.
    const turned = { ...upright, angle: 90 }
    const place = resizedFromCorner(turned, 0.5, 'bottom-right', { x: 0, y: 300 }, limits)
    expect(place.width).toBeCloseTo(300)
    expect(place.angle).toBe(90)
    // The top-left corner, (150, 0) on screen, stays.
    expect(place.x).toBeCloseTo(75)
    expect(place.y).toBeCloseTo(150)
  })

  it('stops at the smallest and largest width', () => {
    expect(resizedFromCorner(upright, 0.5, 'bottom-right', { x: 1, y: 51 }, limits).width).toBe(20)
    expect(resizedFromCorner(upright, 0.5, 'bottom-right', { x: 9000, y: 9000 }, limits).width).toBe(2000)
  })
})

describe('turning', () => {
  const centre = { x: 0, y: 0, width: 100, angle: 0 }

  it('follows the pointer from a handle above the picture', () => {
    expect(turnedToward(centre, { x: 50, y: -50 * Math.tan((60 * Math.PI) / 180) }, { below: false, fine: false }).angle).toBe(30)
  })

  it('follows the pointer from a handle below the picture', () => {
    expect(turnedToward(centre, { x: -10, y: 10 }, { below: true, fine: false }).angle).toBe(45)
  })

  it('snaps to a quarter turn within 4°, and with Shift to every 15°', () => {
    expect(snappedAngle(93, false)).toBe(90)
    expect(snappedAngle(357, false)).toBe(0)
    expect(snappedAngle(85, false)).toBe(85)
    expect(snappedAngle(37, true)).toBe(30)
    expect(snappedAngle(38, true)).toBe(45)
  })

  it('turns by steps and keeps the angle within a whole turn', () => {
    expect(turnedBy({ ...centre, angle: 350 }, 15).angle).toBe(5)
    expect(turnedBy(centre, -15).angle).toBe(345)
  })

  it('resizes by a factor within the limits', () => {
    expect(scaledBy(centre, 1.1, limits).width).toBeCloseTo(110)
    expect(scaledBy({ ...centre, width: 21 }, 0.9, limits).width).toBe(20)
  })
})

describe('reading a stored reference image', () => {
  const stored = newReferenceImage(wide, box)

  it('reads back what was saved', () => {
    expect(readReferenceImage(JSON.parse(JSON.stringify(stored)))).toEqual(stored)
  })

  it('reads nothing for an unreadable record', () => {
    expect(readReferenceImage(undefined)).toBeUndefined()
    expect(readReferenceImage({ ...stored, picture: { ...wide, width: 0 } })).toBeUndefined()
    expect(readReferenceImage({ ...stored, place: { ...stored.place, width: 'wide' } })).toBeUndefined()
  })

  it('reads an unknown opacity as 50% and a missing shown as shown', () => {
    const { shown: _shown, ...rest } = stored
    expect(readReferenceImage({ ...rest, opacity: 40 })).toMatchObject({ opacity: 50, shown: true })
  })

  it('is saved with the Project and taken off it', () => {
    const project = bareProject({})
    const withImage = withReferenceImage(project, stored)
    expect(withImage.referenceImage).toEqual(stored)
    expect('referenceImage' in withReferenceImage(withImage, undefined)).toBe(false)
  })
})
