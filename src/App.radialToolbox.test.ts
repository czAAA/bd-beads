import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { CANVAS_HOLD_MS } from './domain/hold'
import { mountWithProject } from './testUtils/seedProject'
import { beadColor, beadPoint, holdBead, hoverBead, outlinedBead, pressBead, rightClickBead } from './testUtils/beads'
import { pickTool, pressBar, toolState } from './testUtils/pill'
import { loadProjects } from './services/libraryStore'
import { frameOf } from './domain/layerRecord'
import ProjectSurface from './components/canvas/ProjectSurface.vue'

// The Radial toolbox's wiring (ticket 1064, spec 1072): a right click on the Canvas reaches the ring's flow, and a pick
// reaches the handler its own control calls. The ring's places are in radialToolbox, what a pick does in
// useRadialToolboxFlow, its look and events in RadialToolbox, the press outside in App.overlays.

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

type Mounted = Awaited<ReturnType<typeof mountWithProject>>
const ring = (wrapper: Mounted) => wrapper.get('[data-testid="radial-toolbox"]')

describe('the Radial toolbox', () => {
  it('opens on a right click on the Canvas, and a click on Eraser picks it in the Tool pill and closes the ring', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    expect(ring(wrapper).isVisible()).toBe(false)

    await rightClickBead(wrapper, 40)
    expect(ring(wrapper).isVisible()).toBe(true)
    expect(toolState(wrapper, 'paint').pressed).toBe(true)

    await ring(wrapper).get('[data-testid="radial-tool-erase"]').trigger('click')
    await flushPromises()

    expect(toolState(wrapper, 'erase').pressed).toBe(true)
    expect(ring(wrapper).isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('Undo from the ring takes back the last bead and keeps the ring open', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await pressBead(wrapper, 3)
    await wrapper.get('[data-testid="project-surface"]').trigger('pointerup')
    expect(beadColor(wrapper, 3)).not.toBeNull()

    await rightClickBead(wrapper, 40)
    await ring(wrapper).get('[data-testid="radial-undo"]').trigger('click')
    await flushPromises()

    expect(beadColor(wrapper, 3)).toBeNull()
    expect(ring(wrapper).isVisible()).toBe(true)
    expect(ring(wrapper).get('[data-testid="radial-undo"]').attributes('aria-disabled')).toBe('true')
    wrapper.unmount()
  })

  it('a recent colour, Pick color from Canvas and Redo from the ring each reach their own control\'s handler', async () => {
    localStorage.setItem('openbeads:recent-colors', '#1d3557,#f1c453')
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const paint = async (bead: number) => {
      await pressBead(wrapper, bead)
      await wrapper.get('[data-testid="project-surface"]').trigger('pointerup')
    }
    const pick = async (id: string) => {
      await ring(wrapper).get(`[data-testid="radial-${id}"]`).trigger('click')
      await flushPromises()
    }
    await paint(3)
    const first = beadColor(wrapper, 3)

    await rightClickBead(wrapper, 40)
    await pick('recent-1')
    expect(ring(wrapper).isVisible()).toBe(false)
    await paint(5)
    expect(beadColor(wrapper, 5)).toBe('#1d3557')

    // Opened on an empty position: Pick color from Canvas arms the pick, and the next press on a bead takes its colour
    // (ticket 1089).
    await rightClickBead(wrapper, 40)
    await pick('pick-color')
    expect(ring(wrapper).isVisible()).toBe(false)
    expect(wrapper.findComponent(ProjectSurface).props('tools')?.picking).toBe(true)
    await paint(3)
    expect(wrapper.findComponent(ProjectSurface).props('tools')?.picking).toBe(false)
    await paint(6)
    expect(beadColor(wrapper, 6)).toBe(first)

    await rightClickBead(wrapper, 40)
    await pick('undo')
    expect(beadColor(wrapper, 6)).toBeNull()
    await pick('redo')
    expect(beadColor(wrapper, 6)).toBe(first)
    wrapper.unmount()
  })

  it('a right click in the corner of the screen opens the whole ring on the screen, and the pressed bead keeps its outline until the ring closes (ticket 1076)', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const surface = wrapper.get('[data-testid="project-surface"]')
    expect(outlinedBead(wrapper)).toBeUndefined()

    await rightClickBead(wrapper, 40)
    expect(outlinedBead(wrapper)).toEqual({ row: 4, column: 0 })
    await ring(wrapper).get('[data-testid="radial-tool-erase"]').trigger('click')
    await flushPromises()
    expect(outlinedBead(wrapper)).toBeUndefined()

    // The window's bottom right corner: the ring's centre stands its reach and float-edge in from both edges.
    const corner = { clientX: window.innerWidth, clientY: window.innerHeight }
    await surface.trigger('pointerdown', { ...corner, button: 2, buttons: 2, isPrimary: true })
    await surface.trigger('pointerup', { ...corner, button: 2, buttons: 0, isPrimary: true })
    expect(ring(wrapper).isVisible()).toBe(true)
    expect(ring(wrapper).attributes('style')).toContain(`left: ${window.innerWidth - 120}px; top: ${window.innerHeight - 120}px`)
    wrapper.unmount()
  })

  it('a second right click or hold on the Canvas moves the open ring there, and draws nothing (ticket 1147)', async () => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    const stands = () => ({ style: ring(wrapper).attributes('style'), on: outlinedBead(wrapper) })

    await rightClickBead(wrapper, 40)
    const first = stands()
    await rightClickBead(wrapper, 200)
    await flushPromises()
    expect(ring(wrapper).isVisible()).toBe(true)
    const second = stands()
    expect(second.on).not.toEqual(first.on)
    expect(second.style).not.toEqual(first.style)

    await holdBead(wrapper, 40)
    await flushPromises()
    expect(ring(wrapper).isVisible()).toBe(true)
    expect(stands()).toEqual(first)
    expect(beadColor(wrapper, 40)).toBeNull()
    expect(beadColor(wrapper, 200)).toBeNull()
    expect(ring(wrapper).get('[data-testid="radial-undo"]').attributes('aria-disabled')).toBe('true')

    // A left click still only closes it.
    await pressBead(wrapper, 200)
    await wrapper.get('[data-testid="project-surface"]').trigger('pointerup')
    await flushPromises()
    expect(ring(wrapper).isVisible()).toBe(false)
    expect(beadColor(wrapper, 200)).toBeNull()
    wrapper.unmount()
  })

  it('a hold on the Canvas opens the ring and places no bead, and a tap on a recent colour chooses it (ticket 1065)', async () => {
    localStorage.setItem('openbeads:recent-colors', '#1d3557,#f1c453')
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })

    await holdBead(wrapper, 40)
    await flushPromises()
    expect(ring(wrapper).isVisible()).toBe(true)
    // The press's bead was taken back with no Undo step.
    expect(beadColor(wrapper, 40)).toBeNull()
    expect(ring(wrapper).get('[data-testid="radial-undo"]').attributes('aria-disabled')).toBe('true')

    await ring(wrapper).get('[data-testid="radial-recent-1"]').trigger('click')
    await flushPromises()
    expect(ring(wrapper).isVisible()).toBe(false)

    await pressBead(wrapper, 5)
    await wrapper.get('[data-testid="project-surface"]').trigger('pointerup')
    expect(beadColor(wrapper, 5)).toBe('#1d3557')
    wrapper.unmount()
  })

  /** Holds a finger inside an area while it wobbles onto the next bead, less than the drag slop away, so the area steps
   * a bead with it before the hold is up; `stepped` is checked at that moment. Then the finger lifts. */
  async function wobblyHold(wrapper: Mounted, at: { row: number; column: number }, stepped: () => void) {
    const surface = wrapper.get('[data-testid="project-surface"]')
    const middle = beadPoint(wrapper, at)
    const half = (beadPoint(wrapper, { ...at, column: at.column + 1 }).clientX - middle.clientX) / 2
    const finger = { clientY: middle.clientY, pointerType: 'touch', isPrimary: true }
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      await surface.trigger('pointerdown', { ...finger, clientX: middle.clientX + half - 1, button: 0, buttons: 1 })
      await surface.trigger('pointermove', { ...finger, clientX: middle.clientX + half + 1, buttons: 1 })
      stepped()
      vi.advanceTimersByTime(CANVAS_HOLD_MS)
    } finally {
      vi.useRealTimers()
    }
    await surface.trigger('pointerup', { ...finger, clientX: middle.clientX + half + 1 })
    await flushPromises()
  }

  /** A Project with a Selection of 2 x 3 beads on the Canvas, above the Frame, and its top-left bead position. */
  async function mountSelected() {
    const wrapper = await mountWithProject(6, 6, { attachTo: document.body })
    const frame = frameOf(loadProjects()[0]!)!
    const top = { row: frame.row - 10, column: frame.column }
    await pickTool(wrapper, 'select')
    await pressBead(wrapper, top)
    await hoverBead(wrapper, { row: top.row + 1, column: top.column + 2 }, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
    return { wrapper, top }
  }

  it('a hold inside the Selection opens the ring and leaves the Selection as it was (ticket 1084)', async () => {
    const { wrapper, top } = await mountSelected()
    const marked = () => wrapper.findComponent(ProjectSurface).props('selection')
    const selected = marked()
    expect(selected).toBeDefined()

    // The hold puts the stepped Selection back, and the lift is no tap, which under Select would drop it.
    await wobblyHold(wrapper, top, () => expect(marked()).not.toEqual(selected))
    expect(ring(wrapper).isVisible()).toBe(true)
    expect(marked()).toEqual(selected)
    wrapper.unmount()
  })

  it('a hold inside the Mirror\'s Area in Mirror mode opens the ring and leaves the Area as it was (ticket 1084)', async () => {
    const { wrapper, top } = await mountSelected()
    await pressBar(wrapper, 'mirror-selection')
    await flushPromises()
    await wrapper.get('[data-testid="pill-tool-mirror"]').trigger('click')
    await flushPromises()
    const drawn = () => wrapper.findComponent(ProjectSurface).props('mirror')?.place
    const area = drawn()
    expect(area).toBeDefined()

    await wobblyHold(wrapper, top, () => expect(drawn()).not.toEqual(area))
    expect(ring(wrapper).isVisible()).toBe(true)
    expect(drawn()).toEqual(area)
    wrapper.unmount()
  })

  it('a hold, a slide and a lift on a recent colour choose it in one gesture, and no bead is placed (ticket 1077)', async () => {
    localStorage.setItem('openbeads:recent-colors', '#1d3557,#f1c453')
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })

    // Up and a little to the right of the ring's centre, well past the ring: the second recent colour's slice.
    await holdBead(wrapper, 40, { x: 60, y: -200 })
    await flushPromises()
    expect(ring(wrapper).isVisible()).toBe(false)
    expect(beadColor(wrapper, 40)).toBeNull()

    await pressBead(wrapper, 5)
    await wrapper.get('[data-testid="project-surface"]').trigger('pointerup')
    expect(beadColor(wrapper, 5)).toBe('#f1c453')
    wrapper.unmount()
  })
})
