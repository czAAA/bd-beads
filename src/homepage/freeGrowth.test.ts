import { describe, expect, it } from 'vitest'
import { freeListHeight, freeListRoom, freeStartRows, type FreeListMeasure } from './freeGrowth'

// A screen 800 tall, the list starting 300 down, four rows 100 tall, the whole list 700, 20 of padding under it: the
// tile's foot starts at 420 and may run down to 760 (40 kept clear), a gap of 340.
const MEASURE: FreeListMeasure = { viewport: 800, top: 300, start: 100, full: 700, below: 20 }

describe('the free list growing with the scroll (ticket 0742)', () => {
  it('shows the four rows before the page is scrolled', () => {
    expect(freeListHeight(MEASURE, 0)).toBe(100)
  })

  it('grows 2.5 times as fast as the page scrolls, so its foot runs down the screen', () => {
    expect(freeListHeight(MEASURE, 100)).toBe(350)
  })

  it('grows as fast as the page once its foot reaches the screen’s, so it stays screen-tall', () => {
    // The gap of 340 is closed after 340 / 1.5 of scroll (the list then 666.7 tall); 20 more grows it 20 more.
    expect(freeListHeight(MEASURE, 340 / 1.5)).toBeCloseTo(666.67, 1)
    expect(freeListHeight(MEASURE, 340 / 1.5 + 20)).toBeCloseTo(686.67, 1)
  })

  it('stops at the whole list', () => {
    expect(freeListHeight(MEASURE, 5000)).toBe(700)
  })

  it('grows with the page from the start where the tile already reaches the screen’s foot', () => {
    const tall = { ...MEASURE, viewport: 400 }
    expect(freeListHeight(tall, 50)).toBe(150)
  })

  it('lets the page scroll on until the whole list is out, its foot 40 above the screen’s', () => {
    expect(freeListRoom(MEASURE)).toBe(300 + 700 + 20 + 40 - 800)
    expect(freeListRoom({ ...MEASURE, full: 100, top: 100 })).toBe(0)
  })

  it('takes another speed where the design system sets one', () => {
    expect(freeListHeight(MEASURE, 100, 2)).toBe(300)
  })
})

// The same room: the list 300 down, 20 of padding under it, 40 kept clear, so rows may reach 440 down the list.
describe('the rows the free list starts with (ticket 1060)', () => {
  const PLACE = { viewport: 800, top: 300, below: 20 }
  /** Eighteen rows, each 30 tall: their feet from the list's top. */
  const ROWS = Array.from({ length: 18 }, (_, i) => 30 * (i + 1))

  it('starts with as many whole rows as fit above the room kept clear at the foot', () => {
    expect(freeStartRows(PLACE, ROWS)).toBe(14)
  })

  it('takes a row whose foot is exactly at the room kept clear, and not one a pixel past it', () => {
    expect(freeStartRows({ ...PLACE, viewport: 780 }, ROWS)).toBe(14)
    expect(freeStartRows({ ...PLACE, viewport: 779 }, ROWS)).toBe(13)
  })

  it('never starts with fewer than four, however little room there is', () => {
    expect(freeStartRows({ ...PLACE, viewport: 400 }, ROWS)).toBe(4)
  })

  it('starts with the whole list where it fits, and never more rows than the list has', () => {
    expect(freeStartRows({ ...PLACE, viewport: 2000 }, ROWS)).toBe(18)
    expect(freeStartRows({ ...PLACE, viewport: 400 }, ROWS.slice(0, 3))).toBe(3)
  })

  it('takes another least where the design system sets one', () => {
    expect(freeStartRows({ ...PLACE, viewport: 400 }, ROWS, 6)).toBe(6)
  })

  it('needs nothing to grow once the list starts whole', () => {
    const whole = { ...PLACE, viewport: 2000, start: 540, full: 540 }
    expect(freeListHeight(whole, 0)).toBe(540)
    expect(freeListRoom(whole)).toBe(0)
  })
})
