import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { withColors } from './domain/canvas'
import { createProject } from './domain/createProject'
import type { Project } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { beadColor, hoverBead, previewedBeads, pressBead } from './testUtils/beads'
import { pickColor, pickTool } from './testUtils/pill'
import { beadsOfLayer, frameOf, orientationOf } from './domain/layerRecord'
import { type LayersChange, withLayers } from './testUtils/layerFields'

/** The Canvas (ticket 233, ADR 0026) as the app shows it: an endless field to draw on, moved by wheel, Hand tool and
 * Space, read via rulers. */

const RED = '#e63746'
const BLUE = '#2f6fed'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

/** A Project with no Frame and a few beads in two places. */
function unframedProject(extra: LayersChange = {}): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Sketch', size: { width: 4, height: 4, unit: 'beads' } })
  return withLayers(base, {
frame: undefined,
    beads: withColors({}, [
      { row: 0, column: 0, color: RED },
      { row: 0, column: 1, color: RED },
      { row: 1, column: 1, color: RED },
      { row: 10, column: 10, color: RED },
    ]),
    ...extra,
})
}

function mountApp() {
  return mount(App, { attachTo: document.body })
}

async function key(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

const surface = (wrapper: ReturnType<typeof mountApp>) => wrapper.find('[data-testid="project-surface"]')

describe('Rotate canvas (ticket 471)', () => {
  it('turns the picture a quarter from the Canvas strip, saved with the Project and no Undo step', async () => {
    saveProjects([unframedProject()])
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()

    await wrapper.get('[data-testid="strip-rotate-canvas"]').trigger('click')
    await flushPromises()
    expect(orientationOf(loadProjects()[0])).toBe(90)
    expect(wrapper.get('[data-testid="strip-undo"]').attributes('aria-disabled')).toBe('true')
  })

  it('turns the picture with a two-finger twist, live, and keeps the angle it settles on with no Undo step (ticket 0672)', async () => {
    saveProjects([unframedProject()])
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    const finger = (type: string, pointerId: number, clientX: number, clientY: number) =>
      surface(wrapper).trigger(type, { pointerId, clientX, clientY, pointerType: 'touch', isPrimary: pointerId === 1, button: 0, buttons: 1 })

    await finger('pointerdown', 1, 100, 100)
    await finger('pointerdown', 2, 200, 100)
    // The second finger swings 20° clockwise round the first, which engages the twist (ticket 0709), then 40° more.
    const swing = (degrees: number) => finger('pointermove', 2, 100 + 100 * Math.cos((degrees * Math.PI) / 180), 100 + 100 * Math.sin((degrees * Math.PI) / 180))
    await swing(20)
    expect(surface(wrapper).attributes('data-tilt')).toBeUndefined()
    await swing(60)
    expect(surface(wrapper).attributes('data-tilt')).toBe('40')
    expect(orientationOf(loadProjects()[0])).toBe(0)

    await finger('pointerup', 2, 0, 0)
    await finger('pointerup', 1, 0, 0)
    await flushPromises()
    expect(orientationOf(loadProjects()[0])).toBe(40)
    expect(wrapper.get('[data-testid="strip-undo"]').attributes('aria-disabled')).toBe('true')
  })
})

describe('Undo and Redo in the Canvas strip', () => {
  it('take a stroke back and bring it again, Redo lit only once there is something to redo (tickets 295, 296)', async () => {
    saveProjects([unframedProject()])
    const wrapper = mountApp()
    await flushPromises()
    const redo = () => wrapper.get('[data-testid="strip-redo"]')
    expect(redo().attributes('aria-disabled')).toBe('true')

    await pressBead(wrapper, { row: 5, column: 5 })
    await wrapper.trigger('mouseup')
    await wrapper.get('[data-testid="strip-undo"]').trigger('click')
    expect(beadsOfLayer(loadProjects()[0], 'canvas')[5]?.[5]).toBeUndefined()
    expect(redo().attributes('aria-disabled')).toBeUndefined()

    await redo().trigger('click')
    expect(beadsOfLayer(loadProjects()[0], 'canvas')[5]![5]).toBe('#1a1a1a') // the Palette's first color, picked at start
  })
})

describe('drawing anywhere', () => {
  it('paints far from the first bead, at positions the canvas never had a size for, and keeps it through a reload', async () => {
    saveProjects([unframedProject()])
    const wrapper = mountApp()
    await flushPromises()
    await pickColor(wrapper, 'red')

    await pressBead(wrapper, { row: 4000, column: 9000 })
    await wrapper.trigger('mouseup')
    await pressBead(wrapper, { row: -30, column: -12 })
    await wrapper.trigger('mouseup')

    expect(beadColor(wrapper, { row: 4000, column: 9000 })).toBe(RED)
    const saved = loadProjects()[0]!
    expect(beadsOfLayer(saved, 'canvas')[4000]![9000]).toBe(RED)
    expect(beadsOfLayer(saved, 'canvas')[-30]![-12]).toBe(RED)
    expect(frameOf(saved)).toBeUndefined()

    wrapper.unmount()
    const reloaded = mountApp()
    await flushPromises()
    expect(beadColor(reloaded, { row: 4000, column: 9000 })).toBe(RED)
    expect(beadColor(reloaded, { row: -30, column: -12 })).toBe(RED)
  })

  it('fills the pressed bead\'s same-colored region with the Fill tool', async () => {
    saveProjects([unframedProject()])
    const wrapper = mountApp()
    await flushPromises()
    await pickColor(wrapper, 'blue')
    await pickTool(wrapper, 'fill')

    await pressBead(wrapper, { row: 0, column: 0 })

    const beads = beadsOfLayer(loadProjects()[0], 'canvas')
    expect([beads[0]![0], beads[0]![1], beads[1]![1]]).toEqual([BLUE, BLUE, BLUE])
  })
})

describe('the Hand tool', () => {
  it('is the fifth tool, picked by H, and drags the canvas without changing a bead or previewing one', async () => {
    saveProjects([unframedProject()])
    const wrapper = mountApp()
    await flushPromises()
    await pickColor(wrapper, 'red')

    await key({ key: '5' })
    expect(wrapper.find('[data-testid="pill-tool-hand"]').classes()).toContain('icon-btn--selected')
    // Six tools and the Mirror tile (ticket 0703).
    expect(wrapper.findAll('[data-testid^="pill-tool-"]')).toHaveLength(7)

    const before = JSON.stringify(beadsOfLayer(loadProjects()[0], 'canvas'))
    const root = surface(wrapper)
    const startX = Number(root.attributes('data-scroll-x'))
    await root.trigger('pointerdown', { clientX: 100, clientY: 100, button: 0, buttons: 1 })
    await root.trigger('pointermove', { clientX: 70, clientY: 90, buttons: 1 })
    await root.trigger('pointerup')
    await hoverBead(wrapper, { row: 3, column: 3 })

    expect(Number(root.attributes('data-scroll-x'))).toBe(startX + 30)
    expect(JSON.stringify(beadsOfLayer(loadProjects()[0], 'canvas'))).toBe(before)
    expect(previewedBeads(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="strip-undo"]').attributes('aria-disabled')).toBeDefined()
  })
})

