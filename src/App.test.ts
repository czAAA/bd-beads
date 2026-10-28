import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { drawnProject, hoverBead, pressBead } from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { createProject, frameGrid } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { mountWithProject } from './testUtils/seedProject'
import { refuseStorageWrites, spyOnStorageWrites } from './testUtils/storageWrites'
import { chooseAppLanguage, pickColor } from './testUtils/pill'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

/** What spans the areas: start-up, saving and reopening. Each area's wiring is in its own `App.<area>.test.ts`. */
describe('App', () => {
  it('opens the saved Project at start-up, and shows it unchanged after a reload', async () => {
    const first = await mountWithProject(15, 30)
    expect(drawnProject(first)).toMatchObject({ frame: { technique: 'loom' as const, rows: 20, columns: 10 } })
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.find('[data-testid="bead-section"]').exists()).toBe(false)
    expect(drawnProject(afterReload)).toMatchObject({ frame: { technique: 'loom' as const, rows: 20, columns: 10 } })
  })

  it('still opens and paints a Project created with a since-removed custom Bead', async () => {
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
