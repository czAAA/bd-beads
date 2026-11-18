import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProjectSurface from './ProjectSurface.vue'
import { createProject } from '../../domain/createProject'
import { toolCapabilities, type ToolCapabilities } from '../../domain/tool'
import { recordingContext } from '../../testUtils/recordingContext'

// The surface drawn larger by CSS `zoom` (ticket 1071), as the Homepage draws its demo: the browser tells the pointer and
// the surface's box on screen, the surface works in its own px, so a press lands on the bead under it.
const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 20, height: 20, unit: 'beads' } })

/** How much larger the surface is drawn, and its own size: 1000 × 800, so 1500 × 1200 on screen from (30, 60). */
const ZOOM = 1.5
const OWN = { width: 1000, height: 800 }
const AT = { left: 30, top: 60 }

function rectOf(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recordingContext().context as unknown as CanvasRenderingContext2D)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.classList.contains('project-surface') ? rectOf(AT.left, AT.top, OWN.width * ZOOM, OWN.height * ZOOM) : rectOf(0, 0, 0, 0)
  })
  Object.defineProperty(Element.prototype, 'currentCSSZoom', { configurable: true, get: () => ZOOM })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (Element.prototype as { currentCSSZoom?: number }).currentCSSZoom
})

const can = (on: Partial<ToolCapabilities> = {}): ToolCapabilities => ({ ...toolCapabilities(undefined), ...on })

async function mountSurface(tools = can()) {
  const wrapper = mount(ProjectSurface, { props: { project, zoom: 1, scroll: { x: 0, y: 0 }, tools }, attachTo: document.body })
  await nextTick()
  await nextTick()
  return { wrapper, surface: wrapper.get('[data-testid="project-surface"]') }
}

/** Where a bead's middle is on screen: a bead is 20 own px at zoom 1, drawn 1.5 times larger. */
const onScreen = (row: number, column: number) => ({ clientX: AT.left + (column * 20 + 10) * ZOOM, clientY: AT.top + (row * 20 + 10) * ZOOM })

describe('ProjectSurface drawn larger by CSS zoom (ticket 1071)', () => {
  it('lands a press on the bead under the pointer', async () => {
    const { wrapper, surface } = await mountSurface()
    await surface.trigger('pointerdown', { ...onScreen(7, 12), pointerType: 'mouse', button: 0, buttons: 1 })
    expect(wrapper.emitted('cell-primary-down')?.[0]).toEqual([7, 12])
    wrapper.unmount()
  })

  it('tells where a bead is on screen, where a press on it lands', async () => {
    const { wrapper } = await mountSurface()
    const exposed = wrapper.vm as unknown as { beadOnScreen: (at: { row: number; column: number }) => { x: number; y: number } }
    const { clientX, clientY } = onScreen(7, 12)
    expect(exposed.beadOnScreen({ row: 7, column: 12 })).toEqual({ x: clientX, y: clientY })
    wrapper.unmount()
  })

  it('moves the canvas by the drag in its own px', async () => {
    const { wrapper, surface } = await mountSurface(can({ moves: true }))
    await surface.trigger('pointerdown', { clientX: 300, clientY: 300, button: 0, buttons: 1 })
    await surface.trigger('pointermove', { clientX: 330, clientY: 285, buttons: 1 })
    expect(wrapper.emitted('pan')).toEqual([[20, -10]])
    wrapper.unmount()
  })

  it('zooms about the point under the pointer, in its own px', async () => {
    const { wrapper, surface } = await mountSurface()
    surface.element.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, ctrlKey: true, clientX: AT.left + 150, clientY: AT.top + 90, bubbles: true, cancelable: true }))
    expect((wrapper.emitted('zoom-by') as [number, { x: number; y: number }][])[0]![1]).toEqual({ x: 100, y: 60 })
    wrapper.unmount()
  })

  it('draws its canvases at the size on screen, so the beads are as sharp as at zoom 1', async () => {
    const { wrapper } = await mountSurface()
    const canvas = wrapper.get<HTMLCanvasElement>('[data-testid="project-surface-cells"]').element
    expect({ width: canvas.width, height: canvas.height }).toEqual({ width: OWN.width * ZOOM, height: OWN.height * ZOOM })
    wrapper.unmount()
  })
})
