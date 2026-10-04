import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { MAKER_NAME_KEY } from './services/makerNameStore'
import { createProject } from './domain/project'
import { saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
  saveProjects([createProject({ technique: 'loom', beadId: cubeBead.id, name: 'Fox', size: { width: 10, height: 10, unit: 'beads' } })])
})

function mountApp() {
  return mount(App, { attachTo: document.body })
}

async function openNameModal(wrapper: ReturnType<typeof mountApp>) {
  await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
  await wrapper.find('[data-testid="name-on-exports-change"]').trigger('click')
  await flushPromises()
}

const row = (wrapper: ReturnType<typeof mountApp>) => wrapper.find('[data-testid="name-on-exports-value"]').text()

describe('App name on exports (ticket 161)', () => {
  it('ends the Export menu with the name on exports: "Not set" and Add until one is set', async () => {
    const wrapper = mountApp()
    await wrapper.find('[data-testid="export-menu-button"]').trigger('click')

    expect(wrapper.find('[data-testid="name-on-exports"]').text()).toContain(en.saveBox.nameOnExports)
    expect(row(wrapper)).toBe(en.saveBox.nameNotSet)
    expect(wrapper.find('[data-testid="name-on-exports-change"]').text()).toBe(en.saveBox.addName)
  })

  it('sets the name from its modal, which has the field, the hint, Cancel and Save', async () => {
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
    expect(localStorage.getItem(MAKER_NAME_KEY)).toBe('Maria Kovaleva')
    await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
    expect(row(wrapper)).toBe('Maria Kovaleva')
    expect(wrapper.find('[data-testid="name-on-exports-change"]').text()).toBe(en.saveBox.changeName)
  })

  it('saves on Enter, keeps the name across a reload, and changes it', async () => {
    localStorage.setItem(MAKER_NAME_KEY, 'Maria')
    const wrapper = mountApp()
    await openNameModal(wrapper)
    expect(wrapper.find<HTMLInputElement>('[data-testid="maker-name-input"]').element.value).toBe('Maria')

    await wrapper.find('[data-testid="maker-name-input"]').setValue('Anna')
    await wrapper.find('#name-on-exports-form').trigger('submit')
    wrapper.unmount()

    const again = mountApp()
    await again.find('[data-testid="export-menu-button"]').trigger('click')
    expect(row(again)).toBe('Anna')
  })

  it('clears the name when the field is saved empty', async () => {
    localStorage.setItem(MAKER_NAME_KEY, 'Maria')
    const wrapper = mountApp()
    await openNameModal(wrapper)

    await wrapper.find('[data-testid="maker-name-input"]').setValue('')
    await wrapper.find('#name-on-exports-form').trigger('submit')

    expect(localStorage.getItem(MAKER_NAME_KEY)).toBeNull()
    await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
    expect(row(wrapper)).toBe(en.saveBox.nameNotSet)
  })

  it('leaves the name as it was on Escape', async () => {
    localStorage.setItem(MAKER_NAME_KEY, 'Maria')
    const wrapper = mountApp()
    await openNameModal(wrapper)

    await wrapper.find('[data-testid="maker-name-input"]').setValue('Anna')
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="name-on-exports-modal"]').exists()).toBe(false)
    expect(localStorage.getItem(MAKER_NAME_KEY)).toBe('Maria')
  })

  it('speaks Russian too', async () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    const wrapper = mountApp()
    await wrapper.find('[data-testid="export-menu-button"]').trigger('click')

    expect(wrapper.find('[data-testid="name-on-exports"]').text()).toContain(ru.saveBox.nameOnExports)
    expect(row(wrapper)).toBe(ru.saveBox.nameNotSet)
    expect(wrapper.find('[data-testid="name-on-exports-change"]').text()).toBe(ru.saveBox.addName)
  })
})
