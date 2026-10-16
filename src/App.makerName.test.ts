import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { LEGACY_MAKER_NAME_KEY } from './services/legacyMakerName'
import { createProject } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { openSheet } from './testUtils/pill'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

const fox = () => createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  saveProjects([fox()])
})

function mountApp() {
  return mount(App, { attachTo: document.body })
}

async function openNameModal(wrapper: ReturnType<typeof mountApp>) {
  await openSheet(wrapper, 'strip-project')
  await wrapper.find('[data-testid="name-on-exports-change"]').trigger('click')
  await flushPromises()
}

const savedName = () => loadProjects()[0]?.makerName

describe("App name on exports: the Project's own Maker's name (ADR 0060)", () => {
  it('has no name on the Export menu any more, and offers Add on the Project sheet until one is set', async () => {
    const wrapper = mountApp()
    await openSheet(wrapper, 'strip-project')

    expect(wrapper.find('[data-testid="project-name-on-exports"]').text()).toContain(en.saveBox.nameOnExports)
    expect(wrapper.find('[data-testid="name-on-exports-change"]').text()).toBe(en.saveBox.addName)
    await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
    expect(wrapper.find('[data-testid="name-on-exports"]').exists()).toBe(false)
  })

  it('sets the name from its modal onto this Project, which has the field, the hint, Cancel and Save', async () => {
    const wrapper = mountApp()
    await openNameModal(wrapper)

    const modal = wrapper.find('[data-testid="name-on-exports-modal"]')
    expect(modal.text()).toContain(en.saveBox.yourName)
    expect(modal.text()).toContain(en.saveBox.nameHint)
    const input = wrapper.find<HTMLInputElement>('[data-testid="maker-name-input"]')
    expect(input.attributes('maxlength')).toBe('40')
    expect(document.activeElement).toBe(input.element)

    await input.setValue('Maria Kovaleva')
    await wrapper.find('[data-testid="maker-name-save"]').trigger('click')

    expect(wrapper.find('[data-testid="name-on-exports-modal"]').exists()).toBe(false)
    expect(savedName()).toBe('Maria Kovaleva')
    expect(localStorage.getItem(LEGACY_MAKER_NAME_KEY)).toBeNull()
    await openSheet(wrapper, 'strip-project')
    expect(wrapper.find('[data-testid="name-on-exports-change"]').text()).toBe(en.saveBox.changeName)
  })

  it("saves on Enter, keeps the name across a reload, and changes it", async () => {
    saveProjects([{ ...fox(), makerName: 'Maria' }])
    const wrapper = mountApp()
    await openNameModal(wrapper)
    expect(wrapper.find<HTMLInputElement>('[data-testid="maker-name-input"]').element.value).toBe('Maria')

    await wrapper.find('[data-testid="maker-name-input"]').setValue('Anna')
    await wrapper.find('#name-on-exports-form').trigger('submit')
    wrapper.unmount()

    expect(savedName()).toBe('Anna')
  })

  it('clears the name when the field is saved empty', async () => {
    saveProjects([{ ...fox(), makerName: 'Maria' }])
    const wrapper = mountApp()
    await openNameModal(wrapper)

    await wrapper.find('[data-testid="maker-name-input"]').setValue('')
    await wrapper.find('#name-on-exports-form').trigger('submit')

    expect(savedName()).toBeUndefined()
  })

  it('leaves the name as it was on Escape', async () => {
    saveProjects([{ ...fox(), makerName: 'Maria' }])
    const wrapper = mountApp()
    await openNameModal(wrapper)

    await wrapper.find('[data-testid="maker-name-input"]').setValue('Anna')
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="name-on-exports-modal"]').exists()).toBe(false)
    expect(savedName()).toBe('Maria')
  })

  it("copies a saved device-wide name into a Project with none on the first load, then clears the device value (temporary)", () => {
    localStorage.setItem(LEGACY_MAKER_NAME_KEY, 'Maria')
    mountApp()

    expect(savedName()).toBe('Maria')
    expect(localStorage.getItem(LEGACY_MAKER_NAME_KEY)).toBeNull()
  })
})
