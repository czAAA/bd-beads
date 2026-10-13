import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { pressBead } from './testUtils/beads'
import { createProject, type Project } from './domain/project'
import { serializeLibrary } from './domain/projectFile'
import { loadProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { refuseStorageWrites } from './testUtils/storageWrites'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

afterEach(() => vi.restoreAllMocks())

type Wrapper = ReturnType<typeof mount>

function makeProject(name: string): Project {
  return createProject({ name, technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 15, height: 15, unit: 'mm' } })
}

async function createOpen(wrapper: Wrapper, name: string) {
  await wrapper.find('[data-testid="name-input"]').setValue(name)
  await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
  await wrapper.find('form').trigger('submit')
}

async function pick(wrapper: Wrapper, testId: string, contents: string) {
  const input = wrapper.find<HTMLInputElement>(`[data-testid="${testId}"]`)
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File([contents], 'import.json', { type: 'application/json' })],
  })
  await input.trigger('change')
  await flushPromises()
}

const modal = (wrapper: Wrapper) => wrapper.find('[data-testid="import-switch-modal"]')
const openName = (wrapper: Wrapper) => wrapper.find('[data-testid="current-project-summary"]').text()
const libraryNames = () => loadProjects().map((project) => project.name).sort()
const click = (wrapper: Wrapper, testId: string) => wrapper.find(`[data-testid="${testId}"]`).trigger('click')

describe('App import asks before switching (ticket 154)', () => {
  it('asks first, changing nothing on screen or in the library until answered', async () => {
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')

    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

    expect(modal(wrapper).exists()).toBe(true)
    expect(openName(wrapper)).toContain('Current')
    expect(libraryNames()).toEqual(['Current'])
  })

  it('Switch opens the imported Project and keeps the old one in the library', async () => {
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')
    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

    await click(wrapper, 'confirm-modal-confirm')

    expect(modal(wrapper).exists()).toBe(false)
    expect(openName(wrapper)).toContain('Fox')
    expect(libraryNames()).toEqual(['Current', 'Fox'])
  })

  it('Keep current imports into the library and leaves the open Project open', async () => {
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')
    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

    await click(wrapper, 'confirm-modal-cancel')

    expect(modal(wrapper).exists()).toBe(false)
    expect(openName(wrapper)).toContain('Current')
    expect(libraryNames()).toEqual(['Current', 'Fox'])
  })

  it('shows no modal when no Project is open, and opens what came in as before', async () => {
    const wrapper = mount(App)

    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

    expect(modal(wrapper).exists()).toBe(false)
    expect(openName(wrapper)).toContain('Fox')
    expect(libraryNames()).toEqual(['Fox'])
  })

  describe('when the last save did not get through', () => {
    async function unsavedApp() {
      const wrapper = mount(App)
      await createOpen(wrapper, 'Current')
      const spy = refuseStorageWrites('bd-beads:patterns')
      await wrapper.find('[data-color-id="red"]').trigger('click')
      await pressBead(wrapper, { row: 0, column: 0 })
      await wrapper.find('.app-shell').trigger('mouseup')
      expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(true)
      return { wrapper, spy }
    }

    it('says the current Project is not saved and offers Save, not a claim that it is', async () => {
      const { wrapper } = await unsavedApp()
      await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

      expect(modal(wrapper).text()).toContain('“Current” is not saved')
      expect(modal(wrapper).text()).not.toContain('is saved')
      expect(wrapper.find('[data-testid="confirm-modal-extra"]').text()).toBe(en.importSwitch.saveButton)
      expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.importSwitch.switchAnywayButton)
    })

  })

})
