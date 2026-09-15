import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { loadPatterns } from './domain/patternStorage'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

async function createPatternViaForm(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
  await wrapper.find('form').trigger('submit')
}

beforeEach(() => {
  localStorage.clear()
})

describe('App', () => {
  it('shows the new pattern form when nothing has been saved yet', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="grid-row"]').exists()).toBe(false)
  })

  it('disables the new pattern button until at least one pattern exists', async () => {
    const wrapper = mount(App)

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="new-pattern-button"]').element.disabled,
    ).toBe(true)

    await createPatternViaForm(wrapper, '15', '30')

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="new-pattern-button"]').element.disabled,
    ).toBe(false)
  })

  it('creates a pattern, renders its grid, and autosaves it without an explicit save action', async () => {
    const wrapper = mount(App)

    await createPatternViaForm(wrapper, '15', '30')

    const rows = wrapper.findAll('[data-testid="grid-row"]')
    expect(rows).toHaveLength(20)
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')).toHaveLength(10)

    const saved = loadPatterns()
    expect(saved).toHaveLength(1)
    expect(saved[0]!.beadId).toBe(cubeBead.id)
    expect(saved[0]!.columns).toBe(10)
    expect(saved[0]!.rows).toBe(20)
  })

  it('shows the previously created pattern unchanged after a reload', async () => {
    const first = mount(App)

    await createPatternViaForm(first, '15', '30')
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.find('[data-testid="bead-select"]').exists()).toBe(false)
    const rows = afterReload.findAll('[data-testid="grid-row"]')
    expect(rows).toHaveLength(20)
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')).toHaveLength(10)
  })

  it('shows a summary of the currently open pattern', async () => {
    const wrapper = mount(App)

    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('10×20')
  })

  it('lists a newly created pattern below the canvas and lets a second one be started alongside it', async () => {
    const wrapper = mount(App)

    await createPatternViaForm(wrapper, '15', '30')
    expect(wrapper.findAll('[data-testid="pattern-item"]')).toHaveLength(1)

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="pattern-item"]')).toHaveLength(1)

    await createPatternViaForm(wrapper, '30', '30')
    expect(wrapper.findAll('[data-testid="pattern-item"]')).toHaveLength(2)
    expect(loadPatterns()).toHaveLength(2)
  })

  it('switches the open pattern when a different one is selected from the list', async () => {
    const wrapper = mount(App)

    await createPatternViaForm(wrapper, '15', '30')
    const firstId = loadPatterns()[0]!.id

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '30', '30')

    await wrapper.find(`[data-testid="select-pattern-${firstId}"]`).trigger('click')

    const rows = wrapper.findAll('[data-testid="grid-row"]')
    expect(rows).toHaveLength(20)
    expect(rows[0]!.findAll('[data-testid="grid-cell"]')).toHaveLength(10)
  })

  it('removing the open pattern switches to another remaining one', async () => {
    const wrapper = mount(App)

    await createPatternViaForm(wrapper, '15', '30')
    const firstId = loadPatterns()[0]!.id

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '30', '30')
    const secondId = loadPatterns().find((pattern) => pattern.id !== firstId)!.id

    await wrapper.find(`[data-testid="select-pattern-${secondId}"]`).trigger('click')
    await wrapper.find(`[data-testid="remove-pattern-${secondId}"]`).trigger('click')

    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="pattern-item"]')).toHaveLength(1)
    expect(loadPatterns()).toHaveLength(1)
    expect(loadPatterns()[0]!.id).toBe(firstId)
  })

  it('removing the last remaining pattern falls back to the empty home screen', async () => {
    const wrapper = mount(App)

    await createPatternViaForm(wrapper, '15', '30')
    const patternId = loadPatterns()[0]!.id

    await wrapper.find(`[data-testid="remove-pattern-${patternId}"]`).trigger('click')

    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-list"]').exists()).toBe(false)
    expect(loadPatterns()).toHaveLength(0)
  })

  it('lays out the app shell as a top bar, main panel, canvas, and panels above/below the canvas', async () => {
    const wrapper = mount(App)

    const topBar = wrapper.find('[data-testid="app-topbar"]')
    const mainPanel = wrapper.find('[data-testid="app-main-panel"]')
    const aboveCanvas = wrapper.find('[data-testid="app-above-canvas"]')
    const canvas = wrapper.find('[data-testid="app-canvas"]')
    const belowCanvas = wrapper.find('[data-testid="app-below-canvas"]')

    expect(topBar.exists()).toBe(true)
    expect(mainPanel.exists()).toBe(true)
    expect(aboveCanvas.exists()).toBe(true)
    expect(canvas.exists()).toBe(true)
    expect(belowCanvas.exists()).toBe(true)

    expect(topBar.find('h1').exists()).toBe(true)
    expect(topBar.find('[data-testid="language-en"]').exists()).toBe(true)
    expect(mainPanel.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(aboveCanvas.find('[data-testid="new-pattern-button"]').exists()).toBe(true)

    await createPatternViaForm(wrapper, '15', '30')

    expect(topBar.find('[data-testid="current-pattern-summary"]').exists()).toBe(true)
    expect(mainPanel.find('[data-testid="app-main-panel-placeholder"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="grid-row"]').exists()).toBe(true)
    expect(belowCanvas.find('[data-testid="pattern-list"]').exists()).toBe(true)
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
