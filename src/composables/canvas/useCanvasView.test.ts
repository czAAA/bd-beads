import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { paintAt } from '../../testUtils/layers'
import { orientationOf } from '../../domain/layerRecord'
import { rotateCanvas, turnCanvasTo } from '../../domain/rotate'
import { INTO_VIEW_MS, SNAP_MS } from '../../rendering/gestureView'
import { FIT_MARGIN_PX, fitBox, LARGEST_FIT_BEAD_PX, useCanvasView, type CanvasViewOptions } from './useCanvasView'
import { MAX_ZOOM } from '../../domain/grid'
import { NO_INSETS } from '../../domain/toolPill'
import { surfaceView, type SurfaceView } from '../../rendering/surfaceView'
import { OPEN_SPACE } from '../../rendering/space'
import { type LayersChange, withLayers } from '../../testUtils/layerFields'


function projectOf(columns: number, rows: number, extra: LayersChange = {}): Project {
  return withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } }), extra)
}

function setup(project: Project | undefined, size = { width: 1000, height: 800 }, pill = NO_INSETS, opening?: CanvasViewOptions['opening']) {
  const current = ref(project)
  const viewport = ref(size)
  const covered = ref(pill)
  // The Project keeps the angle a twist settles on, as the Rotate canvas flow does.
  const kept: number[] = []
  const keepTwist = (orientation: number) => {
    kept.push(orientation)
    current.value = turnCanvasTo(current.value!, orientation)
  }
  const view = effectScope().run(() => useCanvasView(() => current.value, viewport, { keepTwist, covered: () => covered.value, opening }))!
  return { current, viewport, covered, view, kept }
}

describe('useCanvasView', () => {
  it('is placed only once the area is measured, so nothing is laid at its stand-in view first (ticket 0991)', async () => {
    const { view, viewport } = setup(projectOf(20, 10), { width: 0, height: 0 })
    view.fit()
    expect(view.placed.value).toBe(false)
    viewport.value = { width: 1000, height: 800 }
    await nextTick()
    expect(view.placed.value).toBe(true)
  })

  it('zooms a small Frame in until its sheet fills the viewport one way, with the Frame in the middle (ticket 0964)', async () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()

    // The sheet is 28 × 18 beads of 20px, 560 × 360 at 100%: 36px clear each side across, it fills the 1000px at 165%.
    expect(view.zoom.value).toBe(1.65)
    // The Frame, 400 × 200 at 100%, sits at 0, 0: its middle (330, 165) is the viewport's middle (500, 400).
    expect(view.scroll.value.x).toBeCloseTo(-170, 6)
    expect(view.scroll.value.y).toBeCloseTo(-235, 6)
  })

  it('fills the canvas box of a 1366 × 1024 screen with the 16 × 10 Loom cuff\'s sheet, down (ticket 0964)', () => {
    const pill = { ...NO_INSETS, bottom: 64 }
    const { view } = setup(projectOf(16, 10), { width: 1366, height: 930 }, pill)
    view.fit()

    // The sheet, 24 × 18 beads (480 × 360 at 100%), is 830px tall at 230%: the 866px above the pill less 18px air
    // each side.
    expect(view.zoom.value).toBe(2.3)
    const sheet = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: view.zoom.value, scroll: view.scroll.value }).beadBox({ row: -4, column: -4, rows: 18, columns: 24 })
    expect(930 - 64 - sheet.height).toBeLessThan(2 * 18 + 360 * 0.01)
  })

  it('zooms a tiny Frame in no further than its beads at the largest size, under the Zoom ceiling (ticket 0964)', () => {
    const { view } = setup(projectOf(6, 4), { width: 1366, height: 930 })
    view.fit()

    // A bead is 20px at 100%: 48px is 240%, short of filling the 1366 × 930 with the 14 × 12 sheet.
    expect(view.zoom.value).toBe(LARGEST_FIT_BEAD_PX / 20)
    expect(view.zoom.value).toBeLessThan(MAX_ZOOM)
  })

  it('fits a drawing with no Frame never past 100%, as before (ticket 0964)', () => {
    const painted = paintAt(withLayers(projectOf(2, 2), { frame: undefined }), [{ row: 0, column: 0 }], '#e63746')
    const { view } = setup(painted)
    view.fit()

    expect(view.zoom.value).toBe(1)
  })

  it('zooms out to fit a Frame bigger than the viewport, its Margin sheet whole (ticket 0850)', () => {
    const { view } = setup(projectOf(80, 40))
    view.fit()

    // The sheet is the Frame and 4 positions round it: 88 × 48 beads of 20px.
    expect(view.zoom.value).toBe(0.52)
    expect(view.zoom.value * 88 * 20).toBeLessThanOrEqual(1000)
  })

  it('fits the Frame\'s sheet in the room the Tool pill leaves, and centres it there (ticket 0850)', () => {
    const { view } = setup(projectOf(40, 30), { width: 1000, height: 800 }, { ...NO_INSETS, bottom: 64 })
    view.fit()

    // The sheet, 48 × 38 beads from position -4, -4, lies whole in the 1000 × 736 above the pill, as much room above
    // it as below.
    const sheet = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: view.zoom.value, scroll: view.scroll.value }).beadBox({ row: -4, column: -4, rows: 38, columns: 48 })
    expect(view.zoom.value).toBe(0.92)
    expect(sheet.y).toBeGreaterThan(0)
    expect(sheet.y + sheet.height).toBeLessThan(800 - 64)
    expect(sheet.y).toBeCloseTo(800 - 64 - sheet.y - sheet.height, 5)
  })

  it('fits again when the Tool pill moves to another edge, until the person moves the view (ticket 0850)', async () => {
    const { covered, view } = setup(projectOf(36, 30))
    view.fit()
    expect(view.zoom.value).toBe(1)

    covered.value = { ...NO_INSETS, bottom: 64 }
    await nextTick()
    expect(view.zoom.value).toBe(0.92)

    view.panBy(10, 10)
    covered.value = { ...NO_INSETS, left: 64 }
    await nextTick()
    expect(view.zoom.value).toBe(0.92)
    expect(view.isAtFit.value).toBe(false)
  })

  it('shrinks a huge Project down to the 10% Zoom floor and no further, on any screen', () => {
    const { view } = setup(projectOf(999, 100), { width: 360, height: 640 })
    view.fit()

    expect(view.zoom.value).toBe(0.1)

    view.setZoom(0.01)
    expect(view.zoom.value).toBe(0.1)
    view.zoomOut()
    expect(view.zoom.value).toBe(0.1)
  })

  it('fits what is drawn when there is no Frame, and puts the origin in the middle of an empty canvas', () => {
    const painted = paintAt(withLayers(projectOf(2, 2), { frame: undefined }), [{ row: 50, column: 80 }], '#e63746')
    expect(fitBox(painted)).toEqual({ box: { row: 50, column: 80, rows: 1, columns: 1 }, margin: FIT_MARGIN_PX })
    expect(fitBox(withLayers(projectOf(2, 2), { frame: undefined }))).toBeUndefined()

    const { view } = setup(withLayers(projectOf(2, 2), { frame: undefined }))
    view.fit()
    expect(view.zoom.value).toBe(1)
    expect(view.scroll.value).toEqual({ x: -500, y: -400 })
  })

  it('knows the Canvas positions on screen, as the renderer counts them in view, and follows a move (ticket 0715)', () => {
    const { view } = setup(withLayers(projectOf(2, 2), { frame: undefined }))
    view.fit()
    // At 100% a bead is 20px: the 1000 × 800 view centred on the origin shows 50 columns and 40 rows round it, and the
    // renderer counts the bead touching each edge as well.
    expect(view.canvasOnScreen()).toEqual({ row: -21, column: -26, rows: 42, columns: 52 })

    view.panBy(-200, 100)
    expect(view.canvasOnScreen()).toEqual({ row: -26, column: -16, rows: 42, columns: 52 })
  })

  it('knows no positions on screen until the area is measured', () => {
    const { view } = setup(projectOf(2, 2), { width: 0, height: 0 })

    expect(view.canvasOnScreen()).toBeUndefined()
  })

  it('moves with a drag the way the content moves, with a wheel the way the wheel turns, and stops following the fit', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    const start = { ...view.scroll.value }

    view.panBy(30, -10)
    expect(view.scroll.value).toEqual({ x: start.x - 30, y: start.y + 10 })
    view.scrollBy(5, 7)
    expect(view.scroll.value).toEqual({ x: start.x - 25, y: start.y + 17 })
    expect(view.isAtFit.value).toBe(false)
  })

  it('has no edge: it can be moved a long way in any direction', () => {
    const { view } = setup(projectOf(20, 10))
    view.panBy(-1_000_000, 1_000_000)

    expect(view.scroll.value.x).toBeGreaterThan(900_000)
    expect(view.scroll.value.y).toBeLessThan(-900_000)
  })

  it('keeps the point under the anchor still while zooming', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    const anchor = { x: 200, y: 100 }
    const before = { x: view.scroll.value.x + anchor.x, y: view.scroll.value.y + anchor.y }
    const ratio = 2 / view.zoom.value

    view.setZoom(2, anchor)

    expect(view.zoom.value).toBe(2)
    expect(view.scroll.value.x + anchor.x).toBeCloseTo(before.x * ratio)
    expect(view.scroll.value.y + anchor.y).toBeCloseTo(before.y * ratio)
  })

  it('zooms about the middle of the viewport for the buttons, in steps, within the usable range', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    view.zoomIn()
    expect(view.zoom.value).toBe(1.7)
    for (let i = 0; i < 40; i += 1) view.zoomIn()
    expect(view.zoom.value).toBe(4)
    for (let i = 0; i < 60; i += 1) view.zoomOut()
    expect(view.zoom.value).toBe(0.1)
  })

  it('zooms exactly as far as the fingers or the wheel ask, keeps it when they lift, and labels the nearest whole percent (ticket 0789)', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    const anchor = { x: 200, y: 100 }
    view.pinchStep({ zoom: 0.1234, anchor })
    expect(view.zoom.value).toBe(0.1234)
    expect(view.zoomPercent.value).toBe(12)
    view.endTwist(anchor)
    expect(view.zoom.value).toBe(0.1234)
    view.setZoom(0.4567)
    expect(view.zoom.value).toBe(0.4567)
  })

  it('walks the 10% rungs with the buttons, from a level between two as well, and the label agrees', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    view.setZoom(0.43)
    view.zoomIn()
    expect(view.zoom.value).toBe(0.5)
    view.setZoom(0.43)
    view.zoomOut()
    expect(view.zoom.value).toBe(0.4)
    for (const percent of [30, 20, 10]) {
      view.zoomOut()
      expect(view.zoomPercent.value).toBe(percent)
      expect(view.zoom.value).toBe(percent / 100)
    }
    for (const percent of [20, 30]) {
      view.zoomIn()
      expect(view.zoomPercent.value).toBe(percent)
    }
  })

  it('fits again when the Project changes or the viewport is measured, until the person moves it', async () => {
    const { current, viewport, view } = setup(projectOf(20, 10), { width: 0, height: 0 })
    viewport.value = { width: 1000, height: 800 }
    await nextTick()
    expect(view.scroll.value.x).toBeCloseTo(-170, 6)
    expect(view.scroll.value.y).toBeCloseTo(-235, 6)

    view.panBy(10, 10)
    viewport.value = { width: 1200, height: 800 }
    await nextTick()
    expect(view.scroll.value.x).toBeCloseTo(-180, 6)
    expect(view.scroll.value.y).toBeCloseTo(-245, 6)

    // 6 × 6 at its largest beads, 240%: its middle, 60px at 100%, is 144px.
    current.value = projectOf(6, 6)
    await nextTick()
    expect(view.isAtFit.value).toBe(true)
    expect(view.scroll.value.x).toBeCloseTo(144 - 600, 6)
    expect(view.scroll.value.y).toBeCloseTo(144 - 400, 6)
  })

  it('stays where it is when the same Project is edited, even while it still follows the fit', async () => {
    const empty = withLayers(projectOf(2, 2), { frame: undefined })
    const { current, view } = setup(empty)
    view.fit()
    const before = { ...view.scroll.value }

    current.value = paintAt(empty, [{ row: 50, column: 80 }], '#e63746')
    await nextTick()

    expect(view.scroll.value).toEqual(before)
    expect(view.zoom.value).toBe(1)
  })

  describe("the view a Project opens at, this once (What's inside's Open editor from here, ticket 0879)", () => {
    it('opens the Project the address names at its zoom, the bead it names in the middle, once the area is measured', async () => {
      const project = projectOf(20, 10)
      const { viewport, view } = setup(project, { width: 0, height: 0 }, NO_INSETS, { project: project.id, view: { zoom: 1.5, at: { row: 40, column: -7 } } })
      view.fit()
      viewport.value = { width: 1000, height: 800 }
      await nextTick()

      expect(view.zoom.value).toBe(1.5)
      expect(view.visibleCentre()).toEqual({ row: 40, column: -7 })
      expect(view.isAtFit.value).toBe(false)
    })

    it('keeps to the zoom limits', () => {
      const project = projectOf(20, 10)
      const { view } = setup(project, undefined, NO_INSETS, { project: project.id, view: { zoom: 99, at: { row: 0, column: 0 } } })
      view.fit()
      expect(view.zoom.value).toBe(4)
      expect(view.visibleCentre()).toEqual({ row: 0, column: 0 })
    })

    it('is for that opening only: Fit fits, and another Project opens at its fit', async () => {
      const project = projectOf(20, 10)
      const { current, view } = setup(projectOf(6, 6), undefined, NO_INSETS, { project: project.id, view: { zoom: 2, at: { row: 30, column: 30 } } })
      view.fit()
      expect(view.zoom.value).toBe(2.4)

      current.value = project
      await nextTick()
      expect(view.isAtFit.value).toBe(true)
      expect(view.zoom.value).toBe(1.65)

      const { view: opened } = setup(project, undefined, NO_INSETS, { project: project.id, view: { zoom: 2, at: { row: 30, column: 30 } } })
      opened.fit()
      opened.fit()
      expect(opened.zoom.value).toBe(1.65)
      expect(opened.scroll.value).toEqual(view.scroll.value)
    })
  })

  describe('the view a reload opens at (ticket 1108)', () => {
    it('keeps nothing while the view follows the fit, nor before the area is measured', async () => {
      const { viewport, view } = setup(projectOf(20, 10), { width: 0, height: 0 })
      view.zoomIn()
      expect(view.keptView()).toBeUndefined()
      viewport.value = { width: 1000, height: 800 }
      await nextTick()
      view.fit()
      expect(view.keptView()).toBeUndefined()
    })

    it('opens a reloaded Project at the zoom and place it was left at', async () => {
      const project = projectOf(20, 10)
      const { view } = setup(project)
      view.fit()
      await nextTick()
      view.setZoom(2.5)
      view.panBy(-130, 70)
      const left = { zoom: view.zoom.value, scroll: view.scroll.value }

      const { viewport, view: reloaded } = setup(project, { width: 0, height: 0 }, NO_INSETS, { project: project.id, view: view.keptView()! })
      reloaded.fit()
      viewport.value = { width: 1000, height: 800 }
      await nextTick()

      expect(reloaded.zoom.value).toBe(left.zoom)
      expect(reloaded.scroll.value).toEqual(left.scroll)
      expect(reloaded.isAtFit.value).toBe(false)
    })

    it('keeps the same point in the middle in a window of another size', async () => {
      const project = projectOf(20, 10)
      const { view } = setup(project)
      view.fit()
      await nextTick()
      view.setZoom(3)
      view.panBy(200, -90)
      const centre = view.visibleCentre()

      const { view: reloaded } = setup(project, { width: 600, height: 900 }, NO_INSETS, { project: project.id, view: view.keptView()! })
      reloaded.fit()
      expect(reloaded.visibleCentre()).toEqual(centre)
    })
  })

  it('centres on a block of beads without changing the zoom', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    const zoom = view.zoom.value
    view.centreOn({ row: 100, column: 100, rows: 2, columns: 2 })

    expect(view.zoom.value).toBe(zoom)
    expect(view.scroll.value.x).toBeCloseTo(2020 * zoom - 500, 6)
    expect(view.scroll.value.y).toBeCloseTo(2020 * zoom - 400, 6)
  })

  describe('bringing a part of the drawing into view (ticket 0934)', () => {
    /** A block of the Canvas's beads, found in the view as it stands. */
    const beads = (row: number, rows = 1) => (surface: SurfaceView) => surface.beadBox({ row, column: 0, rows, columns: 4 }, 'canvas')

    it('pans the shortest way that brings it in, the zoom untouched, and leaves the fit', () => {
      const { view } = setup(projectOf(20, 10), { width: 1000, height: 800 }, { ...NO_INSETS, bottom: 64 })
      view.fit()
      view.setZoom(2)
      const zoom = view.zoom.value
      view.bringIntoView(beads(100), { jump: true })

      // The row lands on the bottom of the room the Tool pill leaves, no further.
      const shown = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom, scroll: view.scroll.value }).beadBox({ row: 100, column: 0, rows: 1, columns: 4 })
      expect(view.zoom.value).toBe(zoom)
      expect(shown.y + shown.height).toBeCloseTo(800 - 64, 6)
      expect(view.isAtFit.value).toBe(false)
    })

    it('does not move for a part already in view, and still follows the fit', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      const at = view.scroll.value
      view.bringIntoView(beads(4))
      expect(view.scroll.value).toEqual(at)
      expect(view.isAtFit.value).toBe(true)
    })

    it('glides there over the base duration, and a move of the person\'s own stops it where it is', () => {
      // Frames run by hand: each `frame(time)` plays what was asked for, at that frame time.
      let asked = new Map<number, FrameRequestCallback>()
      let next = 0
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => (asked.set(++next, callback), next))
      vi.stubGlobal('cancelAnimationFrame', (id: number) => asked.delete(id))
      const frame = (time: number) => {
        const due = asked
        asked = new Map()
        for (const callback of due.values()) callback(time)
      }
      try {
        const { view } = setup(projectOf(20, 10))
        view.fit()
        const from = view.scroll.value
        view.bringIntoView(beads(100))
        expect(view.scroll.value).toEqual(from)
        frame(1000)
        frame(1000 + INTO_VIEW_MS / 2)
        const halfway = view.scroll.value.y
        expect(halfway).toBeGreaterThan(from.y)
        frame(1000 + INTO_VIEW_MS)
        const landed = view.scroll.value
        expect(landed.y).toBeGreaterThan(halfway)
        expect(asked.size).toBe(0)

        view.fit()
        view.bringIntoView(beads(100))
        frame(2000)
        frame(2000 + INTO_VIEW_MS / 2)
        view.panBy(0, 10)
        const stopped = view.scroll.value
        frame(2000 + INTO_VIEW_MS)
        expect(view.scroll.value).toEqual(stopped)
        expect(stopped.y).toBeLessThan(landed.y)
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('jumps under reduced motion', () => {
      const requestFrame = vi.fn()
      vi.stubGlobal('requestAnimationFrame', requestFrame)
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
      try {
        const { view } = setup(projectOf(20, 10))
        view.fit()
        const from = view.scroll.value
        view.bringIntoView(beads(100))
        expect(view.scroll.value.y).toBeGreaterThan(from.y)
        expect(requestFrame).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllGlobals()
      }
    })
  })

  describe('making room beside a panel and taking it back (ticket 0971)', () => {
    const frameOf20 = (surface: SurfaceView) => surface.beadBox({ row: 0, column: 0, rows: 10, columns: 20 }, 'canvas')

    it('brings the part into the room left beside what else lies over the drawing this once', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      const zoom = view.zoom.value
      // A panel over the left 300px: the Frame, 660px wide at the fit, moves just clear of it.
      view.bringIntoView(frameOf20, { jump: true, clear: { ...NO_INSETS, left: 300 } })
      const shown = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom, scroll: view.scroll.value }).beadBox({ row: 0, column: 0, rows: 10, columns: 20 })
      expect(shown.x).toBeCloseTo(300, 6)
    })

    it('puts the view back where it was, still following the fit', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      const from = view.scroll.value
      const move = view.bringIntoView(frameOf20, { jump: true, clear: { ...NO_INSETS, left: 300 } })!
      expect(view.isAtFit.value).toBe(false)
      vi.stubGlobal('matchMedia', () => ({ matches: true }))
      try {
        view.putBack(move)
      } finally {
        vi.unstubAllGlobals()
      }
      expect(view.scroll.value).toEqual(from)
      expect(view.isAtFit.value).toBe(true)
    })

    it('leaves a view the person moved or zoomed since where they left it', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      const move = view.bringIntoView(frameOf20, { jump: true, clear: { ...NO_INSETS, left: 300 } })!
      view.panBy(30, 0)
      const moved = view.scroll.value
      view.putBack(move)
      expect(view.scroll.value).toEqual(moved)
      expect(view.isAtFit.value).toBe(false)

      const again = view.bringIntoView(frameOf20, { jump: true, clear: { ...NO_INSETS, left: 335 } })!
      view.setZoom(0.5)
      const zoomed = view.scroll.value
      view.putBack(again)
      expect(view.scroll.value).toEqual(zoomed)
    })

    it('turns back mid-glide when closed before the move has landed', () => {
      let asked = new Map<number, FrameRequestCallback>()
      let next = 0
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => (asked.set(++next, callback), next))
      vi.stubGlobal('cancelAnimationFrame', (id: number) => asked.delete(id))
      const frame = (time: number) => {
        const due = asked
        asked = new Map()
        for (const callback of due.values()) callback(time)
      }
      try {
        const { view } = setup(projectOf(20, 10))
        view.fit()
        const from = view.scroll.value
        const move = view.bringIntoView(frameOf20, { clear: { ...NO_INSETS, left: 300 } })!
        frame(1000)
        frame(1000 + INTO_VIEW_MS / 2)
        view.putBack(move)
        frame(2000)
        frame(2000 + INTO_VIEW_MS)
        expect(view.scroll.value).toEqual(from)
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('makes no move, and returns none, for a part already clear', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      expect(view.bringIntoView(frameOf20, { jump: true, clear: { ...NO_INSETS, left: 100 } })).toBeUndefined()
    })
  })

  describe('a two-finger twist (tickets 0672, 0709)', () => {
    it('turns the view live about the fingers, keeping the bead under them, and leaves the Project as it is until they lift', () => {
      const { current, view } = setup(projectOf(20, 10))
      view.fit()
      const under = { x: 700, y: 300 }
      const before = view.cellAt(under)

      view.pinchStep({ turn: 25, anchor: under })
      view.pinchStep({ turn: 12, anchor: under })

      expect(view.orientation.value).toBe(37)
      expect(view.twistPhase.value).toBe('turning')
      expect(view.cellAt(under)).toEqual(before)
      expect(orientationOf(current.value!)).toBe(0)
    })

    it('is turning from the step the twist engages on, before the fingers have turned it', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      view.pinchStep({ zoom: 1.2, pan: { x: 3, y: 0 }, anchor: { x: 500, y: 400 } })
      expect(view.twistPhase.value).toBeUndefined()
      view.pinchStep({ turn: 0, anchor: { x: 500, y: 400 } })
      expect(view.twistPhase.value).toBe('turning')
      expect(view.orientation.value).toBe(0)
    })

    it('zooms, moves and turns in one step: the bead under the fingers follows their move', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      const under = { x: 500, y: 400 }
      const before = view.cellAt(under)
      view.pinchStep({ zoom: 2, pan: { x: 60, y: -20 }, turn: 0, anchor: { x: 560, y: 380 } })
      expect(view.zoom.value).toBe(2)
      expect(view.cellAt({ x: 560, y: 380 })).toEqual(before)
    })

    it('eases onto the quarter turn within 10° as the fingers lift, about where they were, and the Project keeps it after the ease with no refit', async () => {
      vi.useFakeTimers()
      try {
        const { current, kept, view } = setup(projectOf(20, 10))
        view.fit()
        const middle = view.visibleCentre()
        view.pinchStep({ turn: 83, anchor: { x: 900, y: 100 } })
        view.pinchStep({ pan: { x: 40, y: 0 }, anchor: { x: 900, y: 100 } })
        const fingers = { x: 900, y: 100 }
        const underFingers = view.cellAt(fingers)

        view.endTwist(fingers)

        // The view is already at the quarter turn, settling; the drawing eases there (ProjectSurface).
        expect(view.orientation.value).toBe(90)
        expect(view.twistPhase.value).toBe('settling')
        expect(view.cellAt(fingers)).toEqual(underFingers)
        expect(kept).toEqual([])
        vi.advanceTimersByTime(SNAP_MS)
        await nextTick()
        expect(view.twistPhase.value).toBeUndefined()
        expect(kept).toEqual([90])
        expect(orientationOf(current.value!)).toBe(90)
        expect(view.orientation.value).toBe(90)
        expect(view.visibleCentre()).not.toEqual(middle)
      } finally {
        vi.useRealTimers()
      }
    })

    it('comes to rest at once at an angle further than 10° off a quarter turn', () => {
      const { kept, view } = setup(projectOf(20, 10))
      view.pinchStep({ turn: -30, anchor: { x: 500, y: 400 } })
      view.endTwist({ x: 500, y: 400 })
      expect(view.twistPhase.value).toBeUndefined()
      expect(kept).toEqual([330])
    })

    it('zooms about the point under the fingers on screen while the view leans', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      view.pinchStep({ turn: 30, anchor: { x: 500, y: 400 } })
      const under = { x: 800, y: 200 }
      const before = view.cellAt(under)
      view.setZoom(0.5, under)
      expect(view.cellAt(under)).toEqual(before)
    })

    it('moves the canvas with a drag along the screen, not along the leaning drawing', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      view.pinchStep({ turn: 30, anchor: { x: 500, y: 400 } })
      const before = view.cellAt({ x: 600, y: 400 })
      view.panBy(100, 0)
      expect(view.cellAt({ x: 700, y: 400 })).toEqual(before)
    })

    it('still fits again when the Rotate canvas button turns a quarter from the angle', async () => {
      const { current, view } = setup(projectOf(20, 10))
      view.pinchStep({ turn: 30, anchor: { x: 500, y: 400 } })
      view.endTwist({ x: 500, y: 400 })
      view.panBy(300, 300)
      current.value = rotateCanvas(current.value!)
      await nextTick()
      expect(orientationOf(current.value)).toBe(120)
      expect(view.isAtFit.value).toBe(true)
    })
  })
})
