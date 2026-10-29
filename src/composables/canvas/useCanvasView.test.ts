import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { paintAt } from '../../testUtils/layers'
import { orientationOf } from '../../domain/layerRecord'
import { rotateCanvas, turnCanvasTo } from '../../domain/rotate'
import { FIT_MARGIN_PX, fitBox, useCanvasView } from './useCanvasView'
import { type LayersChange, withLayers } from '../../testUtils/layerFields'


function projectOf(columns: number, rows: number, extra: LayersChange = {}): Project {
  return withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } }), extra)
}

function setup(project: Project | undefined, size = { width: 1000, height: 800 }) {
  const current = ref(project)
  const viewport = ref(size)
  // The Project keeps the angle a twist settles on, as the Rotate canvas flow does.
  const kept: number[] = []
  const keepTwist = (orientation: number) => {
    kept.push(orientation)
    current.value = turnCanvasTo(current.value!, orientation)
  }
  const view = effectScope().run(() => useCanvasView(() => current.value, viewport, { keepTwist }))!
  return { current, viewport, view, kept }
}

describe('useCanvasView', () => {
  it('fits the Frame whole in the viewport, never zooming in past 100%, with the Frame in the middle', async () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()

    expect(view.zoom.value).toBe(1)
    // The Frame is 400 × 200 and sits at 0, 0: its middle (200, 100) is the viewport's middle (500, 400).
    expect(view.scroll.value).toEqual({ x: -300, y: -300 })
  })

  it('zooms out to fit a Frame bigger than the viewport', () => {
    const { view } = setup(projectOf(80, 40))
    view.fit()

    expect(view.zoom.value).toBe(0.54)
    expect(view.zoom.value * 1600 + FIT_MARGIN_PX.width * 2).toBeLessThanOrEqual(1000)
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
    expect(fitBox(painted)).toEqual({ row: 50, column: 80, rows: 1, columns: 1 })
    expect(fitBox(withLayers(projectOf(2, 2), { frame: undefined }))).toBeUndefined()

    const { view } = setup(withLayers(projectOf(2, 2), { frame: undefined }))
    view.fit()
    expect(view.zoom.value).toBe(1)
    expect(view.scroll.value).toEqual({ x: -500, y: -400 })
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

    view.setZoom(2, anchor)

    expect(view.zoom.value).toBe(2)
    expect(view.scroll.value.x + anchor.x).toBeCloseTo(before.x * 2)
    expect(view.scroll.value.y + anchor.y).toBeCloseTo(before.y * 2)
  })

  it('zooms about the middle of the viewport for the buttons, in steps, within the usable range', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    view.zoomIn()
    expect(view.zoom.value).toBe(1.1)
    for (let i = 0; i < 40; i += 1) view.zoomIn()
    expect(view.zoom.value).toBe(4)
    for (let i = 0; i < 60; i += 1) view.zoomOut()
    expect(view.zoom.value).toBe(0.1)
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
    expect(view.scroll.value).toEqual({ x: -300, y: -300 })

    view.panBy(10, 10)
    viewport.value = { width: 1200, height: 800 }
    await nextTick()
    expect(view.scroll.value).toEqual({ x: -310, y: -310 })

    current.value = projectOf(6, 6)
    await nextTick()
    expect(view.isAtFit.value).toBe(true)
    expect(view.scroll.value).toEqual({ x: 60 - 600, y: 60 - 400 })
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

  it('centres on a block of beads without changing the zoom', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    view.centreOn({ row: 100, column: 100, rows: 2, columns: 2 })

    expect(view.zoom.value).toBe(1)
    expect(view.scroll.value).toEqual({ x: 2020 - 500, y: 2020 - 400 })
  })

  describe('a two-finger twist (ticket 0672)', () => {
    it('turns the view live about the fingers, keeping the bead under them, and leaves the Project as it is until they lift', () => {
      const { current, view } = setup(projectOf(20, 10))
      view.fit()
      const under = { x: 700, y: 300 }
      const before = view.cellAt(under)

      view.twistBy(25, under)
      view.twistBy(12, under)

      expect(view.orientation.value).toBe(37)
      expect(view.cellAt(under)).toEqual(before)
      expect(orientationOf(current.value!)).toBe(0)
    })

    it('snaps to the quarter turn within 10° as the fingers lift, about the middle, and the Project keeps it with no refit', async () => {
      const { current, kept, view } = setup(projectOf(20, 10))
      view.fit()
      const middle = view.visibleCentre()
      view.twistBy(83, { x: 900, y: 100 })
      view.panBy(40, 0)
      const centre = view.visibleCentre()

      view.endTwist()
      await nextTick()

      expect(kept).toEqual([90])
      expect(orientationOf(current.value!)).toBe(90)
      expect(view.orientation.value).toBe(90)
      expect(view.visibleCentre()).toEqual(centre)
      expect(view.visibleCentre()).not.toEqual(middle)
    })

    it('stays at an angle further than 10° off a quarter turn', () => {
      const { kept, view } = setup(projectOf(20, 10))
      view.twistBy(-30, { x: 500, y: 400 })
      view.endTwist()
      expect(kept).toEqual([330])
    })

    it('moves the canvas with a drag along the screen, not along the leaning drawing', () => {
      const { view } = setup(projectOf(20, 10))
      view.fit()
      view.twistBy(30, { x: 500, y: 400 })
      const before = view.cellAt({ x: 600, y: 400 })
      view.panBy(100, 0)
      expect(view.cellAt({ x: 700, y: 400 })).toEqual(before)
    })

    it('still fits again when the Rotate canvas button turns a quarter from the angle', async () => {
      const { current, view } = setup(projectOf(20, 10))
      view.twistBy(30, { x: 500, y: 400 })
      view.endTwist()
      view.panBy(300, 300)
      current.value = rotateCanvas(current.value!)
      await nextTick()
      expect(orientationOf(current.value)).toBe(120)
      expect(view.isAtFit.value).toBe(true)
    })
  })
})
