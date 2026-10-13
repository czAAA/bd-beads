import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import ProjectSurface from './components/canvas/ProjectSurface.vue'
import { withColors } from './domain/canvas'
import { createProject, type Project } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { beadColor, hoverBead, pressBead } from './testUtils/beads'

/** Set Frame (ticket 233, ADR 0026) as the app shows it: drawing, moving and resizing the Frame, its Toolbox row and its keys. */

const RED = '#e63746'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

function openCanvas(): Project {
  const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Sketch', size: { width: 4, height: 4, unit: 'beads' } })
  return {
    ...base,
    frame: undefined,
    beads: withColors({}, [
      { row: 2, column: 3, color: RED },
      { row: 3, column: 3, color: RED },
      { row: 3, column: 5, color: RED },
    ]),
  }
}

async function mountOpen(project = openCanvas()) {
  saveProjects([project])
  const wrapper = mount(App, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function key(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

const surface = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.find('[data-testid="project-surface"]')
const savedFrame = () => loadProjects()[0]!.frame

/** Drags from one bead to another with the pointer, as one gesture. */
async function drag(wrapper: Awaited<ReturnType<typeof mountOpen>>, from: { row: number; column: number }, to: { row: number; column: number }) {
  await pressBead(wrapper, from)
  await hoverBead(wrapper, to, { buttons: 1 })
  await surface(wrapper).trigger('pointerup')
  await flushPromises()
}

describe('Set Frame', () => {
  it('draws a Frame with F and a drag over beads, snapped to whole beads, and the drag paints nothing', async () => {
    const wrapper = await mountOpen()
    expect(wrapper.find('[data-testid="canvas-strip-size"]').text()).toBe('2 pieces · no Frame')

    await key({ key: '6' })
    expect(wrapper.find('[data-testid="canvas-strip-size"]').text()).toBe('2 pieces · setting Frame')

    await drag(wrapper, { row: 4, column: 6 }, { row: 1, column: 2 })

    expect(savedFrame()).toEqual({ row: 1, column: 2, rows: 4, columns: 5 })
    expect(beadColor(wrapper, { row: 4, column: 6 })).toBeNull()
    expect(wrapper.find('[data-testid="canvas-strip-title"]').text()).toBe(en.canvas.stripTitle)
  })

  it('moves a Frame with the Hand tool chosen before, and goes back to the Hand tool after (ticket 294)', async () => {
    const wrapper = await mountOpen({ ...openCanvas(), frame: { row: 1, column: 1, rows: 3, columns: 4 } })
    await key({ key: '5' })
    await key({ key: '6' })

    await drag(wrapper, { row: 2, column: 2 }, { row: 3, column: 4 })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 3, columns: 4 })

    await key({ key: 'Escape' })
    expect(wrapper.find('[data-testid="tool-hand"]').attributes('aria-pressed')).toBe('true')
  })

  it('lights the Frame tool alone while setting, and the previous tool again afterwards (ticket 294)', async () => {
    const wrapper = await mountOpen()
    const pressed = () => wrapper.findAll('[data-testid^="tool-"][aria-pressed="true"]').map((el) => el.attributes('data-testid'))
    expect(pressed()).toEqual(['tool-paint'])

    await key({ key: '6' })
    expect(pressed()).toEqual(['tool-frame'])

    await key({ key: 'Escape' })
    expect(pressed()).toEqual(['tool-paint'])
  })

  it('is left by Escape, Enter, and by choosing a tool', async () => {
    const wrapper = await mountOpen()
    const strip = () => wrapper.find('[data-testid="canvas-strip-size"]').text()

    await key({ key: '6' })
    expect(strip()).toContain('setting Frame')
    await key({ key: 'Escape' })
    expect(strip()).not.toContain('setting Frame')

    await key({ key: '6' })
    await surface(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(strip()).not.toContain('setting Frame')

    await key({ key: '6' })
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    expect(strip()).not.toContain('setting Frame')
  })

  it('works from the keyboard: arrows start a Frame, move it, and Shift resizes it', async () => {
    const wrapper = await mountOpen()
    await key({ key: '6' })

    await surface(wrapper).trigger('keydown', { key: 'ArrowRight' })
    expect(savedFrame()).toEqual({ row: 0, column: 0, rows: 1, columns: 1 })
    await surface(wrapper).trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    await surface(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(savedFrame()).toEqual({ row: 1, column: 0, rows: 1, columns: 2 })
  })

})

describe('the Frame row', () => {
  it('reads "not set" with no Frame, and opening it starts Set Frame', async () => {
    const wrapper = await mountOpen()
    const row = wrapper.find('[data-testid="tool-group-frame"]')
    expect(row.find('.disclosure-row__summary').text()).toBe(en.frame.notSet)

    await row.find('button').trigger('click')
    expect(wrapper.find('[data-testid="canvas-strip-size"]').text()).toContain('setting Frame')
  })

  it('steps the size, fits to the drawing and removes the Frame, each as an Undo step', async () => {
    const wrapper = await mountOpen()
    const row = wrapper.find('[data-testid="tool-group-frame"]')
    await row.find('button').trigger('click')
    await key({ key: 'Escape' })

    await row.find('[data-testid="frame-fit"]').trigger('click')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    // The press only changes the pending Frame (ticket 410); Remove Frame reads the Frame, so it commits it first.
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    await row.find('[data-testid="frame-remove"]').trigger('click')
    expect(savedFrame()).toBeUndefined()

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 4 })
    expect(beadColor(wrapper, { row: 3, column: 5 })).toBe(RED)
    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
  })
})

describe('the Frame row\'s size steppers apply once (ticket 410)', () => {
  const framed = (): Project => ({ ...openCanvas(), frame: { row: 2, column: 3, rows: 2, columns: 3 } })
  const shownFrame = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.findComponent(ProjectSurface).props('project').frame

  async function openRow(wrapper: Awaited<ReturnType<typeof mountOpen>>) {
    const row = wrapper.find('[data-testid="tool-group-frame"]')
    await row.find('button').trigger('click')
    return row
  }

  it('shows each press on the canvas and in the fields, saves nothing, and commits as one Undo step when the row closes', async () => {
    const wrapper = await mountOpen(framed())
    const row = await openRow(wrapper)

    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    await row.find('[data-testid="frame-rows-increase"]').trigger('click')

    expect(shownFrame(wrapper)).toEqual({ row: 2, column: 3, rows: 3, columns: 5 })
    expect(row.find('[data-testid="frame-columns"]').text()).toBe('5')
    expect(row.find('[data-testid="frame-rows"]').text()).toBe('3')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    await row.find('button').trigger('click')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 3, columns: 5 })
    expect(shownFrame(wrapper)).toEqual({ row: 2, column: 3, rows: 3, columns: 5 })

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
  })

  it('commits a pending Frame before Rotate or a stroke reads it, so neither acts on a stale one', async () => {
    const wrapper = await mountOpen(framed())
    const row = await openRow(wrapper)
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toMatchObject({ rows: 4, columns: 2 })

    // Rotate is its own Undo step on top of the committed size.
    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 4 })
    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
  })

})

describe('Rotate, Export and Row progress on the Frame', () => {
  const framed = (): Project => ({
    ...openCanvas(),
    frame: { row: 2, column: 3, rows: 2, columns: 3 },
  })

  it('turns the Frame and its beads, and one Undo turns them back', async () => {
    const wrapper = await mountOpen(framed())
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    await flushPromises()

    expect(savedFrame()).toMatchObject({ rows: 3, columns: 2 })
    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(beadColor(wrapper, { row: 3, column: 5 })).toBe(RED)
  })

  it('opens "Set Frame to export" with no Frame, and Fit to drawing there sets one', async () => {
    const wrapper = await mountOpen()
    await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
    expect(wrapper.find('[data-testid="export-needs-frame"]').text()).toContain(en.frame.exportPromptTitle)

    await wrapper.find('[data-testid="export-fit-frame"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
  })

  it('has Set Frame in the Progress bar with no Frame, and Beads needed asks for one', async () => {
    const wrapper = await mountOpen()
    expect(wrapper.find('[data-testid="progress-bar-needs-frame"]').text()).toBe(en.frame.progressNeedsFrame)
    expect(wrapper.find('[data-testid="quantities-needs-frame"]').text()).toBe(en.frame.countNeedsFrame)

    await wrapper.find('[data-testid="progress-bar-set-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="canvas-strip-size"]').text()).toContain('setting Frame')
  })

})

describe('New Project with the Frame optional', () => {
  it('creates an open canvas from the empty form, and lists it in the library', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await wrapper.find('form.new-project-form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="canvas-strip-title"]').text()).toBe(en.canvas.canvasTitle)
    expect(wrapper.find('[data-testid="canvas-strip-size"]').text()).toBe('0 pieces · no Frame')
    expect(savedFrame()).toBeUndefined()
    expect(loadProjects()).toHaveLength(1)
    expect(wrapper.find('[data-testid="project-list"]').exists() || wrapper.text().includes(loadProjects()[0]!.name)).toBe(true)
  })
})
