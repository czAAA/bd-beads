import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { beadColor, drawnProject, hoverBead, pressBead, rulerNumbers } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { createProject, frameGrid } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { mountWithProject, createProjectViaForm } from './testUtils/seedProject'
import { refuseStorageWrites, spyOnStorageWrites } from './testUtils/storageWrites'
import { chooseLanguage } from './testUtils/chooseLanguage'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

describe('App', () => {
  it('shows the new project form when nothing has been saved yet', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="project-surface"]').exists()).toBe(false)
  })

  it('creates a project, renders its grid, and autosaves it without an explicit save action', async () => {
    const wrapper = await mountWithProject(15, 30)

    expect(drawnProject(wrapper)).toMatchObject({ frame: { rows: 20, columns: 10 } })

    const saved = loadProjects()
    expect(saved).toHaveLength(1)
    expect(saved[0]!.beadId).toBe(cubeBead.id)
    expect(saved[0]!.frame!.columns).toBe(10)
    expect(saved[0]!.frame!.rows).toBe(20)
  })

  it('shows the previously created project unchanged after a reload', async () => {
    const first = await mountWithProject(15, 30)
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.find('[data-testid="bead-select"]').exists()).toBe(false)
    expect(drawnProject(afterReload)).toMatchObject({ frame: { rows: 20, columns: 10 } })
  })

  it('switches the open project when a different one is selected from the list', async () => {
    const wrapper = await mountWithProject(15, 30)
    const firstId = loadProjects()[0]!.id

    await wrapper.find('[data-testid="new-project-button"]').trigger('click')
    await createProjectViaForm(wrapper)

    await wrapper.find(`[data-testid="select-project-${firstId}"]`).trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(drawnProject(wrapper)).toMatchObject({ frame: { rows: 20, columns: 10 } })
  })

  it('removing the last remaining project falls back to the empty home screen', async () => {
    const wrapper = await mountWithProject(15, 30)
    const projectId = loadProjects()[0]!.id

    await wrapper.find(`[data-testid="remove-project-${projectId}"]`).trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
    // Saved Projects keeps its box (ticket 39: always one of the three below-canvas boxes), now showing its
    // own empty message rather than disappearing.
    expect(wrapper.find('[data-testid="project-list-empty"]').exists()).toBe(true)
    expect(loadProjects()).toHaveLength(0)
  })

  it('lays out the app shell as a header, one left column and the canvas box, with nothing below the canvas (ticket 141)', async () => {
    const wrapper = mount(App)

    const topBar = wrapper.find('[data-testid="app-topbar"]')
    const column = wrapper.find('[data-testid="app-main-panel"]')
    const canvas = wrapper.find('[data-testid="app-canvas"]')

    expect(topBar.exists()).toBe(true)
    expect(column.exists()).toBe(true)
    expect(canvas.exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-above-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-below-canvas"]').exists()).toBe(false)

    expect(topBar.find('h1').exists()).toBe(true)
    expect(topBar.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(column.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(topBar.find('[data-testid="new-project-button"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)

    await createProjectViaForm(wrapper)

    expect(topBar.find('[data-testid="current-project-summary"]').exists()).toBe(true)
    expect(column.find('[data-testid="bead-select"]').exists()).toBe(false)
    expect(column.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="project-surface"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(false)
    expect(column.find('[data-testid="project-list"]').exists()).toBe(true)
  })

  it('holds the left column\'s boxes in a fixed order, whether or not a Project is open (ticket 141)', async () => {
    const wrapper = mount(App)
    const column = wrapper.find('[data-testid="app-main-panel"]')
    const boxOrder = () => [...column.element.children].map((box) => box.getAttribute('data-testid'))

    expect(boxOrder()).toEqual(['new-project-box', 'bead-quantities', 'project-list'])

    await createProjectViaForm(wrapper)
    expect(boxOrder()).toEqual(['toolbox', 'save-box', 'bead-quantities', 'project-list'])

    await wrapper.find('[data-testid="new-project-button"]').trigger('click') // back to no Project open, but one is saved
    expect(boxOrder()).toEqual(['new-project-box', 'bead-quantities', 'project-list'])
  })

  it('puts the Toolbox first in the left column while a Project is open, in place of the New Project form (tickets 114, 141)', async () => {
    const wrapper = await mountWithProject(15, 30)

    const mainPanel = wrapper.find('[data-testid="app-main-panel"]')
    const toolbox = wrapper.find('[data-testid="toolbox"]')

    expect(mainPanel.find('[data-testid="bead-select"]').exists()).toBe(false)
    expect(mainPanel.element.firstElementChild).toBe(toolbox.element)
    expect(wrapper.find('[data-testid="app-canvas"]').find('[data-testid="toolbox"]').exists()).toBe(false)
    for (const testId of [
      'tool-paint',
      'tool-fill',
      'palette-picker',
      'undo-button',
      'tool-group-frame',
    ]) {
      expect(toolbox.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('shows the New Project form in the left column, and no Toolbox, with no Project open (ticket 114)', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-testid="new-project-button"]').trigger('click')

    const mainPanel = wrapper.find('[data-testid="app-main-panel"]')
    expect(mainPanel.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toolbox"]').exists()).toBe(false)
  })

  it('puts the open Project\'s Technique behind the board, and the strip above it, in the canvas box (ticket 143)', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="canvas-backdrop"]').exists()).toBe(false)

    await createProjectViaForm(wrapper)

    const canvas = wrapper.find('[data-testid="app-canvas"]')
    expect(canvas.element.firstElementChild?.getAttribute('data-testid')).toBe('canvas-strip')
    expect(canvas.find('[data-testid="canvas-backdrop"]').attributes('aria-hidden')).toBe('true')
    expect(canvas.find('[data-testid="canvas-backdrop"]').text()).not.toBe('')
    expect(canvas.find('[data-testid="canvas-strip-size"]').exists()).toBe(true)
  })

  it('paints a cell with the selected palette color', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)

    expect(beadColor(wrapper, 0)).toBe('#e63746')

    // Releasing the button ends the stroke, which is when a stroke reaches storage (ticket 55).
    await wrapper.trigger('mouseup')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('fills a contiguous same-colored region with the fill tool', async () => {
    const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows

    await wrapper.find('[data-color-id="red"]').trigger('click')
    // Paint a 2x2 red block: (0,0), (0,1), (1,0), (1,1).
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)
    await pressBead(wrapper, 10)
    await pressBead(wrapper, 11)

    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 0)

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBe('#2f6fed')
    expect(grid[0]![1]!.color).toBe('#2f6fed')
    expect(grid[1]![0]!.color).toBe('#2f6fed')
    expect(grid[1]![1]!.color).toBe('#2f6fed')
    // Unpainted neighbor outside the red region is untouched.
    expect(grid[0]![2]!.color).toBeNull()
  })

  it('undoes a fill as a single action, restoring every cell it repainted', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)

    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 0)

    expect(frameGrid(loadProjects()[0]!)[0]![1]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
  })

  it('rotating turns the Frame and its beads a quarter turn, swapping the Frame\'s size and keeping the Technique', async () => {
    const wrapper = await mountWithProject(4.5, 3) // 3 columns x 2 rows

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0) // paint (0,0), the top-left bead
    await wrapper.trigger('mouseup')
    const beforeRotate = loadProjects()[0]!

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    const afterRotate = loadProjects()[0]!
    // A data turn, not a view one: the Project is not left turned, its Frame and beads are.
    expect(afterRotate.rotation).toBe(0)
    expect(afterRotate.technique).toBe(beforeRotate.technique)
    expect(afterRotate.frame).toMatchObject({ columns: beforeRotate.frame!.rows, rows: beforeRotate.frame!.columns })
    // The top-left bead of a quarter turn clockwise is the top-right one.
    expect(frameGrid(afterRotate)[0]![1]!.color).toBe('#e63746')
    expect(frameGrid(afterRotate).flat().filter((cell) => cell.color).length).toBe(1)
    expect(wrapper.find('[data-testid="current-project-summary"]').text()).toContain('2×3')
  })

  it('opens ready to paint with red selected by default, no swatch click needed first (ticket 27)', async () => {
    const wrapper = await mountWithProject(15, 30)

    expect(wrapper.find('[data-color-id="red"]').attributes('aria-pressed')).toBe('true')

    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('paints with a Custom color exactly like a Palette color once one is chosen (ticket 43)', async () => {
    const wrapper = await mountWithProject(15, 30)

    const customColorInput = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    customColorInput.element.value = '#123456'
    await customColorInput.trigger('input')

    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#123456')
  })

  it('paints every cell dragged over with the Paint tool, as a continuous stroke', async () => {
    const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[0]![2]!.color).toBe('#e63746')
    // The rest of the stroke's row is untouched.
    expect(grid[0]![3]!.color).toBeNull()
  })

  it('right-clicks a single cell to erase it with the Paint tool', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')

    await pressBead(wrapper, 0, { button: 2 })
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
  })

  it('right-clicks with the Fill tool to flood-erase the connected same-color region in one click', async () => {
    const wrapper = await mountWithProject(15, 30)

    // Paint a 2x2 red block: (0,0), (0,1), (1,0), (1,1).
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 10, { buttons: 1 })
    await hoverBead(wrapper, 11, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 0, { button: 2 })

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[1]![0]!.color).toBeNull()
    expect(grid[1]![1]!.color).toBeNull()
    // Outside the flood-erased region is untouched.
    expect(grid[0]![2]!.color).toBeNull()
  })

  it('undoes the most recent paint action, and repeated undo steps back further', async () => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
  })

  it('offers exactly the three built-in Beads when creating a Project, even with custom-bead data left over from before ticket 38', () => {
    localStorage.setItem(
      'bd-beads:custom-beads',
      JSON.stringify([
        {
          id: 'acme-fancy-8-0',
          brand: 'Acme',
          name: 'Fancy',
          size: '8/0',
          formFactor: 'round',
          color: '#e63746',
          widthMm: 3,
          heightMm: 3,
        },
      ]),
    )

    const wrapper = mount(App)

    const options = wrapper.findAll<HTMLOptionElement>('[data-testid="bead-select"] option')
    expect(options).toHaveLength(BEAD_CATALOG.length)
    expect(options.map((option) => option.text())).not.toContain('Acme Fancy 8/0')
  })

  it('still opens, paints, and exports a Project created with a since-removed custom Bead', async () => {
    const project = createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
    saveProjects([{ ...project, beadId: 'acme-fancy-8-0' }])

    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="project-surface"]').exists()).toBe(true)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')

    // Export/import round-tripping an unresolved beadId is covered directly in projectFile.test.ts; here it's
    // enough that the button (disabled only while no Project is open) is live for this one.
    await wrapper.find('[data-testid="project-list"] [data-testid="panel-expand"]').trigger('click')
    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="export-project"]').element.disabled,
    ).toBe(false)
  })

  it('defaults to Russian on first visit with no saved language preference', () => {
    const wrapper = mount(App)

    expect(wrapper.find('label[for="bead-select"]').text()).toBe(ru.form.beadLabel)
    expect(wrapper.find('button[type="submit"]').text()).toBe(ru.form.submit)
  })

  it('switches every translated label when the language switcher is used, and persists the choice across a reload', async () => {
    const wrapper = mount(App)

    await chooseLanguage(wrapper, 'en')

    expect(wrapper.find('label[for="bead-select"]').text()).toBe(en.form.beadLabel)
    expect(wrapper.find('button[type="submit"]').text()).toBe(en.form.submit)

    wrapper.unmount()
    const afterReload = mount(App)

    expect(afterReload.find('label[for="bead-select"]').text()).toBe(en.form.beadLabel)
  })

  it('zooms the open Project from the floating canvas-box controls', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('110%')

    await wrapper.find('[data-testid="zoom-reset"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')
  })

  it('lays the header out in the Header card\'s order, with the Project info only while one is open (ticket 142)', async () => {
    const wrapper = mount(App)
    const order = () =>
      [...wrapper.find('[data-testid="app-topbar"]').element.children].map(
        (child) =>
          child.getAttribute('data-testid') ??
          [...child.classList].find((name) => name.startsWith('app-header__')) ??
          child.querySelector('[data-testid]')?.getAttribute('data-testid'),
      )

    expect(order()).toEqual([
      'app-header__brand',
      'header-menu', // the header menu (ticket 210), next to the logo
      'app-header__gap',
      'project-actions',
      'new-project-button',
      'language-switcher',
      'theme-toggle',
      'app-header__shortcuts',
    ])

    await createProjectViaForm(wrapper)

    expect(order()).toEqual([
      'app-header__brand',
      'header-menu',
      'project-info',
      'replace-bead-select',
      'app-header__gap',
      'project-actions',
      'new-project-button',
      'language-switcher',
      'theme-toggle',
      'app-header__shortcuts',
    ])
    const header = wrapper.find('[data-testid="app-topbar"]')
    expect(header.find('h1').text()).toBe('bd-beads')
    expect(header.find('h1 [data-testid="app-logo"]').exists()).toBe(true)
    // A new Project is an open canvas (ticket 342): the summary names the Bead and has no size to add yet.
    expect(header.find('[data-testid="current-project-summary"]').text()).toBe('TOHO Cube 1.5mm')
  })

  it('opens the keyboard shortcuts from the header\'s round button (ticket 142)', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-testid="shortcuts-button"]').trigger('click')

    expect(wrapper.findComponent({ name: 'ShortcutsHelp' }).exists()).toBe(true)
  })

  it('rules the canvas with row and column numbers on all four edges', async () => {
    const wrapper = await mountWithProject(15, 30)

    const numbers = rulerNumbers(wrapper)
    // 10 columns above and below, 20 rows left and right (15 × 30 mm of 1.5 mm cubes): every number drawn, 1 upwards, on all four sides of the Frame.
    for (const axis of ['column', 'row'] as const) {
      const count = axis === 'column' ? 10 : 20
      const along = numbers.filter((label) => label.axis === axis)
      expect(along).toHaveLength(count * 2)
      expect(along.map((label) => label.text).sort()).toEqual([...Array(count).keys()].flatMap((i) => [String(i + 1), String(i + 1)]).sort())
    }
    // Left of the Frame, right of it, above it and below it.
    const row1 = numbers.filter((label) => label.axis === 'row' && label.text === '1').sort((a, b) => a.x - b.x)
    expect(row1[0]!.x).toBeLessThan(0)
    expect(row1[1]!.x).toBeGreaterThan(10 * 20)
    const column1 = numbers.filter((label) => label.axis === 'column' && label.text === '1').sort((a, b) => a.y - b.y)
    expect(column1[0]!.y).toBeLessThan(0)
    expect(column1[1]!.y).toBeGreaterThan(20 * 20)
  })
})

/** Ticket 55: saving follows the Project library instead of sitting on the per-cell edit path. */
describe('App storage writes', () => {
  /** The Project library's own key: the counting and refusing below are scoped to it, so the saved language's writes
   *  (a click on the language switcher) neither show up as noise nor get refused along with it. */
  const PROJECTS_KEY = 'bd-beads:patterns'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes a dragged paint stroke once, when the stroke ends, rather than once per cell', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const writes = spyOnStorageWrites(PROJECTS_KEY)
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })

    expect(writes.count).toBe(0)

    await wrapper.trigger('mouseup')

    expect(writes.count).toBe(1)
    const grid = frameGrid(loadProjects()[0]!)
    expect([grid[0]![0]!.color, grid[0]![1]!.color, grid[0]![2]!.color]).toEqual([
      '#e63746',
      '#e63746',
      '#e63746',
    ])
  })

  it('says so, in the current language, when a write to storage is refused', async () => {
    const wrapper = await mountWithProject(15, 30)
    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(false)

    refuseStorageWrites(PROJECTS_KEY)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(ru.storage.saveFailedMessage)

    await chooseLanguage(wrapper, 'en')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(en.storage.saveFailedMessage)
  })

})
