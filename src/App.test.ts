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
import { chooseAppLanguage, chooseCustomColor, openColorPopover, openNewProject, openSavedProjects, pickColor, pickTool, rotate } from './testUtils/pill'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

describe('App', () => {

  it('creates a project, renders its grid, and autosaves it without an explicit save action', async () => {
    const wrapper = await mountWithProject(15, 30)

    expect(drawnProject(wrapper)).toMatchObject({ frame: { technique: 'loom' as const, rows: 20, columns: 10 } })

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

    expect(afterReload.find('[data-testid="bead-picker"]').exists()).toBe(false)
    expect(drawnProject(afterReload)).toMatchObject({ frame: { technique: 'loom' as const, rows: 20, columns: 10 } })
  })

  it('switches the open project when a different one is selected from the list', async () => {
    const wrapper = await mountWithProject(15, 30)
    const firstId = loadProjects()[0]!.id

    await createProjectViaForm(wrapper)

    await openSavedProjects(wrapper)
    await openSavedProjects(wrapper)
    await wrapper.find(`[data-testid="select-project-${firstId}"]`).trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(drawnProject(wrapper)).toMatchObject({ frame: { technique: 'loom' as const, rows: 20, columns: 10 } })
  })

  it('removing the last remaining project falls back to the empty home screen', async () => {
    const wrapper = await mountWithProject(15, 30)
    const projectId = loadProjects()[0]!.id

    await openSavedProjects(wrapper)
    await openSavedProjects(wrapper)
    await wrapper.find(`[data-testid="remove-project-${projectId}"]`).trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(wrapper.find('[data-testid="phone-project-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)
    expect(loadProjects()).toHaveLength(0)
  })

  it('puts the strip above the board in the canvas box (ticket 143)', async () => {
    const wrapper = mount(App)
    await createProjectViaForm(wrapper)

    const canvas = wrapper.find('[data-testid="app-canvas"]')
    expect(canvas.element.firstElementChild?.getAttribute('data-testid')).toBe('canvas-strip')
  })

  it('paints a cell with the selected palette color', async () => {
    const wrapper = await mountWithProject(15, 30)

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)

    expect(beadColor(wrapper, 0)).toBe('#e63746')

    // Releasing the button ends the stroke, which is when a stroke reaches storage (ticket 55).
    await wrapper.trigger('mouseup')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('fills a contiguous same-colored region with the fill tool', async () => {
    const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows

    await pickColor(wrapper, 'red')
    // Paint a 2x2 red block: (0,0), (0,1), (1,0), (1,1).
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)
    await pressBead(wrapper, 10)
    await pressBead(wrapper, 11)

    await pickColor(wrapper, 'blue')
    await pickTool(wrapper, 'fill')
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

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)

    await pickColor(wrapper, 'blue')
    await pickTool(wrapper, 'fill')
    await pressBead(wrapper, 0)

    expect(frameGrid(loadProjects()[0]!)[0]![1]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="strip-undo"]').trigger('click')

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
  })

  it('rotating turns the Selection a quarter turn and leaves the Frame and the Technique alone (ticket 416)', async () => {
    const wrapper = await mountWithProject(4.5, 3) // 3 columns x 2 rows

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0) // paint (0,0) and (0,1), the top row's first two beads
    await wrapper.trigger('mouseup')
    await pressBead(wrapper, 1)
    await wrapper.trigger('mouseup')
    const beforeRotate = loadProjects()[0]!

    await pickTool(wrapper, 'piece') // a tap on the strip selects its rectangle (Select all would take the Frame's inside, ticket 428)
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    await rotate(wrapper)

    const afterRotate = loadProjects()[0]!
    // A data turn of the Selection: the Project is not left turned and its Frame stays as it was.
    expect(afterRotate.rotation).toBe(0)
    expect(afterRotate.technique).toBe(beforeRotate.technique)
    expect(afterRotate.frame).toMatchObject({ row: 0, column: 0, rows: 2, columns: 3 })
    expect(beforeRotate.frame).toMatchObject({ row: 0, column: 0, rows: 2, columns: 3 })
    // The 1 x 2 strip becomes a 2 x 1 column on its right: the left bead goes to the top, the right one below it.
    const grid = frameGrid(afterRotate)
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[1]![1]!.color).toBe('#e63746')
  })

  it('opens ready to paint with the Palette’s first color selected by default, no swatch click needed first (ticket 27)', async () => {
    const wrapper = await mountWithProject(15, 30)

    await openColorPopover(wrapper)
    expect(wrapper.find('[data-color-id="black"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-testid="color-popover-close"]').trigger('click')

    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#1a1a1a')
  })

  it('paints with a Custom color exactly like a Palette color once one is chosen (ticket 43)', async () => {
    const wrapper = await mountWithProject(15, 30)

    await chooseCustomColor(wrapper, '#123456')

    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#123456')
  })

  it('paints every cell dragged over with the Paint tool, as a continuous stroke', async () => {
    const wrapper = await mountWithProject(15, 30) // 10 columns x 20 rows
    await pickColor(wrapper, 'red')

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

  it('does not erase on a right-click under Paint, which moves the Canvas instead (ticket 541)', async () => {
    const wrapper = await mountWithProject(15, 30)

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await pressBead(wrapper, 0, { button: 2 })
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('does not flood-erase on a right-click under Fill (ticket 541)', async () => {
    const wrapper = await mountWithProject(15, 30)

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    await pickTool(wrapper, 'fill')
    await pressBead(wrapper, 0, { button: 2 })
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('undoes the most recent paint action, and repeated undo steps back further', async () => {
    const wrapper = await mountWithProject(15, 30)

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await pickColor(wrapper, 'blue')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="strip-undo"]').trigger('click')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="strip-undo"]').trigger('click')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
  })

  it('offers exactly the three built-in Beads when creating a Project, even with custom-bead data left over from before ticket 38', async () => {
    localStorage.setItem(
      'openbeads:custom-beads',
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
    await openNewProject(wrapper)

    await wrapper.get('[data-testid="bead-picker-toggle"]').trigger('click')
    await wrapper.get('[data-testid="bead-picker-brand"]').trigger('click')
    const brands = wrapper.findAll('[role="menuitem"]').map((item) => item.text())
    expect(brands).toEqual(['TOHO', 'Miyuki'])
    expect(brands).not.toContain('Acme')
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

    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')

    // Export/import round-tripping an unresolved beadId is covered directly in projectFile.test.ts; here it's
    // enough that the button (disabled only while the library is empty) is live for this one.
    await openSavedProjects(wrapper)
    expect(wrapper.get('[data-testid="menu-export-all"]').attributes('aria-disabled')).toBeUndefined()
  })

  it('defaults to Russian on first visit with no saved language preference', async () => {
    const wrapper = mount(App)
    await openNewProject(wrapper)

    expect(wrapper.find('#bead-label').text()).toBe(ru.form.beadLabel)
    expect(wrapper.find('button[type="submit"]').text()).toBe(ru.form.submit)
  })

  it('switches every translated label when the language switcher is used, and persists the choice across a reload', async () => {
    const wrapper = mount(App)

    await chooseAppLanguage(wrapper, 'en')
    await openNewProject(wrapper)

    expect(wrapper.find('#bead-label').text()).toBe(en.form.beadLabel)
    expect(wrapper.find('[data-testid="create-project"]').text()).toBe(en.form.submit)

    wrapper.unmount()
    const afterReload = mount(App)
    await openNewProject(afterReload)

    expect(afterReload.find('#bead-label').text()).toBe(en.form.beadLabel)
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
  const PROJECTS_KEY = 'openbeads:patterns'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes a dragged paint stroke once, when the stroke ends, rather than once per cell', async () => {
    const wrapper = await mountWithProject(15, 30)
    await pickColor(wrapper, 'red')

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
    await pickColor(wrapper, 'red')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(ru.storage.saveFailedMessage)

    await chooseAppLanguage(wrapper, 'en')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(en.storage.saveFailedMessage)
  })
})
