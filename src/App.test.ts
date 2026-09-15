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
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)

    await createPatternViaForm(wrapper, '15', '30')

    expect(topBar.find('[data-testid="current-pattern-summary"]').exists()).toBe(true)
    expect(mainPanel.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="grid-row"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(false)
    expect(belowCanvas.find('[data-testid="pattern-list"]').exists()).toBe(true)
  })

  it('paints a cell with the selected palette color', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('click')

    expect(wrapper.findAll('[data-testid="grid-cell"]')[0]!.attributes('style')).toContain(
      'background-color: rgb(230, 55, 70)',
    )
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('paints a cell regardless of the Pattern\'s Technique', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
    await wrapper.find('[data-testid="technique-select"]').setValue('peyote')
    await wrapper.find('[data-testid="width-input"]').setValue('15')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('form').trigger('submit')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('click')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('fills a contiguous same-colored region with the fill tool', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows

    await wrapper.find('[data-color-id="red"]').trigger('click')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    // Paint a 2x2 red block: (0,0), (0,1), (1,0), (1,1).
    await cells[0]!.trigger('click')
    await cells[1]!.trigger('click')
    await cells[10]!.trigger('click')
    await cells[11]!.trigger('click')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await cells[0]!.trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#2f6fed')
    expect(grid[0]![1]!.color).toBe('#2f6fed')
    expect(grid[1]![0]!.color).toBe('#2f6fed')
    expect(grid[1]![1]!.color).toBe('#2f6fed')
    // Unpainted neighbor outside the red region is untouched.
    expect(grid[0]![2]!.color).toBeNull()
  })

  it('undoes a fill as a single action, restoring every cell it repainted', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('click')
    await cells[1]!.trigger('click')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await cells[0]!.trigger('click')

    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
  })

  it('mirroring is off by default, so applying is unavailable', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    expect(wrapper.find<HTMLInputElement>('[data-testid="mirror-enabled"]').element.checked).toBe(
      false,
    )
    expect(wrapper.find<HTMLButtonElement>('[data-testid="mirror-apply"]').element.disabled).toBe(
      true,
    )
  })

  it('requires the master toggle and at least one axis before mirror can be applied', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3')

    await wrapper.find('[data-testid="mirror-enabled"]').setValue(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="mirror-apply"]').element.disabled).toBe(
      true,
    )

    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="mirror-apply"]').element.disabled).toBe(
      false,
    )
  })

  it('reflects painted cells across the selected axis only when mirror is applied, not live while drawing', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    await wrapper.find('[data-color-id="red"]').trigger('click')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('click') // paint (0,0)

    // Not live: painting alone never touches (0,1).
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()

    await wrapper.find('[data-testid="mirror-enabled"]').setValue(true)
    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
    await wrapper.find('[data-testid="mirror-apply"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    // Vertical axis wasn't selected, so row 1 (never painted) stays untouched.
    expect(grid[1]![0]!.color).toBeNull()
    expect(grid[1]![1]!.color).toBeNull()
  })

  it('undoes a mirror as a single action', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('click')

    await wrapper.find('[data-testid="mirror-enabled"]').setValue(true)
    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
    await wrapper.find('[data-testid="mirror-apply"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('does not paint a cell before a palette color is selected', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('click')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })

  it('undoes the most recent paint action, and repeated undo steps back further', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('click')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('click')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })

  it('disables undo when there is nothing to undo', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(
      true,
    )

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(
      false,
    )
  })

  it('persists painted cells across a reload', async () => {
    const first = mount(App)
    await createPatternViaForm(first, '15', '30')

    await first.find('[data-color-id="red"]').trigger('click')
    await first.findAll('[data-testid="grid-cell"]')[0]!.trigger('click')
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.findAll('[data-testid="grid-cell"]')[0]!.attributes('style')).toContain(
      'background-color: rgb(230, 55, 70)',
    )
  })

  it('lists the seeded catalog in the bead catalog view', () => {
    const wrapper = mount(App)

    expect(wrapper.findAll('[data-testid="catalog-seeded-item"]')).toHaveLength(BEAD_CATALOG.length)
  })

  it('adds a custom bead, which becomes selectable when creating a Pattern', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-testid="catalog-brand-input"]').setValue('Acme')
    await wrapper.find('[data-testid="catalog-name-input"]').setValue('Fancy')
    await wrapper.find('[data-testid="catalog-size-input"]').setValue('8/0')
    await wrapper.find('[data-testid="catalog-width-input"]').setValue('3')
    await wrapper.find('[data-testid="catalog-height-input"]').setValue('3')
    await wrapper.find('[data-testid="bead-catalog"] form').trigger('submit')

    const options = wrapper.findAll<HTMLOptionElement>('[data-testid="bead-select"] option')
    expect(options.map((option) => option.text())).toContain('Acme Fancy 8/0')

    const customBeadOption = options.find((option) => option.text() === 'Acme Fancy 8/0')!
    await wrapper.find('[data-testid="bead-select"]').setValue(customBeadOption.element.value)
    await wrapper.find('[data-testid="width-input"]').setValue('6')
    await wrapper.find('[data-testid="height-input"]').setValue('6')
    await wrapper.find('form.new-pattern-form').trigger('submit')

    expect(loadPatterns()[0]!.columns).toBe(2)
    expect(loadPatterns()[0]!.rows).toBe(2)
  })

  it('persists a custom bead across a reload, still selectable for a new Pattern', async () => {
    const first = mount(App)
    await first.find('[data-testid="catalog-brand-input"]').setValue('Acme')
    await first.find('[data-testid="catalog-name-input"]').setValue('Fancy')
    await first.find('[data-testid="catalog-size-input"]').setValue('8/0')
    await first.find('[data-testid="catalog-width-input"]').setValue('3')
    await first.find('[data-testid="catalog-height-input"]').setValue('3')
    await first.find('[data-testid="bead-catalog"] form').trigger('submit')
    first.unmount()

    const afterReload = mount(App)

    const options = afterReload.findAll<HTMLOptionElement>('[data-testid="bead-select"] option')
    expect(options.map((option) => option.text())).toContain('Acme Fancy 8/0')
  })

  it('edits a custom bead in place', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="catalog-brand-input"]').setValue('Acme')
    await wrapper.find('[data-testid="catalog-name-input"]').setValue('Fancy')
    await wrapper.find('[data-testid="catalog-size-input"]').setValue('8/0')
    await wrapper.find('[data-testid="catalog-width-input"]').setValue('3')
    await wrapper.find('[data-testid="catalog-height-input"]').setValue('3')
    await wrapper.find('[data-testid="bead-catalog"] form').trigger('submit')

    const editButton = wrapper.find('[data-testid="catalog-custom-item"] button')
    await editButton.trigger('click')
    await wrapper.find('[data-testid="catalog-name-input"]').setValue('Renamed')
    await wrapper.find('[data-testid="bead-catalog"] form').trigger('submit')

    const options = wrapper.findAll<HTMLOptionElement>('[data-testid="bead-select"] option')
    expect(options.map((option) => option.text())).toContain('Acme Renamed 8/0')
    expect(options.map((option) => option.text())).not.toContain('Acme Fancy 8/0')
  })

  it('removes a custom bead from the catalog and the pattern-creation select', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="catalog-brand-input"]').setValue('Acme')
    await wrapper.find('[data-testid="catalog-name-input"]').setValue('Fancy')
    await wrapper.find('[data-testid="catalog-size-input"]').setValue('8/0')
    await wrapper.find('[data-testid="catalog-width-input"]').setValue('3')
    await wrapper.find('[data-testid="catalog-height-input"]').setValue('3')
    await wrapper.find('[data-testid="bead-catalog"] form').trigger('submit')

    await wrapper.find('[data-testid="catalog-custom-item"] [data-testid^="catalog-remove-"]').trigger('click')

    expect(wrapper.find('[data-testid="catalog-custom-item"]').exists()).toBe(false)
    const options = wrapper.findAll<HTMLOptionElement>('[data-testid="bead-select"] option')
    expect(options.map((option) => option.text())).not.toContain('Acme Fancy 8/0')
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
