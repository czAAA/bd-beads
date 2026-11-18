import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import { beadColor, holdBead, outlinedBead, pressBead, rightClickBead } from './testUtils/beads'
import { toolState } from './testUtils/pill'

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

    // On the first bead: its colour is the one taken.
    await rightClickBead(wrapper, 3)
    await pick('pick-color')
    expect(ring(wrapper).isVisible()).toBe(false)
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
})
