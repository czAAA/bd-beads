import { describe, expect, it } from 'vitest'
import { scrollAfterTurn, tiltedView } from './tiltedView'

const close = (point: { x: number; y: number }) => ({ x: expect.closeTo(point.x, 6), y: expect.closeTo(point.y, 6) })

describe('a view leaning off its quarter turn (ticket 0672)', () => {
  it('upright, draws on the screen as it is', () => {
    const view = tiltedView({ width: 300, height: 400 }, 0)
    expect(view.drawn).toEqual({ width: 300, height: 400 })
    expect(view.toDrawn({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
    expect(view.toScreen({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
    expect(view.toView({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
  })

  it('leaning, draws on a square as wide as the screen\'s diagonal, so turned it still covers every corner', () => {
    const view = tiltedView({ width: 300, height: 400 }, 30)
    expect(view.drawn).toEqual({ width: 500, height: 500 })
    expect(view.offset).toEqual({ x: 100, y: 50 })
  })

  it('finds a point of the screen on the drawing turned back about the middle, and the other way', () => {
    const view = tiltedView({ width: 300, height: 400 }, 30)
    expect(view.toDrawn({ x: 150, y: 200 })).toEqual(close({ x: 250, y: 250 }))
    // 100 px right of the middle on screen was drawn 30° above the level, as the drawing is turned 30° clockwise.
    expect(view.toDrawn({ x: 250, y: 200 })).toEqual(close({ x: 250 + 86.6025403784, y: 250 - 50 }))
    expect(view.toScreen({ x: 250 + 86.6025403784, y: 200 })).toEqual(close({ x: 250, y: 200 }))
    expect(view.toView({ x: 250, y: 200 })).toEqual(close({ x: 150 + 86.6025403784, y: 150 }))
  })

  it('turns a move on screen back into one across the drawing', () => {
    const view = tiltedView({ width: 300, height: 400 }, 30)
    expect(view.unturned({ x: 10, y: 0 })).toEqual(close({ x: 8.66025403784, y: -5 }))
  })

  it('gives the box a turned block of the drawing covers on screen', () => {
    const view = tiltedView({ width: 300, height: 400 }, 30)
    const box = view.screenBox({ x: 200, y: 250, width: 100, height: 0 })
    expect(box).toEqual({ x: expect.closeTo(150 - 43.30127, 4), y: expect.closeTo(200 - 25, 4), width: expect.closeTo(86.60254, 4), height: expect.closeTo(50, 4) })
  })
})

describe('the scroll after the Canvas turns (ticket 0672)', () => {
  const viewport = { width: 200, height: 200 }

  it('keeps it when the view leans about its middle within its quarter turn', () => {
    expect(scrollAfterTurn({ x: 5, y: 7 }, viewport, { from: 0, to: 30 })).toEqual(close({ x: 5, y: 7 }))
  })

  it('keeps the bead under the fingers there as the Canvas turns about them', () => {
    // The bead under the right edge's middle, (200, 100) of grid space at 100%, lies at (−100, 200) once turned a
    // quarter, and stays at (200, 100) on screen.
    expect(scrollAfterTurn({ x: 0, y: 0 }, viewport, { from: 0, to: 90, anchor: { x: 200, y: 100 } })).toEqual(close({ x: -300, y: 100 }))
  })
})
