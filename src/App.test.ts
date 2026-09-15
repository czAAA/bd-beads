import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { createPattern, type Pattern } from './domain/pattern'
import { serializeLibrary } from './domain/patternFile'
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
    expect(mainPanel.find('[data-testid="bead-select"]').exists()).toBe(false)
    expect(aboveCanvas.find('[data-testid="palette-picker"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="grid-row"]').exists()).toBe(true)
    expect(canvas.find('[data-testid="app-canvas-placeholder"]').exists()).toBe(false)
    expect(belowCanvas.find('[data-testid="pattern-list"]').exists()).toBe(true)
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

  it('mirroring is off by default, so painting touches only the clicked cell', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    expect(wrapper.find<HTMLInputElement>('[data-testid="mirror-horizontal"]').element.checked).toBe(
      false,
    )

    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mousedown')

    expect(loadPatterns()[0]!.grid[0]![1]!.color).toBeNull()
  })

  it('live-mirrors a painted cell across the toggled axis immediately, fixed to the exact center', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid

    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
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

    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
    await wrapper.find('[data-testid="mirror-vertical"]').setValue(true)
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

    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
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

    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
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
    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
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

    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
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

  it('reserves red for destructive actions, leaving every other button in the default style', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const patternId = loadPatterns()[0]!.id

    expect(
      wrapper.find(`[data-testid="remove-pattern-${patternId}"]`).classes(),
    ).toContain('button--danger')

    for (const testId of ['new-pattern-button', 'zoom-in', 'zoom-out', 'zoom-reset', 'tool-paint', 'tool-fill', 'undo-button']) {
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
    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('mouseenter') // (0,0)

    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(2)
  })

  it('does not preview mirrored cells for the Fill tool, since Fill is unaffected by mirror state', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2 grid
    await wrapper.find('[data-testid="mirror-horizontal"]').setValue(true)
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

    await wrapper.find('[data-testid="row-progress-enabled"]').setValue(true)

    expect(wrapper.findAll('.pattern-grid__row--current')).toHaveLength(1)
    expect(wrapper.find('[data-testid="palette-picker"]').exists()).toBe(true)
  })

  it('advances the pointer as rows are finished, dimming the rows behind it', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="row-progress-enabled"]').setValue(true)

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
    await wrapper.find('[data-testid="row-progress-enabled"]').setValue(true)
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click')

    await wrapper.find('[data-testid="row-progress-previous"]').trigger('click')

    expect(wrapper.find('[data-testid="row-progress-position"]').text()).toContain('2 / 20')
    expect(wrapper.findAll('.pattern-grid__row--done')).toHaveLength(1)
  })

  it('will not step past either end of the Pattern', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '3', '3') // 2x2
    await wrapper.find('[data-testid="row-progress-enabled"]').setValue(true)

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
    await first.find('[data-testid="row-progress-enabled"]').setValue(true)
    await first.find('[data-testid="row-progress-next"]').trigger('click')
    first.unmount()

    const afterReload = mount(App)

    expect(afterReload.find('[data-testid="row-progress-position"]').text()).toContain('2 / 20')
    expect(afterReload.findAll('.pattern-grid__row--done')).toHaveLength(1)
    expect(loadPatterns()[0]!.rowProgress).toEqual({ enabled: true, currentRow: 1 })
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

  it('totals the beads each color needs from the painted cells', async () => {
    const wrapper = mount(App)
    await patternWithPaintedCells(wrapper)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="quantity-count-blue"]').text()).toBe('1')
  })

  it('keeps a color\'s default bead across Patterns and reloads', async () => {
    const first = mount(App)
    await patternWithPaintedCells(first)

    await first.find('[data-testid="quantity-default-red"]').setValue('miyuki-delica-11-0')
    first.unmount()

    const afterReload = mount(App)
    expect(
      afterReload.find<HTMLSelectElement>('[data-testid="quantity-default-red"]').element.value,
    ).toBe('miyuki-delica-11-0')

    // A second Pattern starts from that same global default.
    await afterReload.find('[data-testid="new-pattern-button"]').trigger('click')
    await patternWithPaintedCells(afterReload)
    expect(
      afterReload.find<HTMLSelectElement>('[data-testid="quantity-default-red"]').element.value,
    ).toBe('miyuki-delica-11-0')
  })

  it('overrides a color for one Pattern without touching the default or any other Pattern', async () => {
    const wrapper = mount(App)
    await patternWithPaintedCells(wrapper)
    await wrapper.find('[data-testid="quantity-default-red"]').setValue('miyuki-delica-11-0')

    await wrapper.find('[data-testid="quantity-override-red"]').setValue('toho-round-11-0')

    expect(
      wrapper.find<HTMLSelectElement>('[data-testid="quantity-default-red"]').element.value,
    ).toBe('miyuki-delica-11-0')

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await patternWithPaintedCells(wrapper)

    expect(
      wrapper.find<HTMLSelectElement>('[data-testid="quantity-override-red"]').element.value,
    ).toBe('')
  })

  it('remembers a per-Pattern override across a reload', async () => {
    const first = mount(App)
    await patternWithPaintedCells(first)
    await first.find('[data-testid="quantity-override-red"]').setValue('toho-round-11-0')
    first.unmount()

    expect(loadPatterns()[0]!.colorBeadOverrides).toEqual({ red: 'toho-round-11-0' })
    expect(
      mount(App).find<HTMLSelectElement>('[data-testid="quantity-override-red"]').element.value,
    ).toBe('toho-round-11-0')
  })

  it('needs no beads yet for a Pattern with nothing painted on it', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('0')
  })

  it('maps colors to Beads before any Pattern is open, so a default can be set up front', async () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="quantities-no-pattern"]').exists()).toBe(true)

    await wrapper.find('[data-testid="quantity-default-red"]').setValue('toho-round-11-0')
    wrapper.unmount()

    expect(
      mount(App).find<HTMLSelectElement>('[data-testid="quantity-default-red"]').element.value,
    ).toBe('toho-round-11-0')
  })

  it('shows the Bead a color resolves to, so the override is visible in the quantity view', async () => {
    const wrapper = mount(App)
    await patternWithPaintedCells(wrapper)

    await wrapper.find('[data-testid="quantity-default-red"]').setValue('miyuki-delica-11-0')
    expect(wrapper.find('[data-testid="quantity-bead-red"]').text()).toBe('Miyuki Delica 11/0')

    await wrapper.find('[data-testid="quantity-override-red"]').setValue('toho-round-11-0')
    expect(wrapper.find('[data-testid="quantity-bead-red"]').text()).toBe('TOHO Round 11/0')
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

  it("takes in the other device's color-to-bead defaults without overwriting this device's own", async () => {
    const wrapper = mount(App)
    await wrapper.find('[data-testid="quantity-default-red"]').setValue('toho-cube-1.5mm')

    await importFile(
      wrapper,
      serializeLibrary([makePattern('Fox')], {
        red: 'miyuki-delica-11-0',
        blue: 'miyuki-delica-11-0',
      }),
    )

    // Local choice for red stands; blue, which this device had not mapped, is filled in from the file.
    expect(
      wrapper.find<HTMLSelectElement>('[data-testid="quantity-default-red"]').element.value,
    ).toBe('toho-cube-1.5mm')
    expect(
      wrapper.find<HTMLSelectElement>('[data-testid="quantity-default-blue"]').element.value,
    ).toBe('miyuki-delica-11-0')
  })

  it('takes in a library exported on another device and saves every Pattern in it', async () => {
    const wrapper = mount(App)
    const library = [makePattern('Fox'), makePattern('Owl')]

    await importFile(wrapper, serializeLibrary(library, {}))

    expect(loadPatterns().map((pattern) => pattern.name).sort()).toEqual(['Fox', 'Owl'])
    expect(wrapper.findAll('[data-testid="pattern-item"]')).toHaveLength(2)
  })

  it('opens an imported Pattern when nothing was open, so the user resumes where they left off', async () => {
    const wrapper = mount(App)
    const woven = makePattern('Fox')
    woven.rowProgress = { enabled: true, currentRow: 4 }

    await importFile(wrapper, serializeLibrary([woven], {}))

    expect(wrapper.find('[data-testid="row-progress-position"]').text()).toContain('5 / 10')
    expect(wrapper.findAll('.pattern-grid__row--done')).toHaveLength(4)
  })

  it('imports a Pattern that clashes with a local one as a separate entry, keeping both', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    const local = loadPatterns()[0]!

    await importFile(wrapper, serializeLibrary([{ ...local, name: 'Imported copy' }], {}))

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
