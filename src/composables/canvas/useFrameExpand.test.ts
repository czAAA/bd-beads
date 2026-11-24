import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createProject } from '../../domain/createProject'
import { MAX_ZOOM } from '../../domain/grid'
import { footprintOf } from '../../domain/footprint'
import { canvasOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { OPEN_SPACE } from '../../rendering/space'
import { surfaceView } from '../../rendering/surfaceView'
import { withLayers } from '../../testUtils/layerFields'
import { LARGEST_FIT_BEAD_PX, useCanvasView, type CanvasViewOptions } from './useCanvasView'
import { useFrameExpand } from './useFrameExpand'

const framed = (columns: number, rows: number): Project =>
  createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } })

/** The view and Expand the Frame made together, as `useCanvasFraming` makes them, in a 1000 × 600 drawing area with a
 * Tool pill along its left. */
function setup(project: Project) {
  const current = ref<Project | undefined>(project)
  const viewport = ref({ width: 1000, height: 600 })
  const compact = ref(false)
  let room: CanvasViewOptions['expanded'] = () => undefined
  let fitted = (_pitch: number) => {}
  let leave = () => {}
  const covered = () => ({ top: 0, right: 0, bottom: 0, left: 120 })
  const scope = effectScope()
  const { view, expand } = scope.run(() => {
    const view = useCanvasView(() => current.value, viewport, { covered, expanded: () => room?.(), fitted: (pitch) => fitted(pitch), leaveExpanded: () => leave() })
    const expand = useFrameExpand({ currentProject: () => current.value, viewport, zoom: view.zoom, scroll: view.scroll, isAtFit: view.isAtFit, orientation: view.orientation, compact, covered, fit: view.fit, showView: view.showView })
    room = () => (expand.expanded.value ? expand.room : undefined)
    fitted = expand.fitted
    leave = expand.collapse
    return { view, expand }
  })!
  view.fit()
  return { current, viewport, compact, view, expand, stop: () => scope.stop() }
}

/** The Frame's beads on screen, in the view as it stands. */
function beadsOnScreen(project: Project, zoom: number, scroll: { x: number; y: number }) {
  const { technique, cell } = canvasOf(project)
  const surface = surfaceView({ space: OPEN_SPACE, technique, cell, rotation: 0, zoom, scroll, viewport: { width: 1000, height: 600 } })
  return surface.beadBox(footprintOf(project)!, 'canvas')
}

/** The loom bead's longer step on screen at a zoom, the pitch the numbers follow. */
const pitchOf = (zoom: number) => beadsOnScreen(framed(1, 1), zoom, { x: 0, y: 0 }).height

describe('useFrameExpand (ticket 1169)', () => {
  it('fits the Frame into the drawing area clear of the Tool pill, which stays, and its slim sheet, with no gap round it (ticket 1176)', () => {
    const project = framed(60, 20)
    const { view, expand, stop } = setup(project)
    const before = view.zoom.value
    expect(expand.toggle()).toBe(true)
    expect(expand.expanded.value).toBe(true)
    expect(view.zoom.value).toBeGreaterThan(before)
    const room = expand.room(view.zoom.value, pitchOf(view.zoom.value))
    const beads = beadsOnScreen(project, view.zoom.value, view.scroll.value)
    // Across, the width is what binds: the beads end where the pill and the sheet's sides leave off, to a
    // rounding.
    const pill = 120
    expect(beads.x).toBeGreaterThanOrEqual(pill + room.left - 1)
    expect(beads.x + beads.width).toBeLessThanOrEqual(1000 - room.right + 1)
    expect(beads.y).toBeGreaterThanOrEqual(room.top - 1)
    expect(beads.y + beads.height).toBeLessThanOrEqual(600 - room.bottom + 1)
    expect(Math.min(beads.x - pill - room.left, 1000 - room.right - beads.x - beads.width)).toBeLessThan(10)
    stop()
  })

  it('grows a small Frame past Fit\'s 48px bead and the 400% zoom, to the room\'s edge (tickets 1176, 1194)', () => {
    const { view, expand, stop } = setup(framed(3, 3))
    view.fit()
    const fitted = view.zoom.value
    expand.toggle()
    const beads = beadsOnScreen(framed(3, 3), view.zoom.value, view.scroll.value)
    const room = expand.room(view.zoom.value, pitchOf(view.zoom.value))
    expect(beads.width / 3).toBeGreaterThan(LARGEST_FIT_BEAD_PX)
    expect(view.zoom.value).toBeGreaterThan(Math.max(fitted, MAX_ZOOM))
    // The height binds: the beads meet what the sheet needs above and below.
    expect(600 - room.top - room.bottom - beads.height).toBeLessThan(10)
    stop()
  })

  it('makes the numbers about 40% of the bead pitch, 12px to 28px, held while zooming (ticket 1194)', () => {
    const { view, expand, stop } = setup(framed(5, 5))
    expand.toggle()
    const font = expand.content.value!.fontPx
    expect(font).toBe(28)
    view.setZoom(view.zoom.value * 1.2)
    expect(expand.content.value!.fontPx).toBe(font)
    const wide = setup(framed(200, 60))
    wide.expand.toggle()
    expect(wide.expand.content.value!.fontPx).toBe(12)
    wide.stop()
    stop()
  })

  it('fills the whole room: the sheet takes the area less the pill, the Frame centred in it (ticket 1194)', () => {
    const { expand, stop } = setup(framed(6, 6))
    expand.toggle()
    expect(expand.content.value!.fill).toEqual({ width: 880, height: 600 })
    stop()
  })

  it('goes back to the view as it was, the second press or Escape', () => {
    const { view, expand, stop } = setup(framed(60, 20))
    view.setZoom(0.7)
    const was = { zoom: view.zoom.value, scroll: { ...view.scroll.value } }
    expand.toggle()
    expect(expand.toggle()).toBe(false)
    expect({ zoom: view.zoom.value, scroll: view.scroll.value }).toEqual(was)
    expect(view.isAtFit.value).toBe(false)
    expand.toggle()
    expect(expand.collapse()).toBe(true)
    expect(view.zoom.value).toBe(was.zoom)
    expect(expand.collapse()).toBe(false)
    stop()
  })

  it('fits again when the window is resized, moved by hand or not', async () => {
    const { view, expand, viewport, stop } = setup(framed(60, 20))
    expand.toggle()
    view.carryBy(40, 0)
    viewport.value = { width: 1400, height: 600 }
    await nextTick()
    expect(view.isAtFit.value).toBe(true)
    const beads = beadsOnScreen(framed(60, 20), view.zoom.value, view.scroll.value)
    const room = expand.room(view.zoom.value, pitchOf(view.zoom.value))
    // Centred in the room the Tool pill, 120px along the left, and the sheet leave.
    expect(beads.x + beads.width / 2).toBeCloseTo(120 + room.left + (1400 - 120 - room.left - room.right) / 2, 0)
    stop()
  })

  it('fits the sheet anew as it measures itself, while the view follows the fit', async () => {
    const { view, expand, stop } = setup(framed(40, 40))
    expand.toggle()
    await nextTick()
    const tall = view.zoom.value
    expand.measured({ row: 24, title: 0, rowWidth: 0 })
    await nextTick()
    expect(view.zoom.value).toBeGreaterThan(tall)
    stop()
  })

  it('is left by another Project, and by Remove Frame, which puts the view back', async () => {
    const { current, view, expand, stop } = setup(framed(60, 20))
    const was = view.zoom.value
    expand.toggle()
    current.value = withLayers(current.value!, { frame: undefined })
    await nextTick()
    expect(expand.expanded.value).toBe(false)
    expect(view.zoom.value).toBe(was)
    current.value = framed(60, 20)
    await nextTick()
    expect(expand.expanded.value).toBe(false)
    stop()
  })

  it('takes the smaller inset under bp-tablet', () => {
    const { compact, expand, stop } = setup(framed(60, 20))
    expand.toggle()
    const wide = expand.room(1, 30)
    compact.value = true
    const narrow = expand.room(1, 30)
    expect(wide.right - narrow.right).toBe(6 - 4)
    stop()
  })

  describe('zooming out (ticket 1194)', () => {
    it('goes back to the Canvas when a zoom out rests under 95% of the fit, and springs back above it, a zoom in staying', async () => {
      vi.useFakeTimers()
      try {
        const { view, expand, stop } = setup(framed(60, 20))
        view.setZoom(0.5)
        const was = { zoom: view.zoom.value }
        expand.toggle()
        const fit = view.zoom.value
        view.setZoom(fit * 1.3)
        vi.advanceTimersByTime(200)
        expect(expand.expanded.value).toBe(true)
        expect(view.zoom.value).toBeCloseTo(fit * 1.3, 5)
        view.setZoom(fit * 0.97)
        vi.advanceTimersByTime(200)
        expect(expand.expanded.value).toBe(true)
        expect(view.isAtFit.value).toBe(true)
        view.setZoom(fit * 0.9)
        expect(expand.expanded.value).toBe(true)
        vi.advanceTimersByTime(200)
        expect(expand.expanded.value).toBe(false)
        expect(view.zoom.value).toBe(was.zoom)
        stop()
      } finally {
        vi.useRealTimers()
      }
    })

    it('waits for the fingers to lift before it decides', () => {
      vi.useFakeTimers()
      try {
        const { view, expand, stop } = setup(framed(60, 20))
        expand.toggle()
        const fit = view.zoom.value
        view.pinchStep({ zoom: fit * 0.5, anchor: { x: 500, y: 300 } })
        vi.advanceTimersByTime(500)
        expect(expand.expanded.value).toBe(true)
        view.endTwist({ x: 500, y: 300 })
        vi.advanceTimersByTime(1)
        expect(expand.expanded.value).toBe(false)
        stop()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('moving the view by hand', () => {
    /** Expanded from a view of its own, kept to come back to. */
    function expandedFrom() {
      const made = setup(framed(60, 20))
      made.view.setZoom(0.5)
      made.view.panBy(30, 10)
      const was = { zoom: made.view.zoom.value, scroll: { ...made.view.scroll.value } }
      made.expand.toggle()
      return { ...made, was }
    }

    // A drag moves the content with the pointer, a scroll the other way: the view's scroll goes `by` along.
    it.each([
      { move: 'panBy', by: -20 },
      { move: 'scrollBy', by: 20 },
    ] as const)('goes back to the Canvas at once on $move, which then moves the Canvas', ({ move, by }) => {
      const { view, expand, was, stop } = expandedFrom()
      view[move](20, 0)
      expect(expand.expanded.value).toBe(false)
      expect(view.zoom.value).toBe(was.zoom)
      expect(view.scroll.value.x).toBeCloseTo(was.scroll.x + by, 5)
      stop()
    })

    it('stays for the edge scroll a drag carries', () => {
      const { view, expand, stop } = expandedFrom()
      view.carryBy(20, 0)
      expect(expand.expanded.value).toBe(true)
      stop()
    })

    it('goes back on a two-finger pan, a pinch zoom carrying the fingers along staying', () => {
      const { view, expand, was, stop } = expandedFrom()
      const fit = view.zoom.value
      view.pinchStep({ zoom: fit * 1.4, pan: { x: 30, y: 0 }, anchor: { x: 500, y: 300 } })
      expect(expand.expanded.value).toBe(true)
      view.endTwist({ x: 530, y: 300 })
      const zoomed = view.zoom.value
      view.pinchStep({ zoom: zoomed, pan: { x: 10, y: 0 }, anchor: { x: 500, y: 300 } })
      expect(expand.expanded.value).toBe(true)
      view.pinchStep({ zoom: zoomed * 1.02, pan: { x: 20, y: 0 }, anchor: { x: 510, y: 300 } })
      expect(expand.expanded.value).toBe(false)
      // The rest of the pinch pans the Canvas at the zoom it went back to, the fingers' spread let go.
      view.pinchStep({ zoom: zoomed * 1.05, pan: { x: 5, y: 0 }, anchor: { x: 515, y: 300 } })
      expect(view.zoom.value).toBe(was.zoom)
      view.endTwist({ x: 515, y: 300 })
      stop()
    })

    it('goes back on a twist, which then turns the Canvas', () => {
      const { view, expand, was, stop } = expandedFrom()
      view.pinchStep({ zoom: view.zoom.value, turn: 20, anchor: { x: 500, y: 300 } })
      expect(expand.expanded.value).toBe(false)
      expect(view.zoom.value).toBe(was.zoom)
      expect(view.orientation.value).toBe(20)
      stop()
    })

    it('goes back on Rotate canvas, which then turns the Canvas', () => {
      const { view, expand, was, stop } = expandedFrom()
      view.turnCanvas(90)
      expect(expand.expanded.value).toBe(false)
      expect(view.zoom.value).toBe(was.zoom)
      stop()
    })
  })
})
