import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { createProject } from './domain/project'
import { saveProjects } from './services/libraryStore'
import { beadColor, pressBead } from './testUtils/beads'
import { en } from './i18n/en'
import { closePanel, openPanel } from './testUtils/pill'

/** Pen mode and Mouse mode (tickets 325, 326, 443): which pointer draws and which one moves the canvas, and the Menu's Input row that picks, which shows once a pen is seen. */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

/** A device a pen has touched before, with the mode the person chose (none: the pen picked Pen mode). */
function penDevice(mode?: 'pen' | 'mouse') {
  localStorage.setItem('openbeads:pen-seen', 'yes')
  if (mode) localStorage.setItem('openbeads:input-mode', mode)
}

async function mountOpen() {
  saveProjects([createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Sketch', size: { width: 6, height: 6, unit: 'beads' } })])
  const wrapper = mount(App, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

const bead = (row: number, column: number) => ({ row, column })

/** The Menu's Input row (ticket 443): Pen | Mouse, which opens Menu first. */
async function inputRow(wrapper: Awaited<ReturnType<typeof mountOpen>>) {
  await openPanel(wrapper, 'strip-menu')
  return wrapper.find('[data-testid="menu-input-mode"]')
}
const chosen = (row: Awaited<ReturnType<typeof inputRow>>) => row.findAll('[role="radio"]').find((option) => option.attributes('aria-checked') === 'true')?.text()

describe('the Input row in Menu', () => {
  it('is in Mouse mode when the person chose it, and choosing Pen switches it and keeps the choice for the next visit', async () => {
    penDevice('mouse')
    const wrapper = await mountOpen()
    expect(wrapper.find('[data-testid="pill-input-mode"]').exists()).toBe(false)
    const row = await inputRow(wrapper)
    expect(row.text()).toContain(en.panels.menu.input)
    expect(chosen(row)).toBe(en.panels.menu.mouse)

    await row.find('[data-value="pen"]').trigger('click')
    expect(chosen(await inputRow(wrapper))).toBe(en.panels.menu.pen)
    expect(localStorage.getItem('openbeads:input-mode')).toBe('pen')

    wrapper.unmount()
    const again = await mountOpen()
    expect(chosen(await inputRow(again))).toBe(en.panels.menu.pen)
  })

})

describe('a pen appearing', () => {
  it('shows no Input row before a pen is seen, and a finger and a mouse draw as before', async () => {
    const wrapper = await mountOpen()
    expect((await inputRow(wrapper)).exists()).toBe(false)
    await closePanel(wrapper)

    await pressBead(wrapper, bead(1, 1), { pointerType: 'touch' })
    await pressBead(wrapper, bead(2, 2), { pointerType: 'mouse' })
    expect(beadColor(wrapper, bead(1, 1))).not.toBeNull()
    expect(beadColor(wrapper, bead(2, 2))).not.toBeNull()
    expect(localStorage.getItem('openbeads:pen-seen')).toBeNull()
  })

  it('is shown the Input row, in Pen mode, by the first pen stroke, which still draws', async () => {
    const wrapper = await mountOpen()
    await pressBead(wrapper, bead(1, 1), { pointerType: 'pen' })
    expect(beadColor(wrapper, bead(1, 1))).not.toBeNull()
    expect(chosen(await inputRow(wrapper))).toBe(en.panels.menu.pen)
    await closePanel(wrapper)

    // A finger resting on the screen no longer paints.
    await pressBead(wrapper, bead(3, 3), { pointerType: 'touch' })
    expect(beadColor(wrapper, bead(3, 3))).toBeNull()
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

})
