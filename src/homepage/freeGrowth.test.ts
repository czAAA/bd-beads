import { describe, expect, it } from 'vitest'
import { freeListHeight, freeListRoom, type FreeListMeasure } from './freeGrowth'

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
