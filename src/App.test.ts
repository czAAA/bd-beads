import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { loadPattern } from './domain/patternStorage'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

beforeEach(() => {
  localStorage.clear()
})

describe('App', () => {
  it('shows the new pattern form when nothing has been saved yet', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="grid-row"]').exists()).toBe(false)
  })

  it('creates a pattern, renders its grid, and autosaves it without an explicit save action', async () => {
    const wrapper = mount(App)
    const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

    await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
    await wrapper.find('[data-testid="width-input"]').setValue('15')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('form').trigger('submit')

    const rows = wrapper.findAll('[data-testid="grid-row"]')
    expect(rows).toHaveLength(20)
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')).toHaveLength(10)

    const saved = loadPattern()
    expect(saved?.beadId).toBe(cubeBead.id)
    expect(saved?.columns).toBe(10)
    expect(saved?.rows).toBe(20)
  })

  it('shows the previously created pattern unchanged after a reload', async () => {
    const first = mount(App)
    const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

    await first.find('[data-testid="bead-select"]').setValue(cubeBead.id)
    await first.find('[data-testid="width-input"]').setValue('15')
    await first.find('[data-testid="height-input"]').setValue('30')
    await first.find('form').trigger('submit')
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.find('[data-testid="bead-select"]').exists()).toBe(false)
    const rows = afterReload.findAll('[data-testid="grid-row"]')
    expect(rows).toHaveLength(20)
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')).toHaveLength(10)
  })

  it('defaults to Russian on first visit with no saved language preference', () => {
    const wrapper = mount(App)

    expect(wrapper.find('label[for="bead-select"]').text()).toBe(ru.form.beadLabel)
    expect(wrapper.find('button[type="submit"]').text()).toBe(ru.form.submit)
  })

  it('switches every translated label when the language switcher is used, and persists the choice across a reload', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-testid="language-en"]').trigger('click')

    expect(wrapper.find('label[for="bead-select"]').text()).toBe(en.form.beadLabel)
    expect(wrapper.find('button[type="submit"]').text()).toBe(en.form.submit)

    wrapper.unmount()
    const afterReload = mount(App)

    expect(afterReload.find('label[for="bead-select"]').text()).toBe(en.form.beadLabel)
  })
})
