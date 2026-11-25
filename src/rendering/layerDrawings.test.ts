// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canvasDrawing, frameDrawing } from './layerDrawings'
import { tableTurnView } from './tableTurnView'

const screen = { width: 400, height: 300 }

describe("each layer's drawing (ticket 1187)", () => {
  it('draws the Canvas at its nearest quarter turn, from a scroll less the larger square the Table turn leans on', () => {
    const view = tableTurnView(screen, 10)
    const drawing = canvasDrawing(view, 100, { x: 30, y: 40 })
    expect(drawing.rotation).toBe(90)
    expect(drawing.scroll).toEqual({ x: 30 - view.offset.x, y: 40 - view.offset.y })
    expect(canvasDrawing(tableTurnView(screen, 0), 180, { x: 30, y: 40 }).scroll).toEqual({ x: 30, y: 40 })
  })

  it('is scrolled so a Frame\'s centre shows where it is pinned', () => {
    const view = tableTurnView(screen, 37)
    const pinned = { displayed: { x: 500, y: 260 }, onScreen: { x: 120, y: 90 } }
    const drawing = frameDrawing({ view, rotation: 0, pin: () => pinned })
    const shown = view.toScreen({ x: pinned.displayed.x - drawing.scroll.x, y: pinned.displayed.y - drawing.scroll.y })
    expect(shown.x).toBeCloseTo(120, 9)
    expect(shown.y).toBeCloseTo(90, 9)
  })
})
