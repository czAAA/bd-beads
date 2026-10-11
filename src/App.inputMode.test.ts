import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { createProject } from './domain/project'
import { saveProjects } from './services/libraryStore'
import { beadColor, pressBead } from './testUtils/beads'
import { en } from './i18n/en'

/** Pen mode and Mouse mode (tickets 325, 326): which pointer draws and which one moves the canvas, and the toggle that picks, which shows once a pen is seen. */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

/** A device a pen has touched before, with the mode the person chose (none: the pen picked Pen mode). */
function penDevice(mode?: 'pen' | 'mouse') {
  localStorage.setItem('bd-beads:pen-seen', 'yes')
  if (mode) localStorage.setItem('bd-beads:input-mode', mode)
}

async function mountOpen() {
  saveProjects([createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Sketch', size: { width: 6, height: 6, unit: 'beads' } })])
  const wrapper = mount(App, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

const toggle = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.get('[data-testid="input-mode-toggle"]')

const dockToggle = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.get('[data-testid="dock-input-mode"]')
const bead = (row: number, column: number) => ({ row, column })

describe('the input mode toggle', () => {
  it('is in Mouse mode when the person chose it, and one press switches it and keeps the choice for the next visit', async () => {
    penDevice('mouse')
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
    penDevice('mouse')
    const wrapper = await mountOpen()
    await dockToggle(wrapper).trigger('click')
    expect(toggle(wrapper).attributes('aria-pressed')).toBe('true')
    expect(dockToggle(wrapper).attributes('aria-pressed')).toBe('true')
  })
})

describe('a pen appearing', () => {
  it('shows no toggle before a pen is seen, and a finger and a mouse draw as before', async () => {
    const wrapper = await mountOpen()
    expect(wrapper.find('[data-testid="input-mode-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="dock-input-mode"]').exists()).toBe(false)

    await pressBead(wrapper, bead(1, 1), { pointerType: 'touch' })
    await pressBead(wrapper, bead(2, 2), { pointerType: 'mouse' })
    expect(beadColor(wrapper, bead(1, 1))).not.toBeNull()
    expect(beadColor(wrapper, bead(2, 2))).not.toBeNull()
    expect(wrapper.find('[data-testid="input-mode-toggle"]').exists()).toBe(false)
    expect(localStorage.getItem('bd-beads:pen-seen')).toBeNull()
  })

  it('is shown the toggle, in Pen mode, by the first pen stroke, which still draws', async () => {
    const wrapper = await mountOpen()
    await pressBead(wrapper, bead(1, 1), { pointerType: 'pen' })
    expect(beadColor(wrapper, bead(1, 1))).not.toBeNull()
    expect(toggle(wrapper).attributes('aria-pressed')).toBe('true')
    expect(dockToggle(wrapper).attributes('aria-pressed')).toBe('true')

    // A finger resting on the screen no longer paints.
    await pressBead(wrapper, bead(3, 3), { pointerType: 'touch' })
    expect(beadColor(wrapper, bead(3, 3))).toBeNull()
  })

  it('is remembered on the device, so the toggle and Pen mode are there on the next visit', async () => {
    const wrapper = await mountOpen()
    await pressBead(wrapper, bead(1, 1), { pointerType: 'pen' })
    expect(localStorage.getItem('bd-beads:pen-seen')).toBe('yes')

    wrapper.unmount()
    const again = await mountOpen()
    expect(toggle(again).attributes('aria-pressed')).toBe('true')
  })

  it('is shown the toggle by a hovering pen too', async () => {
    const wrapper = await mountOpen()
    window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'pen' }))
    await flushPromises()
    expect(wrapper.find('[data-testid="input-mode-toggle"]').exists()).toBe(true)
  })

  it('never overrides a mode the person chose', async () => {
    localStorage.setItem('bd-beads:input-mode', 'mouse')
    const wrapper = await mountOpen()
    await pressBead(wrapper, bead(1, 1), { pointerType: 'pen' })
    expect(beadColor(wrapper, bead(1, 1))).not.toBeNull()
    expect(toggle(wrapper).attributes('aria-pressed')).toBe('false')
    expect(localStorage.getItem('bd-beads:input-mode')).toBe('mouse')

    await pressBead(wrapper, bead(2, 2), { pointerType: 'pen' })
    expect(beadColor(wrapper, bead(2, 2))).toBeNull()
  })
})

describe('who draws', () => {
  it('lets a pen paint and keeps a finger off the beads in Pen mode', async () => {
    penDevice('pen')
    const wrapper = await mountOpen()

    await pressBead(wrapper, bead(1, 1), { pointerType: 'touch' })
    expect(beadColor(wrapper, bead(1, 1))).toBeNull()

    await pressBead(wrapper, bead(2, 2), { pointerType: 'pen' })
    expect(beadColor(wrapper, bead(2, 2))).not.toBeNull()
  })

  it('lets a finger paint and keeps the pen off the beads in Mouse mode', async () => {
    penDevice('mouse')
    const wrapper = await mountOpen()

    await pressBead(wrapper, bead(1, 1), { pointerType: 'pen' })
    expect(beadColor(wrapper, bead(1, 1))).toBeNull()

    await pressBead(wrapper, bead(2, 2), { pointerType: 'touch' })
    expect(beadColor(wrapper, bead(2, 2))).not.toBeNull()
  })
})
