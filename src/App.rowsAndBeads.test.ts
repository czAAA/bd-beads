import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { hoverBead, pressBead, previewedBeads, rowProgressView } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { createProject, type Project, frameGrid } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { serializeLibrary } from './domain/projectFile'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { createProjectViaForm, mountWithProject } from './testUtils/seedProject'
import { chooseLanguage } from './testUtils/chooseLanguage'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

describe('App row progress', () => {
  it('shows the overlay only once it is toggled on, without leaving the editor', async () => {
    const wrapper = await mountWithProject(15, 30)

    expect(rowProgressView(wrapper).markerShown).toBe(false)

    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    expect(rowProgressView(wrapper).markerShown).toBe(true)
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)
  })

  it('advances the pointer as rows are finished, dimming the rows behind it', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)
    // Two rows are behind the pointer and dimmed, and the third is the one outlined.
    expect(rowProgressView(wrapper)).toMatchObject({ direction: 'rows', finished: 2, current: 2 })
  })

  it('moves the pointer back to an earlier row', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="progress-bar-previous"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b2\D+20\b/)
    expect(rowProgressView(wrapper)).toMatchObject({ finished: 1 })
  })

  it('will not step past either end of the Project', async () => {
    const wrapper = await mountWithProject(3, 3) // 2x2
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').attributes('aria-disabled'),
    ).toBe('true')

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').attributes('aria-disabled'),
    ).toBe('true')
  })

  it('remembers where the weaving got to across a reload', async () => {
    const first = await mountWithProject(15, 30)
    await first.find('[data-testid="progress-bar-switch"]').trigger('click')
    await first.find('[data-testid="progress-bar-next"]').trigger('click')
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b2\D+20\b/)
    expect(rowProgressView(afterReload)).toMatchObject({ finished: 1 })
    expect(loadProjects()[0]!.rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 1,
      currentColumn: 0,
    })
  })

  describe('row direction', () => {
    function position(wrapper: ReturnType<typeof mount>) {
      return wrapper.find('[data-testid="progress-bar-position"]').text()
    }

    it('turns rows to run down the columns: the readout counts columns and the steps move through them', async () => {
      const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows
      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')

      expect(wrapper.find('[data-testid="progress-bar-direction"]').attributes('aria-pressed')).toBe('true')
      expect(position(wrapper)).toMatch(/\b1\D+10\b/)

      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      expect(position(wrapper)).toMatch(/\b3\D+10\b/)
      // Rows run down the columns: the first two columns are behind the pointer and dimmed, the third is outlined.
      expect(rowProgressView(wrapper)).toMatchObject({ direction: 'columns', finished: 2, current: 2 })
    })

    it('will not step past the last column', async () => {
      const wrapper = await mountWithProject(4.5, 3) // 3 columns x 2 rows
      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')

      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      expect(position(wrapper)).toMatch(/\b3\D+3\b/)
      expect(
        wrapper.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').attributes('aria-disabled'),
      ).toBe('true')
    })

    it('returns to the row the weaver was on after flipping the direction and back', async () => {
      const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows
      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      expect(position(wrapper)).toMatch(/\b2\D+10\b/)

      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
      expect(position(wrapper)).toMatch(/\b3\D+20\b/)
    })

    it('remembers the direction and where the weaving got to across a reload', async () => {
      const first = await mountWithProject(15, 30)
      await first.find('[data-testid="progress-bar-switch"]').trigger('click')
      await first.find('[data-testid="progress-bar-direction"]').trigger('click')
      await first.find('[data-testid="progress-bar-next"]').trigger('click')
      first.unmount()

      const afterReload = mount(App)

      expect(afterReload.find('[data-testid="progress-bar-direction"]').attributes('aria-pressed')).toBe('true')
      expect(position(afterReload)).toMatch(/\b2\D+10\b/)
    })

    it('is its own toggle: it changes neither the beads nor the rotation, and flipping is not an undo step', async () => {
      const wrapper = await mountWithProject(15, 30)
      const gridBefore = frameGrid(loadProjects()[0]!)

      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')

      expect(loadProjects()[0]!.rotation).toBe(0)
      expect(frameGrid(loadProjects()[0]!)).toEqual(gridBefore)
      expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').attributes('aria-disabled') === 'true').toBe(true)
      expect(loadProjects()[0]!.rowProgress.direction).toBe('columns')
    })

    it('leaves redo untouched: Row direction and moving the Row progress pointer are not grid edits', async () => {
      const wrapper = await mountWithProject(15, 30)
      await wrapper.find('[data-color-id="red"]').trigger('click')
      await pressBead(wrapper, 0)
      await wrapper.trigger('mouseup')
      await wrapper.find('[data-testid="undo-button"]').trigger('click')
      expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').attributes('aria-disabled') === 'true').toBe(false)

      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').attributes('aria-disabled') === 'true').toBe(false)
      await wrapper.find('[data-testid="redo-button"]').trigger('click')
      expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    })
  })
})

describe('App finished rows', () => {
  /** Opens a 10-column x 20-row Project with Row progress on and rows 1-2 marked done, red selected; returns its cells. */
  async function withTwoRowsWoven(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
  }

  function colorAt(row: number, column: number) {
    return frameGrid(loadProjects()[0]!)[row]![column]!.color
  }

  function undoDisabled(wrapper: ReturnType<typeof mount>) {
    return wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').attributes('aria-disabled') === 'true'
  }

  function redoDisabled(wrapper: ReturnType<typeof mount>) {
    return wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').attributes('aria-disabled') === 'true'
  }

  it('will not paint a bead in a finished row, and records no undo step for trying', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)

    await pressBead(wrapper, 14) // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(undoDisabled(wrapper)).toBe(true)
  })

  it('an edit that lands only on a finished row changes nothing, so it leaves redo alone', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)
    await pressBead(wrapper, 24) // (2,4), the current row — a real edit
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(redoDisabled(wrapper)).toBe(false)

    await pressBead(wrapper, 14) // (1,4), a finished row — paints nothing
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(redoDisabled(wrapper)).toBe(false)
    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(colorAt(2, 4)).toBe('#e63746')
  })

  it('paints only the unfinished part of a drag that crosses into the current row', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)

    await pressBead(wrapper, 14) // (1,4)
    await hoverBead(wrapper, 24, { buttons: 1 }) // (2,4), the current row
    await hoverBead(wrapper, 34, { buttons: 1 }) // (3,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(colorAt(2, 4)).toBe('#e63746')
    expect(colorAt(3, 4)).toBe('#e63746')
  })

  it('will not right-click erase a bead in a finished row', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 4) // (0,4), painted before it was woven
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await pressBead(wrapper, 4, { button: 2 })
    await wrapper.trigger('mouseup')

    expect(colorAt(0, 4)).toBe('#e63746')
  })

  it('fills only the unfinished part of an area that reaches into finished rows', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await pressBead(wrapper, 55) // (5,5), in the one empty area covering the whole grid

    expect(colorAt(0, 0)).toBeNull()
    expect(colorAt(1, 9)).toBeNull()
    expect(colorAt(2, 0)).toBe('#e63746')
    expect(colorAt(19, 9)).toBe('#e63746')
  })

  it('stamps a pasted block only onto the unfinished beads it covers', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)
    await pressBead(wrapper, 50) // (5,0)
    await hoverBead(wrapper, 60, { buttons: 1 }) // (6,0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 50)
    await hoverBead(wrapper, 60, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await pressBead(wrapper, 10) // stamps onto (1,0) and (2,0)
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(colorAt(1, 0)).toBeNull()
    expect(colorAt(2, 0)).toBe('#e63746')
  })

  it('locks the finished columns instead once rows run down them', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await pressBead(wrapper, 0) // (0,0), a row that's finished no longer, in a column that now is
    await wrapper.trigger('mouseup')
    await pressBead(wrapper, 11) // (1,1), the current column
    await wrapper.trigger('mouseup')

    expect(colorAt(0, 0)).toBeNull()
    expect(colorAt(1, 1)).toBe('#e63746')
  })

  it('lets every bead be drawn on again once the overlay is off', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await pressBead(wrapper, 14) // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBe('#e63746')
  })

  it('previews no paint on a finished bead', async () => {
    const wrapper = await mountWithProject(15, 30)
    await withTwoRowsWoven(wrapper)

    await hoverBead(wrapper, 14) // (1,4)
    expect(previewedBeads(wrapper)).toHaveLength(0)
  })

  it('still undoes in full, even a change to a row marked done since', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 4) // (0,4)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(colorAt(0, 4)).toBeNull()
  })

  it('redoes in full too, even onto a row marked done since', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 4) // (0,4)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // row 0 now finished

    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    expect(colorAt(0, 4)).toBe('#e63746')
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
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    expect(frameGrid(loadedProject())[0]![0]!.color).toBe('#e63746')
  })

  it('leaves the Project untouched when Cancel is clicked, and closes the modal', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(frameGrid(loadedProject())[0]![0]!.color).toBe('#e63746')
  })

  it('leaves the Project untouched when Escape is pressed, and closes the modal without also backing out of Select', async () => {
    const wrapper = await mountWithProject(6, 6) // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0) // paint (0,0) red
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await click(wrapper, 0) // select (0,0)
    await wrapper.find('[data-testid="copy-button"]').trigger('click') // copiedBlock now holds the red cell

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(frameGrid(loadedProject())[0]![0]!.color).toBe('#e63746')

    // If Escape had also run backOutOfSelect, it would have dropped the copied block (cancelPaste), and this next
    // click would start a fresh Selection instead of stamping — leaving (1,1) uncolored.
    await click(wrapper, 5) // (1,1)
    expect(frameGrid(loadedProject())[1]![1]!.color).toBe('#e63746')
  })

  it('empties every cell and turns Row progress off with both direction pointers back at the first row, once confirmed', async () => {
    const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)
    await click(wrapper, 25)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(frameGrid(loadedProject()).flat().every((cell) => cell.color === null)).toBe(true)
    expect(loadedProject().rowProgress).toEqual({
      enabled: false,
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
  })

  it('keeps name, size, Technique, Bead and rotation unchanged', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)
    const before = loadedProject()

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    const after = loadedProject()
    expect(after.name).toBe(before.name)
    expect(after.technique).toBe(before.technique)
    expect(after.beadId).toBe(before.beadId)
    expect(after.frame!.columns).toBe(before.frame!.columns)
    expect(after.frame!.rows).toBe(before.frame!.rows)
    expect(after.rotation).toBe(before.rotation)
  })

  it('ignores the Row progress lock, clearing beads in finished rows along with the rest', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 4) // (0,4), painted before it's locked
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // row 0 now finished/locked

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(frameGrid(loadedProject())[0]![4]!.color).toBeNull()
  })


  it('is one undo step: a single Undo restores both the painted grid and Row progress together, including woven rows', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 4) // (0,4)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // rows 0-1 finished

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').attributes('aria-disabled') === 'true').toBe(false)

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(frameGrid(loadedProject())[0]![4]!.color).toBe('#e63746')
    expect(loadedProject().rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 2,
      currentColumn: 0,
    })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)
  })

  it('does nothing when there is no open Project', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="delete-all-button"]').exists()).toBe(false)
  })

  it('translates the modal title, message and button labels with the interface language', async () => {
    const wrapper = await mountWithProject(15, 30)
    await chooseLanguage(wrapper, 'en')
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    expect(wrapper.text()).toContain(en.deleteAll.confirmTitle)
    expect(wrapper.text()).toContain(en.deleteAll.confirmMessage)
    expect(wrapper.find('[data-testid="confirm-modal-cancel"]').text()).toBe(en.deleteAll.cancelButton)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.deleteAll.confirmButton)

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')
    await chooseLanguage(wrapper, 'ru')
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    expect(wrapper.text()).toContain(ru.deleteAll.confirmTitle)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(ru.deleteAll.confirmButton)
  })
})

describe('App header bead', () => {
  it("shows the open Project's Bead label in the header", async () => {
    const wrapper = await mountWithProject(15, 30)

    expect(wrapper.find('[data-testid="current-project-bead"]').text()).toBe('TOHO Cube 1.5mm')
  })

  it('updates the Bead shown when switching to another Project', async () => {
    const wrapper = await mountWithProject(15, 30)
    const firstId = loadProjects()[0]!.id

    await wrapper.find('[data-testid="new-project-button"]').trigger('click')
    await wrapper.find('[data-testid="bead-select"]').setValue('miyuki-delica-11-0')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[data-testid="current-project-bead"]').text()).toBe('Miyuki Delica 11/0')

    await wrapper.find(`[data-testid="select-project-${firstId}"]`).trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(wrapper.find('[data-testid="current-project-bead"]').text()).toBe('TOHO Cube 1.5mm')
  })

  it('shows no Bead in the header with no Project open', async () => {
    const wrapper = await mountWithProject(15, 30)
    const projectId = loadProjects()[0]!.id

    await wrapper.find(`[data-testid="remove-project-${projectId}"]`).trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(wrapper.find('[data-testid="current-project-bead"]').exists()).toBe(false)
  })

  it('shows an "unknown bead" label, translated, for a Project whose Bead is not in the catalog', async () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
    saveProjects([{ ...project, beadId: 'no-such-bead' }])

    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="current-project-bead"]').text()).toBe(ru.projects.unknownBeadLabel)

    await chooseLanguage(wrapper, 'en')
    expect(wrapper.find('[data-testid="current-project-bead"]').text()).toBe(en.projects.unknownBeadLabel)
  })

  it('leaves the Saved Projects list unchanged: no Bead shown there', async () => {
    const wrapper = await mountWithProject(15, 30)
    const projectId = loadProjects()[0]!.id

    await wrapper.find('[data-testid="new-project-button"]').trigger('click')
    await createProjectViaForm(wrapper)

    const projectItem = wrapper
      .findAll('[data-testid="project-item"]')
      .find((item) => item.find(`[data-testid="select-project-${projectId}"]`).exists())!
    expect(projectItem.find('[data-testid="current-project-bead"]').exists()).toBe(false)
  })
})

describe('App replace bead', () => {
  function loadedProject() {
    return loadProjects()[0]!
  }

  it('offers the other built-in catalog Beads, not the current one', async () => {
    const wrapper = await mountWithProject(15, 30) // Cube

    const labels = wrapper.find('[data-testid="replace-bead-select"]').findAll('option').map((option) => option.text())
    expect(labels).not.toContain('TOHO Cube 1.5mm')
    expect(labels).toContain('TOHO Round 11/0')
    expect(labels).toContain('Miyuki Delica 11/0')
  })

  it('opens a confirmation modal showing the new Estimated size next to the current one instead of replacing immediately', async () => {
    const wrapper = await mountWithProject(15, 30) // 10x20 at Cube: about 1.5 x 3.0 cm

    await chooseLanguage(wrapper, 'en')
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

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
    await chooseLanguage(wrapper, 'en')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').text()).toContain('about 4.4 × 1.7 cm instead of 3.0 × 1.5 cm')
  })

  it('leaves the Project untouched when Cancel is clicked, and closes the modal', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(false)
    expect(loadedProject().beadId).toBe('toho-cube-1.5mm')
  })

  it('goes back to its placeholder after Cancel, rather than keeping the declined Bead selected (ticket 113)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const select = wrapper.find<HTMLSelectElement>('[data-testid="replace-bead-select"]')

    await select.setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    expect(select.element.value).toBe('')
  })

  it('opens the modal again when the same Bead is picked a second time after Cancel (ticket 113)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const select = wrapper.find<HTMLSelectElement>('[data-testid="replace-bead-select"]')

    await select.setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')
    await select.setValue('toho-round-11-0')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(true)
  })

  it('goes back to its placeholder after Confirm, with the current Bead label showing the new Bead (ticket 113)', async () => {
    const wrapper = await mountWithProject(15, 30)
    const select = wrapper.find<HTMLSelectElement>('[data-testid="replace-bead-select"]')

    await select.setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(select.element.value).toBe('')
    expect(wrapper.find('[data-testid="current-project-bead"]').text()).toBe('TOHO Round 11/0')
  })

  it('leaves the Project untouched when Escape is pressed, and closes the modal without also backing out of Select', async () => {
    const wrapper = await mountWithProject(6, 6) // 4x4 at Cube
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup') // paint (0,0) red
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup') // select (0,0)
    await wrapper.find('[data-testid="copy-button"]').trigger('click') // copiedBlock now holds the red cell

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(false)
    expect(loadedProject().beadId).toBe('toho-cube-1.5mm')

    // If Escape had also run backOutOfSelect, it would have dropped the copied block, and this next click would
    // start a fresh Selection instead of stamping.
    await pressBead(wrapper, 5)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(frameGrid(loadedProject())[1]![1]!.color).toBe('#e63746')
  })

  it('switches the Bead once confirmed and leaves the grid exactly as it was', async () => {
    const wrapper = await mountWithProject(15, 30) // 10x20 at Cube

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedProject().beadId).toBe('toho-round-11-0')
    expect(loadedProject().frame!.columns).toBe(10)
    expect(loadedProject().frame!.rows).toBe(20)
    expect(loadedProject()).not.toHaveProperty('widthMm')
    expect(wrapper.find('[data-testid="current-project-bead"]').text()).toBe('TOHO Round 11/0')
  })

  it('leaves every painted cell where it was, with no rescale', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0) // (0,0)
    await pressBead(wrapper, 199) // (19,9)
    await wrapper.find('.app-shell').trigger('mouseup')
    const before = frameGrid(loadedProject())

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(frameGrid(loadedProject())).toEqual(before)
    expect(frameGrid(loadedProject())[0]![0]!.color).toBe('#e63746')
    expect(frameGrid(loadedProject())[19]![9]!.color).toBe('#e63746')
  })

  it('keeps Row progress as it was, since the grid it describes is unchanged', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedProject().rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 1,
      currentColumn: 0,
    })
  })

  it('works on a Project created in beads and painted on', async () => {
    saveProjects([createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 12, height: 5, unit: 'beads' } })]) // beads: 12x5
    const wrapper = mount(App)
    await nextTick()
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 7)
    await wrapper.find('.app-shell').trigger('mouseup')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('miyuki-delica-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedProject().beadId).toBe('miyuki-delica-11-0')
    expect(loadedProject().frame!.columns).toBe(12)
    expect(loadedProject().frame!.rows).toBe(5)
    expect(frameGrid(loadedProject())[0]![7]!.color).toBe('#e63746')
  })

  it('keeps name, Technique and rotation unchanged', async () => {
    const saved = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 15, height: 30, unit: 'mm' } })
    saveProjects([{ ...saved, rotation: 90 }])
    const wrapper = mount(App)
    await flushPromises()
    const before = loadedProject()

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    const after = loadedProject()
    expect(after.name).toBe(before.name)
    expect(after.technique).toBe(before.technique)
    expect(after.rotation).toBe(90)
  })

  it('is one undo step: a single Undo restores the previous Bead, and Redo swaps it back', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup') // paint (0,0) red
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').attributes('aria-disabled') === 'true').toBe(false)

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(loadedProject().beadId).toBe('toho-cube-1.5mm')
    expect(loadedProject().frame!.columns).toBe(10)
    expect(loadedProject().frame!.rows).toBe(20)
    expect(frameGrid(loadedProject())[0]![0]!.color).toBe('#e63746')
    expect(loadedProject().rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 1,
      currentColumn: 0,
    })

    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    expect(loadedProject().beadId).toBe('toho-round-11-0')
    expect(loadedProject().frame!.columns).toBe(10)
  })

  it('does nothing when there is no open Project', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="replace-bead-select"]').exists()).toBe(false)
  })

  it('translates the modal title, message and button labels with the interface language', async () => {
    const wrapper = await mountWithProject(15, 30)
    await chooseLanguage(wrapper, 'en')
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    expect(wrapper.text()).toContain(en.replaceBead.confirmTitle)
    expect(wrapper.find('[data-testid="confirm-modal-cancel"]').text()).toBe(en.replaceBead.cancelButton)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.replaceBead.confirmButton)

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')
    await chooseLanguage(wrapper, 'ru')
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    expect(wrapper.text()).toContain(ru.replaceBead.confirmTitle)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(ru.replaceBead.confirmButton)
  })
})

describe('App bead quantities', () => {
  async function projectWithPaintedCells(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('[data-color-id="red"]').trigger('click')
    // Each press is a click, so each is released: the bead counts follow a stroke a few times a second (ticket 106) and
    // settle when it ends, which is what a release does.
    await pressBead(wrapper, 0)
    await wrapper.trigger('pointerup')
    await pressBead(wrapper, 1)
    await wrapper.trigger('pointerup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await pressBead(wrapper, 2)
    await wrapper.trigger('pointerup')
  }

  it('totals the beads each color needs from the painted cells, with no bead picker in sight', async () => {
    const wrapper = await mountWithProject(15, 30)
    await projectWithPaintedCells(wrapper)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="quantity-count-blue"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="bead-quantities"] select').exists()).toBe(false)
  })

  it('shows no row for a color painted nowhere in the Project', async () => {
    const wrapper = await mountWithProject(15, 30)
    await projectWithPaintedCells(wrapper)

    expect(wrapper.find('[data-testid="quantity-count-green"]').exists()).toBe(false)
  })

  it("adds a color's row as soon as it is painted, and removes it once its last cell is erased", async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="quantity-count-red"]').exists()).toBe(false)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
    await wrapper.trigger('pointerup')

    await pressBead(wrapper, 0, { button: 2 }) // right-click erase
    expect(wrapper.find('[data-testid="quantity-count-red"]').exists()).toBe(false)
  })

  it('shows the "open a Project" message with no Project open', async () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="quantities-no-project"]').exists()).toBe(true)
  })

  it('shows a "nothing painted yet" message for a Project with nothing painted on it', async () => {
    const wrapper = await mountWithProject(15, 30)

    expect(wrapper.find('[data-testid="quantities-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quantity-count-red"]').exists()).toBe(false)
  })
})

describe('App estimated weight (ticket 155)', () => {
  it('follows painting and erasing, and Replace bead', async () => {
    localStorage.setItem('bd-beads:locale', 'en')
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="quantities-weight-note"]').exists()).toBe(false)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('0.01 g')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('< 0.01 g')
    expect(wrapper.find('[data-testid="quantities-weight-note"]').text()).toContain('about 0.0091 g')

    await pressBead(wrapper, 0, { button: 2 })
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantities-weight-note"]').exists()).toBe(false)
  })

  it('labels the weight in grams or in Russian «г» by the app language, with its own decimal sign (writing.md)', async () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('0,01 г')
    await chooseLanguage(wrapper, 'en')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('0.01 g')
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

  async function importFile(wrapper: ReturnType<typeof mount>, contents: string) {
    const input = wrapper.find<HTMLInputElement>('[data-testid="import-file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([contents], 'library.json', { type: 'application/json' })],
    })
    await input.trigger('change')
    await flushPromises()
  }

  it('takes in a library exported on another device and saves every Project in it', async () => {
    const wrapper = mount(App)
    const library = [makeProject('Fox'), makeProject('Owl')]

    await importFile(wrapper, serializeLibrary(library))

    expect(loadProjects().map((project) => project.name).sort()).toEqual(['Fox', 'Owl'])
    expect(wrapper.findAll('[data-testid="project-item"]')).toHaveLength(2)
  })

  it('opens an imported Project when nothing was open, so the user resumes where they left off', async () => {
    const wrapper = mount(App)
    const woven = makeProject('Fox')
    woven.rowProgress = { enabled: true, direction: 'rows', currentRow: 4, currentColumn: 0 }

    await importFile(wrapper, serializeLibrary([woven]))

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b5\D+10\b/)
    expect(rowProgressView(wrapper)).toMatchObject({ finished: 4 })
  })

  it('imports a Project that clashes with a local one as a separate entry, keeping both', async () => {
    const wrapper = await mountWithProject(15, 30)
    const local = loadProjects()[0]!

    await importFile(wrapper, serializeLibrary([{ ...local, name: 'Imported copy' }]))
    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    const saved = loadProjects()
    expect(saved).toHaveLength(2)
    expect(saved.map((project) => project.id)).toContain(local.id)
    expect(new Set(saved.map((project) => project.id)).size).toBe(2)
  })

  it('reports a file it cannot read instead of importing anything', async () => {
    const wrapper = mount(App)

    await importFile(wrapper, 'definitely not a project file')

    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(true)
    expect(loadProjects()).toHaveLength(0)
  })

  it('keeps the import result and error visible after an import, in both languages (ticket 117)', async () => {
    const wrapper = mount(App)

    await importFile(wrapper, serializeLibrary([makeProject('Fox'), makeProject('Owl')]))
    expect(wrapper.find('[data-testid="import-result"]').text()).toBe(`${ru.transfer.importedLabel}: 2`)
    await chooseLanguage(wrapper, 'en')
    expect(wrapper.find('[data-testid="import-result"]').text()).toBe(`${en.transfer.importedLabel}: 2`)

    await importFile(wrapper, 'definitely not a project file')
    expect(wrapper.find('[data-testid="import-error"]').text()).toBe(en.transfer.importErrorLabel)
    await chooseLanguage(wrapper, 'ru')
    expect(wrapper.find('[data-testid="import-error"]').text()).toBe(ru.transfer.importErrorLabel)
  })

  it('imports into an empty library and opens what it brought in (ticket 117)', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="project-list-empty"]').exists()).toBe(true)

    await importFile(wrapper, serializeLibrary([makeProject('Fox')]))

    expect(wrapper.find('[data-testid="current-project-summary"]').text()).toContain('Fox')
    expect(wrapper.find('[data-testid="project-list-empty"]').exists()).toBe(false)
  })
})
