import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { createProject } from './domain/project'
import { saveProjects } from './services/libraryStore'
import { beadColor, pressBead } from './testUtils/beads'
import { en } from './i18n/en'

/** Pen mode and Mouse mode (ticket 325): which pointer draws and which one moves the canvas, and the toggle that picks. */

/** How many touch points the device says it has: a touch screen is what offers the toggle. */
function touchPoints(count: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: count, configurable: true })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  touchPoints(5)
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'maxTouchPoints')
  document.body.innerHTML = ''
})

async function mountOpen() {
  saveProjects([createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Sketch', size: { width: 6, height: 6, unit: 'beads' } })])
  const wrapper = mount(App, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

const toggle = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.get('[data-testid="input-mode-toggle"]')

describe('the input mode toggle', () => {
  it('starts in Mouse mode, and one press switches it and keeps the choice for the next visit', async () => {
    const wrapper = await mountOpen()
    expect(toggle(wrapper).attributes('aria-label')).toBe(en.inputMode.mouseLabel)
    expect(toggle(wrapper).attributes('aria-pressed')).toBe('false')

    await toggle(wrapper).trigger('click')
    expect(toggle(wrapper).attributes('aria-label')).toBe(en.inputMode.penLabel)
    expect(toggle(wrapper).attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('bd-beads:input-mode')).toBe('pen')

    wrapper.unmount()
    const again = await mountOpen()
    expect(toggle(again).attributes('aria-label')).toBe(en.inputMode.penLabel)
  })

  it('is on the Dock too, and is the same mode', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('[data-testid="dock-input-mode"]').trigger('click')
    expect(toggle(wrapper).attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="dock-input-mode"]').attributes('aria-pressed')).toBe('true')
  })

  it('is nowhere on a device without a touch screen, where every pointer draws', async () => {
    touchPoints(0)
    localStorage.setItem('bd-beads:input-mode', 'pen')
    const wrapper = await mountOpen()
    expect(wrapper.find('[data-testid="input-mode-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dock-input-mode"]').exists()).toBe(false)

    await pressBead(wrapper, { row: 1, column: 1 }, { pointerType: 'mouse' })
    expect(beadColor(wrapper, { row: 1, column: 1 })).not.toBeNull()
  })
})

describe('who draws', () => {
  it('lets a pen paint and keeps a finger off the beads in Pen mode', async () => {
    localStorage.setItem('bd-beads:input-mode', 'pen')
    const wrapper = await mountOpen()

    await pressBead(wrapper, { row: 1, column: 1 }, { pointerType: 'touch' })
    expect(beadColor(wrapper, { row: 1, column: 1 })).toBeNull()

    await pressBead(wrapper, { row: 2, column: 2 }, { pointerType: 'pen' })
    expect(beadColor(wrapper, { row: 2, column: 2 })).not.toBeNull()
  })

  it('lets a finger paint and keeps the pen off the beads in Mouse mode', async () => {
    const wrapper = await mountOpen()

    await pressBead(wrapper, { row: 1, column: 1 }, { pointerType: 'pen' })
    expect(beadColor(wrapper, { row: 1, column: 1 })).toBeNull()

    await pressBead(wrapper, { row: 2, column: 2 }, { pointerType: 'touch' })
    expect(beadColor(wrapper, { row: 2, column: 2 })).not.toBeNull()
  })
})
