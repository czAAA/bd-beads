import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { withColors } from './domain/canvas'
import { createProject, type Project } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { beadColor, hoverBead, pressBead } from './testUtils/beads'
import { closeSheet, openNewProject, openSavedProjects, openSheet, pickTool, rotate, selectAll } from './testUtils/pill'

/** Edit Frame (tickets 233, 417, ADRs 0026, 0046, 0054) as the app shows it: moving and resizing the Frame, its margin steppers, the Project sheet's Frame controls and the keys. */

const RED = '#e63746'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
})

function unframedProject(): Project {
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

async function mountOpen(project = unframedProject()) {
  saveProjects([project])
  const wrapper = mount(App, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function key(init: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

/** The edit toggle at the top-right corner of the margin outline (ticket 452). */
async function toggleEdit(wrapper: Awaited<ReturnType<typeof mountOpen>>) {
  await wrapper.get('[data-testid="frame-edit-toggle"]').trigger('click')
  await flushPromises()
}

const surface = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.find('[data-testid="project-surface"]')
const savedFrame = () => loadProjects()[0]!.frame

const framedProject = (): Project => ({ ...unframedProject(), frame: { row: 2, column: 3, rows: 2, columns: 3 } })
/** Whether edit is on: the margin steppers are up (ticket 452). */
const editing = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.find('[data-testid="edit-frame-steppers"]').exists()

describe('Edit Frame', () => {
  it('is a toggle on the Frame, on by default, and only with a Frame; the Progress bar and Project have no Edit Frame button (tickets 443, 452)', async () => {
    const wrapper = await mountOpen()
    expect(wrapper.find('[data-testid="frame-edit-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-edit-frame"]').exists()).toBe(false)
    await openSheet(wrapper, 'strip-project')
    expect(wrapper.find('[data-testid="frame-edit"]').exists()).toBe(false)
    await closeSheet(wrapper)

    const framed = await mountOpen(framedProject())
    expect(editing(framed)).toBe(true)
    expect(framed.get('[data-testid="frame-edit-toggle"]').attributes('aria-pressed')).toBe('true')
    await toggleEdit(framed)
    expect(editing(framed)).toBe(false)
    expect(framed.get('[data-testid="frame-edit-toggle"]').attributes('aria-pressed')).toBe('false')
    await toggleEdit(framed)
    expect(editing(framed)).toBe(true)
  })

  it('is not left by Escape, Enter or choosing a tool, and the tools draw inside the Frame with edit on', async () => {
    const wrapper = await mountOpen(framedProject())
    await key({ key: 'Escape' })
    await surface(wrapper).trigger('keydown', { key: 'Enter' })
    await pickTool(wrapper, 'fill')
    expect(editing(wrapper)).toBe(true)

    await pickTool(wrapper, 'paint')
    await pressBead(wrapper, { row: 2, column: 4 })
    await surface(wrapper).trigger('pointerup')
    await flushPromises()
    expect(beadColor(wrapper, { row: 2, column: 4 })).not.toBeNull()
  })

  it('works from the keyboard on the Move handle: arrows move the Frame and Shift resizes it', async () => {
    const wrapper = await mountOpen(framedProject())
    const handle = wrapper.get('[data-testid="frame-move-handle"]')

    await handle.trigger('keydown', { key: 'ArrowRight' })
    expect(savedFrame()).toEqual({ row: 2, column: 4, rows: 2, columns: 3 })
    await handle.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    await handle.trigger('keydown', { key: 'ArrowDown' })
    expect(savedFrame()).toEqual({ row: 3, column: 4, rows: 2, columns: 4 })
  })

  it('drags the Frame from the Move handle\'s button, which hands its press to the canvas (ticket 455)', async () => {
    const wrapper = await mountOpen(framedProject())
    await wrapper.get('[data-testid="frame-move-handle"]').trigger('pointerdown', { button: 0, buttons: 1, isPrimary: true, pointerId: 1 })
    await hoverBead(wrapper, { row: 2, column: 4 }, { buttons: 1 })
    await surface(wrapper).trigger('pointerup')
    await flushPromises()
    expect(savedFrame()).not.toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
  })

  it('carries the Frame\'s beads when it is moved, in one Undo step (ticket 452)', async () => {
    const wrapper = await mountOpen(framedProject())
    await wrapper.get('[data-testid="frame-move-handle"]').trigger('keydown', { key: 'ArrowRight' })
    expect(beadColor(wrapper, { row: 2, column: 3 })).toBeNull()
    expect(beadColor(wrapper, { row: 2, column: 4 })).toBe(RED)

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(beadColor(wrapper, { row: 2, column: 3 })).toBe(RED)
  })

  it('has a mini − and + on each edge: a press moves that edge one bead and is one Undo step', async () => {
    const wrapper = await mountOpen(framedProject())
    const press = async (edge: string, direction: 'out' | 'in') => {
      await wrapper.get(`[data-testid="frame-edge-${edge}-${direction}"]`).trigger('click')
      await flushPromises()
    }

    await press('right', 'out')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 4 })
    await press('left', 'out')
    expect(savedFrame()).toEqual({ row: 2, column: 2, rows: 2, columns: 5 })
    await press('top', 'in')
    expect(savedFrame()).toEqual({ row: 3, column: 2, rows: 1, columns: 5 })

    // At one row the top and bottom are as far in as they go: the press is no step.
    await press('bottom', 'in')
    expect(savedFrame()).toEqual({ row: 3, column: 2, rows: 1, columns: 5 })

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 2, rows: 2, columns: 5 })
    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 4 })
  })

  it('goes with the Frame when Remove Frame takes it away, and is on again for a Frame brought back by Undo', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-edit-toggle"]').exists()).toBe(false)

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(editing(wrapper)).toBe(true)
  })

  it('is disabled once Row progress has started, and the Move handle still moves the Frame (ticket 452)', async () => {
    const wrapper = await mountOpen({ ...framedProject(), rowProgress: { direction: 'rows', currentRow: 1, currentColumn: 0 } })
    expect(editing(wrapper)).toBe(false)
    expect(wrapper.get('[data-testid="frame-edit-toggle"]').attributes('aria-disabled')).toBe('true')
    await toggleEdit(wrapper)
    expect(editing(wrapper)).toBe(false)

    await wrapper.get('[data-testid="frame-move-handle"]').trigger('keydown', { key: 'ArrowRight' })
    expect(savedFrame()).toEqual({ row: 2, column: 4, rows: 2, columns: 3 })
    expect(loadProjects()[0]!.rowProgress.currentRow).toBe(1)
  })
})

describe('Fit and Remove frame, on the Progress bar and not in Project (ticket 443)', () => {
  it('fits to the drawing and removes the Frame, each as an Undo step', async () => {
    const wrapper = await mountOpen()

    await wrapper.get('[data-testid="progress-bar-fit-frame"]').trigger('click')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(savedFrame()).toBeUndefined()

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(beadColor(wrapper, { row: 3, column: 5 })).toBe(RED)
  })

  it('has no Edit, Fit or Remove in Project, and no size steppers, unit switch or side choice', async () => {
    const wrapper = await mountOpen(framedProject())
    await openSheet(wrapper, 'strip-project')
    for (const gone of ['frame-edit', 'frame-fit', 'frame-remove', 'frame-columns', 'frame-rows', 'frame-unit', 'frame-width-side', 'frame-height-side']) {
      expect(wrapper.find(`[data-testid="${gone}"]`).exists()).toBe(false)
    }
  })
})

describe('Rotate, Export and Row progress on the Frame', () => {
  const framed = (): Project => ({
    ...unframedProject(),
    frame: { row: 2, column: 3, rows: 2, columns: 3 },
  })

  it('turns the Selection and not the Frame, and one Undo turns it back (ticket 416)', async () => {
    const wrapper = await mountOpen({ ...framed(), frame: { row: 0, column: 0, rows: 8, columns: 8 } })
    await pickTool(wrapper, 'select')
    await pressBead(wrapper, { row: 2, column: 3 }) // drag out the box round the beads (Select all would take the Frame's inside, ticket 428)
    await hoverBead(wrapper, { row: 3, column: 5 }, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
    await rotate(wrapper)
    await flushPromises()

    // The 2 x 3 box round the beads becomes 3 x 2, and the Frame is as it was.
    expect(savedFrame()).toEqual({ row: 0, column: 0, rows: 8, columns: 8 })
    expect(beadColor(wrapper, { row: 3, column: 5 })).toBeNull()
    expect(beadColor(wrapper, { row: 4, column: 4 })).toBe(RED)
    await key({ key: 'z', ctrlKey: true })
    expect(beadColor(wrapper, { row: 3, column: 5 })).toBe(RED)
    expect(beadColor(wrapper, { row: 4, column: 4 })).toBeNull()
  })

  it('opens "Set Frame to export" with no Frame, and Fit to drawing there sets one', async () => {
    const wrapper = await mountOpen()
    await openSheet(wrapper, 'strip-project')
    await wrapper.find('[data-testid="export-png-needs-frame"]').trigger('click')
    expect(wrapper.find('[data-testid="export-needs-frame"]').text()).toContain(en.frame.exportPromptTitle)

    await wrapper.find('[data-testid="export-fit-frame"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
  })

  it('has Fit to drawing in the Progress bar with no Frame, and Beads needed asks for one', async () => {
    const wrapper = await mountOpen()
    expect(wrapper.find('[data-testid="progress-bar-needs-frame"]').text()).toContain(en.frame.progressSelectToSet)
    await openSheet(wrapper, 'strip-project')
    expect(wrapper.find('[data-testid="quantities-needs-frame"]').text()).toBe(en.frame.countNeedsFrame)

    await closeSheet(wrapper)
    await wrapper.find('[data-testid="progress-bar-fit-frame"]').trigger('click')
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
  })
})

describe('Row progress follows the Frame (tickets 411, 426)', () => {
  const savedProgress = () => loadProjects()[0]!.rowProgress

  it('turns on with the first Frame, the pointer at the first pass, and one Undo takes both back', async () => {
    const wrapper = await mountOpen()
    expect(savedFrame()).toBeUndefined()
    expect(savedProgress()).not.toHaveProperty('enabled')

    await wrapper.find('[data-testid="progress-bar-fit-frame"]').trigger('click')

    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(savedProgress()).toMatchObject({ currentRow: 0, currentColumn: 0 })
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(true)

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toBeUndefined()
    expect(savedProgress()).not.toHaveProperty('enabled')
  })

  it('opens with Row progress on for a saved Frame, whatever an older file stored', async () => {
    const framed = { ...unframedProject(), frame: { row: 2, column: 3, rows: 2, columns: 3 } }
    saveProjects([{ ...framed, rowProgress: { ...framed.rowProgress, enabled: false } as Project['rowProgress'] }])
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.find('[data-testid="progress-bar-switch"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(true)
  })

  it('asks before removing the Frame even while no pass is done, and one Undo brings it back (ticket 455)', async () => {
    const wrapper = await mountOpen({ ...unframedProject(), frame: { row: 2, column: 3, rows: 2, columns: 3 } })

    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    expect(wrapper.find('[data-testid="remove-frame-modal"]').exists()).toBe(true)
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-fit-frame"]').exists()).toBe(true)

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(wrapper.find('[data-testid="progress-bar-fit-frame"]').exists()).toBe(false)
  })

  it('asks before Reset progress, then takes the rows back to the first, keeping the Frame (ticket 455)', async () => {
    const wrapper = await mountOpen({ ...unframedProject(), frame: { row: 2, column: 3, rows: 2, columns: 3 } })
    await wrapper.get('[data-testid="progress-bar-next"]').trigger('click')
    expect(savedProgress().currentRow).toBe(1)

    await wrapper.get('[data-testid="progress-bar-reset"]').trigger('click')
    expect(wrapper.find('[data-testid="reset-progress-modal"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(savedProgress().currentRow).toBe(1)

    await wrapper.get('[data-testid="progress-bar-reset"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(savedProgress()).toMatchObject({ currentRow: 0, currentColumn: 0 })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(wrapper.get('[data-testid="progress-bar-reset"]').attributes('aria-disabled')).toBe('true')
  })

  it('asks before Remove frame throws away a done pass; one Undo brings the Frame and the progress back', async () => {
    const wrapper = await mountOpen({ ...unframedProject(), frame: { row: 2, column: 3, rows: 2, columns: 3 } })
    await wrapper.get('[data-testid="progress-bar-next"]').trigger('click')
    expect(savedProgress().currentRow).toBe(1)

    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    expect(wrapper.find('[data-testid="remove-frame-modal"]').exists()).toBe(true)
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="remove-frame-modal"]').exists()).toBe(false)
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toBeUndefined()
    expect(savedProgress()).toMatchObject({ currentRow: 0 })

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(savedProgress()).toMatchObject({ currentRow: 1 })
  })

  it('offers Rotate only until a pass is done: Row done hides it, Remove frame brings it back (tickets 411, 416, 426)', async () => {
    const wrapper = await mountOpen({ ...unframedProject(), frame: { row: 0, column: 0, rows: 8, columns: 8 } })
    await selectAll(wrapper)
    expect(wrapper.find('[data-testid="context-bar-rotate"]').exists()).toBe(true)

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    expect(wrapper.find('[data-testid="context-bar-rotate"]').exists()).toBe(false)

    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    await selectAll(wrapper)
    expect(wrapper.find('[data-testid="context-bar-rotate"]').exists()).toBe(true)
  })

  it('says the new direction in a toast when D turns it, once per press', async () => {
    const wrapper = await mountOpen({ ...unframedProject(), frame: { row: 2, column: 3, rows: 2, columns: 3 } })

    await key({ key: 'd' })
    expect(wrapper.text()).toContain(en.rowProgress.directionToastColumns)
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe(en.rowProgress.columnNextButton)

    await key({ key: 'd' })
    expect(wrapper.text()).toContain(en.rowProgress.directionToastRows)
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe(en.rowProgress.nextButton)
  })
})

describe('New Project with the Frame optional', () => {
  it('creates a Canvas from the empty form, and lists it in the library', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()
    await openNewProject(wrapper)
    await wrapper.find('form.new-project-form').trigger('submit')
    await flushPromises()

    expect(savedFrame()).toBeUndefined()
    expect(loadProjects()).toHaveLength(1)
    await openSavedProjects(wrapper)
    expect(wrapper.findAll('[data-testid="project-item"]')).toHaveLength(1)
  })
})
