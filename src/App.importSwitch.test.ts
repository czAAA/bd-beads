import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settleImport } from './testUtils/settleImport'
import { gzipJson } from './testUtils/gzipJson'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { pressBead } from './testUtils/beads'
import { createProject, type Project } from './domain/project'
import { serializeLibrary } from './domain/projectFile'
import { loadProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { createProjectViaForm } from './testUtils/seedProject'
import { refuseStorageWrites } from './testUtils/storageWrites'
import { openPanel, pickColor } from './testUtils/pill'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => vi.restoreAllMocks())

type Wrapper = ReturnType<typeof mount>

function makeProject(name: string): Project {
  return createProject({ name, technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 15, height: 15, unit: 'mm' } })
}

/** Picks a file for the import control: the project bar's with no Project open, Menu's otherwise. */
async function pick(wrapper: Wrapper, contents: string) {
  if (!wrapper.find('[data-testid="phone-bar-import-file"]').exists()) {
    await openPanel(wrapper, 'strip-menu')
  }
  const input = wrapper.find<HTMLInputElement>('[data-testid="phone-bar-import-file"], [data-testid="menu-import-file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File([await gzipJson(contents)], 'import.openbeads', { type: 'application/json' })],
  })
  await input.trigger('change')
  await settleImport()
}

const modal = (wrapper: Wrapper) => wrapper.find('[data-testid="import-switch-modal"]')
/** The open Project's summary line, in the Project panel. */
const openName = async (wrapper: Wrapper) => {
  await openPanel(wrapper, 'strip-project')
  return wrapper.find('[data-testid="project-name"]').text()
}
const libraryNames = () => loadProjects().map((project) => project.name).sort()
const click = (wrapper: Wrapper, testId: string) => wrapper.find(`[data-testid="${testId}"]`).trigger('click')

describe('App import asks before switching (ticket 154)', () => {
  it('asks first, changing nothing on screen or in the library until answered', async () => {
    const wrapper = mount(App)
    await createProjectViaForm(wrapper, 'Current')

    await pick(wrapper, serializeLibrary([makeProject('Fox')]))

    expect(modal(wrapper).exists()).toBe(true)
    expect(await openName(wrapper)).toContain('Current')
    expect(libraryNames()).toEqual(['Current'])
  })

  it('Switch opens the imported Project and keeps the old one in the library', async () => {
    const wrapper = mount(App)
    await createProjectViaForm(wrapper, 'Current')
    await pick(wrapper, serializeLibrary([makeProject('Fox')]))

    await click(wrapper, 'confirm-modal-confirm')

    expect(modal(wrapper).exists()).toBe(false)
    expect(await openName(wrapper)).toContain('Fox')
    expect(libraryNames()).toEqual(['Current', 'Fox'])
  })

  it('Keep current imports into the library and leaves the open Project open', async () => {
    const wrapper = mount(App)
    await createProjectViaForm(wrapper, 'Current')
    await pick(wrapper, serializeLibrary([makeProject('Fox')]))

    await click(wrapper, 'confirm-modal-cancel')

    expect(modal(wrapper).exists()).toBe(false)
    expect(await openName(wrapper)).toContain('Current')
    expect(libraryNames()).toEqual(['Current', 'Fox'])
  })

  it('shows no modal when no Project is open, and opens what came in as before', async () => {
    const wrapper = mount(App)

    await pick(wrapper, serializeLibrary([makeProject('Fox')]))

    expect(modal(wrapper).exists()).toBe(false)
    expect(await openName(wrapper)).toContain('Fox')
    expect(libraryNames()).toEqual(['Fox'])
  })

  describe('when the last save did not get through', () => {
    async function unsavedApp() {
      const wrapper = mount(App)
      await createProjectViaForm(wrapper, 'Current')
      const spy = refuseStorageWrites('openbeads:patterns')
      await pickColor(wrapper, 'red')
      await pressBead(wrapper, { row: 0, column: 0 })
      await wrapper.find('.app-shell').trigger('mouseup')
      expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(true)
      return { wrapper, spy }
    }

    it('says the current Project is not saved and offers Save, not a claim that it is', async () => {
      const { wrapper } = await unsavedApp()
      await pick(wrapper, serializeLibrary([makeProject('Fox')]))

      expect(modal(wrapper).text()).toContain('“Current” is not saved')
      expect(modal(wrapper).text()).not.toContain('is saved')
      expect(wrapper.find('[data-testid="confirm-modal-extra"]').text()).toBe(en.importSwitch.saveButton)
      expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.importSwitch.switchAnywayButton)
    })
  })
})
