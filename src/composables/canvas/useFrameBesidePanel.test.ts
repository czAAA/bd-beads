import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { placedFrame } from '../../domain/layerWeave'
import { roomBesidePanel } from '../../rendering/roomBesidePanel'
import { surfaceView } from '../../rendering/surfaceView'
import { OPEN_SPACE } from '../../rendering/space'
import { fitBox, RULER_GUTTER_PX, type ViewMove } from './useCanvasView'
import { useFrameBesidePanel, type FrameBesidePanelDeps } from './useFrameBesidePanel'

const framed = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Summer bracelet', size: { width: 24, height: 10, unit: 'beads' } })
const area = { x: 0, y: 46, width: 1366, height: 930 }
/** The iPad's Frame panel, hung from the strip's Frame button. */
const panel = { x: 288, y: 50, width: 565, height: 900 }
const move: ViewMove = { from: { x: 0, y: 0 }, to: { x: -500, y: 0 }, zoom: 1, atFit: true }

function setup(project: Project = framed, areaZoom = 1) {
  const current = ref(project)
  const open = ref(true)
  const bringIntoView = vi.fn<FrameBesidePanelDeps['bringIntoView']>(() => move)
  const putBack = vi.fn()
  const deps: FrameBesidePanelDeps = { currentProject: () => current.value, bringIntoView, putBack, panelOpen: () => open.value, area: () => area, areaZoom: () => areaZoom }
  const { panelPlaced } = effectScope().run(() => useFrameBesidePanel(deps))!
  return { current, open, bringIntoView, putBack, panelPlaced }
}

describe('useFrameBesidePanel (ticket 0971)', () => {
  it('as the panel is placed, brings the Frame\'s sheet whole into the side beside it, where the side holds it', () => {
    const small = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 8, height: 6, unit: 'beads' } })
    const { bringIntoView, panelPlaced } = setup(small)
    panelPlaced(panel)
    const [locate] = bringIntoView.mock.calls[0]!
    const surface = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1, scroll: { x: 0, y: 0 }, viewport: { width: 1366, height: 930 }, frame: placedFrame(small)! })
    expect(locate(surface)).toEqual(surface.beadBox(fitBox(small)!.box, 'canvas'))
  })

  it('brings the Frame and its rulers into the side where its sheet is too wide for it, so its first columns show, as many as the side holds (ticket 0964)', () => {
    const { bringIntoView, panelPlaced } = setup()
    panelPlaced(panel)
    expect(bringIntoView).toHaveBeenCalledTimes(1)
    const [locate, how] = bringIntoView.mock.calls[0]!
    expect(how).toEqual({ clear: roomBesidePanel(panel, area) })
    const frame = placedFrame(framed)!
    const surface = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1, scroll: { x: 0, y: 0 }, viewport: { width: 1366, height: 930 }, frame })
    const line = surface.frameBox(frame)
    // The Frame and its rulers, 550px wide, are cut to the 497px the side holds, from the first column.
    const room = area.width - how.clear.left - how.clear.right
    expect(line.width + 2 * RULER_GUTTER_PX).toBeGreaterThan(room)
    expect(locate(surface)).toEqual({ x: line.x - RULER_GUTTER_PX, y: line.y - RULER_GUTTER_PX, width: room, height: line.height + 2 * RULER_GUTTER_PX })
  })

  it('keeps clear of the panel in the drawing area\'s own px, where CSS zoom draws it larger (ticket 1071)', () => {
    const { bringIntoView, panelPlaced } = setup(framed, 2)
    panelPlaced(panel)
    const onScreen = roomBesidePanel(panel, area)!
    expect(bringIntoView.mock.calls[0]![1]).toEqual({ clear: { top: 0, right: 0, bottom: 0, left: onScreen.left / 2 } })
  })

  it('takes the move back as the panel closes, once', () => {
    const { open, putBack, panelPlaced } = setup()
    panelPlaced(panel)
    open.value = false
    expect(putBack).toHaveBeenCalledWith(move)
    open.value = true
    open.value = false
    expect(putBack).toHaveBeenCalledTimes(1)
  })

  it('moves nothing where the panel leaves no room beside it', () => {
    const { bringIntoView, panelPlaced } = setup()
    const across = { x: 8, y: 50, width: 1350, height: 900 }
    expect(roomBesidePanel(across, area)).toBeUndefined()
    panelPlaced(across)
    expect(bringIntoView).not.toHaveBeenCalled()
  })

  it('takes nothing back in another Project, opened while the panel was', () => {
    const { current, open, putBack, panelPlaced } = setup()
    panelPlaced(panel)
    current.value = { ...framed, id: 'other' }
    open.value = false
    expect(putBack).not.toHaveBeenCalled()
  })
})
