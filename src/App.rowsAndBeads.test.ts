import { beforeEach, describe, expect, it } from 'vitest'
import { settleImport } from './testUtils/settleImport'
import { gzipJson } from './testUtils/gzipJson'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { pressBead, rowProgressView } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { createProject, type Project, frameGrid } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { serializeLibrary } from './domain/projectFile'
import { mountWithProject } from './testUtils/seedProject'
import { chooseAppLanguage, deleteAll, openColorPopover, openSavedProjects, openSheet, pickColor, sheetRead } from './testUtils/pill'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

/** Picks a Bead from the Project sheet's Replace bead menu, which opens the sheet for it and leaves it open. */
async function pickReplacement(wrapper: ReturnType<typeof mount>, beadId: string) {
  await openSheet(wrapper, 'strip-project')
  await wrapper.get('[data-testid="phone-replace-bead-select"]').trigger('click')
  await wrapper.get(`[data-testid="phone-replace-bead-${beadId}"]`).trigger('click')
}

describe('App row progress', () => {
  it('shows the overlay as soon as the Project has a Frame, without leaving the editor (ticket 426)', async () => {
    const wrapper = await mountWithProject(15, 30)

    expect(rowProgressView(wrapper).markerShown).toBe(true)
    await openColorPopover(wrapper)
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)
  })

  it('advances the pointer as rows are finished, dimming the rows behind it', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)
    // Two rows are behind the pointer and dimmed, and the third is the one outlined.
    expect(rowProgressView(wrapper)).toMatchObject({ direction: 'rows', finished: 2, current: 2 })
  })

  describe('row direction', () => {
    function position(wrapper: ReturnType<typeof mount>) {
      return wrapper.find('[data-testid="progress-bar-position"]').text()
    }

    it('turns rows to run down the columns: the readout counts columns and the steps move through them', async () => {
      const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows

      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')

      expect(wrapper.find('[data-testid="progress-bar-direction"]').attributes('aria-checked')).toBe('true')
      expect(position(wrapper)).toMatch(/\b1\D+10\b/)

      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      expect(position(wrapper)).toMatch(/\b3\D+10\b/)
      // Rows run down the columns: the first two columns are behind the pointer and dimmed, the third is outlined.
      expect(rowProgressView(wrapper)).toMatchObject({ direction: 'columns', finished: 2, current: 2 })
    })
  })
})

describe('App finished rows', () => {
  /** Opens a 10-column x 20-row Project with Row progress on and rows 1-2 marked done, red selected; returns its cells. */
  async function withTwoRowsWoven(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await pickColor(wrapper, 'red')
  }

  function colorAt(row: number, column: number) {
    return frameGrid(loadProjects()[0]!)[row]![column]!.color
  }

  function undoDisabled(wrapper: ReturnType<typeof mount>) {
    return wrapper.find<HTMLButtonElement>('[data-testid="strip-undo"]').attributes('aria-disabled') === 'true'
  }

  it('will not paint a bead in a finished row, and records no undo step for trying', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)

    await pressBead(wrapper, 14) // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(undoDisabled(wrapper)).toBe(true)
  })

  it('keeps the finished-row lock while Row highlight is off (ticket 474)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)
    await wrapper.get('[data-testid="progress-bar-highlight"]').trigger('click')
    expect(localStorage.getItem('openbeads:row-highlight')).toBe('off')

    await pressBead(wrapper, 14) // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(undoDisabled(wrapper)).toBe(true)
    expect(wrapper.get('[data-testid="progress-bar-highlight"]').attributes('aria-checked')).toBe('false')
  })

  it('keeps Row highlight off across a reload, in the device and not in the Project (ticket 474)', async () => {
    localStorage.setItem('openbeads:row-highlight', 'off')
    const wrapper = await mountWithProject(15, 30)

    expect(wrapper.get('[data-testid="progress-bar-highlight"]').attributes('aria-checked')).toBe('false')
    expect(JSON.stringify(loadProjects())).not.toContain('highlight')
  })

  it('still undoes in full, even a change to a row marked done since', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 4) // (0,4)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="strip-undo"]').trigger('click')

    expect(colorAt(0, 4)).toBeNull()
  })
})

describe('App delete all', () => {
  /** Presses and releases one cell without moving — a click. */
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  function loadedProject() {
    return loadProjects()[0]!
  }

  it('opens a confirmation modal instead of clearing immediately', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, 'red')
    await click(wrapper, 0)

    await deleteAll(wrapper)

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    expect(frameGrid(loadedProject())[0]![0]!.color).toBe('#e63746')
  })

  it('empties every cell and keeps Row progress on with both direction pointers back at the first row, once confirmed', async () => {
    const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows
    await pickColor(wrapper, 'red')
    await click(wrapper, 0)
    await click(wrapper, 25)
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await deleteAll(wrapper)
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(frameGrid(loadedProject()).flat().every((cell) => cell.color === null)).toBe(true)
    expect(loadedProject().rowProgress).toEqual({
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
  })

  it('is one undo step: a single Undo restores both the painted grid and Row progress together, including woven rows', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, 'red')
    await click(wrapper, 4) // (0,4)
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // rows 0-1 finished

    await deleteAll(wrapper)
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="strip-undo"]').attributes('aria-disabled') === 'true').toBe(false)

    await wrapper.find('[data-testid="strip-undo"]').trigger('click')

    expect(frameGrid(loadedProject())[0]![4]!.color).toBe('#e63746')
    expect(loadedProject().rowProgress).toEqual({
      direction: 'rows',
      currentRow: 2,
      currentColumn: 0,
    })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)
  })
})

describe('App header bead', () => {
  it("shows the open Project's Bead label in the header", async () => {
    const wrapper = await mountWithProject(15, 30)

    expect((await sheetRead(wrapper, 'phone-sheet-bead')).text).toBe('TOHO Cube 1.5mm')
  })
})

describe('App replace bead', () => {
  it('is picked from an app-drawn menu, not a native select, whose picker swallowed the pick on an iPad mini (ticket 442)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await openSheet(wrapper, 'strip-project')

    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.get('[data-testid="phone-replace-bead-select"]').element.tagName).toBe('BUTTON')
  })

  it('opens the confirmation with Cancel focused first from the Project sheet', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickReplacement(wrapper, 'toho-round-11-0')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirm-modal-cancel"]').attributes()).toHaveProperty('data-autofocus')
  })

  function loadedProject() {
    return loadProjects()[0]!
  }

  it('opens a confirmation modal showing the new Estimated size next to the current one instead of replacing immediately', async () => {
    const wrapper = await mountWithProject(15, 30) // 10x20 at Cube: about 1.5 x 3.0 cm

    await chooseAppLanguage(wrapper, 'en')
    await pickReplacement(wrapper, 'toho-round-11-0')

    const modal = wrapper.find('[data-testid="replace-bead-modal"]')
    expect(modal.exists()).toBe(true)
    // The same 10x20 grid at Round (1.65 x 2.2mm): 16.5 x 44mm.
    expect(modal.text()).toContain('With TOHO Round 11/0, this Project will be about 1.7 × 4.4 cm instead of 1.5 × 3.0 cm.')
    expect(modal.text()).toContain('Your design and its bead count stay exactly the same')
    expect(modal.text()).not.toContain('New size')
    expect(loadedProject().beadId).toBe('toho-cube-1.5mm')
  })

  it('reports the estimate the way the screen shows the Project, so a Project saved turned swaps width and height', async () => {
    const saved = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 15, height: 30, unit: 'mm' } })
    saveProjects([{ ...saved, rotation: 90 }])
    const wrapper = mount(App)
    await flushPromises()
    await chooseAppLanguage(wrapper, 'en')

    await pickReplacement(wrapper, 'toho-round-11-0')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').text()).toContain('about 4.4 × 1.7 cm instead of 3.0 × 1.5 cm')
  })

  it('switches the Bead once confirmed and leaves the grid exactly as it was', async () => {
    const wrapper = await mountWithProject(15, 30) // 10x20 at Cube

    await pickReplacement(wrapper, 'toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedProject().beadId).toBe('toho-round-11-0')
    expect(loadedProject().frame!.columns).toBe(10)
    expect(loadedProject().frame!.rows).toBe(20)
    expect(loadedProject()).not.toHaveProperty('widthMm')
    expect((await sheetRead(wrapper, 'phone-sheet-bead')).text).toBe('TOHO Round 11/0')
  })

  it('is one undo step: a single Undo restores the previous Bead, and Redo swaps it back', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup') // paint (0,0) red
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await pickReplacement(wrapper, 'toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="strip-undo"]').attributes('aria-disabled') === 'true').toBe(false)

    await wrapper.find('[data-testid="strip-undo"]').trigger('click')

    expect(loadedProject().beadId).toBe('toho-cube-1.5mm')
    expect(loadedProject().frame!.columns).toBe(10)
    expect(loadedProject().frame!.rows).toBe(20)
    expect(frameGrid(loadedProject())[0]![0]!.color).toBe('#e63746')
    expect(loadedProject().rowProgress).toEqual({
      direction: 'rows',
      currentRow: 1,
      currentColumn: 0,
    })

    await wrapper.find('[data-testid="strip-redo"]').trigger('click')

    expect(loadedProject().beadId).toBe('toho-round-11-0')
    expect(loadedProject().frame!.columns).toBe(10)
  })
})

describe('App bead quantities', () => {
  async function projectWithPaintedCells(wrapper: ReturnType<typeof mount>) {
    await pickColor(wrapper, 'red')
    // Each press is a click, so each is released: the bead counts follow a stroke a few times a second (ticket 106) and
    // settle when it ends, which is what a release does.
    await pressBead(wrapper, 0)
    await wrapper.trigger('pointerup')
    await pressBead(wrapper, 1)
    await wrapper.trigger('pointerup')
    await pickColor(wrapper, 'blue')
    await pressBead(wrapper, 2)
    await wrapper.trigger('pointerup')
  }

  it('totals the beads each color needs from the painted cells, with no bead picker in sight', async () => {
    const wrapper = await mountWithProject(15, 30)
    await projectWithPaintedCells(wrapper)

    expect((await sheetRead(wrapper, 'quantity-count-red')).text).toBe('2')
    expect((await sheetRead(wrapper, 'quantity-count-blue')).text).toBe('1')
    expect((await sheetRead(wrapper, 'bead-quantities')).exists).toBe(true)
    await openSheet(wrapper, 'strip-project')
    expect(wrapper.find('[data-testid="bead-quantities"] select').exists()).toBe(false)
  })
})

describe('App estimated weight (ticket 155)', () => {
  it('follows painting and erasing, and Replace bead', async () => {
    localStorage.setItem('openbeads:locale', 'en')
    const wrapper = await mountWithProject(15, 30)
    expect((await sheetRead(wrapper, 'quantities-weight-note')).exists).toBe(false)

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect((await sheetRead(wrapper, 'quantity-weight-red')).text).toBe('0.01 g')

    await pickReplacement(wrapper, 'toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect((await sheetRead(wrapper, 'quantity-weight-red')).text).toBe('< 0.01 g')
    expect((await sheetRead(wrapper, 'quantities-weight-note')).text).toContain('about 0.0091 g')

    await pressBead(wrapper, 0, { button: 2 })
    await wrapper.find('.app-shell').trigger('mouseup')
    expect((await sheetRead(wrapper, 'quantity-weight-red')).exists).toBe(false)
    expect((await sheetRead(wrapper, 'quantities-weight-note')).exists).toBe(false)
  })
})

describe('App project transfer', () => {
  function makeProject(name: string): Project {
    return createProject({
      name,
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
  }

  /** Picks the file in the import control the person has in reach: the project bar's with no Project open, Menu's otherwise. */
  async function importFile(wrapper: ReturnType<typeof mount>, contents: string) {
    if (!wrapper.find('[data-testid="phone-bar-import-file"]').exists()) {
      await openSheet(wrapper, 'strip-menu')
    }
    const input = wrapper.find<HTMLInputElement>('[data-testid="phone-bar-import-file"], [data-testid="menu-import-file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([await gzipJson(contents)], 'library.openbeads', { type: 'application/json' })],
    })
    await input.trigger('change')
    await settleImport()
  }

  it('takes in a library exported on another device and saves every Project in it', async () => {
    const wrapper = mount(App)
    const library = [makeProject('Fox'), makeProject('Owl')]

    await importFile(wrapper, serializeLibrary(library))

    expect(loadProjects().map((project) => project.name).sort()).toEqual(['Fox', 'Owl'])
    await openSavedProjects(wrapper)
    expect(wrapper.findAll('[data-testid="project-item"]')).toHaveLength(2)
  })

  it('imports into an empty library and opens what it brought in (ticket 117)', async () => {
    const wrapper = mount(App)

    await importFile(wrapper, serializeLibrary([makeProject('Fox')]))

    expect((await sheetRead(wrapper, 'project-name')).text).toContain('Fox')
    await openSavedProjects(wrapper)
    expect(wrapper.find('[data-testid="project-list-empty"]').exists()).toBe(false)
  })
})
