import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { loadPatterns } from './domain/patternStorage'

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

describe('App Mirror axis counters (ticket 44)', () => {
  it('shows axis counters instead of the on/off toggles in the Mirror group', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="mirror-left-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-top-bottom"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-horizontal"]').exists()).toBe(false)
  })

  it('draws no axis lines and mirrors nothing while both counts are 0', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10x20

    expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(0)

    await wrapper.findAll('[data-testid="grid-cell"]')[0]!.trigger('pointerdown') // paint (0,0)

    expect(wrapper.findAll('[data-testid="grid-cell"]').filter((cell) => !!cell.attributes('style')?.includes('background-color'))).toHaveLength(1)
  })

  it('1 left-right axis draws one axis line and mirrors across the center exactly like the legacy toggle', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns, 20 rows

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')

    expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[0]!.trigger('pointerdown') // paint (0,0), 10 columns wide -> mirrors to (0,9)

    const painted = cells.filter((cell) => cell.attributes('style')?.includes('background-color'))
    expect(painted).toHaveLength(2)
  })

  it('still shows the Mirror current buttons, unchanged', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="mirror-current-horizontal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mirror-current-vertical"]').exists()).toBe(true)
  })

  it('resets axis counts to 0 when switching Patterns', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('0')
  })

  it('resets axis counts to 0 when Replace Bead is confirmed (ticket 48), and Undo brings them back', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')

    await wrapper.find('[data-testid="replace-bead-select"]').setValue('toho-round-11-0')
    await wrapper.find('[data-testid="confirm-modal-confirm"]').trigger('click')

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('0')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')
  })

  it('rotating swaps which counter reads which grid axis, without touching the grid', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns, 20 rows

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="mirror-top-bottom-value"]').text()).toContain('0')

    await wrapper.find('[data-testid="rotate-button"]').trigger('click')

    // Same underlying columns-count (1) now reads as Top–bottom, since the picture turned 90°.
    expect(wrapper.find('[data-testid="mirror-left-right-value"]').text()).toContain('0')
    expect(wrapper.find('[data-testid="mirror-top-bottom-value"]').text()).toContain('1')
  })
})

describe("App's Mirror copy mode (ticket 45)", () => {
  it('shows its on/off state and switches strips from mirror-image to plain-repeat when turned on', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click') // 1 axis, 2 strips of 5

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    const paintedColumns = () =>
      cells
        .map((cell, index) => ({ index, painted: cell.attributes('style')?.includes('background-color') }))
        .filter((cell) => cell.painted)
        .map((cell) => cell.index)

    await cells[0]!.trigger('pointerdown') // paint (0,0)
    await wrapper.trigger('mouseup') // ends the stroke, so it becomes one undo step
    expect(paintedColumns()).toEqual([0, 9]) // mirror-image by default: 0 <-> 9

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    const copyModeButton = wrapper.find('[data-testid="mirror-copy-mode"]')
    expect(copyModeButton.attributes('aria-pressed')).toBe('false')
    await copyModeButton.trigger('click')
    expect(copyModeButton.attributes('aria-pressed')).toBe('true')

    await cells[0]!.trigger('pointerdown') // paint (0,0) again, now in copy mode
    expect(paintedColumns()).toEqual([0, 5]) // plain repeat: same relative cell in the other strip, 0 <-> 5
  })

  it('resets to off when switching Patterns', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    await wrapper.find('[data-testid="mirror-copy-mode"]').trigger('click')
    expect(wrapper.find('[data-testid="mirror-copy-mode"]').attributes('aria-pressed')).toBe('true')

    await wrapper.find('[data-testid="new-pattern-button"]').trigger('click')
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.find('[data-testid="mirror-copy-mode"]').attributes('aria-pressed')).toBe('false')
  })
})

describe("App's Mirror current across strips (ticket 46)", () => {
  it('syncs the fullest strip onto the rest, as one undo step', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns, 20 rows
    await wrapper.find('[data-color-id="red"]').trigger('click')

    // Paint (0,9) *before* turning the axis on, so it's a plain, un-mirrored paint -- exactly the "content drawn
    // before that direction's live mirroring was turned on" scenario ADR 0006 built "Mirror current" for.
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[9]!.trigger('pointerdown') // (0, 9)
    await wrapper.trigger('mouseup')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull() // not live-mirrored: only column 9 got painted

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click') // 1 axis, 2 strips of 5 columns
    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('click')

    // Strip [5..9] (containing the painted cell) is fuller, so it's the source, mirrored onto [0..4]: 9<->0.
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
    expect(loadPatterns()[0]!.grid[0]![9]!.color).toBe('#e63746') // the source cell survives the undo
  })

  it('honours copy mode', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[9]!.trigger('pointerdown') // (0, 9), before the axis is on
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    await wrapper.find('[data-testid="mirror-copy-mode"]').trigger('click')
    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('click')

    // Copy mode: same relative cell (last of each strip), not mirrored -> column 4 (not column 0).
    expect(loadPatterns()[0]!.grid[0]![4]!.color).toBe('#e63746')
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull()
  })

  it('leaves woven rows untouched (Row progress lock)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns, 20 rows
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click') // finishes row 0
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await wrapper.find('[data-testid="mirror-top-bottom-increase"]').trigger('click') // 1 axis, 2 strips of 10 rows

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[19 * 10]!.trigger('pointerdown') // (row 19, column 0) -- its mirror counterpart is row 0
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="mirror-current-vertical"]').trigger('click')

    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBeNull() // row 0 is finished/locked, stays untouched
    expect(loadPatterns()[0]!.grid[19]![0]!.color).toBe('#e63746') // the source row is unaffected
  })
})

describe("App's Mirror current hover preview (ticket 47)", () => {
  it('shows a center axis on hover even when that direction\'s count is 0', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')

    expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(0)

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('mouseenter')

    expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="mirror-axis-line-row"]')).toHaveLength(0) // the other direction is untouched
  })

  it('leaves an actual count above 0 alone (does not add a second axis)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')
    expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(1)

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('mouseenter')

    expect(wrapper.findAll('[data-testid="mirror-axis-line-column"]')).toHaveLength(1)
  })

  it('dims exactly the cells the click would overwrite, and clears on mouseleave', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[9]!.trigger('pointerdown') // (0, 9)
    await wrapper.trigger('mouseup')

    expect(cells.filter((cell) => cell.classes().includes('pattern-grid__cell--dimmed'))).toHaveLength(0)

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('mouseenter')

    // Count 0 -> acts as 1 axis, 2 strips of 5. Column 9 is the (already-painted) source; only its counterpart,
    // column 0, would actually change color when clicked.
    const dimmed = cells.filter((cell) => cell.classes().includes('pattern-grid__cell--dimmed'))
    expect(dimmed).toHaveLength(1)
    expect(dimmed[0]!.attributes('data-testid')).toBe('grid-cell')
    expect(cells.indexOf(dimmed[0]!)).toBe(0) // (0, 0)

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('mouseleave')

    expect(cells.filter((cell) => cell.classes().includes('pattern-grid__cell--dimmed'))).toHaveLength(0)
  })

  it('clicking produces exactly the change the dimmed preview showed', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30')
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[9]!.trigger('pointerdown')
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('mouseenter')

    const dimmedCount = cells.filter((cell) => cell.classes().includes('pattern-grid__cell--dimmed')).length

    await wrapper.find('[data-testid="mirror-current-horizontal"]').trigger('click')

    expect(dimmedCount).toBe(1)
    expect(loadPatterns()[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('does not dim a cell a click could not actually change (Row progress lock)', async () => {
    const wrapper = mount(App)
    await createPatternViaForm(wrapper, '15', '30') // 10 columns, 20 rows
    await wrapper.find('[data-testid="row-progress-enabled"]').trigger('click')
    await wrapper.find('[data-testid="row-progress-next"]').trigger('click') // finishes row 0
    await wrapper.find('[data-color-id="red"]').trigger('click')

    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[19 * 10]!.trigger('pointerdown') // (row 19, column 0) -- mirrors onto row 0
    await wrapper.trigger('mouseup')

    await wrapper.find('[data-testid="mirror-current-vertical"]').trigger('mouseenter')

    // Row 0 would naively change under the raw sync, but it's finished/locked, so a click couldn't actually
    // change it -- it must not be dimmed either.
    expect(cells[0]!.classes()).not.toContain('pattern-grid__cell--dimmed')
  })
})

describe('App Paste through Mirror (ticket 50)', () => {
  /** A drag across the grid: press on one cell, move through the rest, release. */
  async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
    const cells = wrapper.findAll('[data-testid="grid-cell"]')
    await cells[indices[0]!]!.trigger('pointerdown')
    for (const index of indices.slice(1)) {
      await cells[index]!.trigger('pointerenter', { buttons: 1 })
    }
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /** Presses and releases one cell without moving -- a click, which is what stamps a copied block. */
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await wrapper.findAll('[data-testid="grid-cell"]')[index]!.trigger('pointerdown')
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  /** A 10x20 Pattern with a single red cell at (0,0), copied and ready to Paste. */
  async function patternWithCopiedDot(wrapper: ReturnType<typeof mount>) {
    await createPatternViaForm(wrapper, '15', '30') // 10 columns, 20 rows
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await click(wrapper, 0) // paint (0,0)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0])
    await wrapper.find('[data-testid="copy-button"]').trigger('click')
  }

  it('with both axis counts at 0, stamps a single unmirrored copy exactly as before', async () => {
    const wrapper = mount(App)
    await patternWithCopiedDot(wrapper)

    await click(wrapper, 21) // (2,1)

    const grid = loadPatterns()[0]!.grid
    expect(grid[2]![1]!.color).toBe('#e63746')
    expect(grid[2]![8]!.color).toBeNull() // nothing mirrors with both counts at 0
  })

  it('previews and stamps the block at every strip a left-right axis projects onto', async () => {
    const wrapper = mount(App)
    await patternWithCopiedDot(wrapper)
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click') // 1 axis: column c <-> column 9-c

    await wrapper.findAll('[data-testid="grid-cell"]')[22]!.trigger('pointerenter') // hover (2,2)
    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(2) // aimed spot + its mirrored counterpart

    await click(wrapper, 22) // (2,2)

    const grid = loadPatterns()[0]!.grid
    expect(grid[2]![2]!.color).toBe('#e63746')
    expect(grid[2]![7]!.color).toBe('#e63746') // column 2 <-> column 9-2
  })

  it('undoes every mirrored copy from one click together, as a single step', async () => {
    const wrapper = mount(App)
    await patternWithCopiedDot(wrapper)
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')

    await click(wrapper, 22) // (2,2), mirrors onto (2,7)
    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBe('#e63746')
    expect(loadPatterns()[0]!.grid[2]![7]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')

    const grid = loadPatterns()[0]!.grid
    expect(grid[2]![2]!.color).toBeNull()
    expect(grid[2]![7]!.color).toBeNull()
  })

  it('honours copy mode: strips translate rather than mirror-image', async () => {
    const wrapper = mount(App)
    await patternWithCopiedDot(wrapper)
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click') // 1 axis, 2 strips of 5
    await wrapper.find('[data-testid="mirror-copy-mode"]').trigger('click')

    await click(wrapper, 1) // (0,1)

    const grid = loadPatterns()[0]!.grid
    expect(grid[0]![1]!.color).toBe('#e63746')
    // Copy mode translates to the same relative offset (1) into the next strip (starting at column 5) rather than
    // mirror-imaging onto column 9-1=8.
    expect(grid[0]![6]!.color).toBe('#e63746')
    expect(grid[0]![8]!.color).toBeNull()
  })

  it('right-click still cancels the pending Paste while Mirror is projecting it', async () => {
    const wrapper = mount(App)
    await patternWithCopiedDot(wrapper)
    await wrapper.find('[data-testid="mirror-left-right-increase"]').trigger('click')

    await wrapper.findAll('[data-testid="grid-cell"]')[22]!.trigger('pointerdown', { button: 2 })

    expect(wrapper.findAll('[data-testid="cell-preview"]')).toHaveLength(0)
    await click(wrapper, 22)
    expect(loadPatterns()[0]!.grid[2]![2]!.color).toBeNull() // the click landed as a fresh Selection, not a stamp
  })
})
