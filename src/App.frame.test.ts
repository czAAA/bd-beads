import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import ProjectSurface from './components/canvas/ProjectSurface.vue'
import { withColors } from './domain/canvas'
import { createProject, type Project } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { beadColor, drawnProject, hoverBead, pressBead } from './testUtils/beads'

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

  it('shows the Frame while it is dragged and commits it on release, as one Undo step that changes no bead', async () => {
    const wrapper = await mountOpen()
    await key({ key: '6' })

    await pressBead(wrapper, { row: 1, column: 1 })
    await hoverBead(wrapper, { row: 3, column: 4 }, { buttons: 1 })
    await flushPromises()
    expect(drawnProject(wrapper).frame).toEqual({ row: 1, column: 1, rows: 3, columns: 4 })
    expect(savedFrame()).toBeUndefined()

    await surface(wrapper).trigger('pointerup')
    await flushPromises()
    expect(savedFrame()).toEqual({ row: 1, column: 1, rows: 3, columns: 4 })

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toBeUndefined()
    expect(beadColor(wrapper, { row: 2, column: 3 })).toBe(RED)
  })

  it('moves a Frame by dragging inside it', async () => {
    const wrapper = await mountOpen({ ...openCanvas(), frame: { row: 1, column: 1, rows: 3, columns: 4 } })
    await key({ key: '6' })

    await drag(wrapper, { row: 2, column: 2 }, { row: 3, column: 4 })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 3, columns: 4 })
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

  it('shows no bead cursor when F focuses the Project, and hints at the Frame keys instead (ticket 286)', async () => {
    const wrapper = await mountOpen({ ...openCanvas(), frame: { row: 1, column: 1, rows: 3, columns: 4 } })
    await key({ key: '6' })

    expect(document.activeElement).toBe(surface(wrapper).element)
    expect(wrapper.findComponent(ProjectSurface).props('cursor')).toBeUndefined()
    expect(wrapper.find('[data-testid="canvas-strip-hint"]').text()).toBe(en.frame.keyboardHint)

    await surface(wrapper).trigger('keydown', { key: 'Enter' })
    // Ending Set Frame reveals no cursor the person did not move (ticket 354); an arrow key brings it back.
    expect(wrapper.findComponent(ProjectSurface).props('cursor')).toBeUndefined()
    expect(wrapper.find('[data-testid="canvas-strip-hint"]').text()).toBe(en.a11y.keyboardHint)
    await surface(wrapper).trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.findComponent(ProjectSurface).props('cursor')).toBeDefined()
  })

  it('shows no bead cursor after key 6 or Escape ends Set Frame until an arrow key moves it (ticket 354)', async () => {
    const wrapper = await mountOpen({ ...openCanvas(), frame: { row: 1, column: 1, rows: 3, columns: 4 } })
    const cursor = () => wrapper.findComponent(ProjectSurface).props('cursor')

    await key({ key: '6' })
    await surface(wrapper).trigger('keydown', { key: '6' })
    expect(cursor()).toBeUndefined()

    await key({ key: '6' })
    await surface(wrapper).trigger('keydown', { key: 'Escape' })
    expect(cursor()).toBeUndefined()
    await surface(wrapper).trigger('keydown', { key: 'ArrowDown' })
    expect(cursor()).toBeDefined()
  })

  it('is refused while Row progress is on', async () => {
    const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 4, unit: 'beads' } })
    const wrapper = await mountOpen({ ...project, rowProgress: { ...project.rowProgress, enabled: true } })
    await key({ key: '6' })
    await drag(wrapper, { row: 5, column: 5 }, { row: 7, column: 8 })
    expect(savedFrame()).toEqual(project.frame)
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

  it('takes no Undo step when the Frame is closed back at its own size', async () => {
    const wrapper = await mountOpen(framed())
    const row = await openRow(wrapper)

    await row.find('[data-testid="frame-columns-decrease"]').trigger('click')
    await row.find('[data-testid="frame-columns-decrease"]').trigger('click')
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    await row.find('button').trigger('click')

    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(wrapper.find('[data-testid="undo-button"]').attributes('aria-disabled')).toBe('true')
  })

  it('grows from the side that was chosen, keeps the choice on the device and never saves it in the Project', async () => {
    const wrapper = await mountOpen(framed())
    const row = await openRow(wrapper)
    expect(row.find('[data-testid="frame-width-side"] [aria-checked="true"]').text()).toBe(en.frame.sideRight)
    expect(row.find('[data-testid="frame-height-side"] [aria-checked="true"]').text()).toBe(en.frame.sideBottom)

    await row.find('[data-testid="frame-width-side"] [data-value="left"]').trigger('click')
    await row.find('[data-testid="frame-height-side"] [data-value="top"]').trigger('click')
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    await row.find('[data-testid="frame-rows-increase"]').trigger('click')
    await row.find('button').trigger('click')

    expect(savedFrame()).toEqual({ row: 1, column: 2, rows: 3, columns: 4 })
    expect(localStorage.getItem('bd-beads:frame-width-side')).toBe('left')
    expect(localStorage.getItem('bd-beads:frame-height-side')).toBe('top')
    expect(JSON.stringify(loadProjects())).not.toMatch(/frame-width-side|frameWidthSide|"left"/)

    wrapper.unmount()
    const again = await mountOpen(loadProjects()[0])
    const reopened = await openRow(again)
    expect(reopened.find('[data-testid="frame-width-side"] [aria-checked="true"]').text()).toBe(en.frame.sideLeft)
    expect(reopened.find('[data-testid="frame-height-side"] [aria-checked="true"]').text()).toBe(en.frame.sideTop)
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

  it('commits a pending Frame when a bead is painted, in the bead the pending Frame reaches', async () => {
    const wrapper = await mountOpen(framed())
    const row = await openRow(wrapper)
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    await pressBead(wrapper, { row: 2, column: 6 })
    await surface(wrapper).trigger('pointerup')
    await flushPromises()

    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 4 })
    expect(beadColor(wrapper, { row: 2, column: 6 })).not.toBeNull()
  })

  it('drops a pending Frame on Undo, which has nothing of it to take back', async () => {
    const wrapper = await mountOpen(framed())
    const row = await openRow(wrapper)
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    expect(shownFrame(wrapper)?.columns).toBe(4)

    await key({ key: 'z', ctrlKey: true })
    expect(shownFrame(wrapper)).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    await row.find('button').trigger('click')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
  })

  it('keeps the steppers and the choices disabled with the reason while Row progress is on', async () => {
    const project = framed()
    const wrapper = await mountOpen({ ...project, rowProgress: { ...project.rowProgress, enabled: true } })
    const row = await openRow(wrapper)

    expect(row.find('[data-testid="frame-width-side"]').attributes('aria-disabled')).toBe('true')
    expect(row.find('[data-testid="frame-height-side"]').attributes('aria-disabled')).toBe('true')
    await row.find('[data-testid="frame-columns-increase"]').trigger('click')
    expect(shownFrame(wrapper)).toEqual(project.frame)
    expect(row.find('[data-testid="frame-locked"]').exists()).toBe(true)
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

  it('moves a Piece out of the way with a Message, and Undo brings it and the turn back', async () => {
    const project = framed()
    // A piece below the Frame, where the taller turned Frame reaches.
    const withPiece = { ...project, beads: withColors(project.beads, [{ row: 4, column: 5, color: RED }]) }
    const wrapper = await mountOpen(withPiece)
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    await flushPromises()

    const message = wrapper.find('[data-testid="project-rotated"]')
    expect(message.text()).toContain(en.palette.undoButton)
    expect(message.text()).toContain('Pattern rotated. 1 piece was in the way and moved outside the Frame.')
    expect(beadColor(wrapper, { row: 4, column: 5 })).toBeNull()

    await message.find('[data-testid="toast-action"]').trigger('click')
    await flushPromises()
    expect(beadColor(wrapper, { row: 4, column: 5 })).toBe(RED)
    expect(savedFrame()).toEqual(project.frame)
  })

  it('disables Rotate with no Frame, naming why', async () => {
    const wrapper = await mountOpen()
    const rotate = wrapper.find('[data-testid="rotate-button"]')
    expect(rotate.attributes('aria-disabled')).toBeDefined()
    expect(rotate.attributes('aria-label')).toBe(en.palette.rotateButton)
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

  it('turns Row progress on over the Frame\'s rows, and locks the Frame while it is on', async () => {
    const wrapper = await mountOpen(framed())
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/1.*2/)

    await key({ key: '6' })
    await drag(wrapper, { row: 9, column: 9 }, { row: 11, column: 12 })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(wrapper.find('[data-testid="rotate-button"]').attributes('aria-disabled')).toBeDefined()
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
