import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { pressBead } from './testUtils/beads'
import { createProject, type Project } from './domain/project'
import { serializeLibrary, serializeProject } from './domain/projectFile'
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

  it('names the Project left and the one opened, and says the progress is saved', async () => {
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')
    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

    const text = modal(wrapper).text()
    expect(text).toContain('Your progress on “Current” is saved')
    expect(text).toContain('“Fox” was imported')
    expect(text).toContain('Switch to “Fox”')
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

  it('counts Escape as Keep current', async () => {
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')
    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(modal(wrapper).exists()).toBe(false)
    expect(openName(wrapper)).toContain('Current')
    expect(libraryNames()).toEqual(['Current', 'Fox'])
  })

  it('says how many came in and which one would open when several are imported', async () => {
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')
    const older = { ...makeProject('Older'), updatedAt: 1 }
    const newer = { ...makeProject('Newer'), updatedAt: 2 }
    await pick(wrapper, 'import-file', serializeLibrary([older, newer]))

    expect(modal(wrapper).text()).toContain('2 Projects were imported')
    expect(modal(wrapper).text()).toContain('Switch to “Newer”')

    await click(wrapper, 'confirm-modal-confirm')

    expect(openName(wrapper)).toContain('Newer')
    expect(libraryNames()).toEqual(['Current', 'Newer', 'Older'])
  })

  it('never overwrites: a taken id comes in under a fresh id, in both answers', async () => {
    for (const answer of ['confirm-modal-confirm', 'confirm-modal-cancel']) {
      localStorage.clear()
      localStorage.setItem('bd-beads:locale', 'en')
      const wrapper = mount(App)
      await createOpen(wrapper, 'Current')
      const local = loadProjects()[0]!

      await pick(wrapper, 'import-file', serializeProject({ ...local, name: 'Clash' }))
      await click(wrapper, answer)

      const saved = loadProjects()
      expect(saved).toHaveLength(2)
      expect(saved.find((project) => project.id === local.id)!.name).toBe('Current')
      expect(new Set(saved.map((project) => project.id)).size).toBe(2)
    }
  })

  it('shows no modal when no Project is open, and opens what came in as before', async () => {
    const wrapper = mount(App)

    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

    expect(modal(wrapper).exists()).toBe(false)
    expect(openName(wrapper)).toContain('Fox')
    expect(libraryNames()).toEqual(['Fox'])
  })

  it('resets Undo history on Switch, like any Project switch, but not on Keep current', async () => {
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, { row: 0, column: 0 })
    await wrapper.find('.app-shell').trigger('mouseup')
    const canUndo = () => wrapper.find('[data-testid="undo-button"]').attributes('aria-disabled') === undefined
    expect(canUndo()).toBe(true)

    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))
    await click(wrapper, 'confirm-modal-cancel')
    expect(canUndo()).toBe(true)

    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Owl')]))
    await click(wrapper, 'confirm-modal-confirm')
    expect(canUndo()).toBe(false)
  })

  it('offers the same modal for a QR-code picture', async () => {
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')
    const shown = wrapper.findComponent({ name: 'ProjectImport' })
    shown.vm.$emit('import', [makeProject('Scanned')])
    await flushPromises()

    expect(modal(wrapper).exists()).toBe(true)
    await click(wrapper, 'confirm-modal-confirm')
    expect(openName(wrapper)).toContain('Scanned')
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

    it('shows the storage-full error when the save fails again, and stays on the question', async () => {
      const { wrapper } = await unsavedApp()
      await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

      await click(wrapper, 'confirm-modal-extra')

      expect(wrapper.find('[data-testid="import-switch-save-failed"]').text()).toBe(en.storage.saveFailedMessage)
      expect(modal(wrapper).text()).toContain('is not saved')
    })

    it('turns into the ordinary question once Save gets through', async () => {
      const { wrapper, spy } = await unsavedApp()
      await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))
      spy.mockRestore()

      await click(wrapper, 'confirm-modal-extra')

      expect(wrapper.find('[data-testid="confirm-modal-extra"]').exists()).toBe(false)
      expect(modal(wrapper).text()).toContain('Your progress on “Current” is saved')
      expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.importSwitch.switchButton)
    })

    it('lets the person switch anyway', async () => {
      const { wrapper, spy } = await unsavedApp()
      await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))
      spy.mockRestore()

      await click(wrapper, 'confirm-modal-confirm')

      expect(openName(wrapper)).toContain('Fox')
    })
  })

  it('has Russian copy', async () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    const wrapper = mount(App)
    await createOpen(wrapper, 'Current')
    await pick(wrapper, 'import-file', serializeLibrary([makeProject('Fox')]))

    expect(modal(wrapper).text()).toContain('Перейти к импортированному проекту?')
  })
})
