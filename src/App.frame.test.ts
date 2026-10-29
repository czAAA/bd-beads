import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { frameWeave } from './domain/layerWeave'
import { weaveSettings } from './domain/weave'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { withColors, type Rect } from './domain/canvas'
import { changeFrame } from './domain/changeFrame'
import { createProject } from './domain/createProject'
import type { Project } from './domain/project'
import { designSizes, STARTER_BEAD_ID, starterById, starterProject } from './domain/starters'
import { loadProjects, saveProjects } from './services/libraryStore'
import { hoverBead, pressBead } from './testUtils/beads'
import { pickColor, pressBar, selectAll } from './testUtils/pill'
import { frameOf } from './domain/layerRecord'
import { rowProgressOf } from './domain/rowProgress'
import { frameSheetOf, withLayers } from './testUtils/layerFields'

/** Edit Frame's wiring (tickets 233, 417, ADRs 0026, 0046, 0054): each control reaches the flow once. Its rules live in
 * `useFrameFlow`, `FramePanel` and `changeFrame`'s tests, one level each (ticket 0599, docs/testing.md). */

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
  return withLayers(base, {
frame: undefined,
    beads: withColors({}, [
      { row: 2, column: 3, color: RED },
      { row: 3, column: 3, color: RED },
      { row: 3, column: 5, color: RED },
    ]),
})
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

/** The Frame button in the Canvas strip: opens the Frame panel, which is no part of the pencil (ticket 510). */
async function toggleBar(wrapper: Awaited<ReturnType<typeof mountOpen>>) {
  await wrapper.get('[data-testid="strip-frame"]').trigger('click')
  await flushPromises()
}

const surface = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.find('[data-testid="project-surface"]')
/** The rectangle of the saved Frame, its beads aside. */
const savedFrame = () => {
  const [project] = loadProjects()
  const frame = project && frameSheetOf(project)
  if (!frame) return undefined
  const { beads: _beads, name: _name, technique: _technique, ...rectangle } = frame
  return rectangle
}

/** The sketch with a Frame made round the beads in `rectangle`: they are the Frame's own (Frame from Selection). */
const framedAround = (rectangle: Rect): Project => {
  const made = changeFrame(unframedProject(), { make: rectangle })
  if (made.kind !== 'changed') throw new Error('expected a Frame')
  return made.project
}
const framedProject = (): Project => framedAround({ row: 2, column: 3, rows: 2, columns: 3 })
/** A Frame big enough to step every edge in and out (ticket 473). */
const bigFramedProject = (): Project => framedAround({ row: 1, column: 2, rows: 5, columns: 5 })
/** Whether the Frame panel is up (ticket 473). */
const editing = (wrapper: Awaited<ReturnType<typeof mountOpen>>) => wrapper.find('[data-testid="frame-panel"]').exists()

describe('Edit Frame', () => {
  it('opens and closes from the Frame button in the Canvas strip, apart from the pencil; Escape or Menu closes it (tickets 473, 475, 510)', async () => {
    const wrapper = await mountOpen(framedProject())
    const button = () => wrapper.get('[data-testid="strip-frame"]')
    await toggleEdit(wrapper)
    expect(editing(wrapper)).toBe(false)
    await toggleBar(wrapper)
    expect(editing(wrapper)).toBe(true)
    expect(button().attributes('aria-pressed')).toBe('true')
    await toggleBar(wrapper)
    expect(editing(wrapper)).toBe(false)

    await toggleBar(wrapper)
    await key({ key: 'Escape' })
    expect(editing(wrapper)).toBe(false)
    await toggleBar(wrapper)
    await wrapper.get('[data-testid="strip-menu"]').trigger('click')
    await flushPromises()
    expect(editing(wrapper)).toBe(false)
  })

  it('carries each control of the panel to the Project as one Undo step: an edge, Rotate, a typed size and the name (tickets 471, 473, 555)', async () => {
    const wrapper = await mountOpen(bigFramedProject())
    await toggleBar(wrapper)
    await wrapper.get('[data-testid="frame-edge-right-out"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toEqual({ row: 1, column: 2, rows: 5, columns: 6 })
    await wrapper.get('[data-testid="frame-panel-width"]').setValue('9')
    const field = wrapper.get('[data-testid="frame-panel-height"]')
    await field.setValue('7')
    await field.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(savedFrame()).toMatchObject({ rows: 7, columns: 9 })
    await wrapper.get('[data-testid="frame-name-add"]').trigger('click')
    await wrapper.get('[data-testid="frame-name-input"]').setValue('Moth wing')
    await wrapper.get('[data-testid="frame-name-save"]').trigger('click')
    await flushPromises()
    expect(frameOf(loadProjects()[0])!.name).toBe('Moth wing')
    await wrapper.get('[data-testid="frame-rotate"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toMatchObject({ rows: 7, columns: 9, quarterTurns: 1 })

    for (let step = 0; step < 4; step++) await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 1, column: 2, rows: 5, columns: 5 })
    expect(frameOf(loadProjects()[0])!.name).toBeUndefined()
  })

  it('does not open the bar when a Frame is set from a Selection (ticket 473)', async () => {
    const wrapper = await mountOpen()
    await selectAll(wrapper)
    await pressBar(wrapper, 'frame')
    await flushPromises()
    expect(savedFrame()).toBeDefined()
    expect(editing(wrapper)).toBe(false)
  })

  it('moves the Frame from the Move handle, by its arrows (Shift resizes) and by a drag it hands to the canvas (tickets 452, 455)', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleEdit(wrapper)
    const handle = () => wrapper.get('[data-testid="frame-move-handle"]')
    await handle().trigger('keydown', { key: 'ArrowRight' })
    expect(savedFrame()).toEqual({ row: 2, column: 4, rows: 2, columns: 3 })
    await handle().trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    await handle().trigger('keydown', { key: 'ArrowDown' })
    expect(savedFrame()).toEqual({ row: 3, column: 4, rows: 2, columns: 4 })

    await handle().trigger('pointerdown', { button: 0, buttons: 1, isPrimary: true, pointerId: 1 })
    await hoverBead(wrapper, { row: 2, column: 4 }, { buttons: 1 })
    await surface(wrapper).trigger('pointerup')
    await flushPromises()
    expect(savedFrame()).not.toEqual({ row: 3, column: 4, rows: 2, columns: 4 })
  })

  it('removes the Frame on confirm and not on Cancel, goes with it, and is closed again for a Frame brought back by Undo', async () => {
    const wrapper = await mountOpen(framedProject())
    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-cancel"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="remove-frame-modal"]').exists()).toBe(false)
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })

    // The dialog took focus, so the handles closed, as Menu and Project do (ticket 475).
    await toggleEdit(wrapper)
    await wrapper.get('[data-testid="frame-chrome-remove"]').trigger('click')
    await wrapper.get('[data-testid="confirm-modal-confirm"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-edit-toggle"]').exists()).toBe(false)

    await key({ key: 'z', ctrlKey: true })
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(editing(wrapper)).toBe(false)
  })
})

describe('A Frame from the panel with no Frame', () => {
  it('fits one to the drawing from the panel, which then shows its size (ticket 555)', async () => {
    const wrapper = await mountOpen()
    await toggleBar(wrapper)
    await wrapper.get('[data-testid="frame-fit"]').trigger('click')
    await flushPromises()
    expect(savedFrame()).toEqual({ row: 2, column: 3, rows: 2, columns: 3 })
    expect(wrapper.find('[data-testid="frame-panel-width"]').exists()).toBe(true)
  })

  it('selects a frame from the panel: Select becomes the tool and the next drag becomes the Frame on release, Escape cancels (ticket 568)', async () => {
    const wrapper = await mountOpen()
    await toggleBar(wrapper)
    await wrapper.get('[data-testid="frame-select"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="frame-panel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="pill-tool-select"]').attributes('aria-pressed')).toBe('true')

    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    expect(savedFrame()).toBeUndefined()
    await wrapper.find('.app-shell').trigger('mouseup')
    await flushPromises()
    expect(savedFrame()).toMatchObject({ rows: 1, columns: 2 })

    await toggleBar(wrapper)
    await wrapper.get('[data-testid="frame-select"]').trigger('click')
    await key({ key: 'Escape' })
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    await flushPromises()
    expect(savedFrame()).toMatchObject({ rows: 1, columns: 2 })
  })

})

describe('Painting a Custom frame', () => {
  it('paints a bead whose place lies past the Frame\'s columns: the press stays on the Frame (ADR 0077)', async () => {
    const triangle = starterById('triangle')
    const wrapper = await mountOpen(starterProject(triangle, { name: 'Triangle', beadId: STARTER_BEAD_ID, sizes: designSizes(triangle), useDesign: false }))
    await pickColor(wrapper, 'red')
    const { row, column, columns } = frameOf(loadProjects()[0])!
    // Round 7 of a 10-round Triangle runs one place past the Frame's last column.
    const own = { row: 7, column: columns }

    await pressBead(wrapper, { row: row + own.row, column: column + own.column, layer: 'frame' })
    await wrapper.find('.app-shell').trigger('mouseup')
    await flushPromises()

    expect(frameOf(loadProjects()[0])!.beads[own.row]?.[own.column]).toBe(RED)
  })
})

describe('Row progress follows the Frame (tickets 411, 426, 443)', () => {
  const savedProgress = () => rowProgressOf(loadProjects()[0])

  it('turns on with the first Frame, fitted from the Progress bar, and one Undo takes both back', async () => {
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

  it('asks before Reset progress, then takes the rows back to the first, keeping the Frame (ticket 455)', async () => {
    const wrapper = await mountOpen(withLayers(unframedProject(), { frame: { technique: 'loom' as const, row: 2, column: 3, rows: 2, columns: 3, beads: {} } }))
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
})

describe('the margin sheet (ticket 0657, MarginSheet card)', () => {
  const sheetProject = () => (withLayers(unframedProject(), { frame: { technique: 'loom' as const, row: 2, column: 3, rows: 2, columns: 3, beads: {} } }))

  it('moves the one pointer from its Row done, which the Progress bar then shows', async () => {
    const wrapper = await mountOpen(sheetProject())
    await wrapper.get('[data-testid="margin-progress-next"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="progress-bar-compact-position"]').text()).toBe('2/2')
  })

  it('opens the Export panel from its Export button, hung from that button', async () => {
    const wrapper = await mountOpen(sheetProject())
    await wrapper.get('[data-testid="margin-export"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="export-panel"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="margin-export"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-testid="margin-export"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="export-panel"]').exists()).toBe(false)
  })

  it('sets the Frame\'s Drop from its title block\'s stepper (ticket 0698)', async () => {
    const wrapper = await mountOpen(withLayers(unframedProject(), { frame: { technique: 'brick' as const, row: 2, column: 3, rows: 2, columns: 3, beads: {} } }))
    await wrapper.get('[data-testid="margin-brick-drop-edit"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="margin-brick-drop-stepper-more"]').trigger('click')
    await flushPromises()
    expect(weaveSettings(frameWeave(loadProjects()[0]!))).toEqual({ brickDrop: 2 })
  })
})
