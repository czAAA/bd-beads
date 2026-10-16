import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { withColors } from './domain/canvas'
import { createProject, type Project } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { beadColor, hoverBead, previewedBeads, pressBead } from './testUtils/beads'
import { pickColor } from './testUtils/pill'

/**
 * The Canvas (ticket 233, ADR 0026) as the app shows it: a Project with no Frame is an endless field you draw on
 * anywhere, move with the wheel, the Hand tool and Space, and read through the rulers of its pieces.
 */

const RED = '#e63746'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

/** A Project with no Frame and a few beads in two places. */
function unframedProject(extra: Partial<Project> = {}): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Sketch', size: { width: 4, height: 4, unit: 'beads' } })
  return {
    ...base,
    frame: undefined,
    beads: withColors({}, [
      { row: 0, column: 0, color: RED },
      { row: 0, column: 1, color: RED },
      { row: 1, column: 1, color: RED },
      { row: 10, column: 10, color: RED },
    ]),
    ...extra,
  }
}

function mountApp() {
  return mount(App, { attachTo: document.body })
}

async function key(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

const surface = (wrapper: ReturnType<typeof mountApp>) => wrapper.find('[data-testid="project-surface"]')

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
    expect(saved.beads[4000]![9000]).toBe(RED)
    expect(saved.beads[-30]![-12]).toBe(RED)
    expect(saved.frame).toBeUndefined()

    wrapper.unmount()
    const reloaded = mountApp()
    await flushPromises()
    expect(beadColor(reloaded, { row: 4000, column: 9000 })).toBe(RED)
    expect(beadColor(reloaded, { row: -30, column: -12 })).toBe(RED)
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
    expect(wrapper.findAll('[data-testid^="pill-tool-"]')).toHaveLength(6)

    const before = JSON.stringify(loadProjects()[0]!.beads)
    const root = surface(wrapper)
    const startX = Number(root.attributes('data-scroll-x'))
    await root.trigger('pointerdown', { clientX: 100, clientY: 100, button: 0, buttons: 1 })
    await root.trigger('pointermove', { clientX: 70, clientY: 90, buttons: 1 })
    await root.trigger('pointerup')
    await hoverBead(wrapper, { row: 3, column: 3 })

    expect(Number(root.attributes('data-scroll-x'))).toBe(startX + 30)
    expect(JSON.stringify(loadProjects()[0]!.beads)).toBe(before)
    expect(previewedBeads(wrapper)).toEqual([])
    expect(wrapper.find('[data-testid="strip-undo"]').attributes('aria-disabled')).toBeDefined()
  })
})

