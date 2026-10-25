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
const field = (wrapper: ReturnType<typeof mountApp>) => wrapper.find<HTMLInputElement>('[data-testid="project-maker-input"]')
const save = (wrapper: ReturnType<typeof mountApp>) => wrapper.get('[data-testid="project-maker-form"]').trigger('submit')

describe("App maker line: the Project's own Maker's name (ADR 0060, tickets 443, 554)", () => {
  it('reads "+ Add your name for exports" until one is set, with no field open', async () => {
    const wrapper = mountApp()
    await openProject(wrapper)

    expect(wrapper.get('[data-testid="project-maker-row"]').text()).toContain(en.panels.project.makerLabel)
    expect(wrapper.get('[data-testid="project-maker-add"]').text()).toBe(en.panels.project.addMaker)
    expect(field(wrapper).exists()).toBe(false)
    expect(wrapper.find('[data-testid="project-maker-edit"]').exists()).toBe(false)
  })

  it('sets the name on this Project from the field, trimmed, with a counter, and then shows the name with a pencil', async () => {
    const wrapper = mountApp()
    await openProject(wrapper)

    await wrapper.get('[data-testid="project-maker-add"]').trigger('click')
    await flushPromises()
    expect(field(wrapper).attributes('maxlength')).toBe('40')
    expect(wrapper.get('[data-testid="project-maker-form"]').text()).toContain('0/40')
    await field(wrapper).setValue('  Maria Kovaleva ')
    await save(wrapper)
    await flushPromises()

    expect(savedName()).toBe('Maria Kovaleva')
    expect(localStorage.getItem(LEGACY_MAKER_NAME_KEY)).toBeNull()
    expect(wrapper.get('[data-testid="project-maker"]').text()).toBe('Maria Kovaleva')
    expect(wrapper.get('[data-testid="project-maker-edit"]').attributes('aria-label')).toBe(en.panels.project.changeMaker)
  })

  it('the pencil swaps the name for the field to change it', async () => {
    saveProjects([{ ...fox(), makerName: 'Maria' }])
    const wrapper = mountApp()
    await openProject(wrapper)
    expect(wrapper.get('[data-testid="project-maker"]').text()).toBe('Maria')

    await wrapper.get('[data-testid="project-maker-edit"]').trigger('click')
    await flushPromises()
    expect(field(wrapper).element.value).toBe('Maria')
    await field(wrapper).setValue('Anna')
    await save(wrapper)
    await flushPromises()

    expect(savedName()).toBe('Anna')
    expect(wrapper.get('[data-testid="project-maker"]').text()).toBe('Anna')
  })

  it('clears the name when the field is saved empty, returning the line to unset', async () => {
    saveProjects([{ ...fox(), makerName: 'Maria' }])
    const wrapper = mountApp()
    await openProject(wrapper)

    await wrapper.get('[data-testid="project-maker-edit"]').trigger('click')
    await flushPromises()
    await field(wrapper).setValue('')
    await save(wrapper)
    await flushPromises()

    expect(savedName()).toBeUndefined()
    expect(wrapper.find('[data-testid="project-maker-add"]').exists()).toBe(true)
  })

  it("copies a saved device-wide name into a Project with none on the first load, then clears the device value (temporary)", () => {
    localStorage.setItem(LEGACY_MAKER_NAME_KEY, 'Maria')
    mountApp()

    expect(savedName()).toBe('Maria')
    expect(localStorage.getItem(LEGACY_MAKER_NAME_KEY)).toBeNull()
  })
})
