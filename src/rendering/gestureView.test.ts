// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { nearestQuarterTurn, tiltOf } from '../domain/canvasOrientation'
import { beadsToDraw, bitmapBox, coversArea, gestureTransform, mayRedrawMidGesture, twistTransform, type View } from './gestureView'
import { OPEN_SPACE } from './space'
import { surfaceView } from './surfaceView'
import { scrollAfterTurn, tiltedView } from './tiltedView'

describe('gestureTransform', () => {
  it('is the identity for an unchanged view', () => {
    expect(gestureTransform({ zoom: 1, scroll: { x: 30, y: 40 } }, { zoom: 1, scroll: { x: 30, y: 40 } })).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('moves the bitmap against the scroll when panning', () => {
    expect(gestureTransform({ zoom: 1, scroll: { x: 0, y: 0 } }, { zoom: 1, scroll: { x: 50, y: -20 } })).toEqual({ scale: 1, x: -50, y: 20 })
  })

  it('keeps the point that stays under the fingers where it was when zooming', () => {
    const from = { zoom: 1, scroll: { x: 100, y: 60 } }
    // Zooming to 0.5 about the screen point (200, 100): the displayed point under it stays under it.
    const to = { zoom: 0.5, scroll: { x: (100 + 200) * 0.5 - 200, y: (60 + 100) * 0.5 - 100 } }
    const { scale, x, y } = gestureTransform(from, to)
    expect(scale).toBe(0.5)
    expect([200 * scale + x, 100 * scale + y]).toEqual([200, 100])
  })
})

describe('bitmapBox', () => {
  const screen = { width: 1000, height: 800 }

  it('is the drawing area itself in the full look', () => {
    expect(bitmapBox(screen, false, 2)).toEqual({ x: 0, y: 0, width: 1000, height: 800 })
  })

  it('reaches half the drawing area past it on every side in the draft look (ticket 0717)', () => {
    expect(bitmapBox(screen, true, 1)).toEqual({ x: -500, y: -400, width: 2000, height: 1600 })
  })

  it('reaches less where its bitmap would pass the 4096 × 4096 pixels Safari on iOS still draws', () => {
    const box = bitmapBox({ width: 1366, height: 1024 }, true, 2)
    expect(box.width * 2 * box.height * 2).toBeLessThanOrEqual(4096 * 4096)
    expect(box.x).toBeLessThan(0)
    expect(box.x).toBeGreaterThan(-683)
  })

  /** Whether the bitmap drawn over `box` for the view `from`, moved to show `to`, still covers the whole screen. */
  function covers(box: ReturnType<typeof bitmapBox>, from: View, to: View): boolean {
    return coversArea(box, gestureTransform(from, to, box), screen)
  }

  it.each([
    { pan: 'left', scroll: { x: -500, y: 0 } },
    { pan: 'down and right', scroll: { x: 500, y: 400 } },
  ])('in the draft look, still covers the screen after a pan of half a screen $pan', ({ scroll }) => {
    expect(covers(bitmapBox(screen, true, 1), { zoom: 0.2, scroll: { x: 0, y: 0 } }, { zoom: 0.2, scroll })).toBe(true)
  })

  it('in the draft look, still covers the screen zoomed out to 60% about its middle', () => {
    const from = { zoom: 0.2, scroll: { x: 100, y: 60 } }
    const to = { zoom: 0.12, scroll: { x: (100 + 500) * 0.6 - 500, y: (60 + 400) * 0.6 - 400 } }
    expect(covers(bitmapBox(screen, true, 1), from, to)).toBe(true)
  })

  it('in the full look, uncovers a strip on a pan, as before', () => {
    expect(covers(bitmapBox(screen, false, 1), { zoom: 0.6, scroll: { x: 0, y: 0 } }, { zoom: 0.6, scroll: { x: 100, y: 0 } })).toBe(false)
  })
})

describe('coversArea', () => {
  const screen = { width: 1000, height: 800 }

  it('holds for an unmoved bitmap over the drawing area, and one reaching past it', () => {
    expect(coversArea({ x: 0, y: 0, width: 1000, height: 800 }, { scale: 1, x: 0, y: 0 }, screen)).toBe(true)
    expect(coversArea({ x: -500, y: -400, width: 2000, height: 1600 }, { scale: 1, x: 300, y: -200 }, screen)).toBe(true)
  })

  it.each([
    { side: 'left', move: { scale: 1, x: 1, y: 0 } },
    { side: 'bottom', move: { scale: 1, x: 0, y: -1 } },
    { side: 'right and bottom, zoomed out', move: { scale: 0.9, x: 0, y: 0 } },
  ])('fails where a move uncovers the $side edge', ({ move }) => {
    expect(coversArea({ x: 0, y: 0, width: 1000, height: 800 }, move, screen)).toBe(false)
  })
})

describe('mayRedrawMidGesture (ticket 0732)', () => {
  it('waits three times as long as the last draw took after it', () => {
    expect(mayRedrawMidGesture(1059, { at: 1000, ms: 20 })).toBe(false)
    expect(mayRedrawMidGesture(1060, { at: 1000, ms: 20 })).toBe(true)
  })

  it('draws at once before anything was drawn', () => {
    expect(mayRedrawMidGesture(0, { at: Number.NEGATIVE_INFINITY, ms: 0 })).toBe(true)
  })
})

describe('beadsToDraw', () => {
  it('is capped by what fits in view', () => {
    expect(beadsToDraw(1_000_000, 0, { width: 200, height: 100 }, 1)).toBe(10 * 5)
  })

  it('counts a rounded bead as the square beads it costs (ticket 0676)', () => {
    expect(beadsToDraw(1_000_000, 0, { width: 200, height: 100 }, 1, 3)).toBe(10 * 5 * 3)
  })

  it('is capped by what is there to draw', () => {
    expect(beadsToDraw(10, 90, { width: 2000, height: 2000 }, 1)).toBe(100)
  })
})

describe('twistTransform', () => {
  const screen = { width: 1000, height: 800 }
  /** The drawing of a loom Canvas looked at from `scroll` at `zoom`, turned to `orientation`, as the surface builds it. */
  function drawnAt(orientation: number, zoom = 1, scroll = { x: 0, y: 0 }) {
    const leaning = tiltedView(screen, tiltOf(orientation))
    const drawnScroll = { x: scroll.x - leaning.offset.x, y: scroll.y - leaning.offset.y }
    return { leaning, surface: surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: nearestQuarterTurn(orientation), zoom, scroll: drawnScroll, viewport: leaning.drawn }) }
  }
  /** Where the drawing's box, laid by the matrix, puts a point drawn at `p`, on the screen. */
  function laid(m: ReturnType<typeof twistTransform>, offset: { x: number; y: number }, p: { x: number; y: number }) {
    return { x: m.a * p.x + m.c * p.y + m.e - offset.x, y: m.b * p.x + m.d * p.y + m.f - offset.y }
  }

  it('leaves an unchanged view where it is', () => {
    const view = drawnAt(0)
    const m = twistTransform(view, view)
    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('moves the drawing against the scroll when the fingers pan', () => {
    const m = twistTransform(drawnAt(0), drawnAt(0, 1, { x: 50, y: -20 }))
    expect([m.a, m.b, m.c, m.d, m.e, m.f]).toEqual([1, 0, 0, 1, -50, 20])
  })

  it('turns the drawing a quarter clockwise about the middle when the Canvas turned there', () => {
    const from = drawnAt(0)
    const to = drawnAt(90, 1, scrollAfterTurn({ x: 0, y: 0 }, screen, { from: 0, to: 90 }))
    const m = twistTransform(from, to)
    expect([m.a, m.b, m.c, m.d].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([0, 1, -1, 0])
    expect(laid(m, from.leaning.offset, { x: 500, y: 400 })).toEqual({ x: 500, y: 400 })
  })

  it('lays the beads of a drawing made upright where a view zoomed, moved and leaning 30° shows them', () => {
    const from = drawnAt(0, 1, { x: 100, y: 60 })
    const to = drawnAt(30, 1.5, { x: -40, y: 220 })
    const m = twistTransform(from, to)
    for (const [x, y] of [[0, 0], [7, 3], [-2, 11]]) {
      const expected = to.leaning.toScreen(to.surface.gridToPoint(x, y))
      const got = laid(m, from.leaning.offset, from.surface.gridToPoint(x, y))
      expect(got.x).toBeCloseTo(expected.x, 6)
      expect(got.y).toBeCloseTo(expected.y, 6)
    }
  })
})
