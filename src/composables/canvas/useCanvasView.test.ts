import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createProject, paintCells, type Project } from '../../domain/project'
import { FIT_MARGIN_PX, fitBox, useCanvasView } from './useCanvasView'

const NO_MIRROR = { columns: 0, rows: 0 }

function projectOf(columns: number, rows: number, extra: Partial<Project> = {}): Project {
  return { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: columns, height: rows, unit: 'beads' } }), ...extra }
}

function setup(project: Project | undefined, size = { width: 1000, height: 800 }) {
  const current = ref(project)
  const viewport = ref(size)
  const view = effectScope().run(() => useCanvasView(() => current.value, viewport))!
  return { current, viewport, view }
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
    const painted = paintCells({ ...projectOf(2, 2), frame: undefined }, [{ row: 50, column: 80 }], '#e63746', NO_MIRROR)
    expect(fitBox(painted)).toEqual({ row: 50, column: 80, rows: 1, columns: 1 })
    expect(fitBox({ ...projectOf(2, 2), frame: undefined })).toBeUndefined()

    const { view } = setup({ ...projectOf(2, 2), frame: undefined })
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
    const empty = { ...projectOf(2, 2), frame: undefined }
    const { current, view } = setup(empty)
    view.fit()
    const before = { ...view.scroll.value }

    current.value = paintCells(empty, [{ row: 50, column: 80 }], '#e63746', NO_MIRROR)
    await nextTick()

    expect(view.scroll.value).toEqual(before)
    expect(view.zoom.value).toBe(1)
  })

  it('scrolls only as far as it takes to bring a bead into view', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    const before = { ...view.scroll.value }

    view.reveal({ row: 5, column: 5 })
    expect(view.scroll.value).toEqual(before)

    view.reveal({ row: 5, column: 100 })
    // Bead 100 spans x 2000 to 2020; with 24px clear it ends at the viewport's right edge.
    expect(view.scroll.value.x).toBe(2020 + 24 - 1000)
    expect(view.scroll.value.y).toBe(before.y)
  })

  it('centres on a block of beads without changing the zoom', () => {
    const { view } = setup(projectOf(20, 10))
    view.fit()
    view.centreOn({ row: 100, column: 100, rows: 2, columns: 2 })

    expect(view.zoom.value).toBe(1)
    expect(view.scroll.value).toEqual({ x: 2020 - 500, y: 2020 - 400 })
  })
})
