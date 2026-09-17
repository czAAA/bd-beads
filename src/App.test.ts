import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { createPattern, type Pattern } from './domain/pattern'
import { serializeLibrary } from './domain/patternFile'
import { loadPatterns, savePattern } from './domain/patternStorage'
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
    expect(aboveCanvas.find('[data-testid="new-pattern-button"]').exists()).toBe(true)
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

  it('moves editing tools into the above-canvas panel, as a second row below New Pattern/zoom, and empties the main panel', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const mainPanel = wrapper.find('[data-testid="app-main-panel"]')
    const toolStrip = wrapper.find('[data-testid="tool-strip"]')

    expect(mainPanel.text()).toBe('')
    expect(toolStrip.exists()).toBe(true)
    for (const testId of [
      'tool-paint',
      'tool-fill',
      'palette-picker',
      'undo-button',
      'mirror-horizontal',
      'row-progress-enabled',
    ]) {
      expect(toolStrip.find(`[data-testid="${testId}"]`).exists()).toBe(true)
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

  it('rotating is a view-only flip: it turns the picture on screen but never touches the grid, dimensions, or technique', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '4.5', '3') // 3 columns x 2 rows

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // paint (0,0)
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

  it('mirroring is off by default, so painting touches only the clicked cell', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    expect(wrapper.find('[data-testid="mirror-horizontal"]').attributes('aria-pressed')).toBe(
      'false',
    )

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')

    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()
  })

  it('live-mirrors a painted cell across the toggled axis immediately, fixed to the exact center', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // paint (0,0)

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    // Vertical axis is off, so row 1 stays untouched.
    expect(grid[1]![0]!.color).toBeNull()
    expect(grid[1]![1]!.color).toBeNull()
  })

  it('live-mirrors into all four quadrants when both axes are toggled on', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')
    await wrapper.find('[data-testid="mirror-vertical"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // paint (0,0)

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[1]![0]!.color).toBe('#e63746')
    expect(grid[1]![1]!.color).toBe('#e63746')
  })

  it('undoes a live-mirrored paint as a single action', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3')

    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })

  it('leaves Fill unaffected by mirror state', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    // Mirror off while painting (0,0), so (0,1) starts out unpainted.
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')

    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // fill (0,0), mirror on

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#2f6fed')
    // If Fill mirrored like Paint does, (0,1) — (0,0)'s horizontal counterpart — would also have flipped to blue.
    expect(grid[0]![1]!.color).toBeNull()
  })

  it('reflects whatever is currently painted with "Mirror current", for content painted before the axis was on', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown') // paint (0,0), mirror off

    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
  })

  it('undoes "Mirror current" as a single action', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3')

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('click')
    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('opens ready to paint with red selected by default, no swatch click needed first (ticket 27)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-color-id="red"]').attributes('aria-pressed')).toBe('true')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
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

  it('drags a live-mirrored stroke, mirroring each dragged cell along the way', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid
    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')
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

    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')
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
    savePattern({ ...pattern, beadId: 'acme-fancy-8-0' })

    const wrapper = mount(App)

    expect(wrapper.findAll('[data-testid="grid-cell"]')).not.toHaveLength(0)

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')
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

    for (const testId of ['new-pattern-button', 'zoom-in', 'zoom-out', 'zoom-reset', 'tool-paint', 'tool-fill', 'undo-button', 'rotate-button']) {
      expect(wrapper.find(`[data-testid="${testId}"]`).classes()).not.toContain('button--danger')
    }
  })

  it('puts the zoom controls in the above-canvas panel rather than inside the canvas box', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const aboveCanvas = wrapper.find('[data-testid="app-above-canvas"]')
    expect(aboveCanvas.find('[data-testid="zoom-controls"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="pattern-canvas-viewport"]').find('[data-testid="zoom-controls"]').exists(),
    ).toBe(false)
  })

  it('zooms the open Pattern from the above-canvas controls', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')

    await wrapper.find('[data-testid="zoom-in"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('125%')

    await wrapper.find('[data-testid="zoom-reset"]').trigger('click')
    expect(wrapper.find('[data-testid="zoom-level"]').text()).toBe('100%')
  })

  it('splits the top bar into a dark title box and an aqua summary box', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const topBar = wrapper.find('[data-testid="app-topbar"]')
    const titleBox = topBar.find('.app-shell__topbar-title')
    const summaryBox = topBar.find('.app-shell__topbar-summary')

    expect(titleBox.find('h1').text()).toBe('bd-beads')
    expect(titleBox.find('[data-testid="current-pattern-summary"]').exists()).toBe(false)
    expect(summaryBox.find('[data-testid="current-pattern-summary"]').exists()).toBe(true)
    expect(summaryBox.find('[data-testid="language-en"]').exists()).toBe(true)
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
 * Every control in the tool strip is an icon: no card heading, no button label, nothing but the row-progress
 * readout in text. The words survive as a hover/focus tooltip plus the screen-reader name, so the strip stays
 * compact — .tool-strip stretches every card in a row to the tallest one, so one wrapped label used to make the
 * whole row tall (tickets 29/30, then widened to the rest of the strip).
 */
describe('App tool strip icon buttons', () => {
  const iconButtons = [
    { testId: 'tool-paint', label: (t: typeof en) => t.tools.paintLabel },
    { testId: 'tool-fill', label: (t: typeof en) => t.tools.fillLabel },
    { testId: 'tool-select', label: (t: typeof en) => t.tools.selectLabel },
    { testId: 'undo-button', label: (t: typeof en) => t.palette.undoButton },
    { testId: 'rotate-button', label: (t: typeof en) => t.palette.rotateButton },
    { testId: 'copy-button', label: (t: typeof en) => t.tools.copyButton },
    { testId: 'mirror-horizontal', label: (t: typeof en) => t.mirror.horizontalLabel },
    { testId: 'mirror-vertical', label: (t: typeof en) => t.mirror.verticalLabel },
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

  it('leaves the row-progress readout as the strip\u2019s only text \u2014 every card heading and button label is now a tooltip', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    const toolStrip = wrapper.find('[data-testid="tool-strip"]')

    expect(toolStrip.text().replace(/\s+/g, ' ').trim()).toBe(
      wrapper.find('[data-testid="row-progress-position"]').text().replace(/\s+/g, ' ').trim(),
    )
  })

  it('names each card for screen readers, now that its heading is gone', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    const labels = wrapper.findAll('.tool-strip__card').map((card) => card.attributes('aria-label'))

    expect(labels).toContain(en.tools.heading)
    expect(labels).toContain(en.palette.heading)
    expect(labels).toContain(en.mirror.heading)
    expect(labels).toContain(en.rowProgress.heading)
  })

  it('shows which tool and which mirror axes are on, now that nothing is labelled in text', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="tool-paint"]').classes()).toContain(
      'tool-picker__button--selected',
    )

    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')

    const mirrorButton = wrapper.find('[data-testid="mirror-horizontal"]')
    expect(mirrorButton.attributes('aria-pressed')).toBe('true')
    expect(mirrorButton.classes()).toContain('tool-picker__button--selected')
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
    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mouseenter') // (0,0)

    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(2)
  })

  it('does not preview mirrored cells for the Fill tool, since Fill is unaffected by mirror state', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid
    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mouseenter') // (0,0)

    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(1)
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

  it('will not paint a bead in a finished row, and records no undo step for trying', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)

    await cells[14]!.trigger('mousedown') // (1,4)
    await wrapper.trigger('mouseup')

    expect(colorAt(1, 4)).toBeNull()
    expect(undoDisabled(wrapper)).toBe(true)
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
    await wrapper.find('[data-testid="mirror-vertical"]').trigger('click')

    await cells[183]!.trigger('mousedown') // (18,3), whose counterpart across the middle is (1,3)
    await wrapper.trigger('mouseup')

    expect(colorAt(18, 3)).toBe('#e63746')
    expect(colorAt(1, 3)).toBeNull()
  })

  it('keeps "Mirror current" from reflecting anything onto finished rows', async () => {
    const wrapper = mount(App)
    const cells = await withTwoRowsWoven(wrapper)
    await cells[183]!.trigger('mousedown') // (18,3)
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="mirror-current-vertical"]').trigger('click')

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

    await wrapper.find('[data-testid="mirror-vertical"]').trigger('click')
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
    savePattern({ ...pattern, beadId: 'no-such-bead' })

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

  it('stamps exactly where it was aimed even with a Mirror axis on, as Fill does', async () => {
    const wrapper = mount(App)
    await patternWithMotif(wrapper)
    await drag(wrapper, [0, 1, 5])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await wrapper.find('[data-testid="mirror-horizontal"]').trigger('click')

    await click(wrapper, 8) // (2,0)

    const grid = loadPatterns()[0]!.grid
    expect(grid[2]![0]!.color).toBe('#e63746')
    expect(grid[2]![3]!.color).toBeNull() // the mirrored counterpart is left alone
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

  it('keeps the selection itself, so Copy can put the same block back on the clipboard', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)

    await pressEscape(wrapper)

    expect(selectedCount(wrapper)).toBe(4)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(false)

    await wrapper.find('[data-testid="copy-button"]').trigger('click')
    await click(wrapper, 10)

    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBe('#e63746')
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

  it('clears the selection on a second Escape or right-click, once the first has dropped the copy', async () => {
    const wrapper = mount(App)
    await copiedMotif(wrapper)

    await pressEscape(wrapper)
    expect(selectedCount(wrapper)).toBe(4)

    await wrapper.findAll('[data-testid="grid-cell"]')[10]!.trigger('mousedown', { button: 2 })
    expect(selectedCount(wrapper)).toBe(0)
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
