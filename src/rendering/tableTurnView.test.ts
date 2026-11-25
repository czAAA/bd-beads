import { describe, expect, it } from 'vitest'
import { drawingScrollOf, originTurnedAbout, tableScrollOf, tableTurnView } from './tableTurnView'

const close = (point: { x: number; y: number }) => ({ x: expect.closeTo(point.x, 6), y: expect.closeTo(point.y, 6) })

describe('a Table turned off its quarter turn (ticket 0672)', () => {
  it('upright, draws on the screen as it is', () => {
    const view = tableTurnView({ width: 300, height: 400 }, 0)
    expect(view.drawn).toEqual({ width: 300, height: 400 })
    expect(view.toDrawn({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
    expect(view.toScreen({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
    expect(view.toView({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 })
  })

  it('turned off a quarter, draws on a square as wide as the screen\'s diagonal, so turned it still covers every corner', () => {
    const view = tableTurnView({ width: 300, height: 400 }, 30)
    expect(view.drawn).toEqual({ width: 500, height: 500 })
    expect(view.offset).toEqual({ x: 100, y: 50 })
  })

  it('finds a point of the screen on the drawing turned back about the middle, and the other way', () => {
    const view = tableTurnView({ width: 300, height: 400 }, 30)
    expect(view.toDrawn({ x: 150, y: 200 })).toEqual(close({ x: 250, y: 250 }))
    // 100 px right of the middle on screen was drawn 30° above the level, as the drawing is turned 30° clockwise.
    expect(view.toDrawn({ x: 250, y: 200 })).toEqual(close({ x: 250 + 86.6025403784, y: 250 - 50 }))
    expect(view.toScreen({ x: 250 + 86.6025403784, y: 200 })).toEqual(close({ x: 250, y: 200 }))
    expect(view.toView({ x: 250, y: 200 })).toEqual(close({ x: 150 + 86.6025403784, y: 150 }))
  })

  it('turns a move on screen back into one across the drawing', () => {
    const view = tableTurnView({ width: 300, height: 400 }, 30)
    expect(view.unturned({ x: 10, y: 0 })).toEqual(close({ x: 8.66025403784, y: -5 }))
  })

  it('gives the box a turned block of the drawing covers on screen', () => {
    const view = tableTurnView({ width: 300, height: 400 }, 30)
    const box = view.screenBox({ x: 200, y: 250, width: 100, height: 0 })
    expect(box).toEqual({ x: expect.closeTo(150 - 43.30127, 4), y: expect.closeTo(200 - 25, 4), width: expect.closeTo(86.60254, 4), height: expect.closeTo(50, 4) })
  })
})

describe('a turn of the Canvas on the table (tickets 0672, 1185)', () => {
  const viewport = { width: 200, height: 200 }
  const upright = { orientation: 0, origin: { x: 0, y: 0 }, zoom: 1 }

  /** The drawing's scroll after the Canvas turns `from` `to` about `anchor`, and the table scroll before and after. */
  function turn(drawing: { x: number; y: number }, from: number, to: number, anchor = { x: 100, y: 100 }, origin = { x: 0, y: 0 }, zoom = 1) {
    const table = tableScrollOf(drawing, viewport, { orientation: from, origin, zoom })
    const turned = originTurnedAbout(origin, { by: to - from, anchor, table, zoom })
    const after = drawingScrollOf(table, viewport, { orientation: to, origin: turned, zoom })
    return { after, table, tableAfter: tableScrollOf(after, viewport, { orientation: to, origin: turned, zoom }) }
  }

  it('reads an upright drawing\'s scroll as the table scroll, and back', () => {
    expect(tableScrollOf({ x: 5, y: 7 }, viewport, upright)).toEqual({ x: 5, y: 7 })
    expect(drawingScrollOf({ x: 5, y: 7 }, viewport, upright)).toEqual({ x: 5, y: 7 })
  })

  it('keeps the drawing\'s scroll when the view turns about its middle within its quarter turn', () => {
    expect(turn({ x: 5, y: 7 }, 0, 30).after).toEqual(close({ x: 5, y: 7 }))
  })

  it('keeps the bead under the fingers there as the Canvas turns about them, and never the table scroll', () => {
    // The bead under the right edge's middle, (200, 100) of grid space at 100%, lies at (−100, 200) once turned a
    // quarter, and stays at (200, 100) on screen.
    const { after, table, tableAfter } = turn({ x: 0, y: 0 }, 0, 90, { x: 200, y: 100 })
    expect(after).toEqual(close({ x: -300, y: 100 }))
    expect(tableAfter).toEqual(close(table))
  })

  it('keeps the table scroll through a turn that crosses a quarter, zoomed, from where an earlier twist left the Canvas', () => {
    const { table, tableAfter } = turn({ x: 40, y: -90 }, 37, 151, { x: 30, y: 170 }, { x: 12, y: -8 }, 1.7)
    expect(tableAfter).toEqual(close(table))
  })
})
