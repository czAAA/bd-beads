import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import {
  beadColor,
  drawnPattern,
  hoverBead,
  leaveSurface,
  pressBead,
  previewedBeads,
  rowProgressView,
  selectedBeadCount,
} from './testUtils/beads'
import { BEAD_CATALOG } from './domain/beads'
import { PALETTE } from './domain/palette'
import { createPattern, type Pattern } from './domain/pattern'
import { serializeLibrary } from './domain/patternFile'
import { loadPatterns, savePatterns } from './services/libraryStore'
import { serializePatternForQr } from './domain/qrExport'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { refuseStorageWrites, spyOnStorageWrites } from './testUtils/storageWrites'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

async function createPatternViaForm(wrapper: ReturnType<typeof mount>, width: string, height: string) {
  await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
  await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
  await wrapper.find('[data-testid="width-input"]').setValue(width)
  await wrapper.find('[data-testid="height-input"]').setValue(height)
  await wrapper.find('form').trigger('submit')
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

describe('App opened from a scanned QR link', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  function sharedPattern(): Pattern {
    return createPattern({ technique: 'loom', beadId: cubeBead.id, size: { width: 9, height: 9, unit: 'mm' }, name: 'Shared' })
  }

  it('imports the Pattern in the URL, opens it and clears the fragment', async () => {
    const shared = sharedPattern()
    const link = serializePatternForQr(shared, 'http://localhost:3000/')
    window.history.replaceState(null, '', `/${link.slice(link.indexOf('#'))}`)

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('Shared')
    expect(loadPatterns()).toEqual([{ ...shared, savedAt: expect.any(Number) }])
    expect(window.location.hash).toBe('')
  })

  it('opens it even when another Pattern is already open, keeping both', async () => {
    const existing = { ...sharedPattern(), id: 'existing', name: 'Mine' }
    savePatterns([existing])
    const shared = sharedPattern()
    const link = serializePatternForQr(shared, 'http://localhost:3000/')
    window.history.replaceState(null, '', `/${link.slice(link.indexOf('#'))}`)

    const wrapper = mount(App)
    await flushPromises()

    // The library is most recently saved first (ticket 145).
    expect(loadPatterns().map((pattern) => pattern.name)).toEqual(['Shared', 'Mine'])
    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('Shared')
  })

  it('ignores a broken link and shows the library as it was', async () => {
    window.history.replaceState(null, '', '/#pattern=***')

    const wrapper = mount(App)
    await flushPromises()

    expect(loadPatterns()).toEqual([])
    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(window.location.hash).toBe('')
  })
})

describe('App', () => {
  it('shows the new pattern form when nothing has been saved yet', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-surface"]').exists()).toBe(false)
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

    expect(drawnPattern(wrapper)).toMatchObject({ rows: 20, columns: 10 })

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
    expect(drawnPattern(afterReload)).toMatchObject({ rows: 20, columns: 10 })
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

    expect(drawnPattern(wrapper)).toMatchObject({ rows: 20, columns: 10 })
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
    // Saved Patterns keeps its box (ticket 39: always one of the three below-canvas boxes), now showing its
    // own empty message rather than disappearing.
    expect(wrapper.find('[data-testid="pattern-list-empty"]').exists()).toBe(true)
    expect(loadPatterns()).toHaveLength(0)
  })

  it('lays out the app shell as a header, one left column and the canvas box, with nothing below the canvas (ticket 141)', async () => {
    const wrapper = mount(App)

    const topBar = wrapper.find('[data-testid="app-topbar"]')
    const column = wrapper.find('[data-testid="app-main-panel"]')
    const canvas = wrapper.find('[data-testid="app-canvas"]')

    expect(topBar.exists()).toBe(true)
    expect(column.exists()).toBe(true)
    expect(canvas.exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-above-canvas"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-below-canvas"]').exists()).toBe(false)

    expect(topBar.find('h1').exists()).toBe(true)
    expect(topBar.find('[data-testid="language-en"]').exists()).toBe(true)
    expect(column.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(topBar.find('[data-testid="new-pattern-button"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)

    await createPatternViaForm(wrapper, '15', '30')

    expect(topBar.find('[data-testid="current-pattern-summary"]').exists()).toBe(true)
    expect(column.find('[data-testid="bead-select"]').exists()).toBe(false)
    expect(column.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="pattern-surface"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(false)
    expect(column.find('[data-testid="pattern-list"]').exists()).toBe(true)
  })

  it('holds the left column\'s boxes in a fixed order, whether or not a Pattern is open (ticket 141)', async () => {
    const wrapper = mount(App)
    const column = wrapper.find('[data-testid="app-main-panel"]')
    const boxOrder = () => [...column.element.children].map((box) => box.getAttribute('data-testid'))

    expect(boxOrder()).toEqual(['new-pattern-box', 'bead-quantities', 'pattern-list'])

    await createPatternViaForm(wrapper, '15', '30')
    expect(boxOrder()).toEqual(['toolbox', 'save-box', 'bead-quantities', 'pattern-list'])

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click') // back to no Pattern open, but one is saved
    expect(boxOrder()).toEqual(['new-pattern-box', 'bead-quantities', 'pattern-list'])
  })

  it('puts the notice row under the header only while there is something to say (ticket 141)', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="app-notices"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-topbar"]').element.nextElementSibling?.classList.contains('app-shell__body')).toBe(true)
  })

  it('puts the Toolbox first in the left column while a Pattern is open, in place of the New Pattern form (tickets 114, 141)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const mainPanel = wrapper.find('[data-testid="app-main-panel"]')
    const toolbox = wrapper.find('[data-testid="toolbox"]')

    expect(mainPanel.find('[data-testid="bead-select"]').exists()).toBe(false)
    expect(mainPanel.element.firstElementChild).toBe(toolbox.element)
    expect(wrapper.find('[data-testid="app-canvas"]').find('[data-testid="toolbox"]').exists()).toBe(false)
    for (const testId of [
      'tool-paint',
      'tool-fill',
      'palette-picker',
      'undo-button',
      'tool-group-size',
    ]) {
      expect(toolbox.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('shows the New Pattern form in the left column, and no Toolbox, with no Pattern open (ticket 114)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')

    const mainPanel = wrapper.find('[data-testid="app-main-panel"]')
    expect(mainPanel.find('[data-testid="bead-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="toolbox"]').exists()).toBe(false)
  })

  it('puts the open Pattern\'s Technique behind the board, and the strip above it, in the canvas box (ticket 143)', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="canvas-backdrop"]').exists()).toBe(false)

    await createPatternViaForm(wrapper, '15', '30')

    const canvas = wrapper.find('[data-testid="app-canvas"]')
    expect(canvas.element.firstElementChild?.getAttribute('data-testid')).toBe('canvas-strip')
    expect(canvas.find('[data-testid="canvas-backdrop"]').attributes('aria-hidden')).toBe('true')
    expect(canvas.find('[data-testid="canvas-backdrop"]').text()).not.toBe('')
    expect(canvas.find('[data-testid="canvas-strip-size"]').exists()).toBe(true)
  })

  it('keeps the canvas box outside the left column, side by side in the body (ticket 141)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const column = wrapper.find('[data-testid="app-main-panel"]').element
    expect(column.contains(wrapper.find('[data-testid="app-canvas"]').element)).toBe(false)
    // The column sits in the Drawer (ticket 168), itself a direct child of the body alongside the canvas box.
    expect(wrapper.find('[data-testid="app-canvas"]').element.closest('.app-shell__body')).toBe(column.parentElement!.parentElement)
  })

  it('paints a cell with the selected palette color', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)

    expect(beadColor(wrapper, 0)).toBe('#e63746')

    // Releasing the button ends the stroke, which is when a stroke reaches storage (ticket 55).
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('paints a cell regardless of the Pattern\'s Technique', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
    await wrapper.find('[data-testid="technique-select"] [data-value="peyote"]').trigger('click')
    await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
    await wrapper.find('[data-testid="width-input"]').setValue('15')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('form').trigger('submit')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('fills a contiguous same-colored region with the fill tool', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows

    await wrapper.find('[data-color-id="red"]').trigger('click')
    // Paint a 2x2 red block: (0,0), (0,1), (1,0), (1,1).
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)
    await pressBead(wrapper, 10)
    await pressBead(wrapper, 11)

    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 0)

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
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)

    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 0)

    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
  })

  it('redoes an undone fill as a single action, re-repainting every cell it had touched', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)

    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 0)

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#2f6fed')
    expect(grid[0]![1]!.color).toBe('#2f6fed')
  })

  it('rotating is a view-only flip: it turns the picture on screen but never touches the grid, dimensions, or technique', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '5', '3') // 3 columns x 2 rows

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0) // paint (0,0)
    await wrapper.trigger('mouseup')
    const beforeRotate = loadPatterns()[0]!

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    const afterRotate = loadPatterns()[0]!
    expect(afterRotate.rotation).toBe(90)
    expect(afterRotate.columns).toBe(beforeRotate.columns)
    expect(afterRotate.rows).toBe(beforeRotate.rows)
    expect(afterRotate.grid).toEqual(beforeRotate.grid)
    // The header summary reflects how the Pattern currently looks (swapped), even though the stored grid didn't change.
    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('2×3')
  })

  it('cycles through all four quarter turns and back to upright on a fifth click (ticket 171)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '5', '3')

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    expect(loadPatterns()[0]!.rotation).toBe(90)
    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('2×3')

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    expect(loadPatterns()[0]!.rotation).toBe(180)
    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('3×2')

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    expect(loadPatterns()[0]!.rotation).toBe(270)
    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('2×3')

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    expect(loadPatterns()[0]!.rotation).toBe(0)
    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('3×2')
  })

  it('is not an undo step: rotating does not touch the undo history', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '5', '3')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(true)

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(true)
  })

  it('leaves redo untouched: Rotate is not a grid edit', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '5', '3')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)
    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('opens ready to paint with red selected by default, no swatch click needed first (ticket 27)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-color-id="red"]').attributes('aria-pressed')).toBe('true')

    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('paints with a Custom color exactly like a Palette color once one is chosen (ticket 43)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const customColorInput = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    customColorInput.element.value = '#123456'
    await customColorInput.trigger('input')

    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#123456')
  })

  it('shows the Custom color slot as selected once chosen, and the Palette deselected', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const customColorInput = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    customColorInput.element.value = '#123456'
    await customColorInput.trigger('input')

    expect(customColorInput.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-color-id="red"]').attributes('aria-pressed')).toBe('false')
  })

  it('deselects the Custom color slot when a Palette swatch is picked afterwards, and vice versa', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const customColorInput = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    customColorInput.element.value = '#123456'
    await customColorInput.trigger('input')

    await wrapper.find('[data-color-id="blue"]').trigger('click')

    expect(wrapper.find('[data-color-id="blue"]').attributes('aria-pressed')).toBe('true')
    expect(customColorInput.attributes('aria-pressed')).toBe('false')

    await customColorInput.trigger('input')

    expect(customColorInput.attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-color-id="blue"]').attributes('aria-pressed')).toBe('false')
  })

  it('replaces the previous Custom color when another one is chosen, leaving the Palette itself untouched', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const paletteSwatchCount = wrapper.findAll('[data-testid="palette-swatch"]').length

    const customColorInput = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    customColorInput.element.value = '#123456'
    await customColorInput.trigger('input')
    customColorInput.element.value = '#abcdef'
    await customColorInput.trigger('input')

    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#abcdef')
    expect(wrapper.findAll('[data-testid="palette-swatch"]')).toHaveLength(paletteSwatchCount)
  })

  it('lists cells painted with a Custom color in Beads needed, like any other color', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const customColorInput = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    customColorInput.element.value = '#123456'
    await customColorInput.trigger('input')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="quantity-count-#123456"]').text()).toBe('1')
  })

  it('paints every cell dragged over with the Paint tool, as a continuous stroke', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[0]![2]!.color).toBe('#e63746')
    // The rest of the stroke's row is untouched.
    expect(grid[0]![3]!.color).toBeNull()
  })

  it('undoes a whole dragged stroke as a single action, not one step per cell', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[0]![2]!.color).toBeNull()
    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled,
    ).toBe(true)
  })

  it('redoes a whole dragged stroke as a single action, not one step per cell', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[0]![2]!.color).toBe('#e63746')
    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled,
    ).toBe(true)
  })

  it('does not drag-fill with the Fill tool: a move afterwards is ignored', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    // Isolate cell 5 from cell 6 with different colors, so flood-fill's own same-color spread can't
    // explain either cell's result — only a (nonexistent) drag continuation could paint cell 6 green.
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 5)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await pressBead(wrapper, 6)
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-color-id="green"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 5)
    await hoverBead(wrapper, 6, { buttons: 1 })
    await wrapper.trigger('mouseup')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![5]!.color).toBe('#27ae60')
    expect(grid[0]![6]!.color).toBe('#2f6fed')
  })

  it('right-clicks a single cell to erase it with the Paint tool', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')

    await pressBead(wrapper, 0, { button: 2 })
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })

  it('right-click-drags with the Paint tool to erase every cell along the path, as one undo step', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressBead(wrapper, 0, { button: 2 })
    await hoverBead(wrapper, 1, { buttons: 2 })
    await hoverBead(wrapper, 2, { buttons: 2 })
    await wrapper.trigger('mouseup')

    let grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[0]![2]!.color).toBeNull()

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[0]![2]!.color).toBe('#e63746')
  })

  it('right-clicks with the Fill tool to flood-erase the connected same-color region in one click', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    // Paint a 2x2 red block: (0,0), (0,1), (1,0), (1,1).
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 10, { buttons: 1 })
    await hoverBead(wrapper, 11, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 0, { button: 2 })

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[1]![0]!.color).toBeNull()
    expect(grid[1]![1]!.color).toBeNull()
    // Outside the flood-erased region is untouched.
    expect(grid[0]![2]!.color).toBeNull()
  })

  it('undoes a single-click flood-erase as one step', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await pressBead(wrapper, 0, { button: 2 })
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
  })

  it('suppresses the native context menu when right-clicking the canvas', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    wrapper.find('[data-testid="pattern-surface"]').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('undoes the most recent paint action, and repeated undo steps back further', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

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
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(
      false,
    )
  })

  it('redoes the most recently undone change, and repeated redo steps forward through every undone change in order', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()

    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#2f6fed')
  })

  it('alternates undo and redo freely without losing or duplicating a step', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="undo-button"]').trigger('click') // back to red
    await wrapper.find('[data-testid="redo-button"]').trigger('click') // forward to blue
    await wrapper.find('[data-testid="undo-button"]').trigger('click') // back to red
    await wrapper.find('[data-testid="undo-button"]').trigger('click') // back to empty
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()

    await wrapper.find('[data-testid="redo-button"]').trigger('click') // forward to red
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('disables redo when there is nothing to redo, and re-disables it once redo is exhausted', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(true)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(true)

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(true)
  })

  it('clears the redo history once a new edit actually changes the grid', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await pressBead(wrapper, 1)
    await wrapper.trigger('mouseup')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(true)
  })

  it('switching or creating a Pattern clears the redo history, the same as the undo stack', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const firstId = loadPatterns()[0]!.id

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '6', '6')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(true)

    await wrapper.find(`[data-testid="select-pattern-${firstId}"]`).trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(true)
  })

  it('renders the Undo button as an icon, with an aria-label conveying its action for screen readers', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const undoButton = wrapper.find('[data-testid="undo-button"]')
    expect(undoButton.text()).toBe('')
    expect(undoButton.find('svg').exists()).toBe(true)
    expect(undoButton.attributes('aria-label')).toBe(ru.palette.undoButton)
  })

  it('persists painted cells across a reload', async () => {
    const first = mount(App)
    await createPatternViaForm(first, '15', '30')

    await first.find('[data-color-id="red"]').trigger('click')
    await pressBead(first, 0)
    await first.trigger('mouseup')
    first.unmount()

    const afterReload = mount(App)

    expect(beadColor(afterReload, 0)).toBe('#e63746')
  })

  it('never renders the Bead catalog section (ticket 38): the catalog is a fixed built-in list', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="bead-catalog"]').exists()).toBe(false)
  })

  it('offers exactly the three built-in Beads when creating a Pattern, even with custom-bead data left over from before ticket 38', () => {
    localStorage.setItem(
      'bd-beads:custom-beads',
      JSON.stringify([
        {
          id: 'acme-fancy-8-0',
          brand: 'Acme',
          name: 'Fancy',
          size: '8/0',
          formFactor: 'round',
          color: '#e63746',
          widthMm: 3,
          heightMm: 3,
        },
      ]),
    )

    const wrapper = mount(App)

    const options = wrapper.findAll<HTMLOptionElement>('[data-testid="bead-select"] option')
    expect(options).toHaveLength(BEAD_CATALOG.length)
    expect(options.map((option) => option.text())).not.toContain('Acme Fancy 8/0')
  })

  it('still opens, paints, and exports a Pattern created with a since-removed custom Bead', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
    savePatterns([{ ...pattern, beadId: 'acme-fancy-8-0' }])

    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="pattern-surface"]').exists()).toBe(true)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')

    // Export/import round-tripping an unresolved beadId is covered directly in patternFile.test.ts; here it's
    // enough that the button (disabled only while no Pattern is open) is live for this one.
    await wrapper.find('[data-testid="pattern-list"] [data-testid="panel-expand"]').trigger('click')
    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="export-pattern"]').element.disabled,
    ).toBe(false)
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

  it('reserves red for destructive actions, leaving every other button in the default style', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const patternId = loadPatterns()[0]!.id

    // Remove is the Saved Patterns card's small neutral × (ticket 147); nothing outside a confirmation is red.
    expect(wrapper.find(`[data-testid="remove-pattern-${patternId}"]`).classes()).not.toContain('button--danger')

    for (const testId of ['new-pattern-button', 'zoom-in', 'zoom-out', 'zoom-reset', 'tool-paint', 'tool-fill', 'undo-button', 'rotate-button', 'redo-button']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).classes()).not.toContain('button--danger')
    }
  })

  it('floats the zoom controls in the canvas panel, fixed to its corner rather than the Pattern\'s own box (ticket 57)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="app-main-panel"]').find('[data-testid="zoom-controls"]').exists()).toBe(false)

    const appCanvas = wrapper.find('[data-testid="app-canvas"]')
    expect(appCanvas.find('[data-testid="zoom-controls"]').exists()).toBe(true)
    // Fixed to the canvas panel itself, not to the Pattern's own bordered box inside it (ticket 51 anchored it there;
    // ticket 57 moved it one level up).
    expect(
      wrapper.find('[data-testid="pattern-canvas-viewport"]').find('[data-testid="zoom-controls"]').exists(),
    ).toBe(false)
  })

  it('zooms the open Pattern from the floating canvas-box controls', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('125%')

    await wrapper.find('[data-testid="zoom-reset"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')
  })

  it('lays the header out in the Header card\'s order, with the Pattern info only while one is open (ticket 142)', async () => {
    const wrapper = mount(App)
    const order = () =>
      [...wrapper.find('[data-testid="app-topbar"]').element.children].map(
        (child) =>
          child.getAttribute('data-testid') ??
          [...child.classList].find((name) => name.startsWith('app-header__')) ??
          child.querySelector('[data-testid]')?.getAttribute('data-testid'),
      )

    expect(order()).toEqual([
      'app-header__tools',
      'app-header__brand',
      'app-header__phone-only', // phone brand icon (ticket 188): the bead icon, apart from the <h1> wordmark
      'app-header__menu', // the header menu (ticket 210), next to the logo
      'app-header__phone-only', // phone theme icon: shown whether or not a Pattern is open
      'app-header__gap',
      'pattern-actions',
      'app-header__phone-hide', // New Pattern's wrapper (ticket 79: hidden at the phone tier)
      'app-header__wide-only',
      'app-header__wide-only',
      'app-header__shortcuts',
    ])

    await createPatternViaForm(wrapper, '15', '30')

    expect(order()).toEqual([
      'app-header__tools',
      'app-header__brand',
      'app-header__phone-only', // phone brand icon
      'app-header__menu',
      'app-header__phone-only', // phone bead/technique icon (ticket 188), opens the Pattern sheet's Bead pill row
      'app-header__phone-only', // phone theme icon
      'pattern-info',
      'app-header__phone-hide', // Replace bead's wrapper
      'app-header__gap',
      'pattern-actions',
      'app-header__phone-hide', // New Pattern's wrapper
      'app-header__phone-only', // phone Undo
      'app-header__phone-only', // phone Redo
      'app-header__wide-only',
      'app-header__wide-only',
      'app-header__shortcuts',
    ])
    const header = wrapper.find('[data-testid="app-topbar"]')
    expect(header.find('h1').text()).toBe('bd-beads')
    expect(header.find('h1 [data-testid="app-logo"]').exists()).toBe(true)
    expect(header.find('[data-testid="current-pattern-summary"]').text()).toBe('Pattern 1 · 10×20'.replace('Pattern 1', loadPatterns()[0]!.name))
  })

  it('keeps the two primary actions apart: Replace bead and New Pattern never sit side by side (ticket 142)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const select = wrapper.find('[data-testid="replace-bead-select"]').element.closest('.app-select')!
    expect(select.nextElementSibling?.getAttribute('data-testid')).not.toBe('new-pattern-button')
    expect(wrapper.find('[data-testid="new-pattern-button"]').classes()).toContain('app-button--primary')
    expect(select.classList).toContain('app-select--primary')
  })

  it('opens the keyboard shortcuts from the header\'s round button (ticket 142)', async () => {
    const wrapper = mount(App)

    await wrapper.find('[data-testid="shortcuts-button"]').trigger('click')

    expect(wrapper.findComponent({ name: 'ShortcutsHelp' }).exists()).toBe(true)
  })

  it('has New Pattern and the Imports only in the header, not in the Saved Patterns box (tickets 117, 142)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const patternList = wrapper.find('[data-testid="pattern-list"]')
    for (const testId of ['new-pattern-button', 'import-file', 'import-qr']) {
      expect(patternList.find(`[data-testid="${testId}"]`).exists()).toBe(false)
    }
  })

  it('keeps the two file exports in the Saved Patterns box, with no Export and import box (ticket 118)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const patternList = wrapper.find('[data-testid="pattern-list"]')
    // They sit in the footer the box shows once expanded (ticket 147).
    await patternList.find('[data-testid="panel-expand"]').trigger('click')
    expect(patternList.find('[data-testid="export-pattern"]').exists()).toBe(true)
    expect(patternList.find('[data-testid="export-library"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-transfer"]').exists()).toBe(false)
  })

  it('rules the canvas with row and column numbers on all four edges', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const canvas = wrapper.find('[data-testid="app-canvas"]')
    for (const edge of ['row-start', 'row-end', 'column-start', 'column-end']) {
      expect(canvas.find(`[data-testid="pattern-ruler-${edge}"]`).exists()).toBe(true)
    }
  })
})

/*
 * Every control in the Toolbox is an icon: no button label, just each Tool group's own small title (ticket 40) and
 * the Size group's readout as text (ticket 124 moved the Row progress group's own readout out to Progress bar, on
 * the canvas — see the "App Progress bar" describe block below). Button words survive as a hover/focus tooltip plus
 * the screen-reader name, so the Toolbox stays compact.
 */
describe('App Toolbox controls (ticket 75)', () => {
  /** The Tools group's tabs: an icon over a visible name, with the hotkey in the tooltip where there is one. */
  const tabs = [
    { testId: 'tool-paint', label: (t: typeof en) => t.tools.paintLabel, icon: 'paint', titleSuffix: ' (1)' },
    { testId: 'tool-fill', label: (t: typeof en) => t.tools.fillLabel, icon: 'fill', titleSuffix: ' (2)' },
    { testId: 'tool-select', label: (t: typeof en) => t.tools.selectLabel, icon: 'select', titleSuffix: ' (3)' },
    { testId: 'tool-erase', label: (t: typeof en) => t.tools.eraseLabel, icon: 'erase', titleSuffix: '' },
  ]

  /** Icon-only buttons: named by aria-label, shown as a tooltip; the hotkey, where there is one, in the title. */
  const iconButtons = [
    { testId: 'undo-button', label: (t: typeof en) => t.palette.undoButton, icon: 'undo' },
    { testId: 'redo-button', label: (t: typeof en) => t.palette.redoButton, icon: 'redo' },
    { testId: 'rotate-button', label: (t: typeof en) => t.palette.rotateButton, icon: 'rotate', titleSuffix: ' (R)' },
    { testId: 'copy-button', label: (t: typeof en) => t.tools.copyButton, icon: 'copy', titleSuffix: ' (Ctrl/Cmd+C)' },
  ]

  it.each(tabs)('draws $testId as a tab with its icon and its name, in both languages', async ({ testId, label, icon, titleSuffix }) => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    const tab = wrapper.find(`[data-testid="${testId}"]`)
    expect(tab.classes()).toContain('tool-tab')
    expect(tab.find('svg').attributes('data-icon')).toBe(icon)
    expect(tab.text()).toBe(label(en))
    expect(tab.attributes('title')).toBe(`${label(en)}${titleSuffix}`)

    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    expect(wrapper.find(`[data-testid="${testId}"]`).text()).toBe(label(ru))
  })

  it.each(iconButtons)('draws $testId as an icon button named for screen readers, in both languages', async ({ testId, label, icon, titleSuffix }) => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    const button = wrapper.find(`[data-testid="${testId}"]`)
    expect(button.classes()).toContain('icon-btn')
    expect(button.find('svg').attributes('data-icon')).toBe(icon)
    expect(button.text()).toBe('')
    expect(button.attributes('aria-label')).toBe(label(en))
    if (titleSuffix) expect(button.attributes('title')).toBe(`${label(en)}${titleSuffix}`)

    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    expect(wrapper.find(`[data-testid="${testId}"]`).attributes('aria-label')).toBe(label(ru))
  })

  it('puts Remove line and Delete all under the tabs as links, Delete all in the danger color', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    const removeLine = wrapper.find('[data-testid="tool-remove-line"]')
    expect(removeLine.text()).toBe(en.tools.removeLineShort)
    expect(removeLine.attributes('title')).toBe(en.tools.removeLineButton)
    const deleteAll = wrapper.find('[data-testid="delete-all-button"]')
    expect(deleteAll.text()).toBe(en.deleteAll.button)
    expect(deleteAll.classes()).toContain('app-link--danger')
  })

  it('gives the three always-open groups a label and makes Size a disclosure row (ticket 174 hid Mirror pending its own redesign)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    expect(wrapper.findAll('.tool-group__title').map((title) => title.text())).toEqual([
      en.toolbox.groups.tools,
      en.toolbox.groups.colors,
      en.toolbox.groups.edit,
    ])
    expect(wrapper.findAll('.disclosure-row__label').map((label) => label.text())).toEqual([en.toolbox.groups.size])
  })

  it('shows which tool is active', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="tool-paint"]').classes()).toContain('tool-tab--active')
    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })
})

/*
 * Progress bar (ticket 144): every Row progress control in one bar along the canvas box's bottom edge, always there
 * while a Pattern is open, since its first control is the switch that turns Row progress on.
 */
describe('App Progress bar', () => {
  async function enableRowProgress(wrapper: ReturnType<typeof mount>, width = '15', height = '30') {
    await createPatternViaForm(wrapper, width, height)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
  }

  it('is always there under the drawing area, with just its switch while Row progress is off', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const bar = wrapper.find('[data-testid="progress-bar"]')
    expect(bar.exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-canvas"]').element.lastElementChild).toBe(bar.element)
    expect(bar.find('[data-testid="progress-bar-switch"]').attributes('aria-checked')).toBe('false')
    expect(bar.find('[data-testid="progress-bar-next"]').exists()).toBe(false)

    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    expect(bar.find('[data-testid="progress-bar-switch"]').attributes('aria-checked')).toBe('true')
    expect(bar.find('[data-testid="progress-bar-next"]').exists()).toBe(true)
    expect(loadPatterns()[0]!.rowProgress.enabled).toBe(true)
  })

  it('is the same bar whatever the Pattern\'s shape or rotation', async () => {
    const wrapper = mount(App)
    await enableRowProgress(wrapper, '15', '30') // 10 columns x 20 rows
    const classes = wrapper.find('[data-testid="progress-bar"]').classes()

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar"]').classes()).toEqual(classes)
  })

  it('names Row not done and Row done in words, in both languages, with their icons', async () => {
    const wrapper = mount(App)
    await enableRowProgress(wrapper)

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-previous"]').text()).toBe('Row not done')
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe('Row done')
    expect(wrapper.find('[data-testid="progress-bar-previous"] svg').attributes('data-icon')).toBe('chevron-left')
    expect(wrapper.find('[data-testid="progress-bar-next"] svg').attributes('data-icon')).toBe('check')

    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-previous"]').text()).toBe(ru.rowProgress.previousButton)
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.nextButton)
  })

  it('makes Row done the primary action and names the switch for screen readers', async () => {
    const wrapper = mount(App)
    await enableRowProgress(wrapper)
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar-next"]').classes()).toContain('app-button--primary')
    const toggle = wrapper.find('[data-testid="progress-bar-switch"]')
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-label')).toBe(en.rowProgress.enabledLabel)
    expect(wrapper.find('[data-testid="progress-bar-direction"]').attributes('aria-label')).toBe(en.rowProgress.directionButton)
  })

  it('fills the track with the finished share of the rows', async () => {
    const wrapper = mount(App)
    await enableRowProgress(wrapper) // 20 rows
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    const track = wrapper.find('[data-testid="progress-bar-track"]')
    expect(track.attributes('aria-valuenow')).toBe('2')
    expect(track.attributes('aria-valuemax')).toBe('20')
    expect(track.find('span').attributes('style')).toContain('width: 10%')
  })
})

describe('App keyboard shortcuts', () => {
  /** Dispatched on `target` (window by default, the way Escape is), bubbling up so App's window-level listener sees it. */
  async function pressKey(init: KeyboardEventInit, target: EventTarget = window) {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
    await flushPromises()
  }

  /** Paints (0,0) red, as a single undo step to exercise the shortcuts against. */
  async function paintFirstCell(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
  }

  it.each([{ ctrlKey: true }, { metaKey: true }])('undoes on %s+Z', async (modifier) => {
    const wrapper = mount(App)
    await paintFirstCell(wrapper)

    await pressKey({ key: 'z', ...modifier })

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })

  it.each([{ ctrlKey: true, shiftKey: true }, { metaKey: true, shiftKey: true }, { ctrlKey: true, key: 'y' }])(
    'redoes on %s',
    async (modifier) => {
      const wrapper = mount(App)
      await paintFirstCell(wrapper)
      await pressKey({ key: 'z', ctrlKey: true })
      expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()

      await pressKey({ key: modifier.key ?? 'z', ...modifier })

      expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    },
  )

  it.each(['text', 'number'] as const)(
    'does not undo or redo while typing in a %s form field',
    async (type) => {
      // No text/number field ships alongside an active, painted Pattern in this app (ticket 38 removed the last
      // one, the Bead catalog's add-bead form) — a standalone field, attached to the document so the keydown still
      // bubbles to App.vue's window listener, is what isTypingInFormField actually cares about regardless of it
      // belonging to any real feature.
      const field = document.createElement('input')
      field.type = type
      document.body.appendChild(field)

      try {
        const wrapper = mount(App)
        await paintFirstCell(wrapper)

        await pressKey({ key: 'z', ctrlKey: true }, field)

        expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')

        await wrapper.find('[data-testid="undo-button"]').trigger('click')
        await pressKey({ key: 'z', ctrlKey: true, shiftKey: true }, field)

        expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
      } finally {
        field.remove()
      }
    },
  )

  it('works anywhere in the editor, the same as Escape, not just while the canvas has focus', async () => {
    const wrapper = mount(App)
    await paintFirstCell(wrapper)

    await pressKey({ key: 'z', ctrlKey: true })

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })
})

async function pressKey(init: KeyboardEventInit, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

/**
 * The window-level keyboard shortcut tests below (tickets 87-96) dispatch on `window`, which every still-mounted
 * App instance in this file hears -- and unlike the rest of this suite, several of these assert an *incremental*
 * state (a row-progress pointer, a mirror axis count) that isn't idempotent under a stray extra firing from an
 * earlier test's App instance. mountAppForCleanup tracks every mount here so afterEach can unmount it, keeping
 * each test's dispatched keydowns reaching only its own wrapper.
 */
const mountedAppsForCleanup: ReturnType<typeof mount>[] = []
function mountAppForCleanup() {
  const wrapper = mount(App)
  mountedAppsForCleanup.push(wrapper)
  return wrapper
}
afterEach(() => {
  for (const wrapper of mountedAppsForCleanup.splice(0)) {
    wrapper.unmount()
  }
})

describe('App Tools group hotkeys — 1/2/3 (ticket 87)', () => {
  it.each([
    { key: '1', testId: 'tool-paint' },
    { key: '2', testId: 'tool-fill' },
    { key: '3', testId: 'tool-select' },
  ])('$key selects $testId, the same as clicking it', async ({ key, testId }) => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click') // start on a different tool

    await pressKey({ key })

    expect(wrapper.find(`[data-testid="${testId}"]`).attributes('aria-pressed')).toBe('true')
  })

  it('works even while a Selection or a paste projection is active', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: '1' })

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = mountAppForCleanup()
      await createPatternViaForm(wrapper, '15', '30')
      await wrapper.find('[data-testid="tool-fill"]').trigger('click')

      await pressKey({ key: '1' }, field)

      expect(wrapper.find('[data-testid="tool-fill"]').attributes('aria-pressed')).toBe('true')
    } finally {
      field.remove()
    }
  })

  it('has no effect while a confirm modal is open', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)

    await pressKey({ key: '1' })

    expect(wrapper.find('[data-testid="tool-fill"]').attributes('aria-pressed')).toBe('true')
  })
})

describe('App Colors group hotkeys — Shift+1..9,0,Q,W (ticket 88)', () => {
  const COLOR_SHORTCUT_CODES = [
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyQ', 'KeyW',
  ]

  it.each(PALETTE.map((color, index) => ({ color, code: COLOR_SHORTCUT_CODES[index]! })))(
    'Shift+$code paints with $color.id, in Palette order',
    async ({ color, code }) => {
      const wrapper = mountAppForCleanup()
      await createPatternViaForm(wrapper, '15', '30')

      await pressKey({ code, shiftKey: true })
      await pressBead(wrapper, 0)
      await wrapper.trigger('mouseup')

      expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe(color.hex)
    },
  )

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = mountAppForCleanup()
      await createPatternViaForm(wrapper, '15', '30')

      await pressKey({ code: 'Digit2', shiftKey: true }, field)
      await pressBead(wrapper, 0)
      await wrapper.trigger('mouseup')

      // Red is still the default selected color (ticket 27); Shift+2 (orange) never landed.
      expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    } finally {
      field.remove()
    }
  })
})

describe('App Eraser tool (ticket 89, single-bead default per ticket 176)', () => {
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.trigger('mouseup')
  }

  /** A 2x2 Pattern (from a 3mm x 3mm cube-bead Pattern), fully painted red. */
  async function paintedSmallPattern(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '3', '3')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    for (let index = 0; index < 4; index++) {
      await click(wrapper, index)
    }
  }

  it('erases just the clicked bead, not its connected same-color region, as one undo step', async () => {
    const wrapper = mountAppForCleanup()
    await paintedSmallPattern(wrapper)
    await wrapper.find('[data-testid="tool-erase"]').trigger('click')

    await click(wrapper, 0)

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[1]![0]!.color).toBe('#e63746')
    expect(grid[1]![1]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid.flat().every((cell) => cell.color === '#e63746')).toBe(true)
  })

  it('erases every cell dragged over, as one undo step, on the primary press -- no right-click needed', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="tool-erase"]').trigger('click')

    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')

    let grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[0]![2]!.color).toBeNull()

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[0]![2]!.color).toBe('#e63746')
  })


  it('respects the Row progress lock: a finished row is left alone', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    for (let index = 0; index < 8; index++) {
      await click(wrapper, index) // paint the first two rows
    }
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // row 0 finished
    await wrapper.find('[data-testid="tool-erase"]').trigger('click')

    await click(wrapper, 0) // (0,0), in the finished row

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('leaves right-click erase under Paint and Fill unaffected by the new default behavior', async () => {
    const wrapper = mountAppForCleanup()
    await paintedSmallPattern(wrapper)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await pressBead(wrapper, 0, { button: 2 })

    expect(loadPatterns()[0]!.grid.flat().every((cell) => cell.color === null)).toBe(true)
  })
})

describe('App picking a color switches to Paint (ticket 171)', () => {
  it.each(['tool-fill', 'tool-select', 'tool-erase'])('switches from %s to Paint on picking a Palette color', async (testId) => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find(`[data-testid="${testId}"]`).trigger('click')

    await wrapper.find('[data-color-id="red"]').trigger('click')

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find(`[data-testid="${testId}"]`).attributes('aria-pressed')).toBe('false')
  })

  it('switches to Paint on picking a Custom color', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await wrapper.find('[data-testid="custom-color-input"]').setValue('#123456')

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })

  it('switches to Paint on picking a Palette color by its Shift+key shortcut (ticket 88)', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await pressKey({ code: 'Digit1', shiftKey: true })

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })

  it('leaves Paint active and does not clear a Select marquee when Paint is already the active tool', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="blue"]').trigger('click')

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })

  it('leaves a Fill in progress unaffected: picking a color only changes the next stroke\'s tool', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await wrapper.find('[data-color-id="blue"]').trigger('click')

    // The tool switched to Paint; a press now paints one bead rather than flood-filling.
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#2f6fed')
    expect(grid[0]![1]!.color).toBe('#e63746')
  })
})

describe('App Del key — Erase, or clear the Selection (ticket 90)', () => {
  async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
    await pressBead(wrapper, indices[0]!)
    for (const index of indices.slice(1)) {
      await hoverBead(wrapper, index, { buttons: 1 })
    }
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.trigger('mouseup')
  }

  it('clears just the selected cells, keeping the Selection and staying on Select, as one undo step', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    for (let index = 0; index < 16; index++) {
      await click(wrapper, index)
    }
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1, 4, 5]) // a 2x2 selection

    await pressKey({ key: 'Delete' })

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[1]![0]!.color).toBeNull()
    expect(grid[1]![1]!.color).toBeNull()
    expect(grid[2]![2]!.color).toBe('#e63746') // outside the selection, untouched
    expect(selectedBeadCount(wrapper)).toBe(4) // the Selection itself remains
    expect(wrapper.find('[data-testid="tool-select"]').attributes('aria-pressed')).toBe('true')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('activates Erase when Select is active with no Selection', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await pressKey({ key: 'Delete' })

    expect(wrapper.find('[data-testid="tool-erase"]').attributes('aria-pressed')).toBe('true')
  })

  it('activates Erase when any other tool is active', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await pressKey({ key: 'Delete' })

    expect(wrapper.find('[data-testid="tool-erase"]').attributes('aria-pressed')).toBe('true')
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = mountAppForCleanup()
      await createPatternViaForm(wrapper, '15', '30')

      await pressKey({ key: 'Delete' }, field)

      expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
    } finally {
      field.remove()
    }
  })
})

describe('App Edit group hotkeys — Rotate (R) and Copy (Ctrl/Cmd+C) (ticket 91)', () => {
  it('toggles Rotate on R, the same as clicking the button', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    await pressKey({ key: 'r' })

    expect(loadPatterns()[0]!.rotation).toBe(90)
  })

  it('copies the active Selection on Ctrl/Cmd+C, the same as clicking Copy', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: 'c', ctrlKey: true })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true) // hides the marquee, same as a click
    expect(selectedBeadCount(wrapper)).toBe(0)
  })

  it('is a no-op copying with no Selection (Copy disabled)', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    await pressKey({ key: 'c', ctrlKey: true })

    // Nothing to assert directly beyond no error/crash; canCopy stays false either way.
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = mountAppForCleanup()
      await createPatternViaForm(wrapper, '15', '30')

      await pressKey({ key: 'r' }, field)

      expect(loadPatterns()[0]!.rotation).toBe(0)
    } finally {
      field.remove()
    }
  })
})

describe('App Mirror group hotkeys removed (ticket 174, pending its own redesign)', () => {
  it('-, =, [, ], M, H and V no longer do anything: no UI is left for them to reach', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    const before = loadPatterns()[0]!.grid

    for (const key of ['-', '=', '[', ']', 'm', 'h', 'v']) {
      await pressKey({ key })
    }

    expect(loadPatterns()[0]!.grid).toEqual(before)
  })
})

describe('App Row progress group hotkeys (ticket 94)', () => {
  it('P toggles Row progress on/off', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    await pressKey({ key: 'p' })

    expect(wrapper.find('[data-testid="progress-bar-switch"]').attributes('aria-checked')).toBe('true')
  })

  it('D toggles Row direction', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    await pressKey({ key: 'd' })
    expect(loadPatterns()[0]!.rowProgress.direction).toBe('columns')

    // The direction button shows once Row progress is on, already turned.
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-direction"]').attributes('aria-pressed')).toBe('true')
  })

  it('Enter/Shift+Enter move to the next/previous row', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await pressKey({ key: 'Enter' })
    await pressKey({ key: 'Enter' })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)

    await pressKey({ key: 'Enter', shiftKey: true })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b2\D+20\b/)
  })

  it('respects the disabled bounds at the first/last row', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '3', '3') // 2x2
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await pressKey({ key: 'Enter', shiftKey: true }) // already at the first row

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+2\b/)
  })

  it('is a no-op while Row progress is off', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    await pressKey({ key: 'Enter' })

    expect(loadPatterns()[0]!.rowProgress.currentRow).toBe(0)
  })

  it('suppresses Enter/Shift+Enter when a Toolbox button has focus, so Tab+Enter does not also move the row', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    const button = wrapper.find('[data-testid="undo-button"]').element as HTMLButtonElement
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+20\b/)
  })

  it('suppresses Enter/Shift+Enter when a Progress bar button itself has focus (ticket 124 moved it off the Toolbox), so a plain click there does not also double-move the row', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    const button = wrapper.find('[data-testid="progress-bar-next"]').element as HTMLButtonElement
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+20\b/)
  })

  it('Space/Shift+Space also move to the next/previous row (ticket 178)', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await pressKey({ key: ' ' })
    await pressKey({ key: ' ' })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)

    await pressKey({ key: ' ', shiftKey: true })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b2\D+20\b/)
  })

  it('is a no-op for Space/Shift+Space too while Row progress is off', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    await pressKey({ key: ' ' })
    await pressKey({ key: ' ', shiftKey: true })

    expect(loadPatterns()[0]!.rowProgress.currentRow).toBe(0)
  })

  it('suppresses Space/Shift+Space when a Toolbox or Progress bar button has focus, so it activates the button rather than double-moving the row', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    const toolboxButton = wrapper.find('[data-testid="undo-button"]').element as HTMLButtonElement
    toolboxButton.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+20\b/)

    const progressButton = wrapper.find('[data-testid="progress-bar-next"]').element as HTMLButtonElement
    progressButton.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+20\b/)
  })

  it('does not fire Space/Shift+Space while typing in a text input', async () => {
    const field = document.createElement('input')
    field.type = 'text'
    document.body.appendChild(field)

    try {
      const wrapper = mountAppForCleanup()
      await createPatternViaForm(wrapper, '15', '30')
      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

      await pressKey({ key: ' ' }, field)
      await pressKey({ key: ' ', shiftKey: true }, field)

      expect(loadPatterns()[0]!.rowProgress.currentRow).toBe(0)
    } finally {
      field.remove()
    }
  })
})

describe('App Space+drag pan (ticket 95)', () => {
  function spaceDown() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))
  }

  it('does not paint even if the pointer moves over cells while Space is held', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    spaceDown()
    await flushPromises()
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })

  it('shows a grab cursor while Space is held', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    spaceDown()
    await flushPromises()

    expect(wrapper.find('[data-testid="app-canvas"]').classes()).toContain('app-shell__canvas--pan')
  })

  it('is suppressed while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = mountAppForCleanup()
      await createPatternViaForm(wrapper, '15', '30')

      field.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))
      await flushPromises()

      expect(wrapper.find('[data-testid="app-canvas"]').classes()).not.toContain('app-shell__canvas--pan')
    } finally {
      field.remove()
    }
  })
})

describe('App shortcuts help overlay (ticket 96)', () => {
  it('opens on ?', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')

    await pressKey({ key: '?' })

    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(true)
  })

  it('closes on Escape without also backing out of Select', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')
    await pressKey({ key: '?' })

    await pressKey({ key: 'Escape' })

    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(false)
    expect(selectedBeadCount(wrapper)).toBe(2) // untouched by that Escape
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = mountAppForCleanup()
      await createPatternViaForm(wrapper, '15', '30')

      await pressKey({ key: '?' }, field)

      expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(false)
    } finally {
      field.remove()
    }
  })

  it('has no effect while a confirm modal is open', async () => {
    const wrapper = mountAppForCleanup()
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    await pressKey({ key: '?' })

    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(false)
  })
})

describe('App hover preview', () => {
  it('shows a faint preview of the selected color at the hovered cell, clearing on mouse leave', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await hoverBead(wrapper, 5)
    expect(previewedBeads(wrapper)).toEqual([{ row: 0, column: 5, color: '#e63746' }])

    await leaveSurface(wrapper)
    expect(previewedBeads(wrapper)).toEqual([])
  })

  // The neutral (no color selected) preview is the overlay renderer's own concern and is covered directly in
  // overlayRenderer.test.ts; since ticket 27 made red App's default selection, nothing is never actually selected
  // while a Pattern is open here, so there's no reachable App-level scenario left to exercise it through.

})

describe('App row progress', () => {
  it('shows the overlay only once it is toggled on, without leaving the editor', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(rowProgressView(wrapper).markerShown).toBe(false)

    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    expect(rowProgressView(wrapper).markerShown).toBe(true)
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)
  })

  it('advances the pointer as rows are finished, dimming the rows behind it', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)
    // Two rows are behind the pointer and dimmed, and the third is the one outlined.
    expect(rowProgressView(wrapper)).toMatchObject({ direction: 'rows', finished: 2, current: 2 })
  })

  it('moves the pointer back to an earlier row', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="progress-bar-previous"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b2\D+20\b/)
    expect(rowProgressView(wrapper)).toMatchObject({ finished: 1 })
  })

  it('will not step past either end of the Pattern', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').element.disabled,
    ).toBe(true)

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').element.disabled,
    ).toBe(true)
  })

  it('remembers where the weaving got to across a reload', async () => {
    const first = mount(App)
    await createPatternViaForm(first, '15', '30')
    await first.find('[data-testid="progress-bar-switch"]').trigger('click')
    await first.find('[data-testid="progress-bar-next"]').trigger('click')
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b2\D+20\b/)
    expect(rowProgressView(afterReload)).toMatchObject({ finished: 1 })
    expect(loadPatterns()[0]!.rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 1,
      currentColumn: 0,
    })
  })

  describe('row direction', () => {
    function position(wrapper: ReturnType<typeof mount>) {
      return wrapper.find('[data-testid="progress-bar-position"]').text()
    }

    it('turns rows to run down the columns: the readout counts columns and the steps move through them', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows
      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')

      expect(wrapper.find('[data-testid="progress-bar-direction"]').attributes('aria-pressed')).toBe('true')
      expect(position(wrapper)).toMatch(/\b1\D+10\b/)

      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      expect(position(wrapper)).toMatch(/\b3\D+10\b/)
      // Rows run down the columns: the first two columns are behind the pointer and dimmed, the third is outlined.
      expect(rowProgressView(wrapper)).toMatchObject({ direction: 'columns', finished: 2, current: 2 })
    })

    it('will not step past the last column', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '5', '3') // 3 columns x 2 rows
      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')

      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      expect(position(wrapper)).toMatch(/\b3\D+3\b/)
      expect(
        wrapper.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').element.disabled,
      ).toBe(true)
    })

    it('returns to the row the weaver was on after flipping the direction and back', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows
      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
      expect(position(wrapper)).toMatch(/\b2\D+10\b/)

      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
      expect(position(wrapper)).toMatch(/\b3\D+20\b/)
    })

    it('remembers the direction and where the weaving got to across a reload', async () => {
      const first = mount(App)
      await createPatternViaForm(first, '15', '30')
      await first.find('[data-testid="progress-bar-switch"]').trigger('click')
      await first.find('[data-testid="progress-bar-direction"]').trigger('click')
      await first.find('[data-testid="progress-bar-next"]').trigger('click')
      first.unmount()

      const afterReload = mount(App)

      expect(afterReload.find('[data-testid="progress-bar-direction"]').attributes('aria-pressed')).toBe('true')
      expect(position(afterReload)).toMatch(/\b2\D+10\b/)
    })

    it('is its own toggle, apart from Rotate: neither changes the other, and flipping is not an undo step', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')
      const gridBefore = loadPatterns()[0]!.grid

      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')

      expect(loadPatterns()[0]!.rotation).toBe(0)
      expect(loadPatterns()[0]!.grid).toEqual(gridBefore)
      expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(true)

      await wrapper.find('[data-testid="rotate-button"]').trigger('click')

      expect(loadPatterns()[0]!.rowProgress.direction).toBe('columns')
      await wrapper.find('[data-testid="rotate-button"]').trigger('click')
      expect(loadPatterns()[0]!.rowProgress.direction).toBe('columns')
    })

    it('leaves redo untouched: Row direction and moving the Row progress pointer are not grid edits', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')
      await wrapper.find('[data-color-id="red"]').trigger('click')
      await pressBead(wrapper, 0)
      await wrapper.trigger('mouseup')
      await wrapper.find('[data-testid="undo-button"]').trigger('click')
      expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
      await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

      expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)
      await wrapper.find('[data-testid="redo-button"]').trigger('click')
      expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    })
  })
})

describe('App finished rows', () => {
  /** Opens a 10-column x 20-row Pattern with Row progress on and rows 1-2 marked done, red selected; returns its cells. */
  async function withTwoRowsWoven(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
  }

  function colorAt(row: number, column: number) {
    return loadPatterns()[0]!.grid[row]![column]!.color
  }

  function undoDisabled(wrapper: ReturnType<typeof mount>) {
    return wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled
  }

  function redoDisabled(wrapper: ReturnType<typeof mount>) {
    return wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled
  }

  it('will not paint a bead in a finished row, and records no undo step for trying', async () => {
    const wrapper = mount(App)
    await withTwoRowsWoven(wrapper)

    await pressBead(wrapper, 14) // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(undoDisabled(wrapper)).toBe(true)
  })

  it('an edit that lands only on a finished row changes nothing, so it leaves redo alone', async () => {
    const wrapper = mount(App)
    await withTwoRowsWoven(wrapper)
    await pressBead(wrapper, 24) // (2,4), the current row — a real edit
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(redoDisabled(wrapper)).toBe(false)

    await pressBead(wrapper, 14) // (1,4), a finished row — paints nothing
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(redoDisabled(wrapper)).toBe(false)
    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(colorAt(2, 4)).toBe('#e63746')
  })

  it('paints only the unfinished part of a drag that crosses into the current row', async () => {
    const wrapper = mount(App)
    await withTwoRowsWoven(wrapper)

    await pressBead(wrapper, 14) // (1,4)
    await hoverBead(wrapper, 24, { buttons: 1 }) // (2,4), the current row
    await hoverBead(wrapper, 34, { buttons: 1 }) // (3,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(colorAt(2, 4)).toBe('#e63746')
    expect(colorAt(3, 4)).toBe('#e63746')
  })

  it('will not right-click erase a bead in a finished row', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 4) // (0,4), painted before it was woven
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await pressBead(wrapper, 4, { button: 2 })
    await wrapper.trigger('mouseup')

    expect(colorAt(0, 4)).toBe('#e63746')
  })

  it('fills only the unfinished part of an area that reaches into finished rows', async () => {
    const wrapper = mount(App)
    await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await pressBead(wrapper, 55) // (5,5), in the one empty area covering the whole grid

    expect(colorAt(0, 0)).toBeNull()
    expect(colorAt(1, 9)).toBeNull()
    expect(colorAt(2, 0)).toBe('#e63746')
    expect(colorAt(19, 9)).toBe('#e63746')
  })

  it('stamps a pasted block only onto the unfinished beads it covers', async () => {
    const wrapper = mount(App)
    await withTwoRowsWoven(wrapper)
    await pressBead(wrapper, 50) // (5,0)
    await hoverBead(wrapper, 60, { buttons: 1 }) // (6,0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 50)
    await hoverBead(wrapper, 60, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await pressBead(wrapper, 10) // stamps onto (1,0) and (2,0)
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(colorAt(1, 0)).toBeNull()
    expect(colorAt(2, 0)).toBe('#e63746')
  })

  it('locks the finished columns instead once rows run down them', async () => {
    const wrapper = mount(App)
    await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await pressBead(wrapper, 0) // (0,0), a row that's finished no longer, in a column that now is
    await wrapper.trigger('mouseup')
    await pressBead(wrapper, 11) // (1,1), the current column
    await wrapper.trigger('mouseup')

    expect(colorAt(0, 0)).toBeNull()
    expect(colorAt(1, 1)).toBe('#e63746')
  })

  it('lets every bead be drawn on again once the overlay is off', async () => {
    const wrapper = mount(App)
    await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await pressBead(wrapper, 14) // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBe('#e63746')
  })

  it('previews no paint on a finished bead', async () => {
    const wrapper = mount(App)
    await withTwoRowsWoven(wrapper)

    await hoverBead(wrapper, 14) // (1,4)
    expect(previewedBeads(wrapper)).toHaveLength(0)
  })

  it('still undoes in full, even a change to a row marked done since', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 4) // (0,4)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(colorAt(0, 4)).toBeNull()
  })

  it('redoes in full too, even onto a row marked done since', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 4) // (0,4)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // row 0 now finished

    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    expect(colorAt(0, 4)).toBe('#e63746')
  })
})

describe('App delete all', () => {
  /** Presses and releases one cell without moving — a click. */
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  function loadedPattern() {
    return loadPatterns()[0]!
  }

  it('opens a confirmation modal instead of clearing immediately', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)
    expect(loadedPattern().grid[0]![0]!.color).toBe('#e63746')
  })

  it('leaves the Pattern untouched when Cancel is clicked, and closes the modal', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(loadedPattern().grid[0]![0]!.color).toBe('#e63746')
  })

  it('leaves the Pattern untouched when Escape is pressed, and closes the modal without also backing out of Select', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0) // paint (0,0) red
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await click(wrapper, 0) // select (0,0)
    await wrapper.find('[data-testid="copy-button"]').trigger('click') // copiedBlock now holds the red cell

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(false)
    expect(loadedPattern().grid[0]![0]!.color).toBe('#e63746')

    // If Escape had also run backOutOfSelect, it would have dropped the copied block (cancelPaste), and this next
    // click would start a fresh Selection instead of stamping — leaving (1,1) uncolored.
    await click(wrapper, 5) // (1,1)
    expect(loadedPattern().grid[1]![1]!.color).toBe('#e63746')
  })

  it('empties every cell and turns Row progress off with both direction pointers back at the first row, once confirmed', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)
    await click(wrapper, 25)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().grid.flat().every((cell) => cell.color === null)).toBe(true)
    expect(loadedPattern().rowProgress).toEqual({
      enabled: false,
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
  })

  it('keeps name, size, Technique, Bead and rotation unchanged', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    const before = loadedPattern()

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    const after = loadedPattern()
    expect(after.name).toBe(before.name)
    expect(after.technique).toBe(before.technique)
    expect(after.beadId).toBe(before.beadId)
    expect(after.columns).toBe(before.columns)
    expect(after.rows).toBe(before.rows)
    expect(after.rotation).toBe(before.rotation)
    expect(after.rotation).toBe(90)
  })

  it('ignores the Row progress lock, clearing beads in finished rows along with the rest', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 4) // (0,4), painted before it's locked
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // row 0 now finished/locked

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().grid[0]![4]!.color).toBeNull()
  })


  it('is one undo step: a single Undo restores both the painted grid and Row progress together, including woven rows', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 4) // (0,4)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // rows 0-1 finished

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(loadedPattern().grid[0]![4]!.color).toBe('#e63746')
    expect(loadedPattern().rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 2,
      currentColumn: 0,
    })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)
  })

  it('does nothing when there is no open Pattern', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="delete-all-button"]').exists()).toBe(false)
  })

  it('translates the modal title, message and button labels with the interface language', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-en"]').trigger('click')
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    expect(wrapper.text()).toContain(en.deleteAll.confirmTitle)
    expect(wrapper.text()).toContain(en.deleteAll.confirmMessage)
    expect(wrapper.find('[data-testid="confirm-modal-cancel"]').text()).toBe(en.deleteAll.cancelButton)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.deleteAll.confirmButton)

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')
    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    expect(wrapper.text()).toContain(ru.deleteAll.confirmTitle)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(ru.deleteAll.confirmButton)
  })
})

describe('App header bead', () => {
  it("shows the open Pattern's Bead label in the header", async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="current-pattern-bead"]').text()).toBe('TOHO Cube 1.5mm')
  })

  it('updates the Bead shown when switching to another Pattern', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const firstId = loadPatterns()[0]!.id

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await wrapper.find('[data-testid="bead-select"]').setValue('miyuki-delica-11-0')
    await wrapper.find('[data-testid="unit-select"] [data-value="mm"]').trigger('click')
    await wrapper.find('[data-testid="width-input"]').setValue('15')
    await wrapper.find('[data-testid="height-input"]').setValue('30')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[data-testid="current-pattern-bead"]').text()).toBe('Miyuki Delica 11/0')

    await wrapper.find(`[data-testid="select-pattern-${firstId}"]`).trigger('click')

    expect(wrapper.find('[data-testid="current-pattern-bead"]').text()).toBe('TOHO Cube 1.5mm')
  })

  it('shows no Bead in the header with no Pattern open', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const patternId = loadPatterns()[0]!.id

    await wrapper.find(`[data-testid="remove-pattern-${patternId}"]`).trigger('click')

    expect(wrapper.find('[data-testid="current-pattern-bead"]').exists()).toBe(false)
  })

  it('shows an "unknown bead" label, translated, for a Pattern whose Bead is not in the catalog', async () => {
    const pattern = createPattern({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
    savePatterns([{ ...pattern, beadId: 'no-such-bead' }])

    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="current-pattern-bead"]').text()).toBe(ru.patterns.unknownBeadLabel)

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    expect(wrapper.find('[data-testid="current-pattern-bead"]').text()).toBe(en.patterns.unknownBeadLabel)
  })

  it('leaves the Saved Patterns list unchanged: no Bead shown there', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const patternId = loadPatterns()[0]!.id

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '30', '30')

    const patternItem = wrapper
      .findAll('[data-testid="pattern-item"]')
      .find((item) => item.find(`[data-testid="select-pattern-${patternId}"]`).exists())!
    expect(patternItem.find('[data-testid="current-pattern-bead"]').exists()).toBe(false)
  })
})

describe('App replace bead', () => {
  function loadedPattern() {
    return loadPatterns()[0]!
  }

  it('offers the other built-in catalog Beads, not the current one', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // Cube

    const labels = wrapper.find('[data-testid="replace-bead-select"]').findAll('option').map((option) => option.text())
    expect(labels).not.toContain('TOHO Cube 1.5mm')
    expect(labels).toContain('TOHO Round 11/0')
    expect(labels).toContain('Miyuki Delica 11/0')
  })

  it('opens a confirmation modal showing the new Estimated size next to the current one instead of replacing immediately', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10x20 at Cube: about 1.5 x 3.0 cm

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    const modal = wrapper.find('[data-testid="replace-bead-modal"]')
    expect(modal.exists()).toBe(true)
    // The same 10x20 grid at Round (1.65 x 2.2mm): 16.5 x 44mm.
    expect(modal.text()).toContain('With TOHO Round 11/0, this Pattern will be about 1.7 × 4.4 cm instead of 1.5 × 3.0 cm.')
    expect(modal.text()).toContain('Your design and its bead count stay exactly the same')
    expect(modal.text()).toContain('add or remove rows and columns afterwards')
    expect(modal.text()).not.toContain('New size')
    expect(loadedPattern().beadId).toBe('toho-cube-1.5mm')
  })

  it('reports the estimate the way the screen shows the Pattern, so a rotated Pattern swaps width and height', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-en"]').trigger('click')
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').text()).toContain('about 4.4 × 1.7 cm instead of 3.0 × 1.5 cm')
  })

  it('leaves the Pattern untouched when Cancel is clicked, and closes the modal', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(false)
    expect(loadedPattern().beadId).toBe('toho-cube-1.5mm')
  })

  it('goes back to its placeholder after Cancel, rather than keeping the declined Bead selected (ticket 113)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const select = wrapper.find<HTMLSelectElement>('[data-testid="replace-bead-select"]')

    await select.setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    expect(select.element.value).toBe('')
  })

  it('opens the modal again when the same Bead is picked a second time after Cancel (ticket 113)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const select = wrapper.find<HTMLSelectElement>('[data-testid="replace-bead-select"]')

    await select.setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')
    await select.setValue('toho-round-11-0')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(true)
  })

  it('goes back to its placeholder after Confirm, with the current Bead label showing the new Bead (ticket 113)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const select = wrapper.find<HTMLSelectElement>('[data-testid="replace-bead-select"]')

    await select.setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(select.element.value).toBe('')
    expect(wrapper.find('[data-testid="current-pattern-bead"]').text()).toBe('TOHO Round 11/0')
  })

  it('leaves the Pattern untouched when Escape is pressed, and closes the modal without also backing out of Select', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6') // 4x4 at Cube
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup') // paint (0,0) red
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup') // select (0,0)
    await wrapper.find('[data-testid="copy-button"]').trigger('click') // copiedBlock now holds the red cell

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(false)
    expect(loadedPattern().beadId).toBe('toho-cube-1.5mm')

    // If Escape had also run backOutOfSelect, it would have dropped the copied block, and this next click would
    // start a fresh Selection instead of stamping.
    await pressBead(wrapper, 5)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(loadedPattern().grid[1]![1]!.color).toBe('#e63746')
  })

  it('switches the Bead once confirmed and leaves the grid exactly as it was', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10x20 at Cube

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().beadId).toBe('toho-round-11-0')
    expect(loadedPattern().columns).toBe(10)
    expect(loadedPattern().rows).toBe(20)
    expect(loadedPattern()).not.toHaveProperty('widthMm')
    expect(wrapper.find('[data-testid="current-pattern-bead"]').text()).toBe('TOHO Round 11/0')
  })

  it('leaves every painted cell where it was, with no rescale', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0) // (0,0)
    await pressBead(wrapper, 199) // (19,9)
    await wrapper.find('.app-shell').trigger('mouseup')
    const before = loadedPattern().grid

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().grid).toEqual(before)
    expect(loadedPattern().grid[0]![0]!.color).toBe('#e63746')
    expect(loadedPattern().grid[19]![9]!.color).toBe('#e63746')
  })

  it('keeps Row progress as it was, since the grid it describes is unchanged', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 1,
      currentColumn: 0,
    })
  })

  it('works on a Pattern created in beads and painted on', async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="bead-select"]').setValue(cubeBead.id)
    await wrapper.find('[data-testid="width-input"]').setValue('12')
    await wrapper.find('[data-testid="height-input"]').setValue('5')
    await wrapper.find('form').trigger('submit') // beads: 12x5
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 7)
    await wrapper.find('.app-shell').trigger('mouseup')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('miyuki-delica-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().beadId).toBe('miyuki-delica-11-0')
    expect(loadedPattern().columns).toBe(12)
    expect(loadedPattern().rows).toBe(5)
    expect(loadedPattern().grid[0]![7]!.color).toBe('#e63746')
  })

  it('keeps name, Technique and rotation unchanged', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    const before = loadedPattern()

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    const after = loadedPattern()
    expect(after.name).toBe(before.name)
    expect(after.technique).toBe(before.technique)
    expect(after.rotation).toBe(90)
  })

  it('is one undo step: a single Undo restores the previous Bead, and Redo swaps it back', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup') // paint (0,0) red
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(loadedPattern().beadId).toBe('toho-cube-1.5mm')
    expect(loadedPattern().columns).toBe(10)
    expect(loadedPattern().rows).toBe(20)
    expect(loadedPattern().grid[0]![0]!.color).toBe('#e63746')
    expect(loadedPattern().rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 1,
      currentColumn: 0,
    })

    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    expect(loadedPattern().beadId).toBe('toho-round-11-0')
    expect(loadedPattern().columns).toBe(10)
  })

  it('does nothing when there is no open Pattern', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="replace-bead-select"]').exists()).toBe(false)
  })

  it('translates the modal title, message and button labels with the interface language', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-en"]').trigger('click')
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    expect(wrapper.text()).toContain(en.replaceBead.confirmTitle)
    expect(wrapper.find('[data-testid="confirm-modal-cancel"]').text()).toBe(en.replaceBead.cancelButton)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(en.replaceBead.confirmButton)

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')
    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    expect(wrapper.text()).toContain(ru.replaceBead.confirmTitle)
    expect(wrapper.find('[data-testid="confirm-modal-confirm"]').text()).toBe(ru.replaceBead.confirmButton)
  })
})

describe('App bead quantities', () => {
  async function patternWithPaintedCells(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    // Each press is a click, so each is released: the bead counts follow a stroke a few times a second (ticket 106) and
    // settle when it ends, which is what a release does.
    await pressBead(wrapper, 0)
    await wrapper.trigger('pointerup')
    await pressBead(wrapper, 1)
    await wrapper.trigger('pointerup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await pressBead(wrapper, 2)
    await wrapper.trigger('pointerup')
  }

  it('totals the beads each color needs from the painted cells, with no bead picker in sight', async () => {
    const wrapper = mount(App)
    await patternWithPaintedCells(wrapper)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="quantity-count-blue"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="bead-quantities"] select').exists()).toBe(false)
  })

  it('shows no row for a color painted nowhere in the Pattern', async () => {
    const wrapper = mount(App)
    await patternWithPaintedCells(wrapper)

    expect(wrapper.find('[data-testid="quantity-count-green"]').exists()).toBe(false)
  })

  it("adds a color's row as soon as it is painted, and removes it once its last cell is erased", async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    expect(wrapper.find('[data-testid="quantity-count-red"]').exists()).toBe(false)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
    await wrapper.trigger('pointerup')

    await pressBead(wrapper, 0, { button: 2 }) // right-click erase
    expect(wrapper.find('[data-testid="quantity-count-red"]').exists()).toBe(false)
  })

  it('shows the "open a Pattern" message with no Pattern open', async () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="quantities-no-pattern"]').exists()).toBe(true)
  })

  it('shows a "nothing painted yet" message for a Pattern with nothing painted on it', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="quantities-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quantity-count-red"]').exists()).toBe(false)
  })
})

describe('App estimated weight (ticket 155)', () => {
  it('follows painting and erasing, and Replace bead', async () => {
    localStorage.setItem('bd-beads:locale', 'en')
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    expect(wrapper.find('[data-testid="quantities-weight-info"]').exists()).toBe(false)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('0.01 g')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('< 0.01 g')
    expect(wrapper.find('[data-testid="quantities-weight-tooltip"]').text()).toContain('about 0.0091 g')

    await pressBead(wrapper, 0, { button: 2 })
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantities-weight-info"]').exists()).toBe(false)
  })

  it('labels the weight in grams or in Russian «г» by the app language, with its own decimal sign (writing.md)', async () => {
    localStorage.setItem('bd-beads:locale', 'ru')
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('0,01 г')
    await wrapper.find('[data-testid="language-en"]').trigger('click')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('0.01 g')
  })
})

describe('App pattern transfer', () => {
  function makePattern(name: string): Pattern {
    return createPattern({
      name,
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
  }

  async function importFile(wrapper: ReturnType<typeof mount>, contents: string) {
    const input = wrapper.find<HTMLInputElement>('[data-testid="import-file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([contents], 'library.json', { type: 'application/json' })],
    })
    await input.trigger('change')
    await flushPromises()
  }

  it('takes in a library exported on another device and saves every Pattern in it', async () => {
    const wrapper = mount(App)
    const library = [makePattern('Fox'), makePattern('Owl')]

    await importFile(wrapper, serializeLibrary(library))

    expect(loadPatterns().map((pattern) => pattern.name).sort()).toEqual(['Fox', 'Owl'])
    expect(wrapper.findAll('[data-testid="pattern-item"]')).toHaveLength(2)
  })

  it('opens an imported Pattern when nothing was open, so the user resumes where they left off', async () => {
    const wrapper = mount(App)
    const woven = makePattern('Fox')
    woven.rowProgress = { enabled: true, direction: 'rows', currentRow: 4, currentColumn: 0 }

    await importFile(wrapper, serializeLibrary([woven]))

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b5\D+10\b/)
    expect(rowProgressView(wrapper)).toMatchObject({ finished: 4 })
  })

  it('imports a Pattern that clashes with a local one as a separate entry, keeping both', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const local = loadPatterns()[0]!

    await importFile(wrapper, serializeLibrary([{ ...local, name: 'Imported copy' }]))
    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    const saved = loadPatterns()
    expect(saved).toHaveLength(2)
    expect(saved.map((pattern) => pattern.id)).toContain(local.id)
    expect(new Set(saved.map((pattern) => pattern.id)).size).toBe(2)
  })

  it('reports a file it cannot read instead of importing anything', async () => {
    const wrapper = mount(App)

    await importFile(wrapper, 'definitely not a pattern file')

    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(true)
    expect(loadPatterns()).toHaveLength(0)
  })

  it('keeps the import result and error visible after an import, in both languages (ticket 117)', async () => {
    const wrapper = mount(App)

    await importFile(wrapper, serializeLibrary([makePattern('Fox'), makePattern('Owl')]))
    expect(wrapper.find('[data-testid="import-result"]').text()).toBe(`${ru.transfer.importedLabel}: 2`)
    await wrapper.find('[data-testid="language-en"]').trigger('click')
    expect(wrapper.find('[data-testid="import-result"]').text()).toBe(`${en.transfer.importedLabel}: 2`)

    await importFile(wrapper, 'definitely not a pattern file')
    expect(wrapper.find('[data-testid="import-error"]').text()).toBe(en.transfer.importErrorLabel)
    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    expect(wrapper.find('[data-testid="import-error"]').text()).toBe(ru.transfer.importErrorLabel)
  })

  it('imports into an empty library and opens what it brought in (ticket 117)', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="pattern-list-empty"]').exists()).toBe(true)

    await importFile(wrapper, serializeLibrary([makePattern('Fox')]))

    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('Fox')
    expect(wrapper.find('[data-testid="pattern-list-empty"]').exists()).toBe(false)
  })
})

describe('App select, copy and paste', () => {
  /** A drag across the grid: press on one cell, move through the rest, release (release is on the shell, as a real drag can end anywhere). */
  async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
    await pressBead(wrapper, indices[0]!)
    for (const index of indices.slice(1)) {
      await hoverBead(wrapper, index, { buttons: 1 })
    }
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /** Presses and releases one cell without moving — a click, which is what stamps a copied block. */
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  function selectedCount(wrapper: ReturnType<typeof mount>) {
    return selectedBeadCount(wrapper)
  }

  /** A 4x4 Pattern with a red cell at (0,0) and a blue one at (1,1), ready to copy as a two-color motif. */
  async function patternWithMotif(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '6', '6') // 4x4 grid
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0) // (0,0)
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await click(wrapper, 5) // (1,1)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
  }

  it('offers Select alongside Paint and Fill, chosen the same way', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    expect(wrapper.find('[data-testid="tool-select"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('false')
  })

  it('marks out a rectangle as the cursor is dragged, and keeps it after the drag ends', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await drag(wrapper, [0, 1, 5]) // (0,0) -> (1,1)

    expect(selectedCount(wrapper)).toBe(4)
  })

  it('leaves the grid alone while selecting: dragging under Select paints nothing', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await drag(wrapper, [0, 1, 5])

    expect(loadPatterns()[0]!.grid.flat().every((cell) => cell.color === null)).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(true)
  })

  it('replaces the previous selection when a new drag starts, leaving only one active', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await drag(wrapper, [0, 1, 4, 5]) // a 2x2 rectangle
    expect(selectedCount(wrapper)).toBe(4)

    await drag(wrapper, [10, 11]) // (2,2) -> (2,3)

    expect(selectedCount(wrapper)).toBe(2)
  })

  it('enables Copy only once something is selected', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)

    await drag(wrapper, [0, 1])

    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(false)
  })

  it('previews the copied block in its own colors, following the cursor', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5]) // select the 2x2 holding both painted cells
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await hoverBead(wrapper, 10) // hover (2,2)

    // The block's two painted cells, each in its own color; its two empty ones preview nothing.
    expect(previewedBeads(wrapper).map(({ color }) => color)).toEqual(['#e63746', '#2f6fed'])
  })

  it('stamps the copied block where it is clicked, as a single undo step', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await click(wrapper, 10) // (2,2)

    const grid = loadPatterns()[0]!.grid
    expect(grid[2]![2]!.color).toBe('#e63746')
    expect(grid[3]![3]!.color).toBe('#2f6fed')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBeNull()
    expect(loadPatterns()[0]!.grid[3]![3]!.color).toBeNull()
  })

  it('redoes a stamped paste as a single action', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await click(wrapper, 10) // (2,2)
    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[2]![2]!.color).toBe('#e63746')
    expect(grid[3]![3]!.color).toBe('#2f6fed')
  })

  it('leaves redo untouched: Select, Copy, and cancelling a Paste are not grid edits', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await click(wrapper, 10) // (2,2), a real edit
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

    await drag(wrapper, [0, 1]) // a fresh Selection
    await wrapper.find('[data-testid="copy-button"]').trigger('click') // Copy
    await pressEscape(wrapper) // cancels the pending Paste

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)
    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBe('#e63746')
  })

  it('can stamp the same block again at another position without copying again', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await click(wrapper, 8) // (2,0)
    await click(wrapper, 10) // (2,2)

    const grid = loadPatterns()[0]!.grid
    expect(grid[2]![0]!.color).toBe('#e63746')
    expect(grid[2]![2]!.color).toBe('#e63746')
  })

  it('clips a stamp that runs off the edge instead of refusing it', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await click(wrapper, 15) // (3,3), the last cell: only the block's own top-left corner fits

    expect(loadPatterns()[0]!.grid[3]![3]!.color).toBe('#e63746')
  })

  it('leaves the destination untouched under the block’s empty cells', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    // Paint the destination green first, so the block's holes have something to spare.
    await wrapper.find('[data-testid="tool-paint"]').trigger('click')
    await wrapper.find('[data-color-id="green"]').trigger('click')
    await click(wrapper, 9) // (2,1) — lands under one of the block's empty cells
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await click(wrapper, 8) // stamp at (2,0)

    expect(loadPatterns()[0]!.grid[2]![1]!.color).toBe('#27ae60')
  })

  it('drops the clipboard when a new selection is drawn, so the next click selects rather than stamps', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await drag(wrapper, [10, 11]) // a fresh selection replaces both it and the clipboard
    await click(wrapper, 8)

    expect(loadPatterns()[0]!.grid[2]![0]!.color).toBeNull()
  })

  /** Escape is bound to the window, not to the canvas, so it is dispatched there rather than on an element. */
  async function pressEscape(wrapper: ReturnType<typeof mount>) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    return wrapper
  }

  async function copiedMotif(wrapper: ReturnType<typeof mount>) {
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
  }

  it('drops the copied block on a right-click, so the next click selects instead of stamping', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)

    await pressBead(wrapper, 10, { button: 2 })
    await click(wrapper, 10) // (2,2) — would have stamped the motif

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBeNull()
    expect(selectedCount(wrapper)).toBe(1)
  })

  it('drops the copied block on Escape, so the next click selects instead of stamping', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)

    await pressEscape(wrapper)
    await click(wrapper, 10)

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBeNull()
    expect(selectedCount(wrapper)).toBe(1)
  })

  it('stops previewing the block once the copy is dropped', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)
    await hoverBead(wrapper, 10)
    expect(previewedBeads(wrapper)).toHaveLength(2)

    await pressEscape(wrapper)

    expect(previewedBeads(wrapper)).toHaveLength(0)
  })

  it('hides the Selection marquee immediately once Copy is clicked (ticket 49)', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    expect(selectedCount(wrapper)).toBe(4)

    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)
  })

  it('still pastes normally after Copy hides the marquee, but needs a fresh drag to copy the same block again', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)

    // The clipboard stays armed even though nothing is highlighted, so the next click still pastes.
    await click(wrapper, 10)
    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBe('#e63746')

    // Nothing is left highlighted, so copying the same block again means dragging a new Selection over it first.
    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)

    await drag(wrapper, [0, 1, 5]) // re-select the same motif, since copying it again needs a fresh drag
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await click(wrapper, 8) // (2,0)

    expect(loadPatterns()[0]!.grid[2]![0]!.color).toBe('#e63746')
  })

  it('clears a selection nothing has been copied from on Escape', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])

    await pressEscape(wrapper)

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)
  })

  it('clears a selection nothing has been copied from on a right-click, without erasing anything', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])

    await pressBead(wrapper, 0, { button: 2 }) // a painted cell

    expect(selectedCount(wrapper)).toBe(0)
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('cancels the pending Paste on Escape without reviving the selection (ticket 49)', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)
    expect(selectedCount(wrapper)).toBe(0) // Copy already hid the marquee

    await pressEscape(wrapper)

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)
  })

  it('cancels the pending Paste on a right-click without reviving the selection (ticket 49)', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)
    expect(selectedCount(wrapper)).toBe(0) // Copy already hid the marquee

    await pressBead(wrapper, 10, { button: 2 })

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)
  })

  it('still never erases under Select: a right-click cancels the paste rather than clearing a cell', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)

    await pressBead(wrapper, 0, { button: 2 }) // a painted cell

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('leaves the other tools alone: Escape is not a general-purpose cancel', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)

    await pressEscape(wrapper)

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(false)
  })

  it.each(['tool-paint', 'tool-fill'])('forgets the selected area when the tool changes to %s', async (tool) => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1, 4, 5])
    expect(selectedCount(wrapper)).toBe(4)

    await wrapper.find(`[data-testid="${tool}"]`).trigger('click')

    expect(selectedCount(wrapper)).toBe(0)
  })

  it('forgets the copied block too, so returning to Select does not stamp out of nowhere', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)

    await wrapper.find('[data-testid="tool-paint"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await click(wrapper, 10) // (2,2)

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBeNull()
    expect(selectedCount(wrapper)).toBe(1) // a fresh selection, not a stamp
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(false)
  })

  it('keeps the selection when Select is re-chosen while already active', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1, 4, 5])

    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    expect(selectedCount(wrapper)).toBe(4)
  })

  it('resets the Selection, but keeps the clipboard armed, when a different Pattern is opened (ticket 92)', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    const firstId = loadPatterns()[0]!.id
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    // The Selection itself still resets on a Pattern switch, same as before ticket 92.
    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)

    // But the clipboard survives the switch (ticket 92), so a click under Select still stamps the motif.
    await click(wrapper, 0)
    expect(loadPatterns().find((p) => p.id !== firstId)!.grid[0]![0]!.color).toBe('#e63746')
  })
})

describe('App clipboard lifecycle (ticket 92)', () => {
  async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
    await pressBead(wrapper, indices[0]!)
    for (const index of indices.slice(1)) {
      await hoverBead(wrapper, index, { buttons: 1 })
    }
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /** A 4x4 Pattern with a red cell at (0,0), Select active and that cell copied. */
  async function patternWithCopiedCell(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0) // (0,0)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
  }

  async function hoverCell(wrapper: ReturnType<typeof mount>, index: number) {
    await hoverBead(wrapper, index)
  }

  function pasteAtHoveredCell() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }))
  }

  it('pastes at the cell under the pointer on Ctrl/Cmd+V, matching a click-to-paste stamp', async () => {
    const wrapper = mount(App)
    await patternWithCopiedCell(wrapper)
    await hoverCell(wrapper, 10) // (2,2)

    pasteAtHoveredCell()
    await flushPromises()

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBe('#e63746')
  })

  it('is a no-op when the pointer is not over the grid', async () => {
    const wrapper = mount(App)
    await patternWithCopiedCell(wrapper)
    await hoverCell(wrapper, 10)
    await leaveSurface(wrapper)

    pasteAtHoveredCell()
    await flushPromises()

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBeNull()
  })

  it.each(['tool-paint', 'tool-fill'])('pastes via Ctrl/Cmd+V while %s is the active tool', async (tool) => {
    const wrapper = mount(App)
    await patternWithCopiedCell(wrapper)
    await wrapper.find(`[data-testid="${tool}"]`).trigger('click')
    await hoverCell(wrapper, 10)

    pasteAtHoveredCell()
    await flushPromises()

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBe('#e63746')
  })

  it('keeps the clipboard armed after switching tools away from Select and back, for keyboard paste (ticket 92)', async () => {
    const wrapper = mount(App)
    await patternWithCopiedCell(wrapper)

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await hoverCell(wrapper, 10)

    pasteAtHoveredCell()
    await flushPromises()

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBe('#e63746')
  })

  it('hides the live preview after switching away from Select, even though Ctrl/Cmd+V can still paste', async () => {
    const wrapper = mount(App)
    await patternWithCopiedCell(wrapper)

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await hoverCell(wrapper, 10)

    expect(previewedBeads(wrapper)).toHaveLength(0)
  })

  it('does not revive the click-to-stamp gesture after switching back to Select: a click marks out a Selection instead', async () => {
    const wrapper = mount(App)
    await patternWithCopiedCell(wrapper)

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await click(wrapper, 10)

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBeNull()
    expect(selectedBeadCount(wrapper)).toBe(1)
  })

  it('can still paste via Ctrl/Cmd+V after Escape dismisses the projection', async () => {
    const wrapper = mount(App)
    await patternWithCopiedCell(wrapper)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    await hoverCell(wrapper, 10)

    pasteAtHoveredCell()
    await flushPromises()

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBe('#e63746')
  })
})

describe('App Tool group Escape precedence (ticket 41)', () => {
  function selectedCount(wrapper: ReturnType<typeof mount>) {
    return selectedBeadCount(wrapper)
  }

  async function createPatternWithSelection(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 5, { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /*
   * No real Tool group exceeds 14 controls yet (ToolGroup.test.ts covers the expand/collapse mechanics itself with
   * a synthetic one that does), so this stands in for "some Tool group is currently hover-expanded" by making the
   * mounted Toolbox's own exposed collapseExpandedGroup — the exact function the app's shortcut table calls — report
   * one was, for exactly one call. It's proving the wiring: Escape asks Toolbox first, and only backs out of Select
   * once that reports nothing was expanded.
   */
  function stubOneExpandedGroup(wrapper: ReturnType<typeof mount>) {
    // The exposed object itself, which is what the app holds on to: a spy on the test wrapper's own proxy would not reach it.
    const exposed = wrapper.findComponent({ name: 'Toolbox' }).vm.$.exposed as { collapseExpandedGroup: () => boolean }
    vi.spyOn(exposed, 'collapseExpandedGroup').mockReturnValueOnce(true)
  }

  it('lets an expanded Tool group swallow the first Escape, leaving the Selection untouched', async () => {
    const wrapper = mount(App)
    await createPatternWithSelection(wrapper)
    expect(selectedCount(wrapper)).toBe(4)

    stubOneExpandedGroup(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(selectedCount(wrapper)).toBe(4)
  })

  it('reaches Select as usual on the Escape after that, once no group reports being expanded', async () => {
    const wrapper = mount(App)
    await createPatternWithSelection(wrapper)

    stubOneExpandedGroup(wrapper)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) // swallowed by the (stubbed) expanded group
    await flushPromises()
    expect(selectedCount(wrapper)).toBe(4)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) // no group expanded now — clears the Selection
    await flushPromises()

    expect(selectedCount(wrapper)).toBe(0)
  })
})

/** Ticket 55: saving follows the Pattern library instead of sitting on the per-cell edit path. */
describe('App storage writes', () => {
  /** The Pattern library's own key: the counting and refusing below are scoped to it, so the saved language's writes
   *  (a click on the language switcher) neither show up as noise nor get refused along with it. */
  const PATTERNS_KEY = 'bd-beads:patterns'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes a dragged paint stroke once, when the stroke ends, rather than once per cell', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const writes = spyOnStorageWrites(PATTERNS_KEY)
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })

    expect(writes.count).toBe(0)

    await wrapper.trigger('mouseup')

    expect(writes.count).toBe(1)
    const grid = loadPatterns()[0]!.grid
    expect([grid[0]![0]!.color, grid[0]![1]!.color, grid[0]![2]!.color]).toEqual([
      '#e63746',
      '#e63746',
      '#e63746',
    ])
  })

  it('writes a dragged erase stroke once too', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    const writes = spyOnStorageWrites(PATTERNS_KEY)
    await pressBead(wrapper, 0, { button: 2 })
    await hoverBead(wrapper, 1, { buttons: 2 })
    expect(writes.count).toBe(0)

    await wrapper.trigger('mouseup')

    expect(writes.count).toBe(1)
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()
  })

  it('writes a stroke whose mouseup never arrived when the page goes away', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    // A button released outside the document (dragging off the window edge) fires no mouseup on the shell, so this
    // stroke is still only in memory.
    await pressBead(wrapper, 0)
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()

    window.dispatchEvent(new Event('pagehide'))

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('writes a stroke whose mouseup never arrived when the editor is torn down', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)

    wrapper.unmount()

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('ends a touch/pen stroke the OS cancels mid-drag (ticket 60), instead of leaving it stuck in progress', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await pressBead(wrapper, 0, { pointerType: 'touch' })
    await hoverBead(wrapper, 1, { buttons: 1, pointerType: 'touch' })
    await wrapper.find('.app-shell').trigger('pointercancel')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')

    // The cancelled stroke really ended: painting a third cell starts a fresh one rather than continuing the old.
    await pressBead(wrapper, 2, { pointerType: 'touch' })
    await wrapper.find('.app-shell').trigger('pointerup')
    expect(loadPatterns()[0]!.grid[0]![2]!.color).toBe('#e63746')
  })

  it('still writes a Fill the moment it lands, since it is one click rather than a stroke', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    const writes = spyOnStorageWrites(PATTERNS_KEY)
    await pressBead(wrapper, 0)

    expect(writes.count).toBe(1)
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('says so, in the current language, when a write to storage is refused', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(false)

    refuseStorageWrites(PATTERNS_KEY)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(ru.storage.saveFailedMessage)

    await wrapper.find('[data-testid="language-en"]').trigger('click')

    expect(wrapper.find('[data-testid="save-failed-message"]').text()).toBe(en.storage.saveFailedMessage)
  })

  it('keeps the refused edit on screen, and takes the message down once a save gets through', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const refusing = refuseStorageWrites(PATTERNS_KEY)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(true)
    expect(beadColor(wrapper, 0)).toBe('#e63746')

    refusing.mockRestore()
    await pressBead(wrapper, 1)
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(false)
    // The retry carries the refused cell too, since a save writes the whole library from memory.
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')
  })
})
