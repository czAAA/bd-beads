import { describe, expect, it } from 'vitest'
import { inflate, intersect, placeCard, pointerBetween, overlaps } from './tourGeometry'

const card = { w: 328, h: 220 }
const air = { w: 1440, h: 900 }

describe('rectangles', () => {
  it('intersects and inflates', () => {
    expect(intersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toEqual({ x: 5, y: 5, w: 5, h: 5 })
    expect(intersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBeUndefined()
    expect(inflate({ x: 10, y: 10, w: 20, h: 20 }, 5)).toEqual({ x: 5, y: 5, w: 30, h: 30 })
    expect(overlaps({ x: 0, y: 0, w: 4, h: 4 }, { x: 3, y: 3, w: 4, h: 4 })).toBe(true)
  })
})

describe('placeCard', () => {
  it('docks under the header on a phone', () => {
    expect(placeCard(card, { x: 10, y: 800, w: 50, h: 50 }, { w: 402, h: 874 })).toMatchObject({ x: 12, y: 76 })
  })

  it('centres the card when there is nothing to point at', () => {
    expect(placeCard(card, undefined, air)).toEqual({ x: 556, y: 340 })
  })

  it('puts it to the right of a left-column control, clear of the column', () => {
    const control = { x: 40, y: 200, w: 60, h: 50 }
    const column = { x: 32, y: 88, w: 326, h: 800 }
    const spot = placeCard(card, control, air, column)
    expect(spot.side).toBe('right')
    expect(spot.x).toBe(32 + 326 + 40)
  })

  it('puts it below a header control and above a bottom one', () => {
    expect(placeCard(card, { x: 600, y: 10, w: 80, h: 40 }, air).side).toBe('below')
    expect(placeCard(card, { x: 600, y: 800, w: 80, h: 60 }, { w: 1024, h: 900 }).side).toBe('above')
  })

  it('never overlaps the control it points at', () => {
    const hole = { x: 500, y: 300, w: 400, h: 300 }
    const spot = placeCard(card, hole, air)
    expect(overlaps({ x: spot.x, y: spot.y, w: card.w, h: card.h }, hole)).toBe(false)
  })
})

describe('pointerBetween', () => {
  it('leaves the card by the edge facing the hole', () => {
    const cardRect = { x: 400, y: 200, w: 328, h: 220 }
    const right = pointerBetween(cardRect, { x: 40, y: 250, w: 60, h: 40 })
    expect(right.from.x).toBe(400)
    expect(right.to.x).toBeGreaterThan(100)
    const up = pointerBetween(cardRect, { x: 500, y: 700, w: 60, h: 40 })
    expect(up.from.y).toBe(420)
    expect(up.to.y).toBeLessThan(700)
  })
})
