// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { canvasDrawing, frameDrawing, seamOf } from './layerDrawings'
import { tiltedView } from './tiltedView'

const screen = { width: 400, height: 300 }

describe("each layer's drawing (ticket 1187)", () => {
  it('draws the Canvas at its nearest quarter turn, leaning the rest from a scroll less the larger square', () => {
    const drawing = canvasDrawing(screen, 100, { x: 30, y: 40 })
    expect(drawing.rotation).toBe(90)
    expect(drawing.leaning.degrees).toBe(10)
    expect(drawing.scroll).toEqual({ x: 30 - drawing.leaning.offset.x, y: 40 - drawing.leaning.offset.y })
    expect(canvasDrawing(screen, 180, { x: 30, y: 40 }).scroll).toEqual({ x: 30, y: 40 })
  })

  it("is the Canvas's very drawing while the Frame lies as the Canvas is drawn, without asking where it is", () => {
    const canvas = canvasDrawing(screen, 100, { x: 30, y: 40 })
    const pin = () => {
      throw new Error('not asked')
    }
    // A Frame a quarter round on the Canvas, its Canvas drawn at the Canvas's quarter turn: one drawing.
    expect(frameDrawing({ screen, angle: 190, rotation: 90, canvas, pin })).toBe(canvas)
  })

  it('leans by its own angle and is scrolled so its centre shows where it is pinned', () => {
    const canvas = canvasDrawing(screen, 0, { x: 0, y: 0 })
    const pinned = { displayed: { x: 500, y: 260 }, onScreen: { x: 120, y: 90 } }
    const drawing = frameDrawing({ screen, angle: 37, rotation: 0, canvas, pin: () => pinned })
    expect(drawing.leaning.degrees).toBe(37)
    const shown = drawing.leaning.toScreen({ x: pinned.displayed.x - drawing.scroll.x, y: pinned.displayed.y - drawing.scroll.y })
    expect(shown.x).toBeCloseTo(120, 9)
    expect(shown.y).toBeCloseTo(90, 9)
  })

  it("lays one drawing's points in another's through the screen", () => {
    const [from, to] = [tiltedView(screen, 20), tiltedView(screen, -15)]
    const seam = seamOf(from, to)
    const point = { x: 140, y: 75 }
    const through = to.toDrawn(from.toScreen(point))
    expect(seam.a * point.x + seam.c * point.y + seam.e).toBeCloseTo(through.x, 9)
    expect(seam.b * point.x + seam.d * point.y + seam.f).toBeCloseTo(through.y, 9)
    const same = seamOf(from, from)
    expect([same.a, same.b, same.c, same.d, same.e, same.f].map((value) => Math.round(value * 1e9) / 1e9 + 0)).toEqual([1, 0, 0, 1, 0, 0])
  })
})
