import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { createPattern, type Pattern } from './domain/pattern'
import { serializeLibrary } from './domain/patternFile'
import { loadPatterns, savePatterns } from './domain/patternStorage'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { refuseStorageWrites, spyOnStorageWrites } from './testUtils/storageWrites'

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
    // Saved Patterns keeps its box (ticket 39: always one of the three below-canvas boxes), now showing its
    // own empty message rather than disappearing.
    expect(wrapper.find('[data-testid="pattern-list-empty"]').exists()).toBe(true)
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
    expect(topBar.find('[data-testid="new-pattern-button"]').exists()).toBe(false)
    expect(aboveCanvas.find('[data-testid="new-pattern-button"]').exists()).toBe(false)
    expect(belowCanvas.find('[data-testid="new-pattern-button"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(true)

    await createPatternViaForm(wrapper, '15', '30')

    expect(topBar.find('[data-testid="current-pattern-summary"]').exists()).toBe(true)
    expect(mainPanel.find('[data-testid="bead-select"]').exists()).toBe(false)
    expect(aboveCanvas.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="grid-row"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(false)
    expect(belowCanvas.find('[data-testid="pattern-list"]').exists()).toBe(true)
  })

  it('opens the bottom section with a dimmed divider, then exactly three boxes in order: Beads needed, Saved Patterns, Export and import (ticket 39)', () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="app-below-canvas-divider"]').exists()).toBe(true)

    const belowCanvas = wrapper.find('[data-testid="app-below-canvas"]')
    const boxes = [...belowCanvas.element.children]
    expect(boxes.map((box) => box.getAttribute('data-testid'))).toEqual([
      'bead-quantities',
      'pattern-list',
      'pattern-transfer',
    ])
  })

  it('keeps the same divider and exactly the same three boxes, in order, whether or not a Pattern is open', async () => {
    const wrapper = mount(App)
    const belowCanvas = wrapper.find('[data-testid="app-below-canvas"]')
    const boxOrder = () => [...belowCanvas.element.children].map((box) => box.getAttribute('data-testid'))
    const expectedOrder = ['bead-quantities', 'pattern-list', 'pattern-transfer']

    expect(wrapper.find('[data-testid="app-below-canvas-divider"]').exists()).toBe(true)
    expect(boxOrder()).toEqual(expectedOrder)

    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="app-below-canvas-divider"]').exists()).toBe(true)
    expect(boxOrder()).toEqual(expectedOrder)

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click') // back to no Pattern open, but one is saved

    expect(wrapper.find('[data-testid="app-below-canvas-divider"]').exists()).toBe(true)
    expect(boxOrder()).toEqual(expectedOrder)
  })

  it('moves editing tools into the above-canvas panel, empties the main panel, and leaves the Toolbox as that panel\'s only content (ticket 35 removed the New Pattern/zoom row above it)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const mainPanel = wrapper.find('[data-testid="app-main-panel"]')
    const aboveCanvas = wrapper.find('[data-testid="app-above-canvas"]')
    const toolbox = wrapper.find('[data-testid="toolbox"]')

    expect(mainPanel.text()).toBe('')
    expect(toolbox.exists()).toBe(true)
    // No empty row is left where New Pattern/zoom used to sit: the Toolbox is the panel's first element child.
    expect(aboveCanvas.element.firstElementChild).toBe(toolbox.element)
    for (const testId of [
      'tool-paint',
      'tool-fill',
      'palette-picker',
      'undo-button',
      'mirror-left-right',
      'row-progress-enabled',
    ]) {
      expect(toolbox.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('paints a cell with the selected palette color', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')

    expect(wrapper.findAll('[data-testid="grid-cell"]')[0]!.attributes('style')).toContain(
      'background-color: rgb(230, 55, 70)',
    )

    // Releasing the button ends the stroke, which is when a stroke reaches storage (ticket 55).
    await wrapper.trigger('mouseup')
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('fills a contiguous same-colored region with the fill tool', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows

    await wrapper.find('[data-color-id="red"]').trigger('click')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    // Paint a 2x2 red block: (0,0), (0,1), (1,0), (1,1).
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mousedown')
    await cells[10]!.trigger('mousedown')
    await cells[11]!.trigger('mousedown')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await cells[0]!.trigger('mousedown')

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
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mousedown')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await cells[0]!.trigger('mousedown')

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
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mousedown')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await cells[0]!.trigger('mousedown')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#2f6fed')
    expect(grid[0]![1]!.color).toBe('#2f6fed')
  })

  it('rotating is a view-only flip: it turns the picture on screen but never touches the grid, dimensions, or technique', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '4.5', '3') // 3 columns x 2 rows

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // paint (0,0)
    await wrapper.trigger('mouseup')
    const beforeRotate = loadPatterns()[0]!

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    const afterRotate = loadPatterns()[0]!
    expect(afterRotate.rotated).toBe(true)
    expect(afterRotate.columns).toBe(beforeRotate.columns)
    expect(afterRotate.rows).toBe(beforeRotate.rows)
    expect(afterRotate.widthMm).toBe(beforeRotate.widthMm)
    expect(afterRotate.heightMm).toBe(beforeRotate.heightMm)
    expect(afterRotate.grid).toEqual(beforeRotate.grid)
    // The header summary reflects how the Pattern currently looks (swapped), even though the stored grid didn't change.
    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('2×3')
  })

  it('toggles back to the original orientation on a second click', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '4.5', '3')

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    expect(loadPatterns()[0]!.rotated).toBe(true)

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')
    expect(loadPatterns()[0]!.rotated).toBe(false)
    expect(wrapper.find('[data-testid="current-pattern-summary"]').text()).toContain('3×2')
  })

  it('is not an undo step: rotating does not touch the undo history', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '4.5', '3')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(true)

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(true)
  })

  it('leaves redo untouched: Rotate is not a grid edit', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '4.5', '3')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)
    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('undoes and redoes a live-mirrored paint as a single action', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()

    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')
  })

  it('leaves Fill unaffected by mirror state, both while painting and in its hover preview', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    // Mirror off while painting (0,0), so (0,1) starts out unpainted.
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mouseenter') // (0,0)
    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(1) // no mirrored counterpart previewed

    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // fill (0,0), mirror on

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#2f6fed')
    // If Fill mirrored like Paint does, (0,1) — (0,0)'s left-right counterpart — would also have flipped to blue.
    expect(grid[0]![1]!.color).toBeNull()
  })

  it('opens ready to paint with red selected by default, no swatch click needed first (ticket 27)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-color-id="red"]').attributes('aria-pressed')).toBe('true')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('paints with a Custom color exactly like a Palette color once one is chosen (ticket 43)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const customColorInput = wrapper.find<HTMLInputElement>('[data-testid="custom-color-input"]')
    customColorInput.element.value = '#123456'
    await customColorInput.trigger('input')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown')
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="quantity-count-#123456"]').text()).toBe('1')
  })

  it('paints every cell dragged over with the Paint tool, as a continuous stroke', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await cells[2]!.trigger('mouseenter', { buttons: 1 })
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

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await cells[2]!.trigger('mouseenter', { buttons: 1 })
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

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await cells[2]!.trigger('mouseenter', { buttons: 1 })
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

  it('drags a live-mirrored stroke, mirroring each dragged cell along the way', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown') // (0,0) -> mirrors to (0,1)
    await cells[2]!.trigger('mouseenter', { buttons: 1 }) // (1,0) -> mirrors to (1,1)
    await wrapper.trigger('mouseup')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[1]![0]!.color).toBe('#e63746')
    expect(grid[1]![1]!.color).toBe('#e63746')
  })

  it('does not drag-fill with the Fill tool: a move afterwards is ignored', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    // Isolate cell 5 from cell 6 with different colors, so flood-fill's own same-color spread can't
    // explain either cell's result — only a (nonexistent) drag continuation could paint cell 6 green.
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await cells[5]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await cells[6]!.trigger('mousedown')
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="green"]').trigger('click')
    await cells[5]!.trigger('mousedown')
    await cells[6]!.trigger('mouseenter', { buttons: 1 })
    await wrapper.trigger('mouseup')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![5]!.color).toBe('#27ae60')
    expect(grid[0]![6]!.color).toBe('#2f6fed')
  })

  it('right-clicks a single cell to erase it with the Paint tool', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await cells[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')

    await cells[0]!.trigger('mousedown', { button: 2 })
    await wrapper.trigger('mouseup')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })

  it('right-click-drags with the Paint tool to erase every cell along the path, as one undo step', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await cells[2]!.trigger('mouseenter', { buttons: 1 })
    await wrapper.trigger('mouseup')

    await cells[0]!.trigger('mousedown', { button: 2 })
    await cells[1]!.trigger('mouseenter', { buttons: 2 })
    await cells[2]!.trigger('mouseenter', { buttons: 2 })
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

  it('right-click erase under Paint also erases the mirrored counterpart cell(s), same as painting', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await cells[0]!.trigger('mousedown') // paints (0,0) and (0,1)
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')

    await cells[0]!.trigger('mousedown', { button: 2 })
    await wrapper.trigger('mouseup')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
  })

  it('right-clicks with the Fill tool to flood-erase the connected same-color region in one click', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    // Paint a 2x2 red block: (0,0), (0,1), (1,0), (1,1).
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await cells[10]!.trigger('mouseenter', { buttons: 1 })
    await cells[11]!.trigger('mouseenter', { buttons: 1 })
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await cells[0]!.trigger('mousedown', { button: 2 })

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
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await cells[0]!.trigger('mousedown', { button: 2 })
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
    wrapper.find('[data-testid="grid-cell"]').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('undoes the most recent paint action, and repeated undo steps back further', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="undo-button"]').element.disabled).toBe(
      false,
    )
  })

  it('redoes the most recently undone change, and repeated redo steps forward through every undone change in order', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[1]!.trigger('mousedown')
    await wrapper.trigger('mouseup')

    expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(true)
  })

  it('switching or creating a Pattern clears the redo history, the same as the undo stack', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const firstId = loadPatterns()[0]!.id

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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
    await first.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await first.trigger('mouseup')
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.findAll('[data-testid="grid-cell"]')[0]!.attributes('style')).toContain(
      'background-color: rgb(230, 55, 70)',
    )
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

    expect(wrapper.findAll('[data-testid="grid-cell"]')).not.toHaveLength(0)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')

    // Export/import round-tripping an unresolved beadId is covered directly in patternFile.test.ts; here it's
    // enough that the button (disabled only while no Pattern is open) is live for this one.
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

    expect(
      wrapper.find(`[data-testid="remove-pattern-${patternId}"]`).classes(),
    ).toContain('button--danger')

    for (const testId of ['new-pattern-button', 'zoom-in', 'zoom-out', 'zoom-reset', 'tool-paint', 'tool-fill', 'undo-button', 'rotate-button', 'redo-button']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).classes()).not.toContain('button--danger')
    }
  })

  it('floats the zoom controls in the canvas panel, fixed to its corner rather than the Pattern\'s own box (ticket 57)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const aboveCanvas = wrapper.find('[data-testid="app-above-canvas"]')
    expect(aboveCanvas.find('[data-testid="zoom-controls"]').exists()).toBe(false)

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

  it('splits the top bar into a dark title box and an aqua summary box holding just the current-pattern summary and language switcher (ticket 51 moved New Pattern out)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const topBar = wrapper.find('[data-testid="app-topbar"]')
    const titleBox = topBar.find('.app-shell__topbar-title')
    const summaryBox = topBar.find('.app-shell__topbar-summary')

    expect(titleBox.find('h1').text()).toBe('bd-beads')
    expect(titleBox.find('[data-testid="current-pattern-summary"]').exists()).toBe(false)
    expect(summaryBox.find('[data-testid="new-pattern-button"]').exists()).toBe(false)
    expect(summaryBox.find('[data-testid="current-pattern-summary"]').exists()).toBe(true)
    expect(summaryBox.find('[data-testid="language-en"]').exists()).toBe(true)
  })

  it('renders New Pattern as the first control of the Saved Patterns box, above the list (ticket 51)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const patternList = wrapper.find('[data-testid="pattern-list"]')
    const newPatternButton = wrapper.find('[data-testid="new-pattern-button"]').element
    const firstPatternItem = wrapper.find('[data-testid="pattern-item"]').element

    expect(patternList.find('[data-testid="new-pattern-button"]').exists()).toBe(true)
    const children = Array.from(patternList.element.children)
    expect(children.indexOf(newPatternButton)).toBeLessThan(children.indexOf(firstPatternItem.parentElement!))
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
 * the row-progress readout as text. Button words survive as a hover/focus tooltip plus the screen-reader name, so
 * the Toolbox stays compact.
 */
describe('App tool strip icon buttons', () => {
  const iconButtons = [
    { testId: 'tool-paint', label: (t: typeof en) => t.tools.paintLabel },
    { testId: 'tool-fill', label: (t: typeof en) => t.tools.fillLabel },
    { testId: 'tool-select', label: (t: typeof en) => t.tools.selectLabel },
    { testId: 'delete-all-button', label: (t: typeof en) => t.deleteAll.button },
    { testId: 'undo-button', label: (t: typeof en) => t.palette.undoButton },
    { testId: 'rotate-button', label: (t: typeof en) => t.palette.rotateButton },
    { testId: 'copy-button', label: (t: typeof en) => t.tools.copyButton },
    { testId: 'redo-button', label: (t: typeof en) => t.palette.redoButton },
    { testId: 'mirror-copy-mode', label: (t: typeof en) => t.mirror.copyModeLabel },
    { testId: 'mirror-current-horizontal', label: (t: typeof en) => t.mirror.mirrorCurrentHorizontalButton },
    { testId: 'mirror-current-vertical', label: (t: typeof en) => t.mirror.mirrorCurrentVerticalButton },
    { testId: 'row-progress-enabled', label: (t: typeof en) => t.rowProgress.enabledLabel },
    { testId: 'row-progress-direction', label: (t: typeof en) => t.rowProgress.directionButton },
    { testId: 'row-progress-previous', label: (t: typeof en) => t.rowProgress.previousButton },
    { testId: 'row-progress-next', label: (t: typeof en) => t.rowProgress.nextButton },
  ]

  it.each(iconButtons)('renders $testId as an icon button with no visible text', async ({ testId }) => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const button = wrapper.find(`[data-testid="${testId}"]`)
    expect(button.classes()).toContain('icon-button')
    expect(button.find('svg').exists()).toBe(true)
    expect(button.text()).toBe('')
  })

  it.each(iconButtons)('names $testId for hover tooltips and screen readers alike', async ({ testId, label }) => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    const button = wrapper.find(`[data-testid="${testId}"]`)
    expect(button.attributes('title')).toBe(label(en))
    expect(button.attributes('aria-label')).toBe(label(en))
  })

  it.each(iconButtons)('translates $testId\u2019s tooltip and label with the interface language', async ({ testId, label }) => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-ru"]').trigger('click')

    const button = wrapper.find(`[data-testid="${testId}"]`)
    expect(button.attributes('title')).toBe(label(ru))
    expect(button.attributes('aria-label')).toBe(label(ru))
  })

  it('draws a different glyph for every icon button in the strip', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const glyphs = iconButtons.map(({ testId }) => wrapper.find(`[data-testid="${testId}"] svg`).html())

    expect(new Set(glyphs).size).toBe(glyphs.length)
  })

  it('leaves each Tool group\u2019s title and the row-progress readout as the Toolbox\u2019s only text \u2014 every button label is still just a tooltip', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const toolbox = wrapper.find('[data-testid="toolbox"]')
    const expectedWords = [
      ru.toolbox.groups.tools,
      ru.toolbox.groups.colors,
      ru.toolbox.groups.edit,
      ru.toolbox.groups.mirror,
      wrapper.find('[data-testid="mirror-left-right"]').text(),
      wrapper.find('[data-testid="mirror-top-bottom"]').text(),
      ru.toolbox.groups.rowProgress,
      wrapper.find('[data-testid="row-progress-position"]').text(),
    ].join('')

    // Whitespace stripped entirely, not just collapsed: the mirror axis counters (unlike every other Toolbox
    // control) render real inter-element whitespace from their own template layout, which is incidental to this
    // test's actual point -- that no *other* text content sneaks in beyond these known pieces.
    expect(toolbox.text().replace(/\s+/g, '')).toBe(expectedWords.replace(/\s+/g, ''))
  })

  it('gives each of the five Tool groups its own visible title, in Tools/Colors/Edit/Mirror/Row progress order', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    const titles = wrapper.findAll('.tool-group__title').map((title) => title.text())

    expect(titles).toEqual([
      en.toolbox.groups.tools,
      en.toolbox.groups.colors,
      en.toolbox.groups.edit,
      en.toolbox.groups.mirror,
      en.toolbox.groups.rowProgress,
    ])
  })

  it('shows which tool is active, now that nothing is labelled in text', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="tool-paint"]').classes()).toContain(
      'tool-picker__button--selected',
    )
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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

describe('App hover preview', () => {
  it('shows a faint preview of the selected color at the hovered cell, clearing on mouse leave', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await wrapper.findAll('[data-testid="grid-cell"]')[5]!.trigger('mouseenter')
    expect(wrapper.find('[data-testid="cell-preview"]').attributes('style')).toContain(
      'background-color: rgb(230, 55, 70)',
    )

    await wrapper.find('.pattern-grid').trigger('mouseleave')
    expect(wrapper.find('[data-testid="cell-preview"]').exists()).toBe(false)
  })

  // The neutral (no color selected) preview is PatternGrid's own concern and is covered directly in
  // PatternGrid.test.ts; since ticket 27 made red App's default selection, nothing is never actually selected
  // while a Pattern is open here, so there's no reachable App-level scenario left to exercise it through.

  it('also previews the mirrored counterpart cells when a mirror axis is on', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mouseenter') // (0,0)

    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(2)
  })
})

describe('App row progress', () => {
  it('shows the overlay only once it is toggled on, without leaving the editor', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.findAll('.pattern-grid__row--current')).toHaveLength(0)

    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

    expect(wrapper.findAll('.pattern-grid__row--current')).toHaveLength(1)
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)
  })

  it('advances the pointer as rows are finished, dimming the rows behind it', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    expect(wrapper.find('[data-testid="row-progress-position"]').text()).toContain('3 / 20')
    expect(wrapper.findAll('.pattern-grid__row--done')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="grid-row"]')[2]!.classes()).toContain(
      'pattern-grid__row--current',
    )
  })

  it('moves the pointer back to an earlier row', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    await wrapper.find('[data-testid="row-progress-previous"]').trigger('click')

    expect(wrapper.find('[data-testid="row-progress-position"]').text()).toContain('2 / 20')
    expect(wrapper.findAll('.pattern-grid__row--done')).toHaveLength(1)
  })

  it('will not step past either end of the Pattern', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="row-progress-previous"]').element.disabled,
    ).toBe(true)

    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="row-progress-next"]').element.disabled,
    ).toBe(true)
  })

  it('remembers where the weaving got to across a reload', async () => {
    const first = mount(App)
    await createPatternViaForm(first, '15', '30')
    await first.find('[data-testid="row-progress-enabled"]').trigger('click')
    await first.find('[data-testid="row-progress-next"]').trigger('click')
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.find('[data-testid="row-progress-position"]').text()).toContain('2 / 20')
    expect(afterReload.findAll('.pattern-grid__row--done')).toHaveLength(1)
    expect(loadPatterns()[0]!.rowProgress).toEqual({
      enabled: true,
      direction: 'rows',
      currentRow: 1,
      currentColumn: 0,
    })
  })

  describe('row direction', () => {
    function position(wrapper: ReturnType<typeof mount>) {
      return wrapper.find('[data-testid="row-progress-position"]').text()
    }

    it('turns rows to run down the columns: the readout counts columns and the steps move through them', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows
      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

      await wrapper.find('[data-testid="row-progress-direction"]').trigger('click')

      expect(wrapper.find('[data-testid="row-progress-direction"]').attributes('aria-pressed')).toBe('true')
      expect(position(wrapper)).toContain('1 / 10')

      await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
      await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

      expect(position(wrapper)).toContain('3 / 10')
      const firstGridRow = wrapper.findAll('[data-testid="grid-row"]')[0]!.findAll('[data-testid="grid-cell"]')
      expect(firstGridRow[1]!.classes()).toContain('pattern-grid__cell--done')
      expect(firstGridRow[2]!.classes()).toContain('pattern-grid__cell--current')
      expect(wrapper.findAll('.pattern-grid__row--done')).toHaveLength(0)
    })

    it('will not step past the last column', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '4.5', '3') // 3 columns x 2 rows
      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
      await wrapper.find('[data-testid="row-progress-direction"]').trigger('click')

      await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
      await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

      expect(position(wrapper)).toContain('3 / 3')
      expect(
        wrapper.find<HTMLButtonElement>('[data-testid="row-progress-next"]').element.disabled,
      ).toBe(true)
    })

    it('returns to the row the weaver was on after flipping the direction and back', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30') // 10 columns x 20 rows
      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
      await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
      await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

      await wrapper.find('[data-testid="row-progress-direction"]').trigger('click')
      await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
      expect(position(wrapper)).toContain('2 / 10')

      await wrapper.find('[data-testid="row-progress-direction"]').trigger('click')
      expect(position(wrapper)).toContain('3 / 20')
    })

    it('remembers the direction and where the weaving got to across a reload', async () => {
      const first = mount(App)
      await createPatternViaForm(first, '15', '30')
      await first.find('[data-testid="row-progress-direction"]').trigger('click')
      await first.find('[data-testid="row-progress-enabled"]').trigger('click')
      await first.find('[data-testid="row-progress-next"]').trigger('click')
      first.unmount()

      const afterReload = mount(App)

      expect(afterReload.find('[data-testid="row-progress-direction"]').attributes('aria-pressed')).toBe('true')
      expect(position(afterReload)).toContain('2 / 10')
    })

    it('is its own toggle, apart from Rotate: neither changes the other, and flipping is not an undo step', async () => {
      const wrapper = mount(App)
      await createPatternViaForm(wrapper, '15', '30')
      const gridBefore = loadPatterns()[0]!.grid

      await wrapper.find('[data-testid="row-progress-direction"]').trigger('click')

      expect(loadPatterns()[0]!.rotated).toBe(false)
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
      await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
      await wrapper.trigger('mouseup')
      await wrapper.find('[data-testid="undo-button"]').trigger('click')
      expect(wrapper.find<HTMLButtonElement>('[data-testid="redo-button"]').element.disabled).toBe(false)

      await wrapper.find('[data-testid="row-progress-direction"]').trigger('click')
      await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
      await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

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
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    return wrapper.findAll('[data-testid="grid-cell"]')
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
    const cells = await withTwoRowsWoven(wrapper)

    await cells[14]!.trigger('mousedown') // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(undoDisabled(wrapper)).toBe(true)
  })

  it('an edit that lands only on a finished row changes nothing, so it leaves redo alone', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)
    await cells[24]!.trigger('mousedown') // (2,4), the current row — a real edit
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(redoDisabled(wrapper)).toBe(false)

    await cells[14]!.trigger('mousedown') // (1,4), a finished row — paints nothing
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(redoDisabled(wrapper)).toBe(false)
    await wrapper.find('[data-testid="redo-button"]').trigger('click')
    expect(colorAt(2, 4)).toBe('#e63746')
  })

  it('paints only the unfinished part of a drag that crosses into the current row', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)

    await cells[14]!.trigger('mousedown') // (1,4)
    await cells[24]!.trigger('mouseenter', { buttons: 1 }) // (2,4), the current row
    await cells[34]!.trigger('mouseenter', { buttons: 1 }) // (3,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(colorAt(2, 4)).toBe('#e63746')
    expect(colorAt(3, 4)).toBe('#e63746')
  })

  it('will not right-click erase a bead in a finished row', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[4]!.trigger('mousedown') // (0,4), painted before it was woven
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    await wrapper.findAll('[data-testid="grid-cell"]')[4]!.trigger('mousedown', { button: 2 })
    await wrapper.trigger('mouseup')

    expect(colorAt(0, 4)).toBe('#e63746')
  })

  it('fills only the unfinished part of an area that reaches into finished rows', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await cells[55]!.trigger('mousedown') // (5,5), in the one empty area covering the whole grid

    expect(colorAt(0, 0)).toBeNull()
    expect(colorAt(1, 9)).toBeNull()
    expect(colorAt(2, 0)).toBe('#e63746')
    expect(colorAt(19, 9)).toBe('#e63746')
  })

  it('stamps a pasted block only onto the unfinished beads it covers', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)
    await cells[50]!.trigger('mousedown') // (5,0)
    await cells[60]!.trigger('mouseenter', { buttons: 1 }) // (6,0)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await cells[50]!.trigger('mousedown')
    await cells[60]!.trigger('mouseenter', { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await cells[10]!.trigger('mousedown') // stamps onto (1,0) and (2,0)
    await wrapper.find('.app-shell').trigger('mouseup')

    expect(colorAt(1, 0)).toBeNull()
    expect(colorAt(2, 0)).toBe('#e63746')
  })

  it('leaves a live-mirrored counterpart alone when it lands in a finished row', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="mirror-top-bottom-increase"]').trigger('click')

    await cells[183]!.trigger('mousedown') // (18,3), whose counterpart across the middle is (1,3)
    await wrapper.trigger('mouseup')

    expect(colorAt(18, 3)).toBe('#e63746')
    expect(colorAt(1, 3)).toBeNull()
  })

  it('locks the finished columns instead once rows run down them', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="row-progress-direction"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    await cells[0]!.trigger('mousedown') // (0,0), a row that's finished no longer, in a column that now is
    await wrapper.trigger('mouseup')
    await cells[11]!.trigger('mousedown') // (1,1), the current column
    await wrapper.trigger('mouseup')

    expect(colorAt(0, 0)).toBeNull()
    expect(colorAt(1, 1)).toBe('#e63746')
  })

  it('lets every bead be drawn on again once the overlay is off', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')

    await cells[14]!.trigger('mousedown') // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBe('#e63746')
  })

  it('previews no paint on a finished bead, and only the unfinished half of a mirrored pair', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)

    await cells[14]!.trigger('mouseenter') // (1,4)
    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(0)

    await wrapper.find('[data-testid="mirror-top-bottom-increase"]').trigger('click')
    await cells[183]!.trigger('mouseenter') // (18,3), mirrored onto finished (1,3)
    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(1)
  })

  it('still undoes in full, even a change to a row marked done since', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[4]!.trigger('mousedown') // (0,4)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(colorAt(0, 4)).toBeNull()
  })

  it('redoes in full too, even onto a row marked done since', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[4]!.trigger('mousedown') // (0,4)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click') // row 0 now finished

    await wrapper.find('[data-testid="redo-button"]').trigger('click')

    expect(colorAt(0, 4)).toBe('#e63746')
  })
})

describe('App delete all', () => {
  /** Presses and releases one cell without moving — a click. */
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await wrapper.findAll('[data-testid="grid-cell"]')[index]!.trigger('mousedown')
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
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-direction"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

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
    expect(after.widthMm).toBe(before.widthMm)
    expect(after.heightMm).toBe(before.heightMm)
    expect(after.columns).toBe(before.columns)
    expect(after.rows).toBe(before.rows)
    expect(after.rotated).toBe(before.rotated)
    expect(after.rotated).toBe(true)
  })

  it('ignores the Row progress lock, clearing beads in finished rows along with the rest', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 4) // (0,4), painted before it's locked
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click') // row 0 now finished/locked

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().grid[0]![4]!.color).toBeNull()
  })

  it('is not affected by Mirror: confirming still empties every cell with mirror axes on', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    await wrapper.find('[data-testid="mirror-top-bottom-increase"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0)

    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().grid.flat().every((cell) => cell.color === null)).toBe(true)
  })

  it('is one undo step: a single Undo restores both the painted grid and Row progress together, including woven rows', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 4) // (0,4)
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click') // rows 0-1 finished

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
    expect(wrapper.find('[data-testid="row-progress-position"]').text()).toContain('3 / 20')
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

  it('opens a confirmation modal naming the new grid size instead of replacing immediately', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10x20 at Cube

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('7×14') // round(15/2.2)=7, round(30/2.2)=14
    expect(loadedPattern().beadId).toBe('toho-cube-1.5mm')
  })

  it('leaves the Pattern untouched when Cancel is clicked, and closes the modal', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')

    await wrapper.find('[data-testid="confirm-modal-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(false)
    expect(loadedPattern().beadId).toBe('toho-cube-1.5mm')
  })

  it('leaves the Pattern untouched when Escape is pressed, and closes the modal without also backing out of Select', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '6', '6') // 4x4 at Cube
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.find('.app-shell').trigger('mouseup') // paint (0,0) red
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.find('.app-shell').trigger('mouseup') // select (0,0)
    await wrapper.find('[data-testid="copy-button"]').trigger('click') // copiedBlock now holds the red cell

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="replace-bead-modal"]').exists()).toBe(false)
    expect(loadedPattern().beadId).toBe('toho-cube-1.5mm')

    // If Escape had also run backOutOfSelect, it would have dropped the copied block, and this next click would
    // start a fresh Selection instead of stamping.
    await wrapper.findAll('[data-testid="grid-cell"]')[5]!.trigger('mousedown')
    await wrapper.find('.app-shell').trigger('mouseup')
    expect(loadedPattern().grid[1]![1]!.color).toBe('#e63746')
  })

  it('switches the Bead and resizes the grid once confirmed, keeping real-world size fixed', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10x20 at Cube

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().beadId).toBe('toho-round-11-0')
    expect(loadedPattern().columns).toBe(7)
    expect(loadedPattern().rows).toBe(14)
    expect(loadedPattern().widthMm).toBe(15)
    expect(loadedPattern().heightMm).toBe(30)
    expect(wrapper.find('[data-testid="current-pattern-bead"]').text()).toBe('TOHO Round 11/0')
  })

  it('rescales existing colors onto the new grid rather than cropping them', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // (0,0)
    await wrapper.find('.app-shell').trigger('mouseup')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().grid[0]![0]!.color).toBe('#e63746')
  })

  it('resets Row progress once confirmed', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(loadedPattern().rowProgress).toEqual({
      enabled: false,
      direction: 'rows',
      currentRow: 0,
      currentColumn: 0,
    })
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
    expect(after.rotated).toBe(true)
  })

  it('is one undo step: a single Undo restores the Bead, grid size, colors and Row progress together', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.find('.app-shell').trigger('mouseup') // paint (0,0) red
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

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
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mousedown')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await cells[2]!.trigger('mousedown')
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown', { button: 2 }) // right-click erase
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

    expect(wrapper.find('[data-testid="row-progress-position"]').text()).toContain('5 / 10')
    expect(wrapper.findAll('.pattern-grid__row--done')).toHaveLength(4)
  })

  it('imports a Pattern that clashes with a local one as a separate entry, keeping both', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const local = loadPatterns()[0]!

    await importFile(wrapper, serializeLibrary([{ ...local, name: 'Imported copy' }]))

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
})

describe('App select, copy and paste', () => {
  /** A drag across the grid: press on one cell, move through the rest, release (release is on the shell, as a real drag can end anywhere). */
  async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[indices[0]!]!.trigger('mousedown')
    for (const index of indices.slice(1)) {
      await cells[index]!.trigger('mouseenter', { buttons: 1 })
    }
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /** Presses and releases one cell without moving — a click, which is what stamps a copied block. */
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await wrapper.findAll('[data-testid="grid-cell"]')[index]!.trigger('mousedown')
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  function selectedCount(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('.pattern-grid__cell--selected').length
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

    await wrapper.findAll('[data-testid="grid-cell"]')[10]!.trigger('mouseenter') // hover (2,2)

    const previews = wrapper.findAll('[data-testid="cell-preview"]')
    expect(previews).toHaveLength(2) // the block's two painted cells; its two empty ones preview nothing
    expect(previews[0]!.attributes('style')).toContain('background-color: rgb(230, 55, 70)')
    expect(previews[1]!.attributes('style')).toContain('background-color: rgb(47, 111, 237)')
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

    await wrapper.findAll('[data-testid="grid-cell"]')[10]!.trigger('mousedown', { button: 2 })
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
    await wrapper.findAll('[data-testid="grid-cell"]')[10]!.trigger('mouseenter')
    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(2)

    await pressEscape(wrapper)

    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(0)
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

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown', { button: 2 }) // a painted cell

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

    await wrapper.findAll('[data-testid="grid-cell"]')[10]!.trigger('mousedown', { button: 2 })

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)
  })

  it('still never erases under Select: a right-click cancels the paste rather than clearing a cell', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown', { button: 2 }) // a painted cell

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

  it('clears the selection and clipboard when a different Pattern is opened', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    const firstId = loadPatterns()[0]!.id
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '6', '6')
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    expect(selectedCount(wrapper)).toBe(0)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)

    await click(wrapper, 0)
    expect(loadPatterns().find((p) => p.id !== firstId)!.grid[0]![0]!.color).toBeNull()
  })
})

describe('App Tool group Escape precedence (ticket 41)', () => {
  function selectedCount(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('.pattern-grid__cell--selected').length
  }

  async function createPatternWithSelection(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '6', '6') // 4x4
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await cells[5]!.trigger('mouseenter', { buttons: 1 })
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /*
   * No real Tool group exceeds 14 controls yet (ToolGroup.test.ts covers the expand/collapse mechanics itself with
   * a synthetic one that does), so this stands in for "some Tool group is currently hover-expanded" by making the
   * mounted Toolbox's own exposed collapseExpandedGroup — the exact function App.vue's onKeyDown calls — report
   * one was, for exactly one call. It's proving the wiring: Escape asks Toolbox first, and only backs out of Select
   * once that reports nothing was expanded.
   */
  function stubOneExpandedGroup(wrapper: ReturnType<typeof mount>) {
    const app = wrapper.vm as unknown as { toolboxRef: { collapseExpandedGroup: () => boolean } }
    vi.spyOn(app.toolboxRef, 'collapseExpandedGroup').mockReturnValueOnce(true)
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
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    const writes = spyOnStorageWrites(PATTERNS_KEY)
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await cells[2]!.trigger('mouseenter', { buttons: 1 })

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
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('mousedown')
    await cells[1]!.trigger('mouseenter', { buttons: 1 })
    await wrapper.trigger('mouseup')

    const writes = spyOnStorageWrites(PATTERNS_KEY)
    await cells[0]!.trigger('mousedown', { button: 2 })
    await cells[1]!.trigger('mouseenter', { buttons: 2 })
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()

    window.dispatchEvent(new Event('pagehide'))

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('writes a stroke whose mouseup never arrived when the editor is torn down', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')

    wrapper.unmount()

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('still writes a Fill the moment it lands, since it is one click rather than a stroke', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const writes = spyOnStorageWrites(PATTERNS_KEY)
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')

    expect(writes.count).toBe(1)
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('says so, in the current language, when a write to storage is refused', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(false)

    refuseStorageWrites(PATTERNS_KEY)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="grid-cell"]')[0]!.attributes('style')).toContain(
      'background-color: rgb(230, 55, 70)',
    )

    refusing.mockRestore()
    await wrapper.findAll('[data-testid="grid-cell"]')[1]!.trigger('mousedown')
    await wrapper.trigger('mouseup')

    expect(wrapper.find('[data-testid="save-failed-message"]').exists()).toBe(false)
    // The retry carries the refused cell too, since a save writes the whole library from memory.
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')
  })
})
