import { describe, expect, it } from 'vitest'
import { contains, drawingWindow, intersect } from './surfaceWindow'

describe('intersect', () => {
  it('is the part two rectangles share', () => {
    expect(intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 2, width: 10, height: 4 })).toEqual({
      x: 5,
      y: 2,
      width: 5,
      height: 4,
    })
  })

  it('is nothing for rectangles that only touch or do not meet', () => {
    expect(intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })).toBeUndefined()
    expect(intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 5, height: 5 })).toBeUndefined()
  })
})

describe('contains', () => {
  const outer = { x: 10, y: 10, width: 100, height: 50 }

  it('holds a rectangle inside it, edges included', () => {
    expect(contains(outer, { x: 10, y: 10, width: 100, height: 50 })).toBe(true)
    expect(contains(outer, { x: 20, y: 20, width: 10, height: 10 })).toBe(true)
  })

  it('does not hold one that reaches out on any side', () => {
    expect(contains(outer, { x: 9, y: 20, width: 10, height: 10 })).toBe(false)
    expect(contains(outer, { x: 20, y: 9, width: 10, height: 10 })).toBe(false)
    expect(contains(outer, { x: 105, y: 20, width: 10, height: 10 })).toBe(false)
    expect(contains(outer, { x: 20, y: 55, width: 10, height: 10 })).toBe(false)
  })
})

describe('drawingWindow', () => {
  const extent = { width: 15000, height: 15000 }

  it('is the visible part with the margin on every side', () => {
    expect(drawingWindow({ x: 1000, y: 2000, width: 1900, height: 1200 }, extent, 160)).toEqual({
      x: 840,
      y: 1840,
      width: 2220,
      height: 1520,
    })
  })

  it('stays inside the Project, so a margin never reaches past its edges', () => {
    expect(drawingWindow({ x: 10, y: 20, width: 100, height: 100 }, { width: 200, height: 180 }, 160)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 180,
    })
  })

  it('costs what the screen does, not what the Project does', () => {
    const visible = { x: 5000, y: 5000, width: 1900, height: 1200 }

    const small = drawingWindow(visible, { width: 8000, height: 8000 }, 160)
    const huge = drawingWindow(visible, { width: 15000, height: 15000 }, 160)

    expect(huge).toEqual(small)
  })

  it('is on whole pixels, wherever the visible part begins', () => {
    const window = drawingWindow({ x: 100.6, y: 200.4, width: 300.3, height: 100.2 }, extent, 10)

    expect(Object.values(window).every(Number.isInteger)).toBe(true)
    expect(contains(window, { x: 100.6, y: 200.4, width: 300.3, height: 100.2 })).toBe(true)
  })
})
