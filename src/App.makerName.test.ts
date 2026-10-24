import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { LEGACY_MAKER_NAME_KEY } from './services/legacyMakerName'
import { createProject } from './domain/project'
import { loadProjects, saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { openPanel } from './testUtils/pill'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

const fox = () => createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  saveProjects([fox()])
})

function mountApp() {
  return mount(App, { attachTo: document.body })
}

async function openProject(wrapper: ReturnType<typeof mountApp>) {
  await openPanel(wrapper, 'strip-project')
  await flushPromises()
}

const savedName = () => loadProjects()[0]?.makerName
const field = (wrapper: ReturnType<typeof mountApp>) => wrapper.find<HTMLInputElement>('[data-testid="maker-name-input"]')

describe("App name on exports: the Project's own Maker's name (ADR 0060, ticket 443)", () => {
  it('has no name on the Export menu, and shows an open field with the hint and counter until one is set', async () => {
    const wrapper = mountApp()
    await openProject(wrapper)

    const row = wrapper.find('[data-testid="project-name-on-exports"]')
    expect(row.text()).toContain(en.saveBox.nameOnExports)
    expect(row.text()).toContain(en.saveBox.nameHint)
    expect(row.text()).toContain('0/40')
    expect(field(wrapper).attributes('maxlength')).toBe('40')
    expect(wrapper.find('[data-testid="name-on-exports-change"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="name-on-exports"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="name-on-exports-modal"]').exists()).toBe(false)
  })

  it('sets the name on this Project from the field on Enter, trimmed, and then shows the name with a pencil', async () => {
    const wrapper = mountApp()
    await openProject(wrapper)

    await field(wrapper).setValue('  Maria Kovaleva ')
    await field(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(savedName()).toBe('Maria Kovaleva')
    expect(localStorage.getItem(LEGACY_MAKER_NAME_KEY)).toBeNull()
    expect(wrapper.find('[data-testid="name-on-exports-value"]').text()).toBe('Maria Kovaleva')
    expect(wrapper.find('[data-testid="name-on-exports-change"]').attributes('aria-label')).toBe(en.panels.project.editNameOnExports)
  })

  it('saves when the field is left, and the pencil swaps the name for the field to change it', async () => {
    saveProjects([{ ...fox(), makerName: 'Maria' }])
    const wrapper = mountApp()
    await openProject(wrapper)
    expect(wrapper.find('[data-testid="name-on-exports-value"]').text()).toBe('Maria')

    await wrapper.find('[data-testid="name-on-exports-change"]').trigger('click')
    await flushPromises()
    expect(field(wrapper).element.value).toBe('Maria')
    await field(wrapper).setValue('Anna')
    await field(wrapper).trigger('blur')
    await flushPromises()

    expect(savedName()).toBe('Anna')
    expect(wrapper.find('[data-testid="name-on-exports-value"]').text()).toBe('Anna')
  })

  it('clears the name when the field is saved empty, returning the row to unset', async () => {
    saveProjects([{ ...fox(), makerName: 'Maria' }])
    const wrapper = mountApp()
    await openProject(wrapper)

    await wrapper.find('[data-testid="name-on-exports-change"]').trigger('click')
    await flushPromises()
    await field(wrapper).setValue('')
    await field(wrapper).trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(savedName()).toBeUndefined()
    expect(field(wrapper).element.value).toBe('')
  })

  it("copies a saved device-wide name into a Project with none on the first load, then clears the device value (temporary)", () => {
    localStorage.setItem(LEGACY_MAKER_NAME_KEY, 'Maria')
    mountApp()

    expect(savedName()).toBe('Maria')
    expect(localStorage.getItem(LEGACY_MAKER_NAME_KEY)).toBeNull()
  })
})
