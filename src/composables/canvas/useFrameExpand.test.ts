import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { createProject } from '../../domain/createProject'
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
  const scope = effectScope()
  const { view, expand } = scope.run(() => {
    const view = useCanvasView(() => current.value, viewport, { covered: () => ({ top: 0, right: 0, bottom: 0, left: 120 }), expanded: () => room?.() })
    const expand = useFrameExpand({ currentProject: () => current.value, viewport, zoom: view.zoom, scroll: view.scroll, isAtFit: view.isAtFit, orientation: view.orientation, compact, fit: view.fit, showView: view.showView })
    room = () => (expand.expanded.value ? expand.room : undefined)
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

describe('useFrameExpand (ticket 1169)', () => {
  it('fits the Frame into the drawing area clear of the Tool pill, which stays (ticket 1176), its slim sheet and the gap', () => {
    const project = framed(60, 20)
    const { view, expand, stop } = setup(project)
    const before = view.zoom.value
    expect(expand.toggle()).toBe(true)
    expect(expand.expanded.value).toBe(true)
    expect(view.zoom.value).toBeGreaterThan(before)
    const room = expand.room(view.zoom.value)
    const beads = beadsOnScreen(project, view.zoom.value, view.scroll.value)
    // Across, the width is what binds: the beads end where the pill, the sheet's sides and the gap leave off, to a
    // rounding.
    const pill = 120
    expect(beads.x).toBeGreaterThanOrEqual(pill + room.left - 1)
    expect(beads.x + beads.width).toBeLessThanOrEqual(1000 - room.right + 1)
    expect(beads.y).toBeGreaterThanOrEqual(room.top - 1)
    expect(beads.y + beads.height).toBeLessThanOrEqual(600 - room.bottom + 1)
    expect(Math.min(beads.x - pill - room.left, 1000 - room.right - beads.x - beads.width)).toBeLessThan(10)
    stop()
  })

  it('stops at the Fit limits: a bead no further than 48px from the next', () => {
    const { view, expand, stop } = setup(framed(4, 3))
    expand.toggle()
    const project = framed(4, 3)
    const beads = beadsOnScreen(project, view.zoom.value, view.scroll.value)
    expect(beads.width / 4).toBeLessThanOrEqual(LARGEST_FIT_BEAD_PX + 0.5)
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
    view.panBy(40, 0)
    viewport.value = { width: 1400, height: 600 }
    await nextTick()
    expect(view.isAtFit.value).toBe(true)
    const beads = beadsOnScreen(framed(60, 20), view.zoom.value, view.scroll.value)
    const room = expand.room(view.zoom.value)
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

  it('takes the smaller insets and gap under bp-tablet', () => {
    const { compact, expand, stop } = setup(framed(60, 20))
    expand.toggle()
    const wide = expand.room(1)
    compact.value = true
    const narrow = expand.room(1)
    expect(wide.right - narrow.right).toBe(6 + 8 - (4 + 4))
    stop()
  })
})
