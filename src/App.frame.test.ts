import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { withColors } from './domain/canvas'
import { changeFrame } from './domain/changeFrame'
import { createProject, type Project } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { beadColor, hoverBead, pressBead } from './testUtils/beads'
import { pressBar, closeSheet, openNewProject, openSavedProjects, openSheet, pickTool, rotate, selectAll } from './testUtils/pill'

/** Edit Frame (tickets 233, 417, ADRs 0026, 0046, 0054) as the app shows it: moving and resizing the Frame, its edge steppers, the Project sheet's Frame controls and the keys. */

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

/** The edit pencil above the Frame's top-right corner (tickets 452, 473). */
async function toggleEdit(wrapper: Awaited<ReturnType<typeof mountOpen>>) {
  await wrapper.get('[data-testid="frame-edit-toggle"]').trigger('click')
  await flushPromises()
}

/** The Frame button in the Canvas strip: opens the Frame bar, which is no part of the pencil (ticket 510). */
async function toggleBar(wrapper: Awaited<ReturnType<typeof mountOpen>>) {
  await wrapper.get('[data-testid="strip-frame"]').trigger('click')
  await flushPromises()
}

const surface = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.find('[data-testid="project-surface"]')
/** The rectangle of the saved Frame, its beads aside. */
const savedFrame = () => {
  const frame = loadProjects()[0]!.frame
  if (!frame) return undefined
  const { beads: _beads, name: _name, technique: _technique, ...rectangle } = frame
  return rectangle
}
const savedFrameBeads = () => loadProjects()[0]!.frame?.beads

/** The sketch with a Frame made round the beads in `rectangle`: they are the Frame's own (Frame from Selection). */
const framedAround = (rectangle: { row: number; column: number; rows: number; columns: number }): Project => {
  const made = changeFrame(unframedProject(), { make: rectangle })
  if (made.kind !== 'changed') throw new Error('expected a Frame')
  return made.project
}
const framedProject = (): Project => framedAround({ row: 2, column: 3, rows: 2, columns: 3 })
/** A Frame big enough to step every edge in and out (ticket 473). */
const bigFramedProject = (): Project => framedAround({ row: 1, column: 2, rows: 5, columns: 5 })
/** Whether the Frame bar is up (ticket 473). */
const editing = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.find('[data-testid="frame-bar"]').exists()

describe('Edit Frame', () => {
  it('is a toggle on the Frame, closed by default, and only with a Frame; the Progress bar and Project have no Edit Frame button (tickets 443, 473)', async () => {
    const wrapper = await mountOpen()
    expect(wrapper.find('[data-testid="frame-edit-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-edit-frame"]').exists()).toBe(false)
    await openSheet(wrapper, 'strip-project')
    expect(wrapper.find('[data-testid="frame-edit"]').exists()).toBe(false)
    await closeSheet(wrapper)

    expect(wrapper.find('[data-testid="strip-frame"]').exists()).toBe(false)

    const framed = await mountOpen(framedProject())
    expect(framed.get('[data-testid="frame-edit-toggle"]').attributes('aria-pressed')).toBe('false')
    await toggleEdit(framed)
    expect(framed.get('[data-testid="frame-edit-toggle"]').attributes('aria-pressed')).toBe('true')
    expect(editing(framed)).toBe(false)
    await toggleEdit(framed)
    expect(framed.get('[data-testid="frame-edit-toggle"]').attributes('aria-pressed')).toBe('false')
  })

  it('opens and closes the bar from the Frame button in the Canvas strip, apart from the pencil (tickets 473, 510)', async () => {
    const wrapper = await mountOpen(framedProject())
    const button = () => wrapper.get('[data-testid="strip-frame"]')
    expect(button().text()).toBe('Frame')
    expect(button().attributes('aria-pressed')).toBe('false')
    await button().trigger('click')
    await flushPromises()
    expect(editing(wrapper)).toBe(true)
    expect(button().attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="frame-edit-toggle"]').attributes('aria-pressed')).toBe('false')
    await button().trigger('click')
    await flushPromises()
    expect(editing(wrapper)).toBe(false)
    expect(button().attributes('aria-pressed')).toBe('false')
  })

  it('resizes to a typed size, growing both sides evenly, as one Undo step (ticket 473)', async () => {
    const wrapper = await mountOpen(bigFramedProject())
    await toggleBar(wrapper)
    await wrapper.get('[data-testid="frame-bar-width"]').setValue('9')
    const field = wrapper.get('[data-testid="frame-bar-height"]')
    await field.setValue('7')
    await field.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(savedFrame()).toEqual({ row: 0, column: 0, rows: 7, columns: 9 })
    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 1, column: 2, rows: 5, columns: 5 })
  })

  it('does not open the bar when a Frame is set from a Selection (ticket 473)', async () => {
    const wrapper = await mountOpen()
    await selectAll(wrapper)
    await pressBar(wrapper, 'frame')
    await flushPromises()
    expect(savedFrame()).toBeDefined()
    expect(editing(wrapper)).toBe(false)
  })

  it('closes like Menu and Project: Escape, or a press on the canvas that only closes it, and the next one draws (ticket 475)', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleBar(wrapper)
    await key({ key: 'Escape' })
    expect(editing(wrapper)).toBe(false)

    await toggleBar(wrapper)
    await pickTool(wrapper, 'paint')
    expect(editing(wrapper)).toBe(true)
    await pressBead(wrapper, { row: 2, column: 4 })
    await surface(wrapper).trigger('pointerup')
    await flushPromises()
    expect(editing(wrapper)).toBe(false)
    expect(beadColor(wrapper, { row: 2, column: 4 })).toBeNull()

    await pressBead(wrapper, { row: 2, column: 4 })
    await surface(wrapper).trigger('pointerup')
    await flushPromises()
    expect(beadColor(wrapper, { row: 2, column: 4 })).not.toBeNull()
  })

  it('is the Top sheet under 1024px, like Menu and Project, and the pencil does not open it (tickets 475, 510)', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleEdit(wrapper)
    expect(editing(wrapper)).toBe(false)
    await toggleBar(wrapper)
    expect(wrapper.find('[data-testid="top-sheet"] [data-testid="frame-bar"]').exists()).toBe(true)
  })

  it('is one panel at a time with Menu and Project (ticket 475)', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleBar(wrapper)
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await flushPromises()
    expect(editing(wrapper)).toBe(false)
    expect(wrapper.find('[data-testid="panel-dropdown"], [data-testid="top-sheet"]').exists()).toBe(true)
    await wrapper.get('[data-testid="strip-frame"]').trigger('click')
    await flushPromises()
    expect(editing(wrapper)).toBe(true)
    expect(wrapper.findAll('[data-testid="panel-dropdown"], [data-testid="top-sheet"]')).toHaveLength(1)
  })

  it('works from the keyboard on the Move handle: arrows move the Frame and Shift resizes it', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleEdit(wrapper)
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

  it('has a − and + on each edge of the bar: a press moves that edge one bead and is one Undo step, to a least of four beads (ticket 473)', async () => {
    const wrapper = await mountOpen(bigFramedProject())
    await toggleBar(wrapper)
    const press = async (edge: string, direction: 'out' | 'in') => {
      await wrapper.get(`[data-testid="frame-edge-${edge}-${direction}"]`).trigger('click')
      await flushPromises()
    }

    await press('right', 'out')
    expect(savedFrame()).toEqual({ row: 1, column: 2, rows: 5, columns: 6 })
    await press('left', 'out')
    expect(savedFrame()).toEqual({ row: 1, column: 1, rows: 5, columns: 7 })
    await press('top', 'in')
    expect(savedFrame()).toEqual({ row: 2, column: 1, rows: 4, columns: 7 })

    // At four rows the top and bottom are as far in as they go: the button is disabled and the press is no step.
    expect(wrapper.get('[data-testid="frame-edge-bottom-in"]').attributes('aria-disabled')).toBe('true')
    await press('bottom', 'in')
    expect(savedFrame()).toEqual({ row: 2, column: 1, rows: 4, columns: 7 })

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 1, column: 1, rows: 5, columns: 7 })
    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 1, column: 2, rows: 5, columns: 6 })
  })

  it('goes with the Frame when Remove Frame takes it away, and is closed again for a Frame brought back by Undo', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-edit-toggle"]').exists()).toBe(false)

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(editing(wrapper)).toBe(false)
  })

  it('opens once Row progress has started with the size, Remove and the disabled edge steppers, and the Move handle still moves the Frame (tickets 452, 473, 475)', async () => {
    const wrapper = await mountOpen({ ...framedProject(), rowProgress: { direction: 'rows', currentRow: 1, currentColumn: 0 } })
    expect(editing(wrapper)).toBe(false)
    expect(wrapper.get('[data-testid="strip-frame"]').attributes('aria-disabled')).toBeUndefined()
    await toggleBar(wrapper)
    expect([wrapper.get('[data-testid="frame-bar-width"]').attributes('placeholder'), wrapper.get('[data-testid="frame-bar-height"]').attributes('placeholder')]).toEqual(['3', '2'])
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="frame-rotate"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="frame-edge-top-out"]').attributes('aria-disabled')).toBe('true')
    await toggleBar(wrapper)
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

    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
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
  it('turns the Selection and not the Frame, and one Undo turns it back (ticket 416)', async () => {
    const wrapper = await mountOpen(framedAround({ row: 0, column: 0, rows: 8, columns: 8 }))
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

  it('turns the Frame and its beads from the Frame row, leaving Edit as it was, and one Undo turns it back (ticket 471)', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleBar(wrapper)
    const wasEditing = editing(wrapper)
    await wrapper.get('[data-testid="frame-rotate"]').trigger('click')
    await flushPromises()

    // The 2 x 3 Frame at (2, 3) becomes 3 x 2 about the middle of it.
    expect(savedFrame()).toEqual({ row: 2, column: 4, rows: 3, columns: 2 })
    expect(beadColor(wrapper, { row: 2, column: 3 })).toBeNull()
    expect(editing(wrapper)).toBe(wasEditing)

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(beadColor(wrapper, { row: 2, column: 3 })).toBe(RED)
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
    const framed = { ...unframedProject(), frame: { technique: 'loom' as const, row: 2, column: 3, rows: 2, columns: 3, beads: {} } }
    saveProjects([{ ...framed, rowProgress: { ...framed.rowProgress, enabled: false } as Project['rowProgress'] }])
    const wrapper = mount(App, { attachTo: document.body })
    await flushPromises()

    expect(wrapper.find('[data-testid="progress-bar-switch"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-next"]').exists()).toBe(true)
  })

  it('removes the Frame at once while no pass is done, and one Undo brings it back (ticket 497)', async () => {
    const wrapper = await mountOpen({ ...unframedProject(), frame: { technique: 'loom' as const, row: 2, column: 3, rows: 2, columns: 3, beads: {} } })

    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="remove-frame-modal"]').exists()).toBe(false)
    expect(savedFrame()).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-chrome-remove"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="progress-bar-fit-frame"]').exists()).toBe(true)

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(wrapper.find('[data-testid="progress-bar-fit-frame"]').exists()).toBe(false)
  })

  it('asks before Reset progress, then takes the rows back to the first, keeping the Frame (ticket 455)', async () => {
    const wrapper = await mountOpen({ ...unframedProject(), frame: { technique: 'loom' as const, row: 2, column: 3, rows: 2, columns: 3, beads: {} } })
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
    const wrapper = await mountOpen({ ...unframedProject(), frame: { technique: 'loom' as const, row: 2, column: 3, rows: 2, columns: 3, beads: {} } })
    await wrapper.get('[data-testid="progress-bar-next"]').trigger('click')
    expect(savedProgress().currentRow).toBe(1)

    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    expect(wrapper.find('[data-testid="remove-frame-modal"]').exists()).toBe(true)
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="remove-frame-modal"]').exists()).toBe(false)
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    // The dialog took focus, so the bar closed, as Menu and Project do (ticket 475).
    await toggleEdit(wrapper)
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
    const wrapper = await mountOpen({ ...unframedProject(), frame: { technique: 'loom' as const, row: 20, column: 20, rows: 8, columns: 8, beads: {} } })
    await selectAll(wrapper)
    expect(wrapper.find('[data-testid="context-bar-rotate"]').exists()).toBe(true)

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    expect(wrapper.find('[data-testid="context-bar-rotate"]').exists()).toBe(false)

    // A Selection carries no Frame bar, so it goes first.
    await key({ key: 'Escape' })
    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    await selectAll(wrapper)
    expect(wrapper.find('[data-testid="context-bar-rotate"]').exists()).toBe(true)
  })

  it('says the new direction in a toast when D turns it, once per press', async () => {
    const wrapper = await mountOpen({ ...unframedProject(), frame: { technique: 'loom' as const, row: 2, column: 3, rows: 2, columns: 3, beads: {} } })

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

describe('The Frame is its own sheet of beads (ADR 0066)', () => {
  /** A 3 x 3 Frame at (20, 20), well clear of a Canvas sketch with a bead at (20, 40) and one at (2, 2). */
  const sheet = (): Project => {
    const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Sheet', size: { width: 3, height: 3, unit: 'beads' } })
    return { ...base, frame: { ...base.frame!, row: 20, column: 20 }, beads: withColors({}, [{ row: 20, column: 40, color: RED }, { row: 2, column: 2, color: RED }]) }
  }

  it('drops the Frame\'s beads onto the Canvas, clearing what lay under it, with no confirmation; one Undo brings back the Frame and the cleared beads', async () => {
    const project = sheet()
    const wrapper = await mountOpen({ ...project, beads: { ...project.beads, 21: { 21: RED } }, frame: { ...project.frame!, beads: { 0: { 0: RED } } } })
    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="remove-frame-modal"]').exists()).toBe(false)
    expect(savedFrame()).toBeUndefined()
    expect(loadProjects()[0]!.beads).toEqual({ ...sheet().beads, 20: { 20: RED, 40: RED } })
    expect(beadColor(wrapper, { row: 20, column: 20 })).toBe(RED)
    expect(beadColor(wrapper, { row: 21, column: 21 })).toBeNull()

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 20, column: 20, rows: 3, columns: 3 })
    expect(savedFrameBeads()).toEqual({ 0: { 0: RED } })
    expect(loadProjects()[0]!.beads[21]?.[21]).toBe(RED)
  })
})
